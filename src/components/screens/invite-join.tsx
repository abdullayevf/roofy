"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInvite } from "@/app/actions/auth";
import type { InviteDetails } from "@/data/contracts";
import { INVITE_FAILED, INVITE_GONE, INVITE_LOAD_FAILED, INVITE_OTHER_EMAIL } from "@/lib/auth-input";
import { withReturn } from "@/lib/return-path";
import { Button } from "@/components/ui/button";
import type { AuthDemo } from "./auth-form";
import { EntryHeading, NeedsConnectionLine, ProblemNote } from "./entry-parts";
import { useOnline } from "./use-online";

const ROLE_WORDS = {
  owner: "an owner",
  manager: "a manager",
  accountant: "an accountant",
  foreman: "a foreman",
} as const;

/** What the page knows about the invite: its team and role, a sentence for why it can't be used, or nothing yet (not signed in). */
export type InviteView =
  | { kind: "ready"; invite: InviteDetails }
  | { kind: "gone"; message: string }
  | { kind: "sign-in"; message: string }
  | { kind: "failed" };

/**
 * "Join team": the title names the team, the intro the role, then the one tap. A cancelled or used invite swaps the
 * heading and offers sign in; an invite that would not load says so with "Try again".
 */
export function InviteJoin({ id, view, demo }: { id: string; view: InviteView; demo: AuthDemo }) {
  const router = useRouter();
  const online = useOnline(demo === "offline");
  const [pending, start] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const busy = pending || demo === "loading";

  if (view.kind === "failed") {
    return (
      <>
        <EntryHeading title="Join your team" />
        <div className="entry-main flex flex-col gap-4">
          <ProblemNote>{INVITE_LOAD_FAILED}</ProblemNote>
          <Button
            variant="primary"
            loading={pending}
            loadingLabel="Loading invite"
            onClick={() => start(() => router.refresh())}
          >
            Try again
          </Button>
        </div>
      </>
    );
  }

  if (view.kind !== "ready" || gone) {
    const signIn = view.kind === "sign-in";
    const message = view.kind !== "ready" ? view.message : INVITE_GONE;
    // Signing in as the right person (not signed in yet, or the wrong email) comes back to the invite; an expired one has nowhere to come back to.
    const invitePath = `/invite/${encodeURIComponent(id)}`;
    const comeBack = signIn || message === INVITE_OTHER_EMAIL;
    return (
      <>
        <EntryHeading title={signIn ? "Sign in to join" : "This invite can't be used"} />
        <div className="entry-main flex flex-col gap-4">
          <ProblemNote>{message}</ProblemNote>
          <Button variant="primary" href={withReturn("/sign-in", comeBack ? invitePath : null)}>
            Sign in
          </Button>
          {signIn ? (
            <Button variant="secondary" href={withReturn("/sign-up", invitePath)}>
              Create an account
            </Button>
          ) : null}
        </div>
      </>
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
    <>
      <EntryHeading
        title={`Join ${view.invite.workspaceName}`}
        intro={`You've been invited to Roofy as ${ROLE_WORDS[view.invite.role]}.`}
      />
      <div className="entry-main flex flex-col gap-4">
        {formError ? <ProblemNote>{formError}</ProblemNote> : null}
        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            loading={busy}
            loadingLabel="Joining team"
            disabled={!online}
            dim
            onClick={join}
          >
            {formError === INVITE_FAILED ? "Try again" : "Join team"}
          </Button>
          {!online ? <NeedsConnectionLine /> : null}
        </div>
      </div>
    </>
  );
}
