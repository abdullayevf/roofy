/**
 * Fake sign in and sign up (prototype). One demo account is known: Karen Holt, the seeded Owner, with the demo
 * password. Any other well-formed email signs in with a password of 8 or more characters, so a reviewer can try
 * their own address; a shorter password reads as a wrong one. Everyone who signs in is the Owner.
 */
import { DataError, type AuthService, type AuthSession, type FieldIssue, type SignInInput } from "../../contracts";
import {
  authProblems,
  emailProblem,
  EMAIL_TAKEN,
  INVITE_GONE,
  LINK_EXPIRED,
  passwordProblem,
  PASSWORD_MIN,
  RESET_LINK_SENT,
  TWO_FACTOR_CODE,
  WRONG_PASSWORD,
  type AuthMode,
} from "@/lib/auth-input";

export const DEMO_OWNER_EMAIL = "karen@harbourroofing.example";
export const DEMO_PASSWORD = "roofy-demo";

export {
  EMAIL_NOT_VERIFIED,
  EMAIL_TAKEN,
  INVITE_GONE,
  LINK_EXPIRED,
  RESET_LINK_SENT,
  TWO_FACTOR_CODE,
  WRONG_PASSWORD,
} from "@/lib/auth-input";

const normal = (email: string) => email.trim().toLowerCase();

function refuseField(field: string, message: string): never {
  throw new DataError("invalid", message, [{ field, message }]);
}

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
    async verifyEmail(token) {
      if (token.trim() === "") throw new DataError("invalid", LINK_EXPIRED);
      return { role: "owner", next: "/onboarding" };
    },
    async requestPasswordReset(email) {
      const problem = emailProblem(email);
      if (problem) refuseField("email", problem);
      return { message: RESET_LINK_SENT };
    },
    async resetPassword(token, password) {
      if (token.trim() === "") throw new DataError("invalid", LINK_EXPIRED);
      const problem = passwordProblem(password, "sign-up");
      if (problem) refuseField("password", problem);
    },
    async verifyTwoFactor(code) {
      if (!/^\d{6}$/.test(code.trim())) refuseField("code", TWO_FACTOR_CODE);
      return { role: "owner", next: "/" };
    },
    /** The prototype has no invite rows to read: an invite link joins as a foreman, the usual invite. */
    async acceptInvite(invitationId) {
      if (invitationId.trim() === "") throw new DataError("invalid", INVITE_GONE);
      return { role: "foreman", next: "/" };
    },
  };
}
