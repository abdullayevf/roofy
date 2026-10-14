"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { verifyTwoFactor } from "@/app/actions/auth";
import { TWO_FACTOR_FAILED, WRONG_CODE, codeProblem } from "@/lib/auth-input";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";
import { Field } from "@/components/ui/field";
import type { AuthDemo } from "./auth-form";
import { NEEDS_CONNECTION, useOnline } from "./use-online";

/** "Check code": the sign-in's second step. A wrong code marks the box; too many tries and an outage say so once, above the button. */
export function TwoFactorStep({ demo }: { demo: AuthDemo }) {
  const router = useRouter();
  const online = useOnline(demo === "offline");
  const [pending, start] = useTransition();
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const busy = pending || demo === "loading";

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !online) return;
    const found = codeProblem(code) ?? undefined;
    setProblem(found);
    setFormError(null);
    if (found) return (event.currentTarget.elements.namedItem("code") as HTMLInputElement | null)?.focus();
    if (demo === "error") return setFormError(TWO_FACTOR_FAILED);
    start(async () => {
      const result = await verifyTwoFactor(code.trim());
      if (result.ok) return router.push(result.next);
      const issue = result.issues.find((i) => i.field === "code");
      if (issue || result.message === WRONG_CODE) return setProblem(issue?.message ?? result.message);
      setFormError(result.code === "unavailable" ? TWO_FACTOR_FAILED : result.message);
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
          name="code"
          label="Code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoCapitalize="none"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          hint="The 6 digits in your authenticator app"
          error={problem}
          disabled={busy}
        />
        {formError ? (
          <div role="alert">
            <ErrorMessage>{formError}</ErrorMessage>
          </div>
        ) : null}
        <Button
          variant="primary"
          type="submit"
          loading={busy}
          loadingLabel="Checking code"
          disabled={!online}
        >
          Check code
        </Button>
      </form>
      <Button variant="link" href="/sign-in">
        Back to sign in
      </Button>
    </div>
  );
}
