"use client";

import { useEffect, useId, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { CheckCircle, CircleNotch, Eye, EyeSlash, WarningCircle, WifiSlash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";
import { Input } from "@/components/ui/input";
import { NEEDS_CONNECTION } from "./use-online";

/**
 * The heading and the one instruction of an entry page. A result (sent, done, expired, used, failed) swaps both for its
 * own, so the page never keeps the form's "Enter your email" above an answer to it (auth i1 D7 + F4).
 */
export function EntryHeading({
  title,
  intro,
  lines,
}: {
  title: string;
  intro?: ReactNode;
  /** A few short lines (a sentence, an address on its own line) that belong right under the title, 8 px below it like an intro (auth i2 D31). */
  lines?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="break-words font-display text-title text-ink">{title}</h1>
      {intro ? <p className="entry-intro text-body text-ink-2">{intro}</p> : null}
      {lines ? <div className="entry-intro flex flex-col gap-1 text-body text-ink-2">{lines}</div> : null}
    </div>
  );
}

/** What a demo state shows already typed, so "Try again" and "Checking code" never sit over an empty box (auth i2 D26 + F19). */
export const DEMO_TYPED = {
  email: "karen@harbourroofing.example",
  password: "a-new-password",
  code: "482913",
} as const;

/** "Needs connection": one line directly under the disabled primary, in ink with its icon (flows.md "Needs connection"). */
export function NeedsConnectionLine() {
  return (
    <p role="status" className="flex items-start gap-2 text-meta text-ink">
      <WifiSlash size={24} aria-hidden="true" className="shrink-0" />
      {NEEDS_CONNECTION}
    </p>
  );
}

/** A good result in one sentence: the good-colour tick first, the words in ink (colour is never alone). */
export function ResultNote({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="flex items-start gap-2 text-body text-ink">
      <CheckCircle size={24} weight="fill" aria-hidden="true" className="shrink-0 text-good" />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}

/**
 * A page-level problem in one sentence, said once with the alert role: body size in ink with its warning icon. Red meta is
 * for a field's own error only (auth i2 D24).
 */
export function ProblemNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" data-problem-note className="flex items-start gap-2 text-body text-ink">
      <WarningCircle size={24} aria-hidden="true" className="shrink-0 text-over" />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}

/** Work in progress with nothing to tap: one spinner row. */
export function SpinnerRow({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="flex items-center gap-2 text-body text-ink">
      <CircleNotch size={24} aria-hidden="true" className="shrink-0 animate-spin" />
      {children}
    </p>
  );
}

/** Whole seconds left on a wait (a resend, a lock-out). `start(n)` begins it; it ticks down once a second. */
export function useCountdown(): { left: number; start: (seconds: number) => void } {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const id = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left]);
  return { left, start: setLeft };
}

type PasswordFieldProps = Omit<ComponentPropsWithoutRef<"input">, "id" | "type"> & {
  label: string;
  hint?: string;
  error?: string;
};

/**
 * A password box with a 48 px show/hide button inside its right edge, so a long password can be checked (auth i1 F12). The
 * button stays as it is while the form saves: it changes nothing that is sent, and a disabled box around it is noise (F25).
 */
export function PasswordField({ label, hint, error, ...inputProps }: PasswordFieldProps) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const hintId = hint && !error ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="break-words text-body-strong text-ink">
        {label}
      </label>
      <div className="relative">
        <Input
          {...inputProps}
          id={id}
          type={shown ? "text" : "password"}
          inputMode="text"
          autoCapitalize="none"
          spellCheck={false}
          invalid={Boolean(error)}
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          className="pr-14"
        />
        <div className="absolute right-0 top-0 flex h-[52px] items-center lg:h-12">
          <Button
            variant="ghost"
            iconOnly
            label={shown ? "Hide password" : "Show password"}
            icon={shown ? EyeSlash : Eye}
            onClick={() => setShown((v) => !v)}
          />
        </div>
      </div>
      {hint && !error ? (
        <span id={hintId} className="text-meta text-ink-2">
          {hint}
        </span>
      ) : null}
      {error ? <ErrorMessage id={errorId}>{error}</ErrorMessage> : null}
    </div>
  );
}
