import { describe, expect, it } from "vitest";
import { inviteEmail, resetEmail, verificationEmail } from "./templates";

const URL_WITH_AMP = "https://app.roofy.test/verify?token=abc123&next=%2Fhome";
const HREF_WITH_AMP = "https://app.roofy.test/verify?token=abc123&amp;next=%2Fhome";
const MONEY = /\$|\b(dollars?|aud|amounts?|rates?|budgets?|margins?|balances?|prices?|invoices?|wages?|salary)\b/i;

const invite = (over: Partial<Parameters<typeof inviteEmail>[0]> = {}) =>
  inviteEmail({
    workspaceName: "Smith Roofing",
    inviterName: "Sam Smith",
    role: "foreman",
    url: "https://app.roofy.test/invite/inv-1",
    ...over,
  });

describe("verificationEmail", () => {
  it("has the link in both the text and the html, and a sentence-case subject", () => {
    const m = verificationEmail(URL_WITH_AMP);
    expect(m.subject).toBe("Verify your email for Roofy");
    expect(m.text).toContain(URL_WITH_AMP);
    expect(m.html).toContain(`href="${HREF_WITH_AMP}"`);
    expect(m.html).not.toContain(`"${URL_WITH_AMP}"`);
  });

  it("carries no money", () => {
    const m = verificationEmail(URL_WITH_AMP);
    expect(`${m.subject} ${m.text} ${m.html}`).not.toMatch(MONEY);
  });
});

describe("resetEmail", () => {
  it("has the link in both the text and the html, and a sentence-case subject", () => {
    const m = resetEmail(URL_WITH_AMP);
    expect(m.subject).toBe("Reset your Roofy password");
    expect(m.text).toContain(URL_WITH_AMP);
    expect(m.html).toContain(`href="${HREF_WITH_AMP}"`);
  });

  it("tells the reader they can ignore it, and carries no money", () => {
    const m = resetEmail(URL_WITH_AMP);
    expect(m.text).toMatch(/ignore this email/i);
    expect(`${m.subject} ${m.text} ${m.html}`).not.toMatch(MONEY);
  });
});

describe("inviteEmail", () => {
  it("names the workspace, the inviter and the role in plain words, with the link in both parts", () => {
    const m = invite();
    expect(m.subject).toBe("Sam Smith invited you to Smith Roofing on Roofy");
    for (const part of [m.text, m.html]) {
      expect(part).toContain("Smith Roofing");
      expect(part).toContain("Sam Smith");
      expect(part).toMatch(/as a foreman/);
    }
    expect(m.text).toContain("https://app.roofy.test/invite/inv-1");
    expect(m.html).toContain('href="https://app.roofy.test/invite/inv-1"');
  });

  it("uses a role label with the right article, never the enum key on its own line", () => {
    expect(invite({ role: "owner" }).text).toMatch(/as an owner/);
    expect(invite({ role: "accountant" }).text).toMatch(/as an accountant/);
    expect(invite({ role: "manager" }).text).toMatch(/as a manager/);
  });

  it("escapes interpolated values in the html, and the url in the href", () => {
    const m = invite({
      workspaceName: 'Tom & "Co" <Roofing>',
      inviterName: "<b>Eve</b> O'Neil",
      url: 'https://app.roofy.test/invite/1?a=1&b="2"',
    });
    expect(m.html).toContain("Tom &amp; &quot;Co&quot; &lt;Roofing&gt;");
    expect(m.html).toContain("&lt;b&gt;Eve&lt;/b&gt; O&#39;Neil");
    expect(m.html).toContain('href="https://app.roofy.test/invite/1?a=1&amp;b=&quot;2&quot;"');
    expect(m.html).not.toContain("<b>Eve</b>");
    expect(m.html).not.toContain("<Roofing>");
  });

  it("keeps the text raw (no html escaping) and the subject on one line", () => {
    const m = invite({ workspaceName: "Tom & Co", inviterName: "Eve\r\nBcc: x@y.test" });
    expect(m.text).toContain("Tom & Co");
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(m.subject).toBe("Eve Bcc: x@y.test invited you to Tom & Co on Roofy");
  });

  it("carries no money", () => {
    const m = invite();
    expect(`${m.subject} ${m.text} ${m.html}`).not.toMatch(MONEY);
  });
});
