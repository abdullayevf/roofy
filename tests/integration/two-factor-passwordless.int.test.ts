/**
 * A Google-only owner (no password on the account) can turn on two-factor (review S1 + R3).
 * Better Auth only skips the password check with `allowPasswordless`; the service must also say
 * whether the account has a password so set-up knows whether to ask.
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DataError } from "@/data/contracts";
import { WRONG_OWN_PASSWORD } from "@/lib/auth-input";
import { getAuth } from "@/server/auth/auth";
import { createDbAuth } from "@/server/services/auth";
import { closePools, rows } from "./helpers";

const PASSWORD = "correct horse battery";
let mailLog = "";

function tokenFromMail(to: string): string {
  const lines = existsSync(mailLog) ? readFileSync(mailLog, "utf8").split("\n").filter(Boolean) : [];
  const mail = lines.map((l) => JSON.parse(l) as { to: string; links: string[] }).filter((m) => m.to === to).at(-1);
  const url = new URL(mail?.links[0] ?? "");
  return url.searchParams.get("token") ?? url.pathname.split("/").pop() ?? "";
}
function base32Decode(text: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of text.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  return Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2))).toString("utf8");
}

/** One browser: its cookies, and the sign-in service bound to them. */
function browser() {
  const cookies = new Map<string, string>();
  const headers = () => new Headers({ cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") });
  const service = createDbAuth({
    auth: getAuth,
    requestHeaders: async () => headers(),
    keepCookies: (h) => {
      for (const c of h.getSetCookie()) {
        const pair = c.split(";")[0] ?? "";
        const at = pair.indexOf("=");
        const [k, v] = [pair.slice(0, at), pair.slice(at + 1)];
        if (v === "" || /max-age=0\b/i.test(c)) cookies.delete(k);
        else cookies.set(k, v);
      }
    },
  });
  return { service };
}

async function refusal(p: Promise<unknown>): Promise<DataError> {
  try {
    await p;
  } catch (e) {
    if (e instanceof DataError) return e;
    throw e;
  }
  throw new Error("expected a refusal");
}

let n = 0;
/** Signed in and verified; `googleOnly` removes the password account, as a Google sign-up leaves it. */
async function signedIn(googleOnly: boolean) {
  const email = `pwless${Date.now()}${n++}@example.com`;
  const b = browser();
  await b.service.signUp({ email, password: PASSWORD });
  await b.service.verifyEmail(tokenFromMail(email));
  const [user] = await rows<{ id: string }>("owner", `select id from "user" where email = $1`, [email]);
  if (googleOnly) await rows("owner", `delete from account where user_id = $1 and provider_id = 'credential'`, [user!.id]);
  return { b, userId: user!.id };
}

describe("two-factor set-up without a password (S1, R3)", () => {
  beforeAll(() => {
    process.env.BETTER_AUTH_SECRET = randomBytes(32).toString("hex");
    process.env.BETTER_AUTH_URL = "http://localhost:3100";
    process.env.ROOFY_MAIL = "console";
    mailLog = join(mkdtempSync(join(tmpdir(), "roofy-2fa-pwless-")), "mail.jsonl");
    process.env.ROOFY_MAIL_LOG = mailLog;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
  });
  afterAll(async () => {
    await closePools();
  });

  it("a Google-only account has no password, reaches the QR step with a blank password and turns two-factor on", async () => {
    const { b, userId } = await signedIn(true);
    expect(await b.service.hasPassword()).toBe(false);
    const setup = await b.service.startTwoFactor("");
    expect(setup.uri).toMatch(/^otpauth:\/\/totp\//);
    const secret = new URL(setup.uri).searchParams.get("secret") ?? "";
    const { code } = await getAuth().api.generateTOTP({ body: { secret: base32Decode(secret) } });
    await b.service.confirmTwoFactor(code);
    const [row] = await rows<{ two_factor_enabled: boolean }>("owner", `select two_factor_enabled from "user" where id = $1`, [userId]);
    expect(row!.two_factor_enabled).toBe(true);
  });

  it("an account with a password still has to type it: a blank one is refused and hasPassword says true", async () => {
    const { b } = await signedIn(false);
    expect(await b.service.hasPassword()).toBe(true);
    const blank = await refusal(b.service.startTwoFactor(""));
    expect([blank.code, blank.issues]).toEqual(["invalid", [{ field: "password", message: WRONG_OWN_PASSWORD }]]);
    expect((await b.service.startTwoFactor(PASSWORD)).uri).toMatch(/^otpauth:\/\/totp\//);
  });

  it("hasPassword needs a sign-in", async () => {
    const e = await refusal(browser().service.hasPassword());
    expect(e.code).toBe("invalid");
  });
});
