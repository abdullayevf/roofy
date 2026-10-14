import { Button } from "@/components/ui/button";

/** After sign-up: where the link went. The address wraps (break-all) so a long one never widens the page. */
export function CheckEmail({ email }: { email: string | null }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-title text-ink">Check your email</h1>
        <p className="entry-intro text-body text-ink-2">
          {email ? (
            <>
              We sent a link to <span className="break-all text-ink">{email}</span>. Open it to finish setting up.
            </>
          ) : (
            "We sent you a link. Open it to finish setting up."
          )}
        </p>
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
    </>
  );
}
