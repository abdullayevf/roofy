"use client";

import { useState, useTransition } from "react";
import { resetPassword } from "@/app/actions/auth";
import { LINK_EXPIRED, PASSWORD_SET, RESET_SET_FAILED, newPasswordProblem } from "@/lib/auth-input";
import { Button } from "@/components/ui/button";
import type { AuthDemo } from "./auth-form";
import { EntryHeading, NeedsConnectionLine, PasswordField, ProblemNote, ResultNote } from "./entry-parts";
import { useOnline } from "./use-online";

/** The link is no good: said once, with the one way forward. */
function LinkGone() {
  return (
    <>
      <EntryHeading title="Link expired" />
      <div className="entry-main flex flex-col gap-4">
        <ProblemNote>{LINK_EXPIRED}</ProblemNote>
        <Button variant="primary" href="/forgot-password">
          Ask for a new link
        </Button>
      </div>
    </>
  );
}

/**
 * "Set password": the new password from the reset link. Afterwards the person signs in again. The `error` demo shows
 * the sorry sentence on arrival, with the button reading "Try again".
 */
export function ResetPasswordForm({ token, demo }: { token: string | null; demo: AuthDemo }) {
  const online = useOnline(demo === "offline");
  const [pending, start] = useTransition();
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(demo === "error" ? RESET_SET_FAILED : null);
  const [state, setState] = useState<"form" | "gone" | "done">("form");
  const busy = pending || demo === "loading";

  if (!token || token.trim() === "" || state === "gone") return <LinkGone />;
  if (state === "done") {
    return (
      <>
        <EntryHeading title="Password changed" />
        <div className="entry-main flex flex-col gap-4">
          <ResultNote>{PASSWORD_SET}</ResultNote>
          <Button variant="primary" href="/sign-in">
            Sign in
          </Button>
        </div>
      </>
    );
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !online || !token) return;
    const found = newPasswordProblem(password) ?? undefined;
    setProblem(found);
    setFormError(null);
    if (found)
      return (event.currentTarget.elements.namedItem("password") as HTMLInputElement | null)?.focus();
    if (demo === "error") return setFormError(RESET_SET_FAILED);
    start(async () => {
      const result = await resetPassword(token, password);
      if (result.ok) return setState("done");
      const issue = result.issues.find((i) => i.field === "password");
      if (issue) return setProblem(issue.message);
      if (result.message === LINK_EXPIRED) return setState("gone");
      setFormError(result.code === "unavailable" ? RESET_SET_FAILED : result.message);
    });
  }

  return (
    <>
      <EntryHeading title="Choose a new password" intro="Set a new password for your Roofy account." />
      <div className="entry-main flex flex-col gap-6">
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          <PasswordField
            name="password"
            label="New password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="At least 8 characters"
            error={problem}
            disabled={busy}
          />
          {formError ? <ProblemNote>{formError}</ProblemNote> : null}
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              type="submit"
              loading={busy}
              loadingLabel="Setting password"
              disabled={!online}
              dim
            >
              {formError === RESET_SET_FAILED ? "Try again" : "Set password"}
            </Button>
            {!online ? <NeedsConnectionLine /> : null}
          </div>
        </form>
      </div>
    </>
  );
}
