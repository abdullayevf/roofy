/**
 * Where to go after signing in: a path on this site, carried in `?next=` from the invite page to sign in or sign
 * up, and in a cookie across two-factor and the verification email. Only a plain path is ever followed.
 */
export const RETURN_PARAM = "next";
export const RETURN_COOKIE = "roofy_return";
const MAX_LENGTH = 200;

/** The path if it is one on this site (a single leading `/`, no backslash, space or control character), else null. */
export function returnPathOf(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_LENGTH) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (/[\\\s\u0000-\u001f\u007f]/.test(raw)) return null;
  try {
    const url = new URL(raw, "https://roofy.invalid");
    return url.origin === "https://roofy.invalid" ? raw : null;
  } catch {
    return null;
  }
}

/** A link to an entry page that comes back to `path` afterwards; the link as it was without one. */
export function withReturn(href: string, path: string | null): string {
  return path ? `${href}?${RETURN_PARAM}=${encodeURIComponent(path)}` : href;
}
