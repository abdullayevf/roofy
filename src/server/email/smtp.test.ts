import nodemailer from "nodemailer";
import { describe, expect, it } from "vitest";
import { createSmtpMailer } from "./smtp";

describe("smtp mailer", () => {
  it("hands from, to, subject, text and html to the transport", async () => {
    const real = nodemailer.createTransport({ jsonTransport: true });
    let sent: Record<string, unknown> = {};
    const transport = {
      sendMail: async (options: Parameters<typeof real.sendMail>[0]) => {
        const info = await real.sendMail(options);
        sent = JSON.parse(info.message as string);
        return info;
      },
    };
    await createSmtpMailer({ transport, from: "Roofy <hello@roofy.test>" }).send({
      to: "a@b.test",
      subject: "Reset your Roofy password",
      text: "plain https://app.roofy.test/r",
      html: '<p><a href="https://app.roofy.test/r">go</a></p>',
    });
    expect(sent).toMatchObject({
      from: { name: "Roofy", address: "hello@roofy.test" },
      to: [{ address: "a@b.test", name: "" }],
      subject: "Reset your Roofy password",
      text: "plain https://app.roofy.test/r",
      html: '<p><a href="https://app.roofy.test/r">go</a></p>',
    });
  });

  it("lets a transport failure reach the caller", async () => {
    const transport = { sendMail: async () => Promise.reject(new Error("connection refused")) };
    await expect(
      createSmtpMailer({ transport, from: "hello@roofy.test" }).send({ to: "a@b.test", subject: "s", text: "t", html: "h" }),
    ).rejects.toThrow("connection refused");
  });
});
