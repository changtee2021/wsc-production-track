/**
 * Client-side transcode to web-safe H.264 MP4 via ffmpeg.wasm (single-thread core).
 * Used when iPhone/LINE HEVC (or broken containers) would not play in Chrome/Edge.
 */
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

/** Skip client ffmpeg above this size — too heavy for phones / wasm memory. */
export const CLIENT_TRANSCODE_MAX_BYTES = 120 * 1024 * 1024;

const CORE_VERSION = "0.12.10";
const CORE_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`;

export type TranscodeProgress = (percent: number) => void;

let ffmpegSingleton: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;
let progressHandler: TranscodeProgress | undefined;

async function getFfmpeg(onProgress?: TranscodeProgress): Promise<FFmpeg> {
  progressHandler = onProgress;
  if (ffmpegSingleton?.loaded) return ffmpegSingleton;
  if (!loadPromise) {
    loadPromise = (async () => {
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress }) => {
        progressHandler?.(Math.min(99, Math.round(progress * 100)));
      });
      onProgress?.(2);
      await ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      });
      ffmpegSingleton = ffmpeg;
      return ffmpeg;
    })().catch((err) => {
      loadPromise = null;
      throw err;
    });
  }
  return loadPromise;
}

function inputNameFor(file: File): string {
  const ext = file.name.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
  if (ext === "webm") return "input.webm";
  if (ext === "mov") return "input.mov";
  if (ext === "m4v") return "input.m4v";
  return "input.mp4";
}

/**
 * Transcode any common phone/LINE video to H.264 + AAC MP4 (faststart).
 * Throws on failure — caller decides fallback.
 */
export async function transcodeToWebMp4(file: File, onProgress?: TranscodeProgress): Promise<File> {
  if (typeof window === "undefined") {
    throw new Error("แปลงวิดีโอได้เฉพาะในเบราว์เซอร์");
  }
  if (file.size > CLIENT_TRANSCODE_MAX_BYTES) {
    throw new Error(
      `ไฟล์ใหญ่เกิน ${Math.round(CLIENT_TRANSCODE_MAX_BYTES / (1024 * 1024))}MB สำหรับแปลงบนเครื่อง — ลองตัดคลิปสั้นลงหรืออัปจากมือถือที่ถ่าย`,
    );
  }

  const ffmpeg = await getFfmpeg(onProgress);
  const input = inputNameFor(file);
  const output = "output.mp4";

  onProgress?.(5);
  await ffmpeg.writeFile(input, await fetchFile(file));
  onProgress?.(12);

  const code = await ffmpeg.exec([
    "-i",
    input,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-vf",
    "scale='min(1280,iw)':-2",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    "-f",
    "mp4",
    output,
  ]);

  if (code !== 0) {
    try {
      await ffmpeg.deleteFile(input);
    } catch {
      /* ignore */
    }
    throw new Error("แปลงวิดีโอไม่สำเร็จ (ffmpeg)");
  }

  const data = await ffmpeg.readFile(output);
  try {
    await ffmpeg.deleteFile(input);
    await ffmpeg.deleteFile(output);
  } catch {
    /* ignore */
  }

  const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
  const blob = new Blob([bytes], { type: "video/mp4" });
  const base = file.name.replace(/\.[^.]+$/, "") || "video";
  onProgress?.(100);
  return new File([blob], `${base}.mp4`, {
    type: "video/mp4",
    lastModified: Date.now(),
  });
}
