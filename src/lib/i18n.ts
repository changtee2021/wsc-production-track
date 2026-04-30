export function flagFor(nat: string | null | undefined): string {
  switch (nat?.toLowerCase()) {
    case "thai":
      return "🇹🇭";
    case "burmese":
    case "myanmar":
      return "🇲🇲";
    case "lao":
      return "🇱🇦";
    case "khmer":
    case "cambodian":
      return "🇰🇭";
    default:
      return "👤";
  }
}

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
