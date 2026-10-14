"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInvite } from "@/app/actions/auth";
import type { InviteDetails } from "@/data/contracts";
import { INVITE_FAILED, INVITE_GONE } from "@/lib/auth-input";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";
import type { AuthDemo } from "./auth-form";
import { NEEDS_CONNECTION, useOnline } from "./use-online";

const ROLE_WORDS = {
  owner: "owner",
  manager: "manager",
  accountant: "accountant",
  foreman: "foreman",
} as const;

/** What the page knows about the invite: its team and role, a sentence for why it can't be used, or nothing yet (not signed in). */
export type InviteView =
  | { kind: "ready"; invite: InviteDetails }
  | { kind: "gone"; message: string }
  | { kind: "sign-in"; message: string };

/** "Join team": names the team and the role before the one tap. A cancelled or used invite says so and offers sign in. */
export function InviteJoin({ id, view, demo }: { id: string; view: InviteView; demo: AuthDemo }) {
  const router = useRouter();
  const online = useOnline(demo === "offline");
  const [pending, start] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const busy = pending || demo === "loading";

  if (view.kind !== "ready" || gone) {
    const message = view.kind !== "ready" ? view.message : INVITE_GONE;
    return (
      <div className="entry-main flex flex-col gap-4">
        <div role="alert">
          <ErrorMessage>{message}</ErrorMessage>
        </div>
        <Button variant="primary" href="/sign-in">
          Sign in
        </Button>
      </div>
    );
  }

  function join() {
    if (busy || !online) return;
    setFormError(null);
    if (demo === "error") return setFormError(INVITE_FAILED);
    start(async () => {
      const result = await acceptInvite(id);
      if (result.ok) return router.push(result.next);
      if (result.message === INVITE_GONE) return setGone(true);
      setFormError(result.code === "unavailable" ? INVITE_FAILED : result.message);
    });
  }

  return (
    <div className="entry-main flex flex-col gap-6">
      {!online ? (
        <p role="status" className="text-meta text-ink-2">
          {NEEDS_CONNECTION}
        </p>
      ) : null}
      <p className="text-body text-ink">
        Join <span className="break-words font-medium">{view.invite.workspaceName}</span> as{" "}
        {ROLE_WORDS[view.invite.role]}.
      </p>
      {formError ? (
        <div role="alert">
          <ErrorMessage>{formError}</ErrorMessage>
        </div>
      ) : null}
      <Button variant="primary" loading={busy} loadingLabel="Joining team" disabled={!online} onClick={join}>
        Join team
      </Button>
    </div>
  );
}
