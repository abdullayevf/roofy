"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult, Cents, CrewLevel, PayFrequency, WorkspaceSettings, WorkspaceSettingsInput } from "@/data/contracts";
import { saveLevel, turnOnTwoFactor, updateSettings } from "@/app/actions/settings";
import { businessProblems } from "@/lib/onboarding-input";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorMessage } from "@/components/ui/error-message";
import { Field } from "@/components/ui/field";
import { MoneyField } from "@/components/ui/money-field";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Toast } from "@/components/ui/toast";
import {
  anchorOn,
  bpText,
  CODE_HINT,
  crewCountHint,
  floorError,
  levelsSummary,
  payPeriodSummary,
  PIN_SUMMARY,
  readCode,
  readHours,
  readOnCost,
  WEEKDAYS,
} from "./settings-input";
import { PinnedAction, usePinnedBar } from "./field-entry";
import { NEEDS_CONNECTION, useOnline } from "./use-online";

export type Errors = Record<string, string | undefined>;
const SAVED = "Changes saved.";
const FAILED = "Couldn't save this. Try again.";
/** Fields sit two to a row from 1024 px, so the form uses the width (lesson: desktop uses the width). */
export const FORM_GRID = "grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-x-8";

const issuesOf = (r: ActionResult): Errors =>
  r.ok ? {} : Object.fromEntries(r.issues.map((i) => [i.field, i.message]));

/** One save flow for every settings form: busy button, per-field errors, saved toast, offline Needs connection. */
export function useSave(demoOffline: boolean) {
  const router = useRouter();
  const online = useOnline(demoOffline);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  // Bumped whenever a save is refused for a bad field, so the form can move focus to the first one.
  const [refused, setRefused] = useState(0);
  async function run(check: () => Errors, save: () => Promise<ActionResult>, savedMessage = SAVED) {
    const found = check();
    setErrors(found);
    setFailed(null);
    if (Object.values(found).some(Boolean)) setRefused((n) => n + 1);
    if (Object.values(found).some(Boolean) || !online) return;
    setBusy(true);
    try {
      const result = await save();
      if (result.ok) {
        setSaved(true);
        setSavedMessage(savedMessage);
        router.refresh();
      } else {
        setErrors(issuesOf(result));
        if (result.issues.length) setRefused((n) => n + 1);
        setFailed(result.issues.length ? null : result.message);
      }
    } catch {
      setFailed(FAILED);
    } finally {
      setBusy(false);
    }
  }
  const [savedMessage, setSavedMessage] = useState(SAVED);
  /** Re-reads the page after a row-by-row save that stopped part way, so rows already saved show in the props (F4). */
  const refresh = () => router.refresh();
  return { online, busy, saved, setSaved, savedMessage, failed, setFailed, errors, setErrors, refused, run, refresh };
}

export type Save = ReturnType<typeof useSave>;

const FORM_CLASS = "flex flex-col gap-6 [&_input]:scroll-mb-[calc(var(--tab-bar-height)+1rem)]";
/** The first field a refused save names, or the first tick of a group that has the error (a working-days group). */
const FIRST_BAD = '[aria-invalid="true"], [data-invalid="true"] [role="checkbox"]';

/** A refused save moves focus to the first bad field, so it is on screen however tall the form is. */
function useFocusFirstBad(s: Save) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (s.refused) ref.current?.querySelector<HTMLElement>(FIRST_BAD)?.focus();
  }, [s.refused]);
  return ref;
}

type SettingsFormProps = {
  s: Save;
  onSubmit: () => void;
  label?: string;
  /** Another form on the same page already says Needs connection. */
  quiet?: boolean;
  /** A form taller than the first viewport pins its Save bar above the tab bar (DESIGN.md §5); its error and Needs connection line sit in the bar. */
  pinned?: boolean;
  /** The bar's line when a pinned save is refused and the failed field has no sentence of its own (default: a general one). */
  summary?: string;
  /** Extra classes on the form (a width from 1024 px, so the list and the pinned bar share one column). */
  className?: string;
  children: ReactNode;
};

/** One form shell for every settings page: pinned Save bar when the form is long, else Save at the end of the form. */
export function SettingsForm(props: SettingsFormProps) {
  return props.pinned ? <PinnedSettingsForm {...props} /> : <PlainSettingsForm {...props} />;
}

function PlainSettingsForm({ s, onSubmit, label = "Save changes", quiet = false, children }: SettingsFormProps) {
  const ref = useFocusFirstBad(s);
  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }
  // On a phone, a focused field scrolls clear of the tab bar when the keyboard opens.
  return (
    <form ref={ref} noValidate onSubmit={submit} className={FORM_CLASS}>
      {children}
      <div className="flex flex-col gap-3">
        {s.online || quiet ? null : (
          <p role="status" className="text-body text-ink">
            {NEEDS_CONNECTION}
          </p>
        )}
        {s.failed ? <ErrorMessage>{s.failed}</ErrorMessage> : null}
        <Button
          type="submit"
          variant="primary"
          loading={s.busy}
          disabled={!s.online}
          className="w-full sm:w-auto sm:min-w-60 sm:self-start"
        >
          {label}
        </Button>
      </div>
      <Toast open={s.saved} onOpenChange={s.setSaved} message={s.savedMessage} viewportClassName="toast-above-tabs" />
    </form>
  );
}

