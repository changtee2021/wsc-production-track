// Tracks the latest system_log timestamp the admin has already seen.
// Used by the sidebar "NEW" badge and the auto-open dialog.
const KEY = "wsc.admin.lastSeenLogAt";

export function getLastSeenLogAt(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function markLogsSeen(latestCreatedAt: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, latestCreatedAt);
  // Notify listeners in the same tab (storage event only fires cross-tab)
  window.dispatchEvent(new CustomEvent("wsc:logs-seen"));
}

export function hasUnseen(latestCreatedAt: string | null | undefined): boolean {
  if (!latestCreatedAt) return false;
  const seen = getLastSeenLogAt();
  if (!seen) return true;
  return new Date(latestCreatedAt).getTime() > new Date(seen).getTime();
}
