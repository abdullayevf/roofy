"use client";

import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { CrewDayDefaults, GridCrewForeman, GridCrewManager } from "@/data/contracts";
import type { Hundredths } from "@/domain/types";
import { submit } from "@/offline/submit";
import { formatDate } from "@/lib/format";
import { cx } from "@/lib/cx";
import { CrewChip, CrewGroup, type CrewChipProps } from "@/components/crew-chip";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { basisLabel, buildEntries, canLog, exceptionFor, initialException, pickableIds } from "./log-input";

const WIDTH = "max-w-150";

type Saved = { state: "logged" | "waiting"; names: string[]; stageLabel: string };

function chipNote(person: GridCrewForeman | GridCrewManager): CrewChipProps["note"] {
  if (person.noWorkOnDate) return { text: "Marked as no work today", tone: "info" };
  if (person.timeOnly) return { text: "Paid from progress, not this grid.", tone: "info" };
  if ("missingRate" in person && person.missingRate) return { text: "No rate for this basis", tone: "watch" };
  if (person.loggedOnDate) return { text: "Already logged today", tone: "info" };
  return undefined;
}

/** `?demo=` (and only that) rides along when the job or stage changes, so a demo state survives a pick. */
function logUrl(
  basePath: string,
  params: { project?: string; stage?: string; crew?: string[]; demo?: string },
): string {
  const q = new URLSearchParams();
  if (params.project) q.set("project", params.project);
  if (params.stage) q.set("stage", params.stage);
  if (params.crew && params.crew.length > 0) q.set("crew", params.crew.join(","));
  if (params.demo) q.set("demo", params.demo);
  const s = q.toString();
  return s ? `${basePath}?${s}` : basePath;
}

export type LogCrewDayProps = {
  defaults: CrewDayDefaults;
  /** Crew ticked when the screen opens (from "Same as yesterday"). */
  initialTicked?: string[];
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
export function LogCrewDay({ defaults, initialTicked = [], demo, basePath = "/log" }: LogCrewDayProps) {
  const router = useRouter();
  const [navigating, startNav] = useTransition();
  const [ticked, setTicked] = useState<Set<string>>(
    () => new Set(pickableIds(defaults.crew, initialTicked)),
  );
  /** People saved in this visit: shown as logged, so a second save can't log them twice. */
  const [justLogged, setJustLogged] = useState<Set<string>>(new Set());
  const [exceptions, setExceptions] = useState<Record<string, Hundredths>>({});
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

  // The pinned bar's height changes with its reason line and error message; the page pads by what it measures.
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState("9rem");
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const measure = () => setBarHeight(`${Math.ceil(el.getBoundingClientRect().height) + 8}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [saved]);

  const go = (url: string) => startNav(() => router.replace(url));

  async function save() {
    if (!project || !stage) return;
    setSaving(true);
    setError(null);
    try {
      const entries = buildEntries(crew, ticked, exceptions);
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

  function logAnother() {
    setSaved(null);
    setTicked(new Set());
    setExceptions({});
  }

  return (
    <div
      data-screen="log"
      style={saved ? undefined : ({ "--pin-action-height": barHeight } as CSSProperties)}
      className={cx("flex flex-col gap-6", WIDTH, saved ? null : "max-lg:pb-[var(--pin-action-height)]")}
    >
      <h1 className="text-title text-ink">Log</h1>

      <div className="flex flex-col gap-2">
        <p className="text-meta text-ink-2">Date</p>
        <p className="text-heading text-ink">Today, {formatDate(defaults.date, defaults.date)}</p>
        <span aria-hidden="true" data-slot="date-rule" className="relative block h-[1.5px] bg-ink">
          <span
            data-testid="chalk-line"
            className={cx(
              "absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-chalk transition-[width] duration-300 ease-out motion-reduce:transition-none",
              saved ? "w-full" : "w-0",
            )}
          />
        </span>
      </div>

      <div data-slot="fields" className="flex flex-col gap-4">
        <Button
          variant="secondary"
          disabled={same === null || saved !== null}
          loading={navigating}
          loadingLabel="Copying"
          onClick={() =>
            same && go(logUrl(basePath, { project: same.projectId, stage: sameStageOpen ? same.stageId : undefined, crew: same.crewMemberIds, demo }))
          }
          className="w-full"
        >
          {same === null ? "No day to copy yet" : "Same as yesterday"}
        </Button>
        <Select
          label="Job"
          value={project?.id ?? ""}
          disabled={saved !== null}
          onChange={(e) => go(logUrl(basePath, { project: e.target.value || undefined, demo }))}
          options={[
            { value: "", label: "Choose a job" },
            ...defaults.projects.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
        <Select
          label="Stage"
          value={stage?.id ?? ""}
          disabled={project === null || saved !== null}
          onChange={(e) => project && go(logUrl(basePath, { project: project.id, stage: e.target.value || undefined, demo }))}
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
          <StatusChip status={saved.state === "logged" ? "sent" : "waiting"} />
          <p className="text-body-strong text-ink">
            {saved.state === "logged" ? "Logged" : "Saved on this phone"}: {saved.names.join(", ")}
          </p>
          <p className="text-meta text-ink-2">
            {saved.stageLabel}.
            {saved.state === "waiting" ? " It will send when you have signal." : ""}
          </p>
          <Button variant="secondary" onClick={logAnother}>
            Log another stage
          </Button>
        </div>
      ) : null}
      </div>

      {saved ? null : (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="text-heading text-ink">Who worked</h2>
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
                  />
                ))}
              </CrewGroup>
            )}
          </section>

          <div ref={barRef} data-slot="primary-action" className="pin-action flex flex-col gap-3">
            {error ? <ErrorMessage>{error}</ErrorMessage> : null}
            <Button
              disabled={!ready}
              reason={ready ? undefined : "Choose a job, a stage and at least one person."}
              loading={saving}
              loadingLabel="Saving day"
              onClick={save}
              className="w-full"
            >
              Save day
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** The grid while it loads (`?demo=loading`): `line` blocks sized like the content. */
export function LogSkeleton() {
  return (
    <div data-screen="log" aria-busy="true" className={cx("flex flex-col gap-6", WIDTH)}>
      <h1 className="text-title text-ink">Log</h1>
      <div className="flex flex-col gap-2">
        <Skeleton width={60} height={20} />
        <Skeleton width={200} height={24} />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton height={52} />
        <Skeleton height={52} />
        <Skeleton height={52} />
      </div>
      <div className="divide-y divide-line overflow-hidden rounded-group border-group bg-surface">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="px-4 py-4">
            <Skeleton height={32} />
          </div>
        ))}
      </div>
      <Skeleton height={52} />
    </div>
  );
}