function PinnedSettingsForm({ s, onSubmit, label = "Save changes", quiet = false, summary, className, children }: SettingsFormProps) {
  const ref = useFocusFirstBad(s);
  // A refused save puts its line in the bar, where it is in view whatever the scroll (entry-settings i2 D8 + F2).
  const barError = Object.values(s.errors).some(Boolean) ? (summary ?? PIN_SUMMARY) : undefined;
  const { style, barProps } = usePinnedBar(`${s.online}${s.failed}${barError}`);
  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }
  return (
    <form ref={ref} noValidate onSubmit={submit} style={style} className={cx(FORM_CLASS, "pin-pad pin-wide", className)}>
      {children}
      <PinnedAction barProps={barProps} error={s.failed ?? barError} hintOnSide hint={s.online || quiet ? undefined : NEEDS_CONNECTION}>
        <Button
          type="submit"
          variant="primary"
          loading={s.busy}
          disabled={!s.online}
          className="w-full lg:w-auto lg:min-w-60 lg:self-start"
        >
          {label}
        </Button>
      </PinnedAction>
      <Toast open={s.saved} onOpenChange={s.setSaved} message={s.savedMessage} viewportClassName="toast-above-pin" />
    </form>
  );
}

function inputOf(settings: WorkspaceSettings): WorkspaceSettingsInput {
  const { id, ...rest } = settings;
  void id;
  return rest;
}

export function BusinessForm({
  settings,
  demoOffline,
}: {
  settings: WorkspaceSettings;
  demoOffline: boolean;
}) {
  const s = useSave(demoOffline);
  const [name, setName] = useState(settings.name);
  const [abn, setAbn] = useState(settings.abn);
  const [gst, setGst] = useState(settings.gstRegistered);
  const submit = () =>
    s.run(
      () => ({ ...businessProblems({ name, abn }) }),
      () =>
        updateSettings({
          ...inputOf(settings),
          name: name.trim(),
          abn: abn.replace(/\s/g, ""),
          gstRegistered: gst,
        }),
    );
  return (
    <SettingsForm s={s} onSubmit={submit}>
      <div className={FORM_GRID}>
        <Field
          label="Business name"
          inputMode="text"
          autoComplete="organization"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={s.errors.name}
        />
        <Field
          label="ABN"
          inputMode="numeric"
          value={abn}
          onChange={(e) => setAbn(e.target.value)}
          error={s.errors.abn}
          hint="11 digits"
        />
      </div>
      <Checkbox label="GST registered" checked={gst} onCheckedChange={setGst} />
    </SettingsForm>
  );
}

const hoursText = (h: number) => bpText(h);

export function PayPeriodForm({
  settings,
  demoOffline,
}: {
  settings: WorkspaceSettings;
  demoOffline: boolean;
}) {
  const s = useSave(demoOffline);
  const [frequency, setFrequency] = useState<PayFrequency>(settings.payFrequency);
  const [weekStart, setWeekStart] = useState(settings.payWeekStart);
  const [days, setDays] = useState<number[]>(settings.workingDays);
  const [hours, setHours] = useState(hoursText(settings.standardDayHours));
  const toggle = (d: number, on: boolean) =>
    setDays((now) => (on ? [...new Set([...now, d])].sort() : now.filter((x) => x !== d)));
  const submit = () => {
    const h = readHours(hours);
    return s.run(
      () => ({
        standardDayHours: "error" in h ? h.error : undefined,
        workingDays: days.length ? undefined : "Pick at least one working day.",
      }),
      () =>
        updateSettings({
          ...inputOf(settings),
          payFrequency: frequency,
          payWeekStart: weekStart,
          payAnchor: anchorOn(settings.payAnchor, weekStart),
          workingDays: days,
          standardDayHours: "hours" in h ? h.hours : settings.standardDayHours,
        }),
    );
  };
  return (
    <SettingsForm s={s} onSubmit={submit} pinned summary={payPeriodSummary(s.errors)} className="lg:max-w-3xl">
      <div className={FORM_GRID}>
        <Segmented
          legend="Pay period"
          name="pay-frequency"
          fill
          options={[
            { value: "weekly", label: "Weekly" },
            { value: "fortnightly", label: "Fortnightly" },
          ]}
          value={frequency}
          onChange={(v) => setFrequency(v as PayFrequency)}
        />
        <Select
          label="Pay period starts on"
          options={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))}
          value={String(weekStart)}
          onChange={(e) => setWeekStart(Number(e.target.value))}
        />
        <div role="group" aria-labelledby="working-days" data-invalid={s.errors.workingDays ? "true" : undefined} className="flex flex-col gap-2">
          <h2 id="working-days" className="text-body-strong text-ink">
            Working days
          </h2>
          <div className="divide-y divide-line overflow-hidden rounded-group border-group bg-surface">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <Checkbox
                key={d}
                grouped
                label={WEEKDAYS[d]!}
                checked={days.includes(d)}
                onCheckedChange={(on) => toggle(d, on)}
              />
            ))}
          </div>
          {s.errors.workingDays ? <ErrorMessage>{s.errors.workingDays}</ErrorMessage> : null}
        </div>
        <Field
          label="Standard day"
          inputMode="decimal"
          suffix="hours"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          error={s.errors.standardDayHours}
          hint="Hours in a full day, used for half days and day rates"
        />
      </div>
    </SettingsForm>
  );
}

