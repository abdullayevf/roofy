import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { formatDate } from "@/lib/format";
import { RetryButton } from "@/components/retry-button";
import { Button } from "@/components/ui/button";
import { COLUMN, HomeTitle } from "./home-parts";

/**
 * Home when its figures can't load (`?demo=error`): the page stays. The message sits under the title with the
 * `over` icon, Try again is the one primary, and a foreman's Log today is the secondary. No link back to Home:
 * this is Home.
 */
export function HomeError({ foreman, today }: { foreman: boolean; today: string }) {
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
        <div className="flex flex-col gap-3 sm:max-w-72">
          <RetryButton className="w-full" />
          {foreman ? (
            <Button variant="secondary" href="/log" className="w-full">
              Log today
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
