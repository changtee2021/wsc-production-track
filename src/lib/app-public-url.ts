/** Public base URL for this app (no trailing slash). Override via VITE_APP_PUBLIC_URL / APP_PUBLIC_URL. */
const DEFAULT = "https://wsc-production-track.lovable.app";

function trimUrl(url: string | undefined): string {
  return url?.trim().replace(/\/$/, "") ?? "";
}

/** Client routes, meta tags, sitemaps (VITE_APP_PUBLIC_URL). */
export function clientAppPublicUrl(): string {
  return trimUrl(import.meta.env.VITE_APP_PUBLIC_URL as string | undefined) || DEFAULT;
}

/** Server-only helpers e.g. LINE notify (APP_PUBLIC_URL). */
export function serverAppPublicUrl(): string {
  return trimUrl(process.env.APP_PUBLIC_URL) || DEFAULT;
}

export function clientAppPublicPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${clientAppPublicUrl()}${normalized}`;
}
