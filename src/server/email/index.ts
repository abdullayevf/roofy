import { createConsoleMailer } from "./console";
import type { Mailer } from "./mailer";
import { createSmtpMailerFromEnv } from "./smtp";

export type { MailMessage, Mailer } from "./mailer";
export { inviteEmail, resetEmail, verificationEmail } from "./templates";

/**
 * Picks the transport from the environment at call time.
 * ROOFY_MAIL=console prints each message (and logs it to ROOFY_MAIL_LOG when set);
 * ROOFY_MAIL=smtp sends through SMTP_URL from MAIL_FROM. Unset means console in dev and test,
 * and an error in production, so a live server never silently drops mail.
 */
export function getMailer(): Mailer {
  const mode = process.env.ROOFY_MAIL || (process.env.NODE_ENV === "production" ? "" : "console");
  if (mode === "console") return createConsoleMailer({ logFile: process.env.ROOFY_MAIL_LOG || undefined });
  if (mode === "smtp") return createSmtpMailerFromEnv();
  if (!mode) throw new Error("ROOFY_MAIL is not set. Set it to smtp (or console) in .env (see .env.example).");
  throw new Error(`ROOFY_MAIL must be "console" or "smtp", not "${mode}". Fix it in .env (see .env.example).`);
}
