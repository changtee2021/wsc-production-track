// บีบอัดรูปภาพก่อนอัปโหลด เพื่อลดขนาดไฟล์โดยยังคงความชัด
// วิดีโอ > 10 MB บีบรอบเดียวเป้า ~4 MB (1280px) — ไม่สำเร็จจะอัปไฟล์ต้นฉบับตรง
import {
  VIDEO_AUTO_COMPRESS_ABOVE_BYTES,
  VIDEO_COMPRESS_MAX_DIMENSION,
  VIDEO_COMPRESS_TARGET_BYTES,
} from "@/lib/utils/media-limits";

const MAX_IMAGE_DIMENSION = 1920;
const JPEG_QUALITY = 0.82;
const COMPRESSIBLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const MIN_VIDEO_BITRATE = 450_000;
const MAX_VIDEO_BITRATE = 1_400_000;

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

function targetBitrateForDuration(durationSec: number): number {
  const sec = durationSec > 0 ? durationSec : 30;
  const raw = Math.round((VIDEO_COMPRESS_TARGET_BYTES * 8) / sec);
  return Math.min(MAX_VIDEO_BITRATE, Math.max(MIN_VIDEO_BITRATE, raw));
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
): Promise<File | null> {
  const scale = Math.min(
    1,
    VIDEO_COMPRESS_MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight),
  );
  const w = Math.max(2, Math.round(video.videoWidth * scale));
  const h = Math.max(2, Math.round(video.videoHeight * scale));
  const videoBitsPerSecond = targetBitrateForDuration(video.duration);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx || typeof canvas.captureStream !== "function") return null;

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const blobPromise = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType.split(";")[0] }));
    recorder.onerror = () => reject(new Error("บีบอัดวิดีโอไม่สำเร็จ"));
  });

  recorder.start(250);
  video.pause();
  video.currentTime = 0;
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
    new Promise<void>((resolve) => setTimeout(resolve, durationMs + 8_000)),
  ]);

  cancelAnimationFrame(raf);
  ctx.drawImage(video, 0, 0, w, h);
  video.pause();

  if (recorder.state !== "inactive") recorder.stop();
  stream.getTracks().forEach((t) => t.stop());

  const blob = await blobPromise;
  if (!blob.size) return null;

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

export async function compressVideo(file: File): Promise<File> {
  if (file.size <= VIDEO_AUTO_COMPRESS_ABOVE_BYTES) return file;
  if (typeof document === "undefined" || typeof MediaRecorder === "undefined") return file;

  const mimeType = pickRecorderMimeType();
  if (!mimeType) return file;

  let objectUrl = "";
  try {
    const loaded = await loadVideoElement(file);
    objectUrl = loaded.objectUrl;
    const out = await transcodeVideoOnce(loaded.video, mimeType, file.name);
    // รอบเดียว — ใช้ผลเมื่อเล็กลงจริง ไม่งั้นอัปต้นฉบับตรง
    if (out && out.size > 0 && out.size < file.size) return out;
    return file;
  } catch {
    return file;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export async function compressMedia(file: File, kind: "image" | "video"): Promise<File> {
  if (kind === "image") return compressImage(file);
  return compressVideo(file);
}
