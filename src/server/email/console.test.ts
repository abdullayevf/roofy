import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConsoleMailer, linksIn } from "./console";

let dir: string;
let log: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "roofy-mail-"));
  log = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

const message = (over: Partial<{ to: string; subject: string; text: string; html: string }> = {}) => ({
  to: "a@b.test",
  subject: "Verify your email for Roofy",
  text: "Open this link:\nhttps://app.roofy.test/verify?token=1&x=2\n\nThen also https://app.roofy.test/second.",
  html: "<p>SECRET-HTML-MARKER</p>",
  ...over,
});

describe("linksIn", () => {
  it("returns every http(s) url in order, without trailing punctuation", () => {
    expect(linksIn("a https://x.test/a?b=1&c=2, then http://y.test/z. end")).toEqual([
      "https://x.test/a?b=1&c=2",
      "http://y.test/z",
    ]);
    expect(linksIn("no links here")).toEqual([]);
  });
});

describe("console mailer", () => {
  it("appends exactly one JSON line {to, subject, text, links} per send when a log file is set", async () => {
    const file = join(dir, "mail.jsonl");
    const mailer = createConsoleMailer({ logFile: file });
    await mailer.send(message());
    const lines = (await readFile(file, "utf8")).split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("");
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      to: "a@b.test",
      subject: "Verify your email for Roofy",
      text: message().text,
      links: ["https://app.roofy.test/verify?token=1&x=2", "https://app.roofy.test/second"],
    });
  });

  it("appends one line per send, in order, and creates the folder", async () => {
    const file = join(dir, "nested", "mail.jsonl");
    const mailer = createConsoleMailer({ logFile: file });
    await mailer.send(message({ to: "one@b.test" }));
    await mailer.send(message({ to: "two@b.test" }));
    const lines = (await readFile(file, "utf8")).trimEnd().split("\n");
    expect(lines.map((l) => JSON.parse(l).to)).toEqual(["one@b.test", "two@b.test"]);
  });

  it("never writes the html, to the file or to the console", async () => {
    const file = join(dir, "mail.jsonl");
    await createConsoleMailer({ logFile: file }).send(message());
    expect(await readFile(file, "utf8")).not.toContain("SECRET-HTML-MARKER");
    expect(log.mock.calls.flat().join("\n")).not.toContain("SECRET-HTML-MARKER");
  });

  it("prints the message to the console", async () => {
    await createConsoleMailer({}).send(message());
    const printed = log.mock.calls.flat().join("\n");
    expect(printed).toContain("a@b.test");
    expect(printed).toContain("Verify your email for Roofy");
    expect(printed).toContain("https://app.roofy.test/verify?token=1&x=2");
  });

  it("writes to no file without a log file", async () => {
    await createConsoleMailer({}).send(message());
    expect(await readdir(dir)).toEqual([]);
  });
});
