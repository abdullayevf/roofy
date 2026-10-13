import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { MailMessage, Mailer } from "./mailer";

/** Every http(s) URL in the text, in order, without trailing sentence punctuation. */
export function linksIn(text: string): string[] {
  return (text.match(/https?:\/\/[^\s<>"']+/g) ?? []).map((url) => url.replace(/[.,;:!?)\]]+$/, ""));
}

/**
 * Dev and test transport: prints each message to the console and, when `logFile` is set,
 * appends one JSON line `{to, subject, text, links}` to it. The html is never written.
 * Db-mode e2e reads verification and invite links from that file.
 */
export function createConsoleMailer({ logFile }: { logFile?: string }): Mailer {
  return {
    async send({ to, subject, text }: MailMessage) {
      console.log(`[mail] to: ${to}\n[mail] subject: ${subject}\n${text}`);
      if (!logFile) return;
      await mkdir(dirname(logFile), { recursive: true });
      await appendFile(logFile, `${JSON.stringify({ to, subject, text, links: linksIn(text) })}\n`);
    },
  };
}
