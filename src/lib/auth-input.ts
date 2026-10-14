/** Checks on the sign-in and sign-up boxes, shared by the form and the fake auth service. Sentences are shown as written. */

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const EMAIL_MAX = 254;

export type AuthMode = "sign-in" | "sign-up";
export type AuthProblems = { email?: string; password?: string };

export function emailProblem(email: string): string | null {
  const value = email.trim();
  if (value === "") return "Enter your email address.";
  if (value.length > EMAIL_MAX) return "That email address is too long.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    return "Check your email address. It should look like name@example.com.";
  return null;
}

/** Signing in only needs something typed; signing up also needs a password worth keeping. */
export function passwordProblem(password: string, mode: AuthMode): string | null {
  if (password === "") return "Enter your password.";
  if (password.length > PASSWORD_MAX) return `Use ${PASSWORD_MAX} characters or fewer.`;
  if (mode === "sign-up" && password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  return null;
}

export function authProblems(mode: AuthMode, input: { email: string; password: string }): AuthProblems {
  const out: AuthProblems = {};
  const email = emailProblem(input.email);
  const password = passwordProblem(input.password, mode);
  if (email) out.email = email;
  if (password) out.password = password;
  return out;
}

/** Said when sign-in or sign-up fails for a reason that is not the person's doing. */
export const SIGN_IN_FAILED = "Couldn't sign you in. Try again.";

// The sign-in copy both auth services use (the fake and the real one, Task 12), so their refusals read the same.
export const WRONG_PASSWORD = "That email and password don't match. Check them and try again.";
/** Two-factor set-up asks for the password of the account that is already signed in, so no email in the sentence. */
export const WRONG_OWN_PASSWORD = "That password doesn't match. Check it and try again.";
export const EMAIL_TAKEN = "An account with that email already exists. Sign in instead.";
/** The one answer to "Send link", so it never reveals whether an email has an account. */
export const RESET_LINK_SENT =
  "If that email has an account, we've sent a link to set a new password. Check your email.";
export const LINK_EXPIRED = "This link has expired or was already used. Ask for a new one.";
export const TWO_FACTOR_CODE = "Enter the 6-digit code from your authenticator app.";
export const INVITE_GONE = "This invite has expired or was cancelled. Ask your manager for a new one.";
/** Signing in before the email is verified: a new link goes out with this answer. */
export const EMAIL_NOT_VERIFIED = "Verify your email first. We've sent you a new link.";
/** A 6-digit code that is not the current one. */
export const WRONG_CODE = "That code doesn't match. Enter the code your authenticator app shows now.";
/** A step that needs a sign-in in progress (two-factor) or a session (invite) when there is none. */
export const SIGN_IN_AGAIN = "Your sign-in has timed out. Sign in again.";
export const INVITE_OTHER_EMAIL =
  "This invite is for a different email. Sign in with the email it was sent to.";
export const GOOGLE_OFF = "Google sign-in isn't available yet. Use your email instead.";
export const TOO_MANY_TRIES = "Too many tries. Wait a minute, then try again.";

// "Send link", "Set password" and the email link landing: one sorry sentence each, for a service that is down.
export const RESET_SEND_FAILED = "Couldn't send the link. Try again.";
export const RESET_SET_FAILED = "Couldn't set your password. Try again.";
export const VERIFY_FAILED = "Couldn't check your link. Try again.";
export const PASSWORD_SET = "Your password is set. Sign in with it now.";

/** The new password from a reset link: the sign-up rules, with a blank box asking for a new one. */
export function newPasswordProblem(password: string): string | null {
  return password === "" ? "Enter a new password." : passwordProblem(password, "sign-up");
}

// Two-factor, invites and the unfinished-workspace screen.
export const TWO_FACTOR_FAILED = "Couldn't check your code. Try again.";
export const LINK_INCOMPLETE = "This link is incomplete. Open it again from your email.";
export const INVITE_LOAD_FAILED = "Couldn't load this invite. Try again.";
export const INVITE_FAILED = "Couldn't join the team. Try again.";
/** A non-owner member opens a workspace whose set-up the owner has not finished. */
export const OWNER_STILL_SETTING_UP = "The owner is still setting this up";

/** The 6-digit code box: blank asks for it, anything but six digits is the same plain sentence. */
export function codeProblem(code: string): string | null {
  return /^\d{6}$/.test(code.trim()) ? null : TWO_FACTOR_CODE;
}

/** The page the verification email's button opens: it checks the token itself, so the person lands in the app. */
export function verifyPageUrl(baseURL: string, token: string): string {
  return `${baseURL.replace(/\/+$/, "")}/verify?token=${encodeURIComponent(token)}`;
}
