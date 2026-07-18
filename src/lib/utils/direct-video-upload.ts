// Client-side direct video upload to private Supabase buckets via signed URLs.
import { supabase } from "@/integrations/supabase/client";
import {
  MAX_VIDEO_BYTES,
  VIDEO_EXT_BY_MIME,
  formatVideoMaxSizeError,
  inferVideoMime,
  type DeptMediaBucket,
} from "@/lib/utils/media-limits";

type PrepareVideoUpload = (args: {
  data: {
    token: string;
    ext: "mp4" | "webm" | "mov" | "m4v";
    sizeBytes: number;
  };
}) => Promise<{ path: string; token: string }>;

export type PrepareVideoReplace = (args: {
  data: {
    token: string;
    path: string;
    sizeBytes: number;
  };
}) => Promise<{ path: string; token: string }>;

export async function uploadVideoViaSignedUrl(opts: {
  bucket: DeptMediaBucket;
  file: File;
  deptToken: string;
  prepareUpload: PrepareVideoUpload;
}): Promise<{ path: string; previewUrl: string }> {
  const mime =
    opts.file.type && VIDEO_EXT_BY_MIME[opts.file.type]
      ? opts.file.type
      : inferVideoMime(opts.file);
  const ext = mime ? VIDEO_EXT_BY_MIME[mime] : undefined;
  if (!ext || !mime) {
    throw new Error("รองรับเฉพาะ MP4, WEBM, MOV, M4V");
  }
  if (opts.file.size > MAX_VIDEO_BYTES) {
    throw new Error(formatVideoMaxSizeError());
  }

  const body =
    opts.file.type === mime
      ? opts.file
      : new File([opts.file], opts.file.name, { type: mime, lastModified: opts.file.lastModified });

  const prepared = await opts.prepareUpload({
    data: { token: opts.deptToken, ext, sizeBytes: body.size },
  });

  const { error } = await supabase.storage
    .from(opts.bucket)
    .uploadToSignedUrl(prepared.path, prepared.token, body, {
      contentType: mime,
      cacheControl: "3600",
      upsert: false,
    });
  if (error) throw new Error(error.message);

  return { path: prepared.path, previewUrl: URL.createObjectURL(body) };
}

/** Upsert converted H.264 bytes onto an existing storage path. */
export async function replaceVideoViaSignedUrl(opts: {
  bucket: DeptMediaBucket;
  path: string;
  file: File;
  deptToken: string;
  prepareReplace: PrepareVideoReplace;
}): Promise<void> {
  if (opts.file.size > MAX_VIDEO_BYTES) {
    throw new Error(formatVideoMaxSizeError());
  }
  const mime = opts.file.type || "video/mp4";
  const prepared = await opts.prepareReplace({
    data: { token: opts.deptToken, path: opts.path, sizeBytes: opts.file.size },
  });
  const { error } = await supabase.storage
    .from(opts.bucket)
    .uploadToSignedUrl(prepared.path, prepared.token, opts.file, {
      contentType: mime,
      cacheControl: "3600",
      upsert: true,
    });
  if (error) throw new Error(error.message);
}
