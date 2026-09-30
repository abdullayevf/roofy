"use client";

import { useState } from "react";
import type { ProgressDefaults, CrewRowForeman } from "@/data/contracts";
import type { Hundredths, Unit } from "@/domain/types";
import { splitByShares } from "@/domain/split";
import { submit } from "@/offline/submit";
import { formatQuantity } from "@/lib/format";
import { cx } from "@/lib/cx";
import { CrewChip, CrewGroup } from "@/components/crew-chip";
import { KeepTogether } from "@/components/keep-together";
import { TapeBar } from "@/components/tape-bar";
import { Button } from "@/components/ui/button";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { ErrorMessage } from "@/components/ui/error-message";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { CrewRowsSkeleton, ENTRY_WIDTH, EntryDate, EntryEmpty, EntrySkeleton, EntryTabs, FieldSkeleton, usePinnedBar } from "./field-entry";
import { equalShares, hundredthsText, parseHundredths, progressAfter, progressLine, shareTotalError, sharesFromText } from "./field-input";

export type ProgressStart = {
  stageId: string | null;
  /** Hundredths, from an outbox entry being edited. */
  quantity: number | null;
  crewMemberIds: string[];
  /** Basis points per person when the entry being edited had a custom split. */
  shares: number[] | null;
};

const UNIT_WORD: Record<Unit, string> = { m2: "m²", lm: "lm", each: "each" };

type Saved = { state: "logged" | "waiting"; text: string; missingRate: boolean; stage: string; after: { done: Hundredths; percent: number | null } | null; unit: Unit };

export type ProgressEntryProps = { defaults: ProgressDefaults; start: ProgressStart; /** The workspace's today; the entry can be for another day when reopened from the outbox. */ today?: string; demo?: string };

/**
 * Progress entry (flows.md screen 7): the stage (recent ones are one-tap chips), the quantity done with a decimal
 * keypad, who did it, and an equal or custom split that has to add up to 100%. Quantities and percentages only:
 * the same screen for a foreman, who never sees a rate or an amount.
 */
