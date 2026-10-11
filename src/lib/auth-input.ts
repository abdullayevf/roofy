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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Check your email address. It should look like name@example.com.";
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
