import { signOut } from "@/app/actions/sign-out";
import { Button } from "@/components/ui/button";

/** A manager, accountant or foreman whose workspace is not finished yet: one plain sentence and one way out. */
export function OnboardingNoAccess() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-title text-ink">The owner is still setting this up</h1>
        <p className="entry-intro text-body text-ink-2">
          You can use Roofy once they finish. Check back later.
        </p>
      </div>
      <form action={signOut}>
        <Button variant="secondary" type="submit">
          Sign out
        </Button>
      </form>
    </div>
  );
}
