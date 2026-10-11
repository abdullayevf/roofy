"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { CaretLeft, CheckCircle } from "@phosphor-icons/react";
import type { InstallPlatform } from "@/lib/install-platform";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/button";
import { FOCUS } from "./home-parts";
import { INSTALL_STEPS, installOrder } from "./install-text";

const STANDALONE = "(display-mode: standalone)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(STANDALONE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Opened from the home screen? iOS Safari says so with `navigator.standalone`, everything else with the display mode. */
function isStandalone(): boolean {
  return window.matchMedia(STANDALONE).matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function Steps({ platform }: { platform: InstallPlatform }) {
  const { title, steps } = INSTALL_STEPS[platform];
  return (
    <section aria-labelledby={`install-${platform}`} className="flex flex-col gap-3">
      <h2 id={`install-${platform}`} className="text-heading text-ink">
        {title}
      </h2>
      <ol className="flex list-decimal flex-col gap-3 rounded-group border-group bg-surface py-4 pl-10 pr-4 text-body text-ink">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The install guide: the steps for this device first, the other devices' behind a disclosure. Opened from the home
 * screen it says Roofy is installed instead. `installed` is the prototype's `?installed=1`, to look at that state in a browser.
 */
export function InstallGuide({ platform, installed: forced, backHref, backLabel }: { platform: InstallPlatform; installed: boolean; backHref: string; backLabel: string }) {
  const standalone = useSyncExternalStore(subscribe, isStandalone, () => false);
  const installed = forced || standalone;
  const { first, others } = installOrder(platform);
  return (
    <div className="flex max-w-150 flex-col gap-6 lg:max-w-none">
      <div className="flex flex-col gap-2">
        <Link href={backHref} prefetch={false} className={cx("flex min-h-12 items-center gap-1 border-b border-line text-body-strong text-chalk-link", FOCUS)}>
          <CaretLeft size={24} aria-hidden="true" />
          {backLabel}
        </Link>
        <h1 className="font-display text-title text-ink">{installed ? "Roofy is installed" : "Install guide"}</h1>
      </div>
      {installed ? (
        <div className="flex flex-col items-start gap-4">
          <p className="flex items-start gap-2 text-body text-ink-2">
            <CheckCircle size={24} aria-hidden="true" className="shrink-0 text-ink" />
            You are using Roofy from your home screen. There is nothing more to do.
          </p>
          <Button variant="primary" href="/">
            Go to Home
          </Button>
        </div>
      ) : (
        <>
          <p className="text-body text-ink-2">Put Roofy on your home screen to open it like any other app, full screen. Entries you make with no signal are kept on your phone.</p>
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
            <Steps platform={first} />
            <details className="group flex flex-col gap-3">
              <summary className={cx("flex min-h-12 cursor-pointer items-center text-body-strong text-chalk-link", FOCUS)}>Steps for other devices</summary>
              <div className="flex flex-col gap-6 pt-3">
                {others.map((p) => (
                  <Steps key={p} platform={p} />
                ))}
              </div>
            </details>
          </div>
        </>
      )}
    </div>
  );
}
