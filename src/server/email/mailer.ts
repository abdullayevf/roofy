/** One outgoing message. `text` and `html` carry the same words and the same links. */
export type MailMessage = { to: string; subject: string; text: string; html: string };

/** Sends one email. Rejects when it could not be sent. */
export interface Mailer {
  send(m: MailMessage): Promise<void>;
}
