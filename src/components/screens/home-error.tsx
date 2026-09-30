import { formatDate } from "@/lib/format";
import { RetryButton } from "@/components/retry-button";
import { Button } from "@/components/ui/button";
import { COLUMN, HomeTitle } from "./home-parts";

/**
 * Home when its figures can't load (`?demo=error`): the page stays (title, and a foreman's Log today), and the
 * message and Try again sit low on the screen, in thumb reach. No link back to Home: this is Home.
 */
export function HomeError({ foreman, today }: { foreman: boolean; today: string }) {
  return (
    <div data-screen="home" className={COLUMN}>
      <header className="flex flex-col gap-1">
        <HomeTitle waiting={0} attention={0} />
        {foreman ? <p className="text-meta text-ink">{formatDate(today, today)}</p> : null}
      </header>
      <section role="alert" className="flex min-h-[60dvh] flex-col justify-end gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-heading text-ink">{foreman ? "Couldn't load your jobs" : "Couldn't load Home figures"}</h2>
          <p className="text-body text-ink">Check your connection, then try again.</p>
        </div>
        <RetryButton className="w-full" />
      </section>
      {foreman ? (
        <div data-slot="primary-action" className="pin-action">
          <Button variant="primary" href="/log" className="w-full">
            Log today
          </Button>
        </div>
      ) : null}
    </div>
  );
}
