"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { verifyEmail } from "@/app/actions/auth";
import { LINK_EXPIRED, VERIFY_FAILED } from "@/lib/auth-input";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";
import type { AuthDemo } from "./auth-form";
import { NEEDS_CONNECTION, useOnline } from "./use-online";

type State = { kind: "checking" } | { kind: "gone" } | { kind: "failed"; message: string };

/**
 * The email link's landing: checks the link on arrival (no tap) and goes on to where the service says. The check runs
 * once (a ref, so React's double effect in development cannot spend the link twice). The `?demo=` states never ask.
 */
export function VerifyEmail({ token, demo }: { token: string | null; demo: AuthDemo }) {
  const router = useRouter();
  const online = useOnline(demo === "offline");
  const started = useRef(false);
  const noToken = !token || token.trim() === "";
  const [state, setState] = useState<State>(
    noToken ? { kind: "gone" } : demo === "error" ? { kind: "failed", message: VERIFY_FAILED } : { kind: "checking" },
  );

  async function check(link: string) {
    const result = await verifyEmail(link);
    if (result.ok) return router.push(result.next);
    setState(
      result.code === "invalid"
        ? { kind: "gone" }
        : { kind: "failed", message: result.code === "unavailable" ? VERIFY_FAILED : result.message },
    );
  }

  useEffect(() => {
    if (started.current || noToken || demo || !online) return;
    started.current = true;
    void check(token);
    // `check` only reads the router and sets state; the link is spent once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, noToken, demo, online]);

  if (state.kind === "gone") {
    return (
      <div className="entry-main flex flex-col gap-4">
        <div role="alert">
          <ErrorMessage>{LINK_EXPIRED}</ErrorMessage>
        </div>
        <Button variant="primary" href="/sign-in">
          Sign in
        </Button>
      </div>
    );
  }
  if (state.kind === "failed") {
    return (
      <div className="entry-main flex flex-col gap-4">
        <div role="alert">
          <ErrorMessage>{state.message}</ErrorMessage>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            if (!token) return;
            setState({ kind: "checking" });
            void check(token);
          }}
        >
          Try again
        </Button>
      </div>
    );
  }
  return (
    <div className="entry-main flex flex-col gap-2">
      <p role="status" className="text-body text-ink">
        {online ? "Checking your link" : NEEDS_CONNECTION}
      </p>
    </div>
  );
}
