import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { EntryHeading } from "./entry-parts";

/** The address with a place to break after each @ and dot only, so a long one wraps at a sensible spot and never widens the page. */
function Address({ email }: { email: string }) {
  const parts = email.split(/(?<=[@.])/);
  return (
    <p className="break-words font-medium text-ink" data-testid="check-email-address">
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 ? <wbr /> : null}
          {part}
        </Fragment>
      ))}
    </p>
  );
}

/**
 * After sign-up: where the link went. The address sits on its own line. There is no "Send again" here: the sign-up has no
 * resend to call (recorded as a deviation), so the way forward is a different email, or sign in once the link is opened.
 */
export function CheckEmail({ email }: { email: string | null }) {
  return (
    <>
      <EntryHeading title="Check your email" />
      <div className="entry-main flex flex-col gap-6">
        <div className="flex flex-col gap-1 text-body text-ink-2">
          {email ? (
            <>
              <p>We sent a link to</p>
              <Address email={email} />
              <p>Open it to finish setting up.</p>
            </>
          ) : (
            <p>We sent you a link. Open it to finish setting up.</p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" href="/sign-up">
            Use a different email
          </Button>
          <p className="flex flex-wrap items-center gap-x-2 text-body text-ink-2">
            Opened the link already?
            <Button variant="link" href="/sign-in">
              Sign in
            </Button>
          </p>
        </div>
      </div>
    </>
  );
}
