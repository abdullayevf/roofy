import { existsSync, readFileSync } from "node:fs";
import { mailLogPath } from "./env";

/** One line of the console mailer's JSONL (src/server/email/console.ts); the html is never written. */
export interface MailLine {
  to: string;
  subject: string;
  text: string;
  links: string[];
}

/** Every mail in the log, oldest first. A missing file is no mail; a half-written last line is skipped. */
export function readMail(file = mailLogPath()): MailLine[] {
  if (!existsSync(file)) return [];
  const mails: MailLine[] = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as Partial<MailLine>;
      if (typeof parsed.to === "string") {
        mails.push({ to: parsed.to, subject: parsed.subject ?? "", text: parsed.text ?? "", links: parsed.links ?? [] });
      }
    } catch {
      // The mailer was mid-append; the next poll sees the whole line.
    }
  }
  return mails;
}

/** How many mails are in the log now. Take it before the action that sends mail, then pass it as `after`. */
export function mailCount(file = mailLogPath()): number {
  return readMail(file).length;
}

export interface WaitOptions {
  /** Only mails after the first `after` lines (see mailCount): a second reset mail, not the first. */
  after?: number;
  /** Only a mail whose subject matches. */
  subject?: RegExp;
  file?: string;
  timeoutMs?: number;
  intervalMs?: number;
}

/** The newest mail to the address (case-insensitive), or undefined. */
export function newestMail(to: string, { after = 0, subject, file }: WaitOptions = {}): MailLine | undefined {
  const wanted = to.trim().toLowerCase();
  return readMail(file)
    .slice(after)
    .filter((m) => m.to.trim().toLowerCase() === wanted && (!subject || subject.test(m.subject)))
    .at(-1);
}

/** Polls the log briefly (default 10 s) for a mail to the address; throws a plain error naming the address when none comes. */
export async function waitForMail(to: string, options: WaitOptions = {}): Promise<MailLine> {
  const { timeoutMs = 10_000, intervalMs = 200 } = options;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const mail = newestMail(to, options);
    if (mail) return mail;
    if (Date.now() >= deadline) throw new Error(`No mail to ${to} in ${options.file ?? mailLogPath()} after ${timeoutMs} ms.`);
    await new Promise((done) => setTimeout(done, intervalMs));
  }
}

/** The first link of the newest mail to the address: the verification, reset or invite link. */
export async function mailLink(to: string, options: WaitOptions = {}): Promise<string> {
  const mail = await waitForMail(to, options);
  const link = mail.links[0];
  if (!link) throw new Error(`The mail to ${to} ("${mail.subject}") has no link.`);
  return link;
}
