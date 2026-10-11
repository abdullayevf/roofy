"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GoogleLogo } from "@phosphor-icons/react";
import { continueWithGoogle, signIn, signUp } from "@/app/actions/auth";
import type { ActionResult } from "@/data/contracts";
import { SIGN_IN_FAILED, authProblems, type AuthMode, type AuthProblems } from "@/lib/auth-input";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";
import { Field } from "@/components/ui/field";
import { NEEDS_CONNECTION, useOnline } from "./use-online";

/** The prototype's `?demo=` states that change the form: `loading` shows the button busy, `offline` blocks it, `error` refuses with the sorry sentence. */
export type AuthDemo = "loading" | "offline" | "error" | null;

const COPY = {
  "sign-in": { action: "Sign in", busy: "Signing in", other: "New to Roofy?", otherLink: "Create an account", otherHref: "/sign-up", password: "current-password" },
  "sign-up": { action: "Create account", busy: "Creating account", other: "Already have an account?", otherLink: "Sign in", otherHref: "/sign-in", password: "new-password" },
} as const;

/** Sign in or sign up: Continue with Google (the prototype goes straight on) or email and password, with errors in plain words. */
export function AuthForm({ mode, demo }: { mode: AuthMode; demo: AuthDemo }) {
  const copy = COPY[mode];
  const router = useRouter();
  const online = useOnline(demo === "offline");
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [problems, setProblems] = useState<AuthProblems>({});
  const [formError, setFormError] = useState<string | null>(null);
  const busy = pending || demo === "loading";

  function finish(result: ActionResult<{ next: string }>) {
    if (result.ok) return router.push(result.next);
    const next: AuthProblems = {};
    for (const issue of result.issues) if (issue.field === "email" || issue.field === "password") next[issue.field] ??= issue.message;
    setProblems(next);
    setFormError(Object.keys(next).length === 0 ? result.message : null);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !online) return;
    const found = authProblems(mode, { email, password });
    setProblems(found);
    setFormError(null);
    const first = found.email ? "email" : found.password ? "password" : null;
    if (first) return (event.currentTarget.elements.namedItem(first) as HTMLInputElement | null)?.focus();
    if (demo === "error") return setFormError(SIGN_IN_FAILED);
    start(async () => finish(await (mode === "sign-in" ? signIn(email, password) : signUp(email, password))));
  }

  function google() {
    if (busy || !online) return;
    setFormError(null);
    if (demo === "error") return setFormError(SIGN_IN_FAILED);
    start(async () => finish(await continueWithGoogle(mode)));
  }

  return (
    <div className="flex flex-col gap-6">
      {!online ? (
        <p role="status" className="text-meta text-ink-2">
          {NEEDS_CONNECTION}
        </p>
      ) : null}
      <Button variant="secondary" icon={GoogleLogo} disabled={busy || !online} onClick={google}>
        Continue with Google
      </Button>
      <div className="flex items-center gap-3 text-meta text-ink-2" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        or use your email
        <span className="h-px flex-1 bg-line" />
      </div>
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
          error={problems.email}
          disabled={busy}
        />
        <Field
          name="password"
          label="Password"
          type="password"
          inputMode="text"
          autoComplete={copy.password}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={mode === "sign-up" ? "At least 8 characters" : undefined}
          error={problems.password}
          disabled={busy}
        />
        {formError ? (
          <div role="alert">
            <ErrorMessage>{formError}</ErrorMessage>
          </div>
        ) : null}
        <Button variant="primary" type="submit" loading={busy} loadingLabel={copy.busy} disabled={!online}>
          {copy.action}
        </Button>
      </form>
      <p className="flex flex-wrap items-center gap-x-2 text-body text-ink-2">
        {copy.other}
        <Button variant="link" href={copy.otherHref}>
          {copy.otherLink}
        </Button>
      </p>
    </div>
  );
}
