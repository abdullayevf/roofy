"use client";

import { useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { CrewDayDefaults, GridCrewForeman, GridCrewManager } from "@/data/contracts";
import type { Hundredths } from "@/domain/types";
import { submit } from "@/offline/submit";
import { cx } from "@/lib/cx";
import { CrewChip, CrewGroup, type CrewChipProps } from "@/components/crew-chip";
import { KeepTogether } from "@/components/keep-together";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { StatusChip } from "@/components/ui/status-chip";
import { CrewRowsSkeleton, ENTRY_WIDTH as WIDTH, EntryDate, EntryEmpty, EntrySkeleton, EntryTabs, FieldSkeleton, PinnedAction, usePinnedBar, withDemo } from "./field-entry";
import { Skeleton } from "@/components/ui/skeleton";
import { basisLabel, buildEntries, canLog, crewDayHint, exceptionFor, initialException, pickableIds, usablePicks } from "./log-input";

type Saved = { state: "logged" | "waiting"; names: string[]; stageLabel: string };

function chipNote(person: GridCrewForeman | GridCrewManager): CrewChipProps["note"] {
  if (person.noWorkOnDate) return { text: "Marked as no work today", tone: "info" };
  if (person.timeOnly) return { text: "Paid from progress, not this grid.", tone: "info" };
  if ("missingRate" in person && person.missingRate) return { text: "No rate for this basis", tone: "watch" };
  if (person.loggedOnDate) return { text: "Already logged today", tone: "info" };
  return undefined;
}

export type LogCrewDayProps = {
  defaults: CrewDayDefaults;
  /** Crew ticked when the screen opens (from "Same as yesterday"). */
  initialTicked?: string[];
  /** What the entry being edited (from the outbox) had for each person: days or hours, and overtime. */
  initialPicks?: { values: Record<string, Hundredths>; multipliers: Record<string, Hundredths> };
  /** The workspace's today; the date can be another day when an entry is reopened from the outbox. */
  today?: string;
  /** The date came from the address (an entry being edited): picks keep it. */
  dateFromAddress?: boolean;
  /** The `?demo=` value, if any, to keep across picks. */
  demo?: string;
  /** The address this screen lives at (the temporary A/B page has its own). */
  basePath?: string;
};

/**
 * Log crew-day grid (flows.md screen 6): date, job, stage, crew ticked with their usual basis, exceptions
 * (half day, hours), Save day. The job and stage live in the address so the crew's bases follow the stage;
 * "Same as yesterday" fills all three and ticks the same crew. The page remounts this with a new `key`
 * whenever those change, so its state always starts from what the address says.
 */
export function LogCrewDay({ defaults, initialTicked = [], initialPicks, today = defaults.date, dateFromAddress = false, demo, basePath = "/log" }: LogCrewDayProps) {
  const router = useRouter();
  const [navigating, startNav] = useTransition();
  const [ticked, setTicked] = useState<Set<string>>(
    () => new Set(pickableIds(defaults.crew, initialTicked)),
  );
  /** People saved in this visit: shown as logged, so a second save can't log them twice. */
  const [justLogged, setJustLogged] = useState<Set<string>>(new Set());
  const [picks] = useState(() => usablePicks(defaults.crew, initialPicks?.values ?? {}, initialPicks?.multipliers ?? {}));
  const [exceptions, setExceptions] = useState<Record<string, Hundredths>>(picks.values);
  const [multipliers, setMultipliers] = useState<Record<string, Hundredths>>(picks.multipliers);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);

  const project = defaults.projects.find((p) => p.id === defaults.projectId) ?? null;
  const stage = project?.stages.find((s) => s.id === defaults.stageId) ?? null;
  const same = defaults.sameAsYesterday;
  const sameStageOpen = same
    ? (defaults.projects.find((p) => p.id === same.projectId)?.stages.find((s) => s.id === same.stageId)?.status ?? "done") !== "done"
    : false;
  const crew = defaults.crew.map((c) => (justLogged.has(c.crewMemberId) ? { ...c, loggedOnDate: true } : c));
  const ready = project !== null && stage !== null && crew.some((c) => ticked.has(c.crewMemberId) && canLog(c));

  const { style, barProps } = usePinnedBar(saved);
  const hint = crewDayHint({
    job: project !== null,
    stage: stage !== null,
    people: crew.some((c) => ticked.has(c.crewMemberId) && canLog(c)),
  });

  const go = (url: string) => startNav(() => router.replace(url));
  /** The address for a new pick: the job and stage; whoever is ticked stays ticked, with their day or hours. */
  const url = (projectId?: string, stageId?: string, crewIds: string[] = [...ticked], keepPicks = true) => {
    const ex = keepPicks
      ? crewIds
          .filter((id) => exceptions[id] !== undefined)
          .map((id) => `${id}:${exceptions[id]}${multipliers[id] && multipliers[id] !== 100 ? `:${multipliers[id]}` : ""}`)
          .join(",")
      : "";
    return withDemo(
      basePath,
      { date: dateFromAddress ? defaults.date : undefined, project: projectId, stage: stageId, crew: crewIds.join(","), ex },
      demo,
    );
  };

  async function save() {
    if (!project || !stage) return;
    setSaving(true);
    setError(null);
    try {
      const entries = buildEntries(crew, ticked, exceptions, multipliers);
      const result = await submit("crew_day", {
        date: defaults.date,
        projectId: project.id,
        stageId: stage.id,
        entries,
      });
      if (result.status === "rejected") {
        setError(result.message);
        return;
      }
      const ids = new Set(entries.map((e) => e.crewMemberId));
      setJustLogged((prev) => new Set([...prev, ...ids]));
      setSaved({
        state: result.status === "applied" ? "logged" : "waiting",
        names: crew.filter((c) => ids.has(c.crewMemberId)).map((c) => c.name),
        stageLabel: `${stage.name} on ${project.name}`,
      });
    } catch {
      setError("Couldn't save the day. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const crewRef = useRef<HTMLElement>(null);
  /** Desktop keyboard (DESIGN.md §8): arrows move between people, Space ticks (the button's own), Enter saves. */
  function onCrewKeyDown(e: KeyboardEvent<HTMLElement>) {
    const row = (e.target as HTMLElement).closest<HTMLButtonElement>("button[aria-pressed]");
    if (!row) return;
    if (e.key === "Enter") {
      e.preventDefault();
      if (ready && !saving) void save();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const rows = [...(crewRef.current?.querySelectorAll<HTMLButtonElement>("button[aria-pressed]:not(:disabled)") ?? [])];
      const at = rows.indexOf(row);
      rows[Math.max(0, Math.min(rows.length - 1, at + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
    }
  }

  function logAnother() {
    setSaved(null);
    setTicked(new Set());
    setExceptions({});
    setMultipliers({});
  }

  if (defaults.projects.length === 0) {
    return (
      <div data-screen="log" className={cx("flex flex-col gap-6", WIDTH)}>
        <EntryTabs active="crew-day" demo={demo} />
        <EntryEmpty
          foreman={defaults.view === "foreman"}
          managerMessage="No jobs yet. Add your first job."
          actionLabel="Add your first job"
          href="/jobs/new"
        />
      </div>
    );
  }

  return (
    <div
      data-screen="log"
      style={saved ? undefined : style}
      className={cx("flex flex-col gap-6", WIDTH, saved ? null : "pin-pad")}
    >
      <EntryTabs active="crew-day" demo={demo} />
      <EntryDate date={defaults.date} today={today} saved={saved !== null} />

      <div data-slot="fields" className="flex flex-col gap-4">
        <Button
          variant="secondary"
          disabled={same === null || saved !== null}
          loading={navigating}
          loadingLabel="Copying"
          onClick={() =>
            same && go(url(same.projectId, sameStageOpen ? same.stageId : undefined, same.crewMemberIds, false))
          }
          className="w-full"
        >
          {same === null ? "No day to copy yet" : "Same as yesterday"}
        </Button>
        <Select
          label="Job"
          value={project?.id ?? ""}
          disabled={saved !== null}
          onChange={(e) => go(url(e.target.value || undefined))}
          options={[
            { value: "", label: "Choose a job" },
            ...defaults.projects.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
        <Select
          label="Stage"
          value={stage?.id ?? ""}
          disabled={project === null || saved !== null}
          onChange={(e) => project && go(url(project.id, e.target.value || undefined))}
          options={[
            { value: "", label: "Choose a stage" },
            ...(project?.stages ?? [])
              .filter((s) => s.status !== "done")
              .map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
      </div>

      <div role="status" className="empty:hidden">
      {saved ? (
        <div className="flex flex-col items-start gap-3 rounded-group border-group bg-surface p-4">
          <StatusChip plain status={saved.state === "logged" ? "sent" : "waiting"} />
          <p className="text-body-strong text-ink">
            {saved.state === "logged" ? "Logged" : "Saved on this device"}: {saved.names.join(", ")}
          </p>
          <p className="text-meta text-ink-2">
            <KeepTogether text={`${saved.stageLabel}.${saved.state === "waiting" ? " It will send when you have signal." : ""}`} />
          </p>
          <Button variant="secondary" onClick={logAnother}>
            Log another stage
          </Button>
        </div>
      ) : null}
      </div>

      {saved ? null : (
        <>
          <section ref={crewRef} onKeyDown={onCrewKeyDown} className="flex flex-col gap-2">
            <h2 className="text-heading text-ink">Who worked</h2>
            <p className="hidden text-meta text-ink-2 lg:block">Arrow keys move, Space ticks, Enter saves the day.</p>
            {crew.length === 0 ? (
              <p className="text-body text-ink-2">No crew yet. Add your crew first.</p>
            ) : (
              <CrewGroup>
                {crew.map((person) => (
                  <CrewChip
                    key={person.crewMemberId}
                    name={person.name}
                    basis={basisLabel(person)}
                    note={chipNote(person)}
                    disabled={!canLog(person)}
                    exception={exceptionFor(person.basis)}
                    pressed={ticked.has(person.crewMemberId)}
                    onPressedChange={(on) =>
                      setTicked((prev) => {
                        const next = new Set(prev);
                        if (on) next.add(person.crewMemberId);
                        else next.delete(person.crewMemberId);
                        return next;
                      })
                    }
                    exceptionValue={exceptions[person.crewMemberId] ?? initialException(person)}
                    onExceptionChange={(v) => setExceptions((prev) => ({ ...prev, [person.crewMemberId]: v }))}
                    multiplier={multipliers[person.crewMemberId] ?? 100}
                    onMultiplierChange={
                      person.basis === "hourly"
                        ? (v) => setMultipliers((prev) => ({ ...prev, [person.crewMemberId]: v }))
                        : undefined
                    }
                  />
                ))}
              </CrewGroup>
            )}
          </section>

          <PinnedAction barProps={barProps} error={error} hint={ready ? undefined : hint}>
            <Button disabled={!ready} loading={saving} loadingLabel="Saving day" onClick={save} className="w-full">
              Save day
            </Button>
          </PinnedAction>
        </>
      )}
    </div>
  );
}

/** The grid while it loads (`?demo=loading`): the switch is live, the rest are blocks shaped like the content. */
export function LogSkeleton() {
  return (
    <EntrySkeleton screen="log" active="crew-day">
      <div className="flex flex-col gap-4">
        <Skeleton height={52} />
        <FieldSkeleton />
        <FieldSkeleton />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton width={120} height={24} />
        <CrewRowsSkeleton count={4} />
      </div>
    </EntrySkeleton>
  );
}
