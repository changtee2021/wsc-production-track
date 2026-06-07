// Helper for encoding/decoding the cross-department staff key used as
// the URL param for /employee-profile/$id. A staff "identity" across
// departments is grouped by (name, emp_code). We base64url-encode the
// pair so it's URL-safe (Thai names, pipes, etc).

function toB64Url(s: string) {
  if (typeof window === "undefined") {
    // SSR / Node
    return Buffer.from(s, "utf8").toString("base64")
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  // Browser: encode UTF-8 → base64
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string) {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (s.length % 4)) % 4);
  if (typeof window === "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeStaffKey(name: string, emp_code: string | null): string {
  const raw = `${(name ?? "").trim()}|${(emp_code ?? "").trim()}`;
  return toB64Url(raw);
}

export function decodeStaffKey(token: string): { name: string; emp_code: string | null } {
  try {
    const raw = fromB64Url(token);
    const idx = raw.indexOf("|");
    if (idx === -1) return { name: raw, emp_code: null };
    const name = raw.slice(0, idx);
    const code = raw.slice(idx + 1);
    return { name, emp_code: code === "" ? null : code };
  } catch {
    return { name: token, emp_code: null };
  }
}
