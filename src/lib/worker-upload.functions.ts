// Public worker-facing upload function.
// Validates file size + magic bytes server-side before uploading to the
// `log-notes` bucket using the service-role client, so the bucket can keep
// its public INSERT policy disabled.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

type Allowed = { mime: string; ext: string };

function detect(bytes: Uint8Array): Allowed | null {
  if (bytes.length < 12) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { mime: "image/jpeg", ext: "jpg" };
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return { mime: "image/png", ext: "png" };
  // GIF87a / GIF89a
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  )
    return { mime: "image/gif", ext: "gif" };
  // WEBP: "RIFF"....("WEBP")
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return { mime: "image/webp", ext: "webp" };
  return null;
}

export const uploadWorkerNoteImage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        // base64-encoded file body (no data: URL prefix)
        dataBase64: z.string().min(1).max(Math.ceil((MAX_BYTES * 4) / 3) + 16),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const bytes = Uint8Array.from(Buffer.from(data.dataBase64, "base64"));
    if (bytes.length === 0) throw new Error("ไฟล์ว่างเปล่า");
    if (bytes.length > MAX_BYTES) throw new Error("ไฟล์ใหญ่เกิน 5MB");

    const detected = detect(bytes);
    if (!detected) throw new Error("รองรับเฉพาะรูปภาพ JPG, PNG, WEBP, GIF");

    const path = `${crypto.randomUUID()}.${detected.ext}`;
    const { error } = await supabaseAdmin.storage
      .from("log-notes")
      .upload(path, bytes, {
        contentType: detected.mime,
        upsert: false,
      });
    if (error) throw new Error(error.message);

    const { data: pub } = supabaseAdmin.storage
      .from("log-notes")
      .getPublicUrl(path);
    return { url: pub.publicUrl };
  });
