import { signOut } from "@/app/actions/sign-out";
import { Button } from "@/components/ui/button";

/** A manager, accountant or foreman whose workspace is not finished yet: one plain sentence and one way out. Title and sentence both use the full column (no balanced wrap: auth i2 D32 + F23). */
export function OnboardingNoAccess() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-title text-ink">The owner is still setting this up</h1>
        <p className="entry-intro text-body text-ink-2">
          Roofy will be ready for you when they finish. Check back later.
        </p>
      </div>
      <form action={signOut} className="flex flex-col">
        <Button variant="secondary" type="submit">
          Sign out
        </Button>
      </form>
    </div>
  );
}
