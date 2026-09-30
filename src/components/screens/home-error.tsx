import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { formatDate } from "@/lib/format";
import { RetryButton } from "@/components/retry-button";
import { Button } from "@/components/ui/button";
import type { OutboxState } from "@/data/contracts";
import { OnThisDevice } from "./home-foreman";
import { COLUMN, HOME_BUTTON, HomeTitle } from "./home-parts";

/**
 * Home when its figures can't load (`?demo=error`): the page stays. The message sits under the title with the
 * `over` icon. A manager's Try again is the primary. A foreman's Log today is the primary (logging works without the
 * server: it goes to this device) with Try again secondary, and On this device stays under the message. No link back
 * to Home: this is Home.
 */
export function HomeError({ foreman, today, outbox }: { foreman: boolean; today: string; outbox: { state: OutboxState }[] }) {
  return (
    <div data-screen="home" className={COLUMN}>
      <header className="flex flex-col gap-1">
        <HomeTitle waiting={0} attention={0} />
        {foreman ? <p className="text-meta text-ink">{formatDate(today, today)}</p> : null}
      </header>
      <section role="alert" className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <WarningCircle size={24} aria-hidden="true" className="mt-0.5 shrink-0 text-over" />
          <div className="flex flex-col gap-1">
            <h2 className="text-heading text-ink">{foreman ? "Couldn't load your jobs" : "Couldn't load Home figures"}</h2>
            <p className="text-body text-ink">Check your connection, then try again.</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {foreman ? (
            <>
              <Button variant="primary" href="/log" className={HOME_BUTTON}>
                Log today
              </Button>
              <RetryButton variant="secondary" className={HOME_BUTTON} />
            </>
          ) : (
            <RetryButton className={HOME_BUTTON} />
          )}
        </div>
      </section>
      {foreman ? <OnThisDevice outbox={outbox} /> : null}
    </div>
  );
}
