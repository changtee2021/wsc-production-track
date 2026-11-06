const KEY = "wsc:home-actor";

export type HomeActor = {
  id: string;
  name: string;
  empCode: string;
  source: string;
  /** True when this badge is also in the office roster. The scan button uses it. */
  office?: boolean;
};

export function saveHomeActor(actor: HomeActor) {
  sessionStorage.setItem(KEY, JSON.stringify(actor));
}

export function loadHomeActor(): HomeActor | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HomeActor;
    if (!parsed?.id || !parsed.name || !parsed.empCode) return null;
    return { ...parsed, office: parsed.office === true };
  } catch {
    return null;
  }
}
