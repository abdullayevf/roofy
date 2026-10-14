"use client";

import { useState, useTransition } from "react";
import { requestPasswordReset } from "@/app/actions/auth";
import { RESET_SEND_FAILED, emailProblem } from "@/lib/auth-input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { AuthDemo } from "./auth-form";
import { DEMO_TYPED, EntryHeading, NeedsConnectionLine, ProblemNote, ResultNote, useCountdown } from "./entry-parts";
import { useOnline } from "./use-online";

/** Seconds before "Send again" works again, so a worried tap does not send a pile of links. */
export const RESEND_SECONDS = 30;

/**
 * "Send link": one answer, word for word, whether or not the email has an account, and it never repeats the email.
 * The answer replaces the form's heading and instruction, and offers "Send again" (after a wait) and a different email.
 * The `error` demo shows the sorry sentence on arrival, with the button reading "Try again".
 */
export function ForgotPasswordForm({ demo }: { demo: AuthDemo }) {
  const online = useOnline(demo === "offline");
  const [pending, start] = useTransition();
  const { left, start: startWait } = useCountdown();
  // The error and loading demos stand for "after Send link was tapped", so the box holds what was typed (auth i2 D26 + F19).
  const [email, setEmail] = useState(demo === "error" || demo === "loading" ? DEMO_TYPED.email : "");
  const [problem, setProblem] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(demo === "error" ? RESET_SEND_FAILED : null);
  const [sent, setSent] = useState<string | null>(null);
  const busy = pending || demo === "loading";

  function send(found: string) {
    start(async () => {
      const result = await requestPasswordReset(found);
      if (result.ok) {
        setSent(result.message);
        setFormError(null);
        return startWait(RESEND_SECONDS);
      }
      const issue = result.issues.find((i) => i.field === "email");
      setProblem(issue?.message);
      setFormError(issue ? null : result.code === "unavailable" ? RESET_SEND_FAILED : result.message);
    });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !online) return;
    const found = emailProblem(email) ?? undefined;
    setProblem(found);
    setFormError(null);
    if (found) return (event.currentTarget.elements.namedItem("email") as HTMLInputElement | null)?.focus();
    if (demo === "error") return setFormError(RESET_SEND_FAILED);
    send(email);
  }

  const signInLine = (
    <p className="flex flex-wrap items-center gap-x-2 text-body text-ink-2">
      Remembered it?
      <Button variant="link" href="/sign-in">
        Sign in
      </Button>
    </p>
  );

  if (sent) {
    return (
      <>
        <EntryHeading title="Check your email" />
        <div className="entry-main flex flex-col gap-6">
          <ResultNote>{sent}</ResultNote>
          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              loading={busy}
              loadingLabel="Sending link"
              disabled={left > 0 || !online}
              onClick={() => send(email)}
            >
              {left > 0 ? `Send again in ${left} s` : "Send again"}
            </Button>
            {!online ? <NeedsConnectionLine /> : null}
            {formError ? <ProblemNote>{formError}</ProblemNote> : null}
            <Button
              variant="secondary"
              onClick={() => {
                setSent(null);
                setFormError(null);
              }}
            >
              Use a different email
            </Button>
          </div>
          {signInLine}
        </div>
      </>
    );
  }

  return (
    <>
      <EntryHeading
        title="Forgot your password?"
        intro="Enter your email and we'll send a link to set a new one."
      />
      <div className="entry-main flex flex-col gap-6">
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          <Field
            name="email"
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={problem}
            disabled={busy}
          />
          {formError ? <ProblemNote>{formError}</ProblemNote> : null}
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              type="submit"
              loading={busy}
              loadingLabel="Sending link"
              disabled={!online}
              dim
            >
              {formError === RESET_SEND_FAILED ? "Try again" : "Send link"}
            </Button>
            {!online ? <NeedsConnectionLine /> : null}
          </div>
        </form>
        {signInLine}
      </div>
    </>
  );
}
