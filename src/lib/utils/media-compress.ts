// บีบอัดรูปภาพ/วิดีโอก่อนอัปโหลด — วิดีโอใหญ่บีบหลายรอบจนใต้ MAX_VIDEO_BYTES
import {
  MAX_VIDEO_BYTES,
  VIDEO_AUTO_COMPRESS_ABOVE_BYTES,
  VIDEO_COMPRESS_MAX_DIMENSION,
  VIDEO_COMPRESS_TARGET_BYTES,
} from "@/lib/utils/media-limits";

const MAX_IMAGE_DIMENSION = 1920;
const JPEG_QUALITY = 0.82;
const COMPRESSIBLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type CompressProgress = (percent: number) => void;

export interface CompressVideoOptions {
  onProgress?: CompressProgress;
  maxBytes?: number;
}

export interface CompressMediaOptions {
  onProgress?: CompressProgress;
}

interface TranscodePass {
  maxDimension: number;
  targetBytes: number;
  minBitrate: number;
  maxBitrate: number;
}

function pickRecorderMimeType(): string | null {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
    "video/mp4;codecs=avc1",
  ];
  if (typeof MediaRecorder === "undefined") return null;
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return null;
}

function mimeToFileType(mimeType: string): { type: string; ext: string } {
  const base = mimeType.split(";")[0]!.trim().toLowerCase();
  if (base === "video/mp4") return { type: "video/mp4", ext: "mp4" };
  return { type: "video/webm", ext: "webm" };
}

function targetBitrateForPass(durationSec: number, pass: TranscodePass): number {
  const sec = durationSec > 0 ? durationSec : 30;
  const budgetBits = pass.targetBytes * 8 * 0.88;
  const raw = Math.round(budgetBits / sec);
  return Math.min(pass.maxBitrate, Math.max(pass.minBitrate, raw));
}

function buildTranscodePasses(fileSize: number, maxBytes: number): TranscodePass[] {
  const mild: TranscodePass = {
    maxDimension: VIDEO_COMPRESS_MAX_DIMENSION,
    targetBytes: VIDEO_COMPRESS_TARGET_BYTES,
    minBitrate: 350_000,
    maxBitrate: 1_400_000,
  };

  if (fileSize <= maxBytes) return [mild];

  return [
    {
      maxDimension: 1280,
      targetBytes: Math.round(maxBytes * 0.5),
      minBitrate: 280_000,
      maxBitrate: 1_200_000,
    },
    {
      maxDimension: 960,
      targetBytes: Math.round(maxBytes * 0.42),
      minBitrate: 200_000,
      maxBitrate: 900_000,
    },
    {
      maxDimension: 720,
      targetBytes: Math.round(maxBytes * 0.38),
      minBitrate: 120_000,
      maxBitrate: 600_000,
    },
  ];
}

async function loadVideoElement(file: File): Promise<{ video: HTMLVideoElement; objectUrl: string }> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = objectUrl;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("โหลดวิดีโอไม่สำเร็จ"));
  });
  return { video, objectUrl };
}

