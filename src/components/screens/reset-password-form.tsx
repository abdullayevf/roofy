"use client";

import { useState, useTransition } from "react";
import { resetPassword } from "@/app/actions/auth";
import { LINK_EXPIRED, PASSWORD_SET, RESET_SET_FAILED, newPasswordProblem } from "@/lib/auth-input";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";
import { Field } from "@/components/ui/field";
import type { AuthDemo } from "./auth-form";
import { NEEDS_CONNECTION, useOnline } from "./use-online";

/** The link is no good: said once, with the one way forward. */
function LinkGone() {
  return (
    <div className="entry-main flex flex-col gap-4">
      <div role="alert">
        <ErrorMessage>{LINK_EXPIRED}</ErrorMessage>
      </div>
      <Button variant="primary" href="/forgot-password">
        Ask for a new link
      </Button>
    </div>
  );
}

/** "Set password": the new password from the reset link. Afterwards the person signs in again. */
export function ResetPasswordForm({ token, demo }: { token: string | null; demo: AuthDemo }) {
  const online = useOnline(demo === "offline");
  const [pending, start] = useTransition();
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [state, setState] = useState<"form" | "gone" | "done">("form");
  const busy = pending || demo === "loading";

  if (!token || token.trim() === "" || state === "gone") return <LinkGone />;
  if (state === "done") {
    return (
      <div className="entry-main flex flex-col gap-4">
        <p role="status" className="text-body text-ink">
          {PASSWORD_SET}
        </p>
        <Button variant="primary" href="/sign-in">
          Sign in
        </Button>
      </div>
    );
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !online || !token) return;
    const found = newPasswordProblem(password) ?? undefined;
    setProblem(found);
    setFormError(null);
    if (found) return (event.currentTarget.elements.namedItem("password") as HTMLInputElement | null)?.focus();
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
    <div className="entry-main flex flex-col gap-6">
      {!online ? (
        <p role="status" className="text-meta text-ink-2">
          {NEEDS_CONNECTION}
        </p>
      ) : null}
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <Field
          name="password"
          label="New password"
          type="password"
          inputMode="text"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="At least 8 characters"
          error={problem}
          disabled={busy}
        />
        {formError ? (
          <div role="alert">
            <ErrorMessage>{formError}</ErrorMessage>
          </div>
        ) : null}
        <Button variant="primary" type="submit" loading={busy} loadingLabel="Setting password" disabled={!online}>
          Set password
        </Button>
      </form>
    </div>
  );
}
