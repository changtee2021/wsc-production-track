// Shared admin-side client helpers. Keeps token handling, error reporting,
// formatting, and signed-upload flow in one place so route files stay focused.
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAdminToken, clearAdminSession } from "@/lib/auth/admin-session";

/** Read the current admin token or kick the user back to /admin. */
export function requireToken(): string {
  const t = getAdminToken();
  if (!t) {
    clearAdminSession();
    if (typeof window !== "undefined") window.location.href = "/admin";
    throw new Error("Unauthorized");
  }
  return t;
}

/** Standard error toast that auto-logs out on Unauthorized. */
export function showError(err: unknown, fallback = "เกิดข้อผิดพลาด") {
  const msg = err instanceof Error ? err.message : fallback;
  if (msg === "Unauthorized") {
    clearAdminSession();
    if (typeof window !== "undefined") window.location.href = "/admin";
    return;
  }
  toast.error(msg);
}

/** Human-readable byte sizes. */
export function formatBytes(n: number): string {
  if (!n || n < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
}

export type AdminBucket = "avatars" | "step-images" | "banners";

type CreateSignedUrlFn = (args: {
  data: { token: string; bucket: AdminBucket; ext: string };
}) => Promise<{ path: string; token: string; publicUrl: string }>;

/**
 * Upload a file to a private admin bucket via a signed URL.
 * Returns the storage path and a public URL.
 */
export async function adminUpload(
  bucket: AdminBucket,
  file: File,
  createUrl: CreateSignedUrlFn,
): Promise<{ path: string; publicUrl: string }> {
  const ext =
    (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const signed = await createUrl({ data: { token: requireToken(), bucket, ext } });
  const { error } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(signed.path, signed.token, file, {
      contentType: file.type,
      upsert: false,
    });
  if (error) throw error;
  return { path: signed.path, publicUrl: signed.publicUrl };
}
