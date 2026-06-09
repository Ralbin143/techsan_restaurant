/** Origin for authenticated admin API (matches `lib/api.ts` host) */
export function getAdminApiOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL || "https://restaurant-api.techsanglobal.com"
  ).replace(/\/$/, "");
}

/**
 * Resolve menu image URL for API-relative paths or absolute URLs.
 * @param apiOrigin Optional API origin (e.g. guest order page passes the same base as axios).
 */
export function resolveMenuImageUrl(
  src?: string | null,
  apiOrigin?: string
): string | undefined {
  if (!src || typeof src !== "string") return undefined;
  const t = src.trim();
  if (!t) return undefined;
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  const base = (apiOrigin || getAdminApiOrigin()).replace(/\/$/, "");
  return t.startsWith("/") ? `${base}${t}` : `${base}/${t}`;
}
