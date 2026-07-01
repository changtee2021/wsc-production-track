export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
/** วิดีโอใหญ่กว่านี้จะถูกบีบอัดอัตโนมัติก่อนอัปโหลด (ไม่แจ้งเตือนพนักงาน) */
export const VIDEO_AUTO_COMPRESS_ABOVE_BYTES = 10 * 1024 * 1024; // 10 MB
/** เป้าขนาดหลังบีบรอบเดียว (~3–5 MB) */
export const VIDEO_COMPRESS_TARGET_BYTES = 4 * 1024 * 1024; // 4 MB
export const VIDEO_COMPRESS_MAX_DIMENSION = 1280;

export type DeptMediaBucket = "qc-media" | "packing-media" | "maintenance-media";

export const VIDEO_EXT_BY_MIME: Record<string, "mp4" | "webm" | "mov" | "m4v"> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
};

const VIDEO_MIME_BY_EXT: Record<string, keyof typeof VIDEO_EXT_BY_MIME> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
};

/** Infer MIME when the device leaves file.type empty (common on mobile). */
export function inferVideoMime(file: File): string | null {
  if (file.type && VIDEO_EXT_BY_MIME[file.type]) return file.type;
  const ext = file.name.match(/\.([^.]+)$/i)?.[1]?.toLowerCase();
  if (!ext) return null;
  return VIDEO_MIME_BY_EXT[ext] ?? null;
}

/** Return the same file with a corrected video MIME, or null if unsupported. */
export function normalizeVideoFile(file: File): File | null {
  const mime = inferVideoMime(file);
  if (!mime) return null;
  if (file.type === mime) return file;
  return new File([file], file.name, { type: mime, lastModified: file.lastModified });
}
