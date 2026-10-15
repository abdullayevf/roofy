/**
 * Fake sign in and sign up (prototype). One demo account is known: Karen Holt, the seeded Owner, with the demo
 * password. Any other well-formed email signs in with a password of 8 or more characters, so a reviewer can try
 * their own address; a shorter password reads as a wrong one. Everyone who signs in is the Owner.
 */
import { DataError, type AuthService, type InviteDetails, type AuthSession, type FieldIssue, type SignInInput, type TwoFactorSetup } from "../../contracts";
import {
  authProblems,
  emailProblem,
  EMAIL_TAKEN,
  INVITE_GONE,
  LINK_EXPIRED,
  passwordProblem,
  PASSWORD_MIN,
  RESET_LINK_SENT,
  TOO_MANY_TRIES,
  TWO_FACTOR_CODE,
  WRONG_CODE,
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

/** Link tokens the prototype treats as spent: the design captures open `?token=expired` and `?token=used`. */
export const FAKE_DEAD_TOKENS: readonly string[] = ["expired", "used"];
const deadLink = (token: string) => token.trim() === "" || FAKE_DEAD_TOKENS.includes(token.trim());

/** Signing in with this email asks for a code next; the prototype takes any 6 digits except the two below. */
export const DEMO_TWO_FACTOR_EMAIL = "owner-2fa@harbourroofing.example";
export const FAKE_WRONG_CODE = "000000";
export const FAKE_LOCKED_CODE = "111111";
/** The key the settings page shows in the prototype (base32, as an authenticator app reads it). */
export const DEMO_TWO_FACTOR_SETUP: TwoFactorSetup = {
  secret: "RFY4 7KQ2 MZTD 3XWB",
  uri: "otpauth://totp/Roofy:karen%40harbourroofing.example?secret=RFY47KQ2MZTD3XWB&issuer=Roofy",
};
/** Invite ids the prototype treats as cancelled or expired; `long` is a team with a very long name. */
export const FAKE_DEAD_INVITES: readonly string[] = ["expired", "used", "cancelled"];
const LONG_TEAM = "Harbour and Bay Roofing and Waterproofing Contractors of the Northern Beaches";

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
      if (email === DEMO_TWO_FACTOR_EMAIL) return { role: "owner", next: "/two-factor" } satisfies AuthSession;
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
      if (deadLink(token)) throw new DataError("invalid", LINK_EXPIRED);
      return { role: "owner", next: "/onboarding" };
    },
    async requestPasswordReset(email) {
      const problem = emailProblem(email);
      if (problem) refuseField("email", problem);
      return { message: RESET_LINK_SENT };
    },
    async resetPassword(token, password) {
      if (deadLink(token)) throw new DataError("invalid", LINK_EXPIRED);
      const problem = passwordProblem(password, "sign-up");
      if (problem) refuseField("password", problem);
    },
    async verifyTwoFactor(code) {
      if (!/^\d{6}$/.test(code.trim())) refuseField("code", TWO_FACTOR_CODE);
      if (code.trim() === FAKE_WRONG_CODE) throw new DataError("invalid", WRONG_CODE);
      if (code.trim() === FAKE_LOCKED_CODE) throw new DataError("invalid", TOO_MANY_TRIES);
      return { role: "owner", next: "/" };
    },
    /** The prototype has no invite rows to read: an invite link joins Harbour Roofing as a foreman, the usual invite. */
    async inviteDetails(invitationId): Promise<InviteDetails> {
      const id = invitationId.trim();
      if (id === "" || FAKE_DEAD_INVITES.includes(id)) throw new DataError("invalid", INVITE_GONE);
      return { workspaceName: id === "long" ? LONG_TEAM : "Harbour Roofing", role: "foreman" };
    },
    /** The prototype's owner signed up with a password. */
    async hasPassword() {
      return true;
    },
    /** The prototype's fixed demo key; the QR code holds the same key. */
    async startTwoFactor() {
      return DEMO_TWO_FACTOR_SETUP;
    },
    async confirmTwoFactor(code) {
      if (!/^\d{6}$/.test(code.trim())) refuseField("code", TWO_FACTOR_CODE);
      if (code.trim() === FAKE_WRONG_CODE) throw new DataError("invalid", WRONG_CODE, [{ field: "code", message: WRONG_CODE }]);
    },
    async acceptInvite(invitationId) {
      if (invitationId.trim() === "" || FAKE_DEAD_INVITES.includes(invitationId.trim())) throw new DataError("invalid", INVITE_GONE);
      return { role: "foreman", next: "/" };
    },
  };
}
