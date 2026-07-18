// Images: compress to JPEG. Videos: fast header repair only — H.264 convert runs in background after upload.
import { MAX_VIDEO_BYTES, formatVideoMaxSizeError } from "@/lib/utils/media-limits";
import {
  canHtmlVideoPlay,
  inspectMp4,
  needsWebSafeRemux,
  repairMp4IfNeeded,
} from "@/lib/utils/mp4-repair";

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

/** iPhone/iPad detection (kept for callers that still check platform). */
export function isAppleMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Client can run ffmpeg.wasm background convert. */
export function canBrowserCompressVideo(): boolean {
  return typeof window !== "undefined" && typeof WebAssembly !== "undefined";
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

function isWebmFile(file: File): boolean {
  return file.type === "video/webm" || /\.webm$/i.test(file.name);
}

function sniffNeedsTranscode(bytes: Uint8Array): boolean {
  const health = inspectMp4(bytes);
  if (!health.isMp4) return false;
  if (health.hasHevc) return true;
  if (!health.hasMoov) return true;
  return false;
}

/** Decide whether this video should be converted to H.264 MP4 in the background. */
export async function videoNeedsWebSafeTranscode(file: File): Promise<boolean> {
  // Fast path: Apple container → almost always needs convert for Chrome/Edge
  if (/\.(mov|m4v)$/i.test(file.name) || file.type === "video/quicktime" || file.type === "video/x-m4v") {
    return true;
  }
  if (isWebmFile(file)) return true;

  const looksMp4Family = file.type === "video/mp4" || /\.mp4$/i.test(file.name);

  if (looksMp4Family) {
    if (file.size <= 12 * 1024 * 1024) {
      const all = new Uint8Array(await file.arrayBuffer());
      if (needsWebSafeRemux(inspectMp4(all))) return true;
    } else {
      const wider = new Uint8Array(await file.slice(0, 2 * 1024 * 1024).arrayBuffer());
      if (sniffNeedsTranscode(wider)) return true;
    }
  }

  if (!(await canHtmlVideoPlay(file))) return true;
  return false;
}

export async function compressVideo(file: File, options?: CompressVideoOptions): Promise<File> {
  return prepareVideoForUpload(file, options);
}

/**
 * Prepare video for upload: fast MP4 header repair only.
 * H.264 transcode runs in the background after upload (see video-background-convert).
 */
export async function prepareVideoForUpload(
  file: File,
  options?: CompressMediaOptions,
): Promise<File> {
  if (file.size > MAX_VIDEO_BYTES) throw new Error(formatVideoMaxSizeError());
  options?.onProgress?.(30);
  const { file: repaired } = await repairMp4IfNeeded(file);
  options?.onProgress?.(100);
  return repaired;
}

export async function compressMedia(
  file: File,
  kind: "image" | "video",
  options?: CompressMediaOptions,
): Promise<File> {
  if (kind === "image") return compressImage(file);
  return prepareVideoForUpload(file, options);
}
