import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMailer } from "./index";

const MSG = { to: "a@b.test", subject: "s", text: "see https://app.roofy.test/x", html: "<p>h</p>" };

beforeEach(() => {
  for (const name of ["ROOFY_MAIL", "SMTP_URL", "MAIL_FROM", "ROOFY_MAIL_LOG"]) vi.stubEnv(name, "");
  vi.stubEnv("NODE_ENV", "test");
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getMailer", () => {
  it("uses the console transport when ROOFY_MAIL is unset in dev and test", async () => {
    await getMailer().send(MSG);
    expect(console.log).toHaveBeenCalled();
    vi.stubEnv("NODE_ENV", "development");
    await getMailer().send(MSG);
  });

  it("uses the console transport when ROOFY_MAIL=console, in production too", async () => {
    vi.stubEnv("ROOFY_MAIL", "console");
    vi.stubEnv("NODE_ENV", "production");
    await getMailer().send(MSG);
    expect(console.log).toHaveBeenCalled();
  });

  it("reads ROOFY_MAIL_LOG at call time", async () => {
    const dir = await mkdtemp(join(tmpdir(), "roofy-mail-"));
    try {
      vi.stubEnv("ROOFY_MAIL_LOG", join(dir, "m.jsonl"));
      await getMailer().send(MSG);
      const line = JSON.parse((await readFile(join(dir, "m.jsonl"), "utf8")).trim());
      expect(line).toEqual({ to: "a@b.test", subject: "s", text: MSG.text, links: ["https://app.roofy.test/x"] });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("throws a plain error in production when ROOFY_MAIL is unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getMailer()).toThrow("ROOFY_MAIL is not set. Set it to smtp (or console) in .env (see .env.example).");
  });

  it("throws a plain error naming ROOFY_MAIL for an unknown value", () => {
    vi.stubEnv("ROOFY_MAIL", "carrier-pigeon");
    expect(() => getMailer()).toThrow('ROOFY_MAIL must be "console" or "smtp", not "carrier-pigeon".');
  });

  it("with ROOFY_MAIL=smtp, builds without SMTP_URL but throws at the first send", async () => {
    vi.stubEnv("ROOFY_MAIL", "smtp");
    vi.stubEnv("MAIL_FROM", "Roofy <hello@roofy.test>");
    const mailer = getMailer();
    await expect(mailer.send(MSG)).rejects.toThrow("SMTP_URL is not set. Add it to .env (see .env.example).");
  });

  it("with ROOFY_MAIL=smtp, requires MAIL_FROM at the first send", async () => {
    vi.stubEnv("ROOFY_MAIL", "smtp");
    vi.stubEnv("SMTP_URL", "smtp://127.0.0.1:1");
    await expect(getMailer().send(MSG)).rejects.toThrow("MAIL_FROM is not set. Add it to .env (see .env.example).");
  });

  it("with ROOFY_MAIL=smtp and both set, sends through SMTP and surfaces a connection failure", async () => {
    vi.stubEnv("ROOFY_MAIL", "smtp");
    vi.stubEnv("SMTP_URL", "smtp://127.0.0.1:1");
    vi.stubEnv("MAIL_FROM", "hello@roofy.test");
    await expect(getMailer().send(MSG)).rejects.toThrow();
    expect(console.log).not.toHaveBeenCalled();
  });
});
