// Server-only helpers for resolving stored media references into
// (bucket, path) tuples that the admin client can sign for short-lived
// reads. Accepts either a new-style storage path ("image/<uuid>.jpg" or
// "<bucket>/<path>") or a legacy public/sign URL from Supabase Storage.

export type StorageRef = { bucket: string; path: string };

const URL_RE =
  /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?#]+)/;

export function parseStorageRef(
  value: string,
  allowedBuckets: readonly string[],
): StorageRef | null {
  if (!value) return null;
  const v = value.trim();

  // Full Supabase storage URL (public or signed)
  if (v.startsWith("http://") || v.startsWith("https://")) {
    const m = v.match(URL_RE);
    if (!m) return null;
    const bucket = decodeURIComponent(m[1]);
    const path = decodeURIComponent(m[2]);
    if (!allowedBuckets.includes(bucket)) return null;
    return { bucket, path };
  }

  // "<bucket>/<rest>" form
  for (const b of allowedBuckets) {
    if (v.startsWith(`${b}/`)) {
      return { bucket: b, path: v.slice(b.length + 1) };
    }
  }

  // Bare path — caller supplies which bucket to assume
  return null;
}

export function parseStorageRefWithDefault(
  value: string,
  defaultBucket: string,
  allowedBuckets: readonly string[],
): StorageRef | null {
  const direct = parseStorageRef(value, allowedBuckets);
  if (direct) return direct;
  if (!value) return null;
  const v = value.trim();
  if (v.startsWith("http://") || v.startsWith("https://")) return null;
  // Treat as a path inside the default bucket
  return { bucket: defaultBucket, path: v };
}
