/** What the three emails say. No amounts, rates or budgets in any of them: invitees may be foremen. */
export type InviteRole = "owner" | "manager" | "foreman" | "accountant";

export type EmailContent = { subject: string; text: string; html: string };

const ROLE_WORDS: Record<InviteRole, string> = {
  owner: "an owner",
  manager: "a manager",
  foreman: "a foreman",
  accountant: "an accountant",
};

/** Escapes text for an html body or a quoted attribute. */
function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** One line only: line breaks in a name must not reach a subject header. */
const oneLine = (value: string) => value.replace(/\s+/g, " ").trim();

function page(paragraphs: string[], url: string, action: string, footer: string): string {
  const body = paragraphs.map((p) => `<p>${p}</p>`).join("");
  return (
    `<!doctype html><html><body>${body}` +
    `<p><a href="${esc(url)}">${esc(action)}</a></p>` +
    `<p>Or copy this link into your browser:<br>${esc(url)}</p>` +
    `<p>${esc(footer)}</p></body></html>`
  );
}

const IGNORE = "If you didn't ask for this, you can ignore this email.";

export function verificationEmail(url: string): EmailContent {
  const intro = "Confirm your email address to finish setting up your Roofy account.";
  return {
    subject: "Verify your email for Roofy",
    text: `${intro}\n\nOpen this link:\n${url}\n\n${IGNORE}\n`,
    html: page([esc(intro)], url, "Verify your email", IGNORE),
  };
}

export function resetEmail(url: string): EmailContent {
  const intro = "Use the link below to choose a new password for your Roofy account.";
  return {
    subject: "Reset your Roofy password",
    text: `${intro}\n\nOpen this link:\n${url}\n\n${IGNORE}\n`,
    html: page([esc(intro)], url, "Choose a new password", IGNORE),
  };
}

export function inviteEmail({ workspaceName, inviterName, role, url }: { workspaceName: string; inviterName: string; role: InviteRole; url: string }): EmailContent {
  const workspace = oneLine(workspaceName);
  const inviter = oneLine(inviterName);
  const intro = `${inviter} invited you to join ${workspace} on Roofy as ${ROLE_WORDS[role]}.`;
  return {
    subject: `${inviter} invited you to ${workspace} on Roofy`,
    text: `${intro}\n\nOpen this link to accept:\n${url}\n\n${IGNORE}\n`,
    html: page([esc(intro)], url, "Accept the invite", IGNORE),
  };
}
