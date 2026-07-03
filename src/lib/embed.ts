/**
 * Recursion contract: the widget appends `laptop_embed=<depth+1>` to whatever
 * URL its screen loads. A page rendering the widget reads its own depth from
 * that param — depth 0 is a normal page, depth 1 still renders a live laptop
 * (no URL bar), depth 2 renders a static laptop (wallpaper screen, no iframe),
 * which terminates the mise-en-abyme.
 */
export const EMBED_PARAM = "laptop_embed";

/** how deep inside laptop screens this page is (0 = a normal page) */
export function laptopEmbedDepth(): number {
  if (typeof window === "undefined") return 0;
  const v = new URLSearchParams(window.location.search).get(EMBED_PARAM);
  const n = v ? parseInt(v, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Resolve what the screen iframe should load. `"self"` means the embedding
 * page itself; bare domains get https:// prepended. The next depth marker is
 * stamped on so the inner page knows where it lives.
 */
export function resolveScreenSrc(target: string, depth: number): string {
  try {
    const base =
      target === "self"
        ? window.location.href
        : /^[a-z][a-z0-9+.-]*:/i.test(target)
          ? target
          : "https://" + target;
    const u = new URL(base, window.location.href);
    u.searchParams.set(EMBED_PARAM, String(depth + 1));
    return u.toString();
  } catch {
    return target;
  }
}
