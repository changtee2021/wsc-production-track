/**
 * After a fast original upload, convert HEVC/LINE/MOV → H.264 MP4 in a background queue
 * and upsert over the same Storage path so reports keep working without DB path changes.
 */
import {
  replaceVideoViaSignedUrl,
  type PrepareVideoReplace,
} from "@/lib/utils/direct-video-upload";
import { canBrowserCompressVideo, videoNeedsWebSafeTranscode } from "@/lib/utils/media-compress";
import type { DeptMediaBucket } from "@/lib/utils/media-limits";
import { repairMp4IfNeeded } from "@/lib/utils/mp4-repair";
import { CLIENT_TRANSCODE_MAX_BYTES, transcodeToWebMp4 } from "@/lib/utils/video-transcode";

export type PlaybackStatus = "ready" | "pending" | "converting" | "failed";

export type BackgroundConvertJob = {
  file: File;
  path: string;
  bucket: DeptMediaBucket;
  deptToken: string;
  prepareReplace: PrepareVideoReplace;
  onUpdate: (status: PlaybackStatus, previewUrl?: string) => void;
};

const queue: BackgroundConvertJob[] = [];
let running = false;

export function enqueueBackgroundWebSafeConvert(job: BackgroundConvertJob): void {
  queue.push(job);
  // Defer so callers can commit media into React state first
  queueMicrotask(() => job.onUpdate("pending"));
  void pumpQueue();
}

async function pumpQueue(): Promise<void> {
  if (running) return;
  running = true;
  try {
    while (queue.length > 0) {
      const job = queue.shift()!;
      await runJob(job);
    }
  } finally {
    running = false;
  }
}

async function runJob(job: BackgroundConvertJob): Promise<void> {
  try {
    // Fix mdat/moov layout before probing or ffmpeg — otherwise convert fails silently.
    const { file: repaired, repaired: didRepair } = await repairMp4IfNeeded(job.file);
    const working = repaired;

    const needs = await videoNeedsWebSafeTranscode(working);
    if (!needs) {
      if (didRepair) {
        await replaceVideoViaSignedUrl({
          bucket: job.bucket,
          path: job.path,
          file: working,
          deptToken: job.deptToken,
          prepareReplace: job.prepareReplace,
        });
        job.onUpdate("ready", URL.createObjectURL(working));
        return;
      }
      job.onUpdate("ready");
      return;
    }

    if (working.size > CLIENT_TRANSCODE_MAX_BYTES) {
      // Still persist container repair so native/HEVC players can open the file.
      if (didRepair) {
        try {
          await replaceVideoViaSignedUrl({
            bucket: job.bucket,
            path: job.path,
            file: working,
            deptToken: job.deptToken,
            prepareReplace: job.prepareReplace,
          });
        } catch {
          /* ignore */
        }
      }
      job.onUpdate("failed");
      return;
    }
    if (!canBrowserCompressVideo()) {
      job.onUpdate("failed");
      return;
    }

    job.onUpdate("converting");
    try {
      const out = await transcodeToWebMp4(working);
      await replaceVideoViaSignedUrl({
        bucket: job.bucket,
        path: job.path,
        file: out,
        deptToken: job.deptToken,
        prepareReplace: job.prepareReplace,
      });
      job.onUpdate("ready", URL.createObjectURL(out));
    } catch (e) {
      // If H.264 convert fails, at least upsert the repaired container when we fixed moov.
      if (didRepair) {
        try {
          await replaceVideoViaSignedUrl({
            bucket: job.bucket,
            path: job.path,
            file: working,
            deptToken: job.deptToken,
            prepareReplace: job.prepareReplace,
          });
        } catch {
          /* ignore */
        }
      }
      console.warn("[video-background-convert]", job.path, e);
      job.onUpdate("failed");
    }
  } catch (e) {
    console.warn("[video-background-convert]", job.path, e);
    job.onUpdate("failed");
  }
}

/** How many jobs are waiting or running (for soft UI hints). */
export function backgroundConvertQueueSize(): number {
  return queue.length + (running ? 1 : 0);
}
