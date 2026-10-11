/** Which "add to home screen" steps to show first. Decided from the browser's user agent. */

export type InstallPlatform = "ios" | "android" | "desktop";

export const INSTALL_PLATFORMS: readonly InstallPlatform[] = ["ios", "android", "desktop"];

export function detectPlatform(userAgent: string | null | undefined): InstallPlatform {
  const ua = userAgent ?? "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

/** `?platform=` (the prototype's way to look at another phone's steps): one of the three names, else null. */
export function parsePlatform(value: unknown): InstallPlatform | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && (INSTALL_PLATFORMS as readonly string[]).includes(raw) ? (raw as InstallPlatform) : null;
}
