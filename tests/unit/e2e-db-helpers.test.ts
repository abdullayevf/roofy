import { appendFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { E2E_BASE_URL, E2E_DB_NAME, e2eDatabaseUrls, e2eServerEnv, withDatabase } from "../e2e-db/env";
import { mailCount, mailLink, newestMail, readMail, waitForMail } from "../e2e-db/mail";
import { projectArgs, selection } from "../e2e-db/select";
import { base32Decode, totpCode } from "../e2e-db/totp";

// RFC 6238 appendix B, SHA-1: the key is the ASCII "12345678901234567890", shown here in base32.
const RFC_KEY = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("e2e-db totp helper", () => {
  it("decodes base32 whatever the spacing and case", () => {
    expect(base32Decode(RFC_KEY).toString("ascii")).toBe("12345678901234567890");
    expect(base32Decode("gezd gnbv gy3t qojq gezd gnbv gy3t qojq").toString("ascii")).toBe("12345678901234567890");
    expect(() => base32Decode("GEZ1")).toThrow(/not a base32 character/);
  });

  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
  ])("matches the RFC 6238 vector at %i s", (seconds, eightDigits) => {
    expect(totpCode(RFC_KEY, { nowMs: seconds * 1000, digits: 8 })).toBe(eightDigits);
    expect(totpCode(RFC_KEY, { nowMs: seconds * 1000 })).toBe(eightDigits.slice(2));
  });

  it("changes only when the 30 second step does", () => {
    expect(totpCode(RFC_KEY, { nowMs: 30_000 })).toBe(totpCode(RFC_KEY, { nowMs: 59_999 }));
    expect(totpCode(RFC_KEY, { nowMs: 59_999 })).not.toBe(totpCode(RFC_KEY, { nowMs: 60_000 }));
  });
});

describe("e2e-db mail log reader", () => {
  const dir = mkdtempSync(join(tmpdir(), "roofy-mail-"));
  const line = (to: string, subject: string, link: string) => JSON.stringify({ to, subject, text: link, links: [link] });

  it("reads nothing from a missing file and skips a half-written line", () => {
    expect(readMail(join(dir, "none.jsonl"))).toEqual([]);
    const file = join(dir, "half.jsonl");
    writeFileSync(file, `${line("a@x.example", "Verify", "http://l/1")}\n{"to":"b@x.example","sub`);
    expect(readMail(file).map((m) => m.to)).toEqual(["a@x.example"]);
  });

  it("returns the newest link for an address, case-insensitively, and only mail after a count", async () => {
    const file = join(dir, "mail.jsonl");
    writeFileSync(file, `${line("Ann@x.example", "Verify your email", "http://l/old")}\n${line("bob@x.example", "Verify", "http://l/bob")}\n`);
    expect(await mailLink("ann@x.example", { file })).toBe("http://l/old");
    const before = mailCount(file);
    appendFileSync(file, `${line("ann@x.example", "Reset your password", "http://l/new")}\n`);
    expect(newestMail("ann@x.example", { file })?.links[0]).toBe("http://l/new");
    expect(newestMail("ann@x.example", { file, after: before, subject: /Verify/ })).toBeUndefined();
    expect(await mailLink("ann@x.example", { file, after: before })).toBe("http://l/new");
  });

  it("waits for a mail that arrives, and times out with the address in the error", async () => {
    const file = join(dir, "late.jsonl");
    setTimeout(() => writeFileSync(file, `${line("late@x.example", "Invite", "http://l/late")}\n`), 150);
    expect((await waitForMail("late@x.example", { file, intervalMs: 20 })).links).toEqual(["http://l/late"]);
    await expect(waitForMail("nobody@x.example", { file, timeoutMs: 60, intervalMs: 20 })).rejects.toThrow(/nobody@x\.example/);
  });
});

describe("e2e-db environment and project selection", () => {
  it("points all three roles of the TEST_* set at roofy_e2e and nothing else", () => {
    const source = {
      TEST_DATABASE_URL: "postgres://roofy_app:pw1@127.0.0.1:5440/roofy_test",
      TEST_AUTH_DATABASE_URL: "postgres://roofy_auth:pw2@127.0.0.1:5440/roofy_test",
      TEST_MIGRATE_DATABASE_URL: "postgres://roofy:pw3@127.0.0.1:5440/roofy_test",
      DATABASE_URL: "postgres://roofy_app:pw1@127.0.0.1:5440/roofy_dev",
    };
    expect(e2eDatabaseUrls(source)).toEqual({
      DATABASE_URL: "postgres://roofy_app:pw1@127.0.0.1:5440/roofy_e2e",
      AUTH_DATABASE_URL: "postgres://roofy_auth:pw2@127.0.0.1:5440/roofy_e2e",
      MIGRATE_DATABASE_URL: "postgres://roofy:pw3@127.0.0.1:5440/roofy_e2e",
    });
    expect(e2eDatabaseUrls({})).toEqual({});
    expect(withDatabase("postgres://u:p@h:5/roofy_dev", E2E_DB_NAME)).toBe("postgres://u:p@h:5/roofy_e2e");
  });

  it("runs the server in db mode on 3101 with the mail log and a trusted origin", () => {
    const env = e2eServerEnv({}, "/work/roofy");
    expect(env).toMatchObject({
      ROOFY_DATA: "db",
      ROOFY_MAIL: "console",
      ROOFY_MAIL_LOG: "/work/roofy/.superpowers/run/mail.jsonl",
      BETTER_AUTH_URL: E2E_BASE_URL,
    });
    expect(E2E_BASE_URL).toBe("http://127.0.0.1:3101");
    expect((env.BETTER_AUTH_SECRET ?? "").length).toBeGreaterThanOrEqual(32);
  });

  it("adds the db projects and server only when a db-* project is named", () => {
    expect(projectArgs(["node", "pw", "test", "--project=iphone", "--project", "db-android", "--project=a,b"])).toEqual(["iphone", "db-android", "a", "b"]);
    expect(selection(["test"], {})).toEqual({ db: false, fake: true });
    expect(selection(["test", "--project=iphone", "--project=android"], {})).toEqual({ db: false, fake: true });
    expect(selection(["test", "--project=db-iphone"], {})).toEqual({ db: true, fake: false });
    expect(selection(["test", "--project=iphone", "--project=db-desktop"], {})).toEqual({ db: true, fake: true });
    expect(selection(["worker"], { ROOFY_DB_PROJECTS: "1" }).db).toBe(true);
  });
});