export function ProgressEntry({ defaults, start, today = defaults.date, demo }: ProgressEntryProps) {
  const stages = defaults.projects.flatMap((p) =>
    p.stages.filter((s) => s.unit !== null && s.status !== "done").map((s) => ({ ...s, projectId: p.id, projectName: p.name, unit: s.unit as Unit })),
  );
  const [stageId, setStageId] = useState<string>(start.stageId ?? "");
  const [pickOther, setPickOther] = useState(
    start.stageId !== null && !defaults.latestStages.some((l) => l.stageId === start.stageId),
  );
  const [projectId, setProjectId] = useState<string>(stages.find((s) => s.id === start.stageId)?.projectId ?? "");
  const [quantity, setQuantity] = useState(start.quantity ? hundredthsText(start.quantity) : "");
  const [people, setPeople] = useState<string[]>(start.crewMemberIds);
  const [mode, setMode] = useState<"equal" | "custom">(start.shares ? "custom" : "equal");
  const [shareText, setShareText] = useState<Record<string, string>>(() =>
    Object.fromEntries(start.crewMemberIds.map((id, i) => [id, start.shares?.[i] !== undefined ? hundredthsText(start.shares[i]!) : ""])),
  );
  /** What this visit has added per stage, so the tape and "measured so far" stay right when logging again. */
  const [added, setAdded] = useState<Record<string, Hundredths>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const { style, barProps } = usePinnedBar(saved);

  if (stages.length === 0) {
    return (
      <div data-screen="log-progress" className={cx("flex flex-col gap-6", ENTRY_WIDTH)}>
        <EntryTabs active="progress" demo={demo} />
        <EntryEmpty foreman={defaults.view === "foreman"} managerMessage="No jobs to measure yet. Add your first job." actionLabel="Add your first job" href="/jobs/new" />
      </div>
    );
  }

  const stage = stages.find((s) => s.id === stageId) ?? null;
  const latest = defaults.latestStages.find((l) => l.stageId === stageId) ?? null;
  const done = latest ? latest.quantityDone + (added[stageId] ?? 0) : null;
  const qty = parseHundredths(quantity);
  const chosen = people.map((id) => defaults.crew.find((c) => c.id === id)).filter((c): c is CrewRowForeman => c !== undefined);
  const custom = mode === "custom" && chosen.length > 1;
  const typed = sharesFromText(chosen.map((c) => shareText[c.id] ?? ""));
  const totalError = custom ? shareTotalError(typed.total) : null;
  const ready = stage !== null && qty !== null && qty > 0 && chosen.length > 0 && totalError === null;
  const each =
    qty !== null && qty > 0 && chosen.length > 1 && totalError === null
      ? splitByShares(qty, chosen.length, custom ? { mode: "custom", bp: typed.bp } : { mode: "equal" })
      : null;
  const unit = stage?.unit ?? "m2";

  function toggle(id: string, on: boolean) {
    setPeople((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  function chooseMode(next: "equal" | "custom") {
    if (next === "custom") {
      const eq = equalShares(chosen.length);
      setShareText(Object.fromEntries(chosen.map((c, i) => [c.id, hundredthsText(eq[i] ?? 0)])));
    }
    setMode(next);
  }

  async function save() {
    if (!stage || qty === null) return;
    setSaving(true);
    setError(null);
    try {
      const result = await submit("progress", {
        stageId: stage.id,
        date: defaults.date,
        quantity: qty,
        crewMemberIds: chosen.map((c) => c.id),
        shares: custom ? { mode: "custom", bp: typed.bp } : { mode: "equal" },
        photoFileId: null,
        note: null,
      });
      if (result.status === "rejected") {
        setError(result.message);
        return;
      }
      setAdded((prev) => ({ ...prev, [stage.id]: (prev[stage.id] ?? 0) + qty }));
      setSaved({
        state: result.status === "applied" ? "logged" : "waiting",
        text: `${formatQuantity(qty, stage.unit)} on ${stage.name}, ${chosen.map((c) => c.name).join(" and ")}`,
        missingRate: result.status === "applied" && result.result.flags.includes("missing_rate"),
        stage: `${stage.name} on ${stage.projectName}`,
        after: latest ? progressAfter({ done: done ?? 0, planned: latest.plannedQuantity }, qty) : null,
        unit: stage.unit,
      });
    } catch {
      setError("Couldn't save the progress. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function logMore() {
    setSaved(null);
    setQuantity("");
    setPeople([]);
    setMode("equal");
    setShareText({});
  }

  return (
    <div
      data-screen="log-progress"
      style={saved ? undefined : style}
      className={cx("flex flex-col gap-6", ENTRY_WIDTH, saved ? null : "pin-pad")}
    >
      <EntryTabs active="progress" demo={demo} />
      <EntryDate date={defaults.date} today={today} saved={saved !== null} />

      <div role="status" className="empty:hidden">
        {saved ? (
          <div className="flex flex-col items-start gap-3 rounded-group border-group bg-surface p-4">
            <StatusChip status={saved.state === "logged" ? "sent" : "waiting"} />
            <p className="text-body-strong text-ink">
              {saved.state === "logged" ? "Logged" : "Saved on this device"}: {saved.text}
            </p>
            {saved.state === "waiting" ? <p className="text-meta text-ink-2">It will send when you have signal.</p> : null}
            {saved.after ? (
              <div className="flex w-full flex-col gap-1">
                <TapeBar label={`${saved.stage} progress`} percent={saved.after.percent ?? 0} />
                <p className="text-meta text-ink-2">
                  <KeepTogether text={`${saved.stage} is now at ${formatQuantity(saved.after.done, saved.unit)}${saved.after.percent !== null ? ` (${saved.after.percent}%)` : ""}.`} />
                </p>
              </div>
            ) : null}
            {saved.missingRate ? (
              <p className="text-meta text-watch">Someone has no rate for this stage yet. Add one and their pay is corrected.</p>
            ) : null}
            <Button variant="secondary" onClick={logMore}>
              Log more progress
            </Button>
          </div>
        ) : null}
      </div>

      {saved ? null : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-heading text-ink">Which stage</h2>
            {defaults.latestStages.length > 0 ? (
              <ChoiceChip
                legend="Recent stages"
                name="recent-stage"
                value={stageId}
                options={defaults.latestStages.map((l) => ({ value: l.stageId, label: l.label }))}
                onChange={(v) => {
                  setStageId(v);
                  setPickOther(false);
                }}
              />
            ) : null}
            {defaults.latestStages.length === 0 || pickOther ? (
              <div className="flex flex-col gap-4">
                <Select
                  label="Job"
                  value={projectId}
                  onChange={(e) => {
                    setProjectId(e.target.value);
                    setStageId("");
                  }}
                  options={[{ value: "", label: "Choose a job" }, ...defaults.projects.filter((p) => p.stages.some((s) => s.unit !== null && s.status !== "done")).map((p) => ({ value: p.id, label: p.name }))]}
                />
                <Select
                  label="Stage"
                  value={stage && !latest ? stage.id : ""}
                  disabled={projectId === ""}
                  onChange={(e) => setStageId(e.target.value)}
                  options={[{ value: "", label: "Choose a stage" }, ...stages.filter((s) => s.projectId === projectId).map((s) => ({ value: s.id, label: `${s.name} (${UNIT_WORD[s.unit]})` }))]}
                />
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setPickOther(true)} className="w-full">
                Choose another stage
              </Button>
            )}
            {latest && done !== null ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-body-strong text-ink">{progressLine(done, latest.plannedQuantity, latest.unit)}</p>
                <TapeBar
                  label={`${latest.label} progress`}
                  percent={latest.plannedQuantity ? progressAfter({ done, planned: latest.plannedQuantity }, 0).percent ?? 0 : 0}
                />
              </div>
            ) : null}
          </section>

          <Field
            label="Quantity done"
            inputMode="decimal"
            suffix={UNIT_WORD[unit]}
            value={quantity}
            autoComplete="off"
            onChange={(e) => setQuantity(e.target.value)}
            error={quantity !== "" && qty === null ? "Type a number, like 120 or 12.5." : undefined}
          />

          <section className="flex flex-col gap-2">
            <h2 className="text-heading text-ink">Who did it</h2>
            {defaults.crew.length === 0 ? (
              <p className="text-body text-ink-2">No crew yet. Add your crew first.</p>
            ) : (
              <CrewGroup>
                {defaults.crew.map((c) => (
                  <CrewChip key={c.id} name={c.name} pressed={people.includes(c.id)} onPressedChange={(on) => toggle(c.id, on)} />
                ))}
              </CrewGroup>
            )}
          </section>

          {chosen.length > 1 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-heading text-ink">Split</h2>
              <Segmented
                legend="How to split"
                name="split-mode"
                value={mode}
                onChange={(v) => chooseMode(v === "custom" ? "custom" : "equal")}
                options={[
                  { value: "equal", label: "Equal split" },
                  { value: "custom", label: "Custom split" },
                ]}
              />
              {custom ? (
                <div className="flex flex-col gap-3">
                  {chosen.map((c) => (
                    <Field
                      key={c.id}
                      label={`${c.name}'s share`}
                      inputMode="decimal"
                      suffix="%"
                      autoComplete="off"
                      value={shareText[c.id] ?? ""}
                      onChange={(e) => setShareText((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    />
                  ))}
                  {totalError ? <ErrorMessage>{totalError}</ErrorMessage> : null}
                </div>
              ) : null}
              {each ? (
                <p className="text-meta text-ink-2">
                  {chosen.map((c, i) => `${c.name} ${formatQuantity(each[i] ?? 0, unit)}`).join(", ")}
                </p>
              ) : null}
            </section>
          ) : null}

          <div {...barProps} data-slot="primary-action" className="pin-action flex flex-col gap-3">
            {error ? <ErrorMessage>{error}</ErrorMessage> : null}
            <Button
              disabled={!ready}
              reason={ready || totalError ? undefined : "Choose a stage, a quantity and who did it."}
              loading={saving}
              loadingLabel="Saving progress"
              onClick={save}
              className="w-full"
            >
              Save progress
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Progress while it loads (`?demo=loading`): the switch is live, the rest are blocks shaped like the content. */
export function ProgressSkeleton() {
  return (
    <EntrySkeleton screen="log-progress" active="progress">
      <div className="flex flex-col gap-3">
        <Skeleton width={120} height={24} />
        <Skeleton height={52} />
      </div>
      <FieldSkeleton />
      <div className="flex flex-col gap-2">
        <Skeleton width={120} height={24} />
        <CrewRowsSkeleton count={3} />
      </div>
    </EntrySkeleton>
  );
}
