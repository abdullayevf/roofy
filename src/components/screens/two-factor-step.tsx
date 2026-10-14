"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { verifyTwoFactor } from "@/app/actions/auth";
import { TOO_MANY_TRIES, TWO_FACTOR_FAILED, WRONG_CODE, codeProblem } from "@/lib/auth-input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { AuthDemo } from "./auth-form";
import { DEMO_TYPED, EntryHeading, NeedsConnectionLine, ProblemNote, useCountdown } from "./entry-parts";
import { useOnline } from "./use-online";

/** Seconds the button stays off after "Too many tries", so the wait the sentence asks for is the wait the screen enforces. */
export const LOCKED_SECONDS = 60;

/**
 * "Check code": the sign-in's second step. A wrong code marks the box; too many tries clears the box and turns the button
 * off for the wait; an outage says so once, above the button, and the button reads "Try again".
 */
export function TwoFactorStep({ demo }: { demo: AuthDemo }) {
  const router = useRouter();
  const online = useOnline(demo === "offline");
  const [pending, start] = useTransition();
  const { left, start: startWait } = useCountdown();
  // The error and loading demos stand for "after Check code was tapped", so the box shows the code that was typed (auth i2 D26 + F19).
  const [code, setCode] = useState(demo === "error" || demo === "loading" ? DEMO_TYPED.code : "");
  const [problem, setProblem] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(demo === "error" ? TWO_FACTOR_FAILED : null);
  const busy = pending || demo === "loading";
  const waiting = left > 0;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !online || waiting) return;
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
      if (result.message === TOO_MANY_TRIES) {
        setCode("");
        startWait(LOCKED_SECONDS);
        return setFormError(TOO_MANY_TRIES);
      }
      setFormError(result.code === "unavailable" ? TWO_FACTOR_FAILED : result.message);
    });
  }

  return (
    <>
      <EntryHeading
        title="Enter your code"
        intro="Open your authenticator app and enter the code it shows."
      />
      <div className="entry-main flex flex-col gap-6">
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
            disabled={busy || waiting}
          />
          {formError ? <ProblemNote>{formError}</ProblemNote> : null}
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              type="submit"
              loading={busy}
              loadingLabel="Checking code"
              disabled={!online || waiting}
              dim={!waiting}
            >
              {waiting
                ? `Try again in ${left} s`
                : formError === TWO_FACTOR_FAILED
                  ? "Try again"
                  : "Check code"}
            </Button>
            {!online ? <NeedsConnectionLine /> : null}
          </div>
        </form>
        <div>
          <Button variant="link" href="/sign-in">
            Back to sign in
          </Button>
        </div>
      </div>
    </>
  );
}
