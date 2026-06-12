// บีบอัดรูปภาพก่อนอัปโหลด เพื่อลดขนาดไฟล์โดยยังคงความชัด
// สำหรับวิดีโอ: เบราว์เซอร์ไม่สามารถ transcode ได้สะดวก จึงคืนไฟล์เดิม
// (ขนาด upload ถูกจำกัดอยู่แล้วผ่าน MAX_VIDEO_BYTES)

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.82;
const COMPRESSIBLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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
    // Defer revoke so the image keeps decoded pixels for canvas draw
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export async function compressImage(file: File): Promise<File> {
  if (!COMPRESSIBLE_IMAGE_TYPES.has(file.type)) return file;
  if (typeof document === "undefined") return file;
  try {
    const img = await loadImage(file);
    const { width: w, height: h } = img;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(w, h));
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

export async function compressMedia(file: File, kind: "image" | "video"): Promise<File> {
  if (kind === "image") return compressImage(file);
  return file;
}
