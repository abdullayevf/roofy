import { Button } from "@/components/ui/button";

type StateProps = { title: string; message: string; className?: string };

function StateBody({ title, message, children }: StateProps & { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-12 text-center">
      <h1 className="font-display text-title text-ink">{title}</h1>
      <p className="text-body text-ink-2">{message}</p>
      {children}
    </div>
  );
}

/** DESIGN.md §4 no-permission state: one plain sentence, no figures, one way back. */
export function NoPermission({ backHref = "/", backLabel = "Go to Home" }: { backHref?: string; backLabel?: string }) {
  return (
    <StateBody title="No access" message="You don't have access to this. Ask your manager.">
      <Button variant="primary" href={backHref}>
        {backLabel}
      </Button>
    </StateBody>
  );
}

/** A page that doesn't exist (or a job or crew member that isn't there any more). */
export function NotFoundState({ backHref = "/", backLabel = "Go to Home" }: { backHref?: string; backLabel?: string }) {
  return (
    <StateBody title="Page not found" message="We can't find that page. It may have moved or been removed.">
      <Button variant="primary" href={backHref}>
        {backLabel}
      </Button>
    </StateBody>
  );
}

/** Something failed to load: try again, or go back Home. */
export function ErrorState({ onRetry, backHref = "/", backLabel = "Go to Home" }: {
  onRetry: () => void;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <StateBody title="Something went wrong" message="Couldn't load this. Check your signal and try again.">
      <Button variant="primary" onClick={onRetry}>
        Try again
      </Button>
      <Button variant="ghost" href={backHref}>
        {backLabel}
      </Button>
    </StateBody>
  );
}
