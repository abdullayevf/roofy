/**
 * Fake sign in and sign up (prototype). One demo account is known: Karen Holt, the seeded Owner, with the demo
 * password. Any other well-formed email signs in with a password of 8 or more characters, so a reviewer can try
 * their own address; a shorter password reads as a wrong one. Everyone who signs in is the Owner.
 */
import { DataError, type AuthService, type AuthSession, type FieldIssue, type SignInInput } from "../../contracts";
import { authProblems, type AuthMode, PASSWORD_MIN } from "@/lib/auth-input";

export const DEMO_OWNER_EMAIL = "karen@harbourroofing.example";
export const DEMO_PASSWORD = "roofy-demo";

export const WRONG_PASSWORD = "That email and password don't match. Check them and try again.";
export const EMAIL_TAKEN = "An account with that email already exists. Sign in instead.";

const normal = (email: string) => email.trim().toLowerCase();

function check(mode: AuthMode, input: SignInInput): void {
  const problems = authProblems(mode, input);
  const issues: FieldIssue[] = [];
  if (problems.email) issues.push({ field: "email", message: problems.email });
  if (problems.password) issues.push({ field: "password", message: problems.password });
  if (issues.length > 0) throw new DataError("invalid", issues[0]!.message, issues);
}

export function createFakeAuth(): AuthService {
  return {
    async signIn(input) {
      check("sign-in", input);
      const email = normal(input.email);
      const known = email === DEMO_OWNER_EMAIL ? input.password === DEMO_PASSWORD : input.password.length >= PASSWORD_MIN;
      if (!known) throw new DataError("invalid", WRONG_PASSWORD);
      return { role: "owner", next: "/" } satisfies AuthSession;
    },
    async signUp(input) {
      check("sign-up", input);
      if (normal(input.email) === DEMO_OWNER_EMAIL)
        throw new DataError("invalid", EMAIL_TAKEN, [{ field: "email", message: EMAIL_TAKEN }]);
      return { role: "owner", next: "/onboarding" } satisfies AuthSession;
    },
    async continueWithGoogle(mode) {
      return { role: "owner", next: mode === "sign-up" ? "/onboarding" : "/" };
    },
  };
}
