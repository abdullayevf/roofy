"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult, Cents, CrewLevel, PayFrequency, WorkspaceSettings, WorkspaceSettingsInput } from "@/data/contracts";
import { saveLevel, turnOnTwoFactor, updateSettings } from "@/app/actions/settings";
import { businessProblems } from "@/lib/onboarding-input";
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
  floorError,
  readCode,
  readHours,
  readOnCost,
  WEEKDAYS,
} from "./settings-input";
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
  async function run(check: () => Errors, save: () => Promise<ActionResult>, savedMessage = SAVED) {
    const found = check();
    setErrors(found);
    setFailed(null);
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
        setFailed(result.issues.length ? null : result.message);
      }
    } catch {
      setFailed(FAILED);
    } finally {
      setBusy(false);
    }
  }
  const [savedMessage, setSavedMessage] = useState(SAVED);
  return { online, busy, saved, setSaved, savedMessage, failed, errors, setErrors, run };
}

export type Save = ReturnType<typeof useSave>;

export function SettingsForm({
  s,
  onSubmit,
  label = "Save changes",
  children,
}: {
  s: Save;
  onSubmit: () => void;
  label?: string;
  children: ReactNode;
}) {
  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }
  // On a phone, a focused field scrolls clear of the tab bar when the keyboard opens.
  return (
    <form
      noValidate
      onSubmit={submit}
      className="flex flex-col gap-6 [&_input]:scroll-mb-[calc(var(--tab-bar-height)+1rem)]"
    >
      {children}
      <div className="flex flex-col gap-3">
        {s.online ? null : (
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
      <Toast open={s.saved} onOpenChange={s.setSaved} message={s.savedMessage} />
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
    <SettingsForm s={s} onSubmit={submit}>
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
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-body-strong text-ink">Working days</legend>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,11rem),1fr))] gap-x-4">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <Checkbox
                key={d}
                label={WEEKDAYS[d]!}
                checked={days.includes(d)}
                onCheckedChange={(on) => toggle(d, on)}
              />
            ))}
          </div>
          {s.errors.workingDays ? <ErrorMessage>{s.errors.workingDays}</ErrorMessage> : null}
        </fieldset>
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
        for (const l of levels) {
          const cents = floors[l.id] as Cents;
          if (cents === l.floorRateCents) continue;
          const r = await saveLevel({ id: l.id, name: l.name, floorRateCents: cents });
          if (!r.ok)
            return r.issues.length ? { ...r, issues: r.issues.map((i) => ({ ...i, field: l.id })) } : r;
        }
        return { ok: true } as const;
      },
    );
  return (
    <SettingsForm s={s} onSubmit={submit}>
      <div className={FORM_GRID}>
        {levels.map((l) => (
          <MoneyField
            key={l.id}
            label={l.name}
            ariaLabel={`Floor rate for ${l.name}`}
            hint={`An hour. ${l.crewCount}\u00a0crew on this level.`}
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
      () => turnOnTwoFactor("code" in r ? r.code : ""),
      "Two-factor is on.",
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
