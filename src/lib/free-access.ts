/**
 * Content that stays fully open with no registration at all:
 * the blog and the free group maker. Everything else under /tools
 * requires a registered user with an active (or lifetime) trial.
 */
export const ALWAYS_FREE_PREFIXES = ["/blog", "/tools/group-maker"] as const;

export function isAlwaysFree(pathname: string): boolean {
  return ALWAYS_FREE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}