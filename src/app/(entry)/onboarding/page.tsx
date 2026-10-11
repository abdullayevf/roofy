import type { Metadata } from "next";
import { headers } from "next/headers";
import { getOnboarding } from "@/data";
import { isDataError, ONBOARDING_STEPS, type OnboardingStep } from "@/data/contracts";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { Button } from "@/components/ui/button";
import { OnboardingWizard } from "@/components/screens/onboarding-wizard";
import { detectPlatform, parsePlatform } from "@/lib/install-platform";

export const metadata: Metadata = { title: "Set up your business" };

/**
 * The set-up wizard after sign-up: business, trade, templates and categories, crew, install, then Home.
 * Each step is saved as it goes, so a reload resumes where it was (and says so). `?step=` shows a given step and
 * `?platform=` another device's install steps (design loop); without it the install step follows the browser, as /install does.
 */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { onboarding, actor, demo } = await getOnboarding({ searchParams: params });
  let state: Awaited<ReturnType<typeof onboarding.state>>;
  try {
    state = await onboarding.state(actor);
  } catch (e) {
    if (isDataError(e) && e.code === "forbidden") return <NoPermission backHref="/" backLabel="Go to Home" ask="the business owner" />;
    return (
      <div role="alert" className="flex flex-col gap-4">
        <h1 className="font-display text-title text-ink">Couldn&apos;t load this</h1>
        <p className="text-body text-ink-2">Couldn&apos;t load this. Try again.</p>
        <Button variant="primary" href="/onboarding">
          Try again
        </Button>
      </div>
    );
  }
  const asked = typeof params.step === "string" && (ONBOARDING_STEPS as readonly string[]).includes(params.step);
  const step = asked ? (params.step as OnboardingStep) : state.step;
  const platform = parsePlatform(params.platform) ?? detectPlatform((await headers()).get("user-agent"));
  const resumed = !asked && state.step !== "business";
  return <OnboardingWizard initial={{ ...state, step }} platform={platform} offline={demo.offline} resumed={resumed} />;
}
