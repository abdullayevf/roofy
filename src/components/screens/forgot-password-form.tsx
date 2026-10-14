"use client";

import { useState, useTransition } from "react";
import { requestPasswordReset } from "@/app/actions/auth";
import { RESET_SEND_FAILED, emailProblem } from "@/lib/auth-input";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";
import { Field } from "@/components/ui/field";
import type { AuthDemo } from "./auth-form";
import { NEEDS_CONNECTION, useOnline } from "./use-online";

/** "Send link": one answer, word for word, whether or not the email has an account, and it never repeats the email. */
export function ForgotPasswordForm({ demo }: { demo: AuthDemo }) {
  const online = useOnline(demo === "offline");
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const busy = pending || demo === "loading";

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !online) return;
    const found = emailProblem(email) ?? undefined;
    setProblem(found);
    setFormError(null);
    if (found) return (event.currentTarget.elements.namedItem("email") as HTMLInputElement | null)?.focus();
    if (demo === "error") return setFormError(RESET_SEND_FAILED);
    start(async () => {
      const result = await requestPasswordReset(email);
      if (result.ok) return setSent(result.message);
      const issue = result.issues.find((i) => i.field === "email");
      setProblem(issue?.message);
      setFormError(issue ? null : result.code === "unavailable" ? RESET_SEND_FAILED : result.message);
    });
  }

  return (
    <div className="entry-main flex flex-col gap-6">
      {!online ? (
        <p role="status" className="text-meta text-ink-2">
          {NEEDS_CONNECTION}
        </p>
      ) : null}
      {sent ? (
        <p role="status" className="text-body text-ink">
          {sent}
        </p>
      ) : (
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
          {formError ? (
            <div role="alert">
              <ErrorMessage>{formError}</ErrorMessage>
            </div>
          ) : null}
          <Button variant="primary" type="submit" loading={busy} loadingLabel="Sending link" disabled={!online}>
            Send link
          </Button>
        </form>
      )}
      <p className="flex flex-wrap items-center gap-x-2 text-body text-ink-2">
        Remembered it?
        <Button variant="link" href="/sign-in">
          Sign in
        </Button>
      </p>
    </div>
  );
}
