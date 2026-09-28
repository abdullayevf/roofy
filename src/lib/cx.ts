/** Joins class names, dropping falsy values. No de-duplication: callers keep class lists conflict-free. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
