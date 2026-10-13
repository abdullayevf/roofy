import nodemailer from "nodemailer";
import { requireEnv } from "@/server/db/env";
import type { Mailer } from "./mailer";

/** The part of a nodemailer transport the mailer uses. */
export type MailTransport = { sendMail(options: { from: string; to: string; subject: string; text: string; html: string }): Promise<unknown> };

/** Sends through the given transport. Tests pass a nodemailer `jsonTransport`; no network. */
export function createSmtpMailer({ transport, from }: { transport: MailTransport; from: string }): Mailer {
  return {
    async send({ to, subject, text, html }) {
      await transport.sendMail({ from, to, subject, text, html });
    },
  };
}

/**
 * Production transport. SMTP_URL and MAIL_FROM are read when the first message is sent, not
 * when the mailer is built, so a missing value fails with a plain error at the point of use.
 */
export function createSmtpMailerFromEnv(): Mailer {
  let mailer: Mailer | undefined;
  return {
    async send(m) {
      mailer ??= createSmtpMailer({
        transport: nodemailer.createTransport(requireEnv("SMTP_URL")),
        from: requireEnv("MAIL_FROM"),
      });
      await mailer.send(m);
    },
  };
}