export function OnCostForm({ settings, demoOffline }: { settings: WorkspaceSettings; demoOffline: boolean }) {
  const s = useSave(demoOffline);
  const [text, setText] = useState(bpText(settings.onCostBp));
  const submit = () => {
    const r = readOnCost(text);
    return s.run(
      () => ({ onCostBp: "error" in r ? r.error : undefined }),
      () => updateSettings({ ...inputOf(settings), onCostBp: "bp" in r ? r.bp : settings.onCostBp }),
    );
  };
  return (
    <SettingsForm s={s} onSubmit={submit}>
      <div className={FORM_GRID}>
        <Field
          label="On-cost"
          inputMode="decimal"
          suffix="%"
          value={text}
          onChange={(e) => setText(e.target.value)}
          error={s.errors.onCostBp}
          hint="Added to employee pay for super, workers' comp and payroll tax"
        />
      </div>
    </SettingsForm>
  );
}

type Floor = Cents | null | "unreadable";

export function LevelsForm({ levels, demoOffline }: { levels: CrewLevel[]; demoOffline: boolean }) {
  const s = useSave(demoOffline);
  const [floors, setFloors] = useState<Record<string, Floor>>(() =>
    Object.fromEntries(levels.map((l) => [l.id, l.floorRateCents])),
  );
  const submit = () =>
    s.run(
      () => Object.fromEntries(levels.map((l) => [l.id, floorError(floors[l.id] ?? null)])),
      async () => {
        let savedAny = false;
        for (const l of levels) {
          const cents = floors[l.id] as Cents;
          if (cents === l.floorRateCents) continue;
          const r = await saveLevel({ id: l.id, name: l.name, floorRateCents: cents });
          if (!r.ok) {
            // Earlier levels are saved: re-read so the page's props show them (F4).
            if (savedAny) s.refresh();
            return r.issues.length ? { ...r, issues: r.issues.map((i) => ({ ...i, field: l.id })) } : r;
          }
          savedAny = true;
        }
        return { ok: true } as const;
      },
    );
  return (
    <SettingsForm s={s} onSubmit={submit} pinned summary={levelsSummary(levels, s.errors)} className="lg:max-w-3xl">
      {/* From 600 px (tablet and up) a level is a row: name and crew count on the left, a narrow right-aligned rate on the
          right, in one 1 px edge outline as wide as the form column (and the pinned bar). */}
      <div className="grid grid-cols-1 gap-6 tablet:flex tablet:flex-col tablet:gap-0 tablet:divide-y tablet:divide-line tablet:overflow-hidden tablet:rounded-group tablet:border tablet:border-edge tablet:bg-surface">
        {levels.map((l) => (
          <MoneyField
            key={l.id}
            className="tablet:grid tablet:min-h-14 tablet:grid-cols-[1fr_14rem] tablet:items-center tablet:gap-x-6 tablet:px-4 tablet:py-1 tablet:[&>:nth-child(2)]:row-span-2 tablet:[&>:nth-child(2)]:self-center tablet:[&_input]:text-right"
            label={l.name}
            ariaLabel={`Floor rate for ${l.name}`}
            suffix="an hour"
            hint={crewCountHint(l.crewCount)}
            defaultCents={l.floorRateCents}
            error={s.errors[l.id]}
            onCentsChange={(cents) => setFloors((f) => ({ ...f, [l.id]: cents }))}
          />
        ))}
      </div>
    </SettingsForm>
  );
}

export function TwoFactorForm({ demoOffline }: { demoOffline: boolean }) {
  const s = useSave(demoOffline);
  const [code, setCode] = useState("");
  const submit = () => {
    const r = readCode(code);
    return s.run(
      () => ({ code: "error" in r ? r.error : undefined }),
      // No toast: once it is on the page re-reads and shows the on state in its place (F7).
      () => turnOnTwoFactor("code" in r ? r.code : ""),
    );
  };
  return (
    <SettingsForm s={s} onSubmit={submit} label="Turn on two-factor">
      <ol className="flex list-decimal flex-col gap-2 pl-6 text-body text-ink">
        <li>Open an authenticator app, like Google Authenticator or 1Password.</li>
        <li>
          Add Roofy with this set-up key:{" "}
          <span className="text-body-strong tabular-nums">RFY4 7KQ2 M9TD 3XWB</span>
        </li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      <div className={FORM_GRID}>
        <Field
          label="Code"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          error={s.errors.code}
          hint={s.errors.code ? undefined : CODE_HINT}
        />
      </div>
    </SettingsForm>
  );
}
