/** Words and sizes on the Workspace export screen (flows.md screen 26). A plain module so server and client share it. */

/** The file the Export workspace button saves. */
export const EXPORT_FILENAME = "roofy-workspace-export.zip";

/**
 * Classes for the zip's name inside a sentence. It never breaks while it fits on a line, and moves to its own line when
 * the rest of the sentence leaves too little room. Only at 200% text zoom, where the name is wider than the screen, may
 * it break inside the word, instead of pushing the page sideways.
 */
export const EXPORT_NAME_CLASS = "inline-block max-w-full [overflow-wrap:anywhere]";

export const rowsText = (n: number): string => `${n.toLocaleString("en-AU")} ${n === 1 ? "row" : "rows"}`;

/** Sizes the way a phone shows them: whole KB below 1 MB, then one decimal. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${bytes === 0 ? 0 : Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export function attachmentsText({ count, bytes }: { count: number; bytes: number }): string {
  if (count === 0) return "No attachments yet.";
  return `${count.toLocaleString("en-AU")} ${count === 1 ? "attachment" : "attachments"}, ${formatBytes(bytes)}`;
}
