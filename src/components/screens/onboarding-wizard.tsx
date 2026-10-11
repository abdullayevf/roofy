"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CaretLeft } from "@phosphor-icons/react";
import { acceptDefaults, addCrewRow, chooseTrade, finishCrew, finishSetUp, saveBusiness, stepBack } from "@/app/actions/onboarding";
import { ONBOARDING_STEPS, type ActionResult, type OnboardingState } from "@/data/contracts";
import type { Cents } from "@/domain/types";
import { formatMoney } from "@/lib/format";
import type { InstallPlatform } from "@/lib/install-platform";
import { cx } from "@/lib/cx";
import { businessProblems, crewRowProblems, crewRowReason } from "@/lib/onboarding-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { ErrorMessage } from "@/components/ui/error-message";
import { Field } from "@/components/ui/field";
import { MoneyField } from "@/components/ui/money-field";
import { Select } from "@/components/ui/select";
import { FOCUS } from "./home-parts";
import { InstallBody } from "./install-guide";
import { NEEDS_CONNECTION, useOnline } from "./use-online";

const TITLES = { business: "Your business", trade: "Your trade", defaults: "Stages and categories", crew: "Your crew", install: "Put Roofy on your phone" } as const;
type Problems = Record<string, string | undefined>;
type Result = ActionResult<{ state: OnboardingState }>;

/** The one line directly under a disabled primary button: body size, `ink`, naming only what is missing (DESIGN §5). */
function Why({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="text-body text-ink">
      {children}
    </p>
  );
}

