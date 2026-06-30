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