async function transcodeVideoOnce(
  video: HTMLVideoElement,
  mimeType: string,
  sourceName: string,
  pass: TranscodePass,
  onProgress?: CompressProgress,
): Promise<File | null> {
  const scale = Math.min(1, pass.maxDimension / Math.max(video.videoWidth, video.videoHeight));
  const w = Math.max(2, Math.round(video.videoWidth * scale));
  const h = Math.max(2, Math.round(video.videoHeight * scale));
  const videoBitsPerSecond = targetBitrateForPass(video.duration, pass);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx || typeof canvas.captureStream !== "function") return null;

  const stream = canvas.captureStream(24);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const blobPromise = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType.split(";")[0] }));
    recorder.onerror = () => reject(new Error("บีบอัดวิดีโอไม่สำเร็จ"));
  });

  const reportProgress = () => {
    if (!onProgress || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const pct = Math.min(99, Math.round((video.currentTime / video.duration) * 100));
    onProgress(pct);
  };

  recorder.start(250);
  video.pause();
  video.currentTime = 0;
  video.ontimeupdate = reportProgress;
  await new Promise<void>((resolve) => {
    if (video.readyState >= 2 && video.currentTime === 0) resolve();
    else video.onseeked = () => resolve();
  });
  await video.play();

  let raf = 0;
  const draw = () => {
    if (video.ended) return;
    ctx.drawImage(video, 0, 0, w, h);
    raf = requestAnimationFrame(draw);
  };
  draw();

  const durationMs = Number.isFinite(video.duration) ? video.duration * 1000 : 60_000;
  await Promise.race([
    new Promise<void>((resolve) => {
      video.onended = () => resolve();
    }),
    new Promise<void>((resolve) => setTimeout(resolve, durationMs + 10_000)),
  ]);

  cancelAnimationFrame(raf);
  video.ontimeupdate = null;
  ctx.drawImage(video, 0, 0, w, h);
  video.pause();

  if (recorder.state !== "inactive") recorder.stop();
  stream.getTracks().forEach((t) => t.stop());

  const blob = await blobPromise;
  if (!blob.size) return null;

  onProgress?.(100);

  const { type, ext } = mimeToFileType(mimeType);
  const newName = sourceName.replace(/\.[^.]+$/, "") + `.${ext}`;
  return new File([blob], newName || `video.${ext}`, { type });
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("โหลดรูปภาพไม่สำเร็จ"));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export async function compressImage(file: File): Promise<File> {
  if (!COMPRESSIBLE_IMAGE_TYPES.has(file.type)) return file;
  if (typeof document === "undefined") return file;
  try {
    const img = await loadImage(file);
    const { width: w, height: h } = img;
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(w, h));
    const targetW = Math.round(w * scale);
    const targetH = Math.round(h * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;
    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export async function compressVideo(file: File, options?: CompressVideoOptions): Promise<File> {
  const maxBytes = options?.maxBytes ?? MAX_VIDEO_BYTES;
  const needsCompress = file.size > VIDEO_AUTO_COMPRESS_ABOVE_BYTES || file.size > maxBytes;
  if (!needsCompress) return file;
  if (typeof document === "undefined" || typeof MediaRecorder === "undefined") {
    if (file.size > maxBytes) {
      throw new Error("เบราว์เซอร์นี้บีบอัดวิดีโอไม่ได้ ลองใช้ Chrome หรือตัดคลิปสั้นลง");
    }
    return file;
  }

  const mimeType = pickRecorderMimeType();
  if (!mimeType) {
    if (file.size > maxBytes) {
      throw new Error("เบราว์เซอร์นี้บีบอัดวิดีโอไม่ได้ ลองใช้ Chrome หรือตัดคลิปสั้นลง");
    }
    return file;
  }

  const passes = buildTranscodePasses(file.size, maxBytes);
  let objectUrl = "";
  let videoEl: HTMLVideoElement | null = null;
  let workingFile = file;

  try {
    const loaded = await loadVideoElement(file);
    objectUrl = loaded.objectUrl;
    videoEl = loaded.video;

    for (let i = 0; i < passes.length; i++) {
      const pass = passes[i]!;
      const passStart = Math.round((i / passes.length) * 100);
      const passSpan = 100 / passes.length;

      const out = await transcodeVideoOnce(videoEl, mimeType, workingFile.name, pass, (p) => {
        const overall = Math.min(99, Math.round(passStart + (p * passSpan) / 100));
        options?.onProgress?.(overall);
      });

      if (!out?.size) break;

      workingFile = out;
      options?.onProgress?.(Math.min(99, Math.round(((i + 1) / passes.length) * 100)));

      if (workingFile.size <= maxBytes) {
        options?.onProgress?.(100);
        return workingFile;
      }

      if (i < passes.length - 1) {
        URL.revokeObjectURL(objectUrl);
        const reloaded = await loadVideoElement(workingFile);
        objectUrl = reloaded.objectUrl;
        videoEl = reloaded.video;
      }
    }

    if (workingFile.size <= maxBytes) {
      options?.onProgress?.(100);
      return workingFile;
    }

    if (file.size <= maxBytes && workingFile.size < file.size) {
      options?.onProgress?.(100);
      return workingFile;
    }

    throw new Error(
      `บีบอัดแล้วยังใหญ่เกิน ${Math.round(maxBytes / (1024 * 1024))}MB — ลองตัดคลิปสั้นลงหรือลดความละเอียดกล้อง`,
    );
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export async function compressMedia(
  file: File,
  kind: "image" | "video",
  options?: CompressMediaOptions,
): Promise<File> {
  if (kind === "image") return compressImage(file);
  return compressVideo(file, { onProgress: options?.onProgress });
}