/** The set-up wizard. Each Continue saves (admin step: needs connection); Back keeps what was entered. `resumed`: the page was opened on a step that was saved earlier. */
export function OnboardingWizard({ initial, platform, offline, resumed = false }: { initial: OnboardingState; platform: InstallPlatform; offline: boolean; resumed?: boolean }) {
  const router = useRouter();
  const online = useOnline(offline);
  const [state, setState] = useState(initial);
  const [problems, setProblems] = useState<Problems>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [biz, setBiz] = useState(initial.business);
  const [adding, setAdding] = useState(false);
  const [row, setRow] = useState({ name: "", type: "employee" as "employee" | "contractor", levelId: "", basis: "hourly" as "hourly" | "daily" });
  const [rate, setRate] = useState<Cents | null | "unreadable">(null);

  const save = (work: () => Promise<Result>, after?: (s: OnboardingState) => void) =>
    start(async () => {
      const r = await work();
      if (!r.ok) {
        setProblems(Object.fromEntries(r.issues.map((i) => [i.field, i.message])));
        setFormError(r.issues.length > 0 ? null : r.message);
        return;
      }
      setProblems({});
      setFormError(null);
      setState(r.state);
      after?.(r.state);
    });

  if (state.step === "done")
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-title text-ink">You&apos;re set up</h1>
        <p className="text-body text-ink-2">Add your first job, then log the first day.</p>
        <Button variant="primary" href="/jobs/new">Add your first job</Button>
      </div>
    );

  const at = ONBOARDING_STEPS.indexOf(state.step);
  const blocked = !online || pending;
  const offlineWhy = online ? null : <Why>{NEEDS_CONNECTION}</Why>;
  const cancelRow = () => {
    setAdding(false);
    setProblems({});
    setRow({ name: "", type: "employee", levelId: "", basis: "hourly" });
    setRate(null);
  };
  const submitBusiness = (e: React.FormEvent) => {
    e.preventDefault();
    const p = businessProblems(biz);
    if (p.name || p.abn) return setProblems({ ...p });
    save(() => saveBusiness(biz));
  };
  const addRow = (e: React.FormEvent) => {
    e.preventDefault();
    const p = crewRowProblems({ name: row.name, rateCents: rate, basis: row.basis });
    if (p.name || p.rate) return setProblems({ ...p });
    save(
      () => addCrewRow({ ...row, levelId: row.type === "employee" && row.levelId !== "" ? row.levelId : null, rateCents: rate as Cents }),
      () => {
        setAdding(false);
        setRow({ name: "", type: "employee", levelId: "", basis: "hourly" });
        setRate(null);
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {at > 0 ? (
          <button
            type="button"
            disabled={blocked}
            onClick={() => save(() => stepBack())}
            className={cx("flex min-h-12 items-center gap-1 self-start text-body-strong text-chalk-link disabled:text-ink-2", FOCUS)}
          >
            <CaretLeft size={24} aria-hidden="true" />
            Back
          </button>
        ) : null}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-meta text-ink-2">
              Step {at + 1} of {ONBOARDING_STEPS.length}
            </p>
            <div className="flex gap-1" aria-hidden="true">
              {ONBOARDING_STEPS.map((s, i) => (
                <span key={s} className={cx("h-2 flex-1 rounded-full border border-ink", i <= at ? "bg-tape" : "bg-surface")} />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-title text-ink">{TITLES[state.step]}</h1>
            {resumed && state.step === initial.step ? <p className="text-meta text-ink-2">Picking up where you left off.</p> : null}
          </div>
        </div>
      </div>

      {state.step === "business" ? (
        <form noValidate onSubmit={submitBusiness} className="flex flex-col gap-4">
          <Field name="name" label="Business name" inputMode="text" autoComplete="organization" value={biz.name} onChange={(e) => setBiz({ ...biz, name: e.target.value })} error={problems.name} />
          <Field name="abn" label="ABN" inputMode="numeric" hint="11 digits" value={biz.abn} onChange={(e) => setBiz({ ...biz, abn: e.target.value })} error={problems.abn} />
          <Checkbox label="GST registered" checked={biz.gstRegistered} onCheckedChange={(v) => setBiz({ ...biz, gstRegistered: v })} />
          <Button variant="primary" type="submit" loading={pending} loadingLabel="Saving" disabled={!online}>
            Continue
          </Button>
          {offlineWhy}
        </form>
      ) : null}

      {state.step === "trade" ? (
        <ChoiceChip legend="Trade" name="trade" options={[{ value: "roofing", label: "Roofing" }]} value={state.trade ?? undefined} disabled={blocked} onChange={() => save(() => chooseTrade())} />
      ) : null}
      {state.step === "trade" ? offlineWhy : null}

      {state.step === "defaults" ? (
        <div className="flex flex-col gap-4">
          <p className="text-body text-ink-2">Roofy starts you with these. You can change them later in Settings.</p>
          <section className="flex flex-col gap-2">
            <h2 className="text-label text-ink">Job types and their stages</h2>
            <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-surface">
              {state.defaults.templates.map((t) => (
                <li key={t.jobType} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-body text-ink">
                  <span className="min-w-0 break-words">{t.name}</span>
                  <span className="shrink-0 text-meta text-ink-2">{t.stages} stages</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-label text-ink">Expense categories</h2>
            <p className="text-body text-ink">{state.defaults.categories.join(", ")}</p>
          </section>
          <Button variant="primary" loading={pending} loadingLabel="Saving" disabled={!online} onClick={() => save(() => acceptDefaults())}>
            Use these
          </Button>
          {offlineWhy}
        </div>
      ) : null}

      {state.step === "crew" ? (
        <div className="flex flex-col gap-4">
          <p className="text-body text-ink-2">Add the people you pay. You can add more, or import a CSV file, from Crew later.</p>
          {state.crew.length > 0 ? (
            <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-surface" aria-label="Crew added">
              {state.crew.map((c) => (
                <li key={c.id} className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 px-4 py-2">
                  <span className="min-w-0 break-words text-body text-ink">{c.name}</span>
                  <span className="text-meta text-ink-2">
                    <span className="whitespace-nowrap text-figure num">{formatMoney(c.rateCents)}</span>{"\u00a0"}{c.basis === "daily" ? "a day" : "an hour"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {adding ? (
            <form noValidate onSubmit={addRow} className="flex flex-col gap-4 rounded-md border border-line p-4">
              <Field name="crew-name" label="Name" inputMode="text" value={row.name} onChange={(e) => setRow({ ...row, name: e.target.value })} error={problems.name} />
              <ChoiceChip legend="Type" name="type" options={[{ value: "employee", label: "Employee" }, { value: "contractor", label: "ABN contractor" }]} value={row.type} onChange={(v) => setRow({ ...row, type: v as "employee" | "contractor" })} />
              {row.type === "employee" ? (
                <Select label="Level" value={row.levelId} onChange={(e) => setRow({ ...row, levelId: e.target.value })} options={[{ value: "", label: "No level yet" }, ...state.levels.map((l) => ({ value: l.id, label: l.name }))]} />
              ) : null}
              <ChoiceChip legend="Paid by" name="basis" options={[{ value: "hourly", label: "Hourly" }, { value: "daily", label: "Daily" }]} value={row.basis} onChange={(v) => setRow({ ...row, basis: v as "hourly" | "daily" })} />
              <MoneyField label={row.basis === "daily" ? "Daily rate" : "Hourly rate"} onCentsChange={(c) => setRate(c)} error={problems.rate} />
              <Button variant="secondary" type="submit" loading={pending} loadingLabel="Adding" disabled={!online}>
                Add
              </Button>
              <Button variant="link" className="self-start" disabled={pending} onClick={cancelRow}>
                Cancel
              </Button>
            </form>
          ) : (
            <Button variant="secondary" onClick={() => setAdding(true)}>
              Add crew member
            </Button>
          )}
          <Button variant="primary" loading={pending && !adding} loadingLabel="Saving" disabled={!online || adding} onClick={() => save(() => finishCrew())}>
            Continue
          </Button>
          {adding && online ? <Why>{crewRowReason({ name: row.name, rateCents: rate, basis: row.basis })}</Why> : offlineWhy}
        </div>
      ) : null}

      {state.step === "install" ? (
        <div className="flex flex-col gap-4">
          <InstallBody platform={platform} />
          <Button variant="primary" loading={pending} loadingLabel="Saving" disabled={!online} onClick={() => save(() => finishSetUp(), () => router.push("/"))}>
            Continue
          </Button>
          {offlineWhy}
        </div>
      ) : null}

      {formError ? (
        <div role="alert">
          <ErrorMessage>{formError}</ErrorMessage>
        </div>
      ) : null}
    </div>
  );
}
