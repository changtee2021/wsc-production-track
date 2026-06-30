// Client-side direct video upload to private Supabase buckets via signed URLs.
import { supabase } from "@/integrations/supabase/client";
import {
  MAX_VIDEO_BYTES,
  VIDEO_EXT_BY_MIME,
  type DeptMediaBucket,
} from "@/lib/utils/media-limits";

type PrepareVideoUpload = (args: {
  data: {
    token: string;
    ext: "mp4" | "webm" | "mov" | "m4v";
    sizeBytes: number;
  };
}) => Promise<{ path: string; token: string }>;

export async function uploadVideoViaSignedUrl(opts: {
  bucket: DeptMediaBucket;
  file: File;
  deptToken: string;
  prepareUpload: PrepareVideoUpload;
}): Promise<{ path: string; previewUrl: string }> {
  const ext = VIDEO_EXT_BY_MIME[opts.file.type];
  if (!ext) {
    throw new Error("รองรับเฉพาะ MP4, WEBM, MOV, M4V");
  }
  if (opts.file.size > MAX_VIDEO_BYTES) {
    throw new Error(`ไฟล์ใหญ่เกิน ${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))}MB`);
  }

  const prepared = await opts.prepareUpload({
    data: { token: opts.deptToken, ext, sizeBytes: opts.file.size },
  });

  const { error } = await supabase.storage
    .from(opts.bucket)
    .uploadToSignedUrl(prepared.path, prepared.token, opts.file, {
      contentType: opts.file.type,
      upsert: false,
    });
  if (error) throw new Error(error.message);

  return { path: prepared.path, previewUrl: URL.createObjectURL(opts.file) };
}
