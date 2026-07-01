export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_BYTES = 1024 * 1024 * 1024; // 1 GB — ตรง Supabase global limit
export const MAX_VIDEO_SIZE_LABEL = "1 GB";

/** User-facing error when a video exceeds the per-file upload cap. */
export function formatVideoMaxSizeError(): string {
  return `ไฟล์ใหญ่เกิน ${MAX_VIDEO_SIZE_LABEL} ต่อไฟล์`;
}

/** วิดีโอต้นฉบับใหญ่กว่านี้จะลองบีบก่อนอัป (Android) — ≤50 MB อัปตรง */
export const VIDEO_AUTO_COMPRESS_ABOVE_BYTES = 50 * 1024 * 1024; // 50 MB
/** เป้าหลังบีบ: ใกล้ 50 MB เพื่อคงความชัดสูงสุดในขนาดที่อัปได้สะดวก */
export const VIDEO_COMPRESS_TARGET_BYTES = Math.round(VIDEO_AUTO_COMPRESS_ABOVE_BYTES * 0.96);
export const VIDEO_COMPRESS_MAX_DIMENSION = 1920;

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

/** iOS Safari มักไม่เปิด picker ถ้า input เป็น display:none — ใช้คลาสนี้แทน hidden */
export const IOS_SAFE_FILE_INPUT_CLASS =
  "fixed left-0 top-0 -z-50 h-px w-px overflow-hidden opacity-0";

/** accept ชัดเจนสำหรับวิดีโอจาก iPhone (MOV/MP4) */
export const VIDEO_FILE_ACCEPT =
  "video/mp4,video/quicktime,video/x-m4v,video/webm,video/*";

export function sniffVideoMimeFromBytes(b: Uint8Array): string | null {
  if (b.length < 12) return null;
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video/webm";
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (brand === "qt  ") return "video/quicktime";
    if (brand.startsWith("M4V")) return "video/x-m4v";
    return "video/mp4";
  }
  return null;
}

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

/**
 * iOS บางครั้งส่ง file.type ว่างและไม่มีนามสกุล — อ่าน magic bytes ช่วย
 */
export async function normalizeVideoFileAsync(file: File): Promise<File | null> {
  const sync = normalizeVideoFile(file);
  if (sync) return sync;

  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mime = sniffVideoMimeFromBytes(head);
  if (!mime) return null;

  const ext = VIDEO_EXT_BY_MIME[mime];
  const base = file.name.replace(/\.[^.]+$/, "") || "video";
  const name = file.name.includes(".") ? file.name : `${base}.${ext}`;
  return new File([file], name, { type: mime, lastModified: file.lastModified });
}
