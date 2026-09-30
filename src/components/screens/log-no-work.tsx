"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CrewDayDefaults, NoWorkReason } from "@/data/contracts";
import { submit } from "@/offline/submit";
import { formatDate } from "@/lib/format";
import { cx } from "@/lib/cx";
import { CrewChip, CrewGroup, type CrewChipProps } from "@/components/crew-chip";
import { Button } from "@/components/ui/button";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { ErrorMessage } from "@/components/ui/error-message";
import { Field } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { ENTRY_WIDTH, EntryDate, EntryEmpty, EntryTabs, usePinnedBar, withDemo } from "./field-entry";
import { basisLabel } from "./log-input";
import { reasonLabel } from "./field-input";

const REASONS: NoWorkReason[] = ["rain", "leave", "sick", "other"];

export type NoWorkEntryProps = {
  defaults: CrewDayDefaults;
  today: string;
  start: { crewMemberIds: string[]; reason: NoWorkReason | null };
  demo?: string;
};

type Person = CrewDayDefaults["crew"][number];

function chipNote(p: Person, day: string): CrewChipProps["note"] {
  if (p.loggedOnDate) return { text: `${p.name} already has a log ${day}. Remove it first to mark no work.`, tone: "info" };
  if (p.noWorkOnDate) return { text: `Already marked as ${reasonLabel(p.noWorkOnDate).toLowerCase()}. Saving changes it.`, tone: "info" };
  return undefined;
}

/**
 * No-work marker (flows.md screen 8): who didn't work, on which day (today or yesterday) and why. Someone who
 * already has a log that day can't be marked; nothing is paid for a no-work day.
 */
export function NoWorkEntry({ defaults, today, start, demo }: NoWorkEntryProps) {
  const router = useRouter();
  const [, startNav] = useTransition();
  const [people, setPeople] = useState<string[]>(start.crewMemberIds);
  const [reason, setReason] = useState<NoWorkReason | "">(start.reason ?? "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ state: "logged" | "waiting"; text: string } | null>(null);
  const { barRef, style } = usePinnedBar(saved);

  const day = defaults.date === today ? "today" : "that day";
  const ready = people.length > 0 && reason !== "";

  if (defaults.crew.length === 0) {
    return (
      <div data-screen="log-no-work" className={cx("flex flex-col gap-6", ENTRY_WIDTH)}>
        <EntryTabs active="no-work" demo={demo} />
        <EntryEmpty foreman={defaults.view === "foreman"} managerMessage="No crew yet. Add your first crew member." actionLabel="Add your first crew member" href="/crew" />
      </div>
    );
  }

  const url = (dayWord: "today" | "yesterday") =>
    withDemo("/log/no-work", { day: dayWord === "yesterday" ? "yesterday" : undefined, crew: people.join(","), reason }, demo);

  async function save() {
    if (reason === "") return;
    setSaving(true);
    setError(null);
    try {
      const result = await submit("no_work", { crewMemberIds: people, date: defaults.date, reason, note: note.trim() || null });
      if (result.status === "rejected") {
        setError(result.message);
        return;
      }
      const names = defaults.crew.filter((c) => people.includes(c.crewMemberId)).map((c) => c.name);
      setSaved({
        state: result.status === "applied" ? "logged" : "waiting",
        text: `${names.join(" and ")} marked as ${reasonLabel(reason).toLowerCase()} on ${formatDate(defaults.date, today)}`,
      });
    } catch {
      setError("Couldn't save this. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      data-screen="log-no-work"
      style={saved ? undefined : style}
      className={cx("flex flex-col gap-6", ENTRY_WIDTH, saved ? null : "max-lg:pb-[var(--pin-action-height)]")}
    >
      <EntryTabs active="no-work" demo={demo} />
      <EntryDate date={defaults.date} today={today} saved={saved !== null} />

      <div role="status" className="empty:hidden">
        {saved ? (
          <div className="flex flex-col items-start gap-3 rounded-group border-group bg-surface p-4">
            <StatusChip status={saved.state === "logged" ? "sent" : "waiting"} />
            <p className="text-body-strong text-ink">
              {saved.state === "logged" ? "Saved" : "Saved on this device"}: {saved.text}
            </p>
            {saved.state === "waiting" ? <p className="text-meta text-ink-2">It will send when you have signal.</p> : null}
            <Button
              variant="secondary"
              onClick={() => {
                setSaved(null);
                setPeople([]);
                setReason("");
                setNote("");
              }}
            >
              Mark someone else
            </Button>
          </div>
        ) : null}
      </div>

      {saved ? null : (
        <>
          <ChoiceChip
            legend="Day"
            name="no-work-day"
            value={defaults.date === today ? "today" : "yesterday"}
            options={[
              { value: "today", label: "Today" },
              { value: "yesterday", label: "Yesterday" },
            ]}
            onChange={(v) => startNav(() => router.replace(url(v === "yesterday" ? "yesterday" : "today")))}
          />

          <section className="flex flex-col gap-2">
            <h2 className="text-heading text-ink">Who didn&apos;t work</h2>
            <CrewGroup>
              {defaults.crew.map((p) => (
                <CrewChip
                  key={p.crewMemberId}
                  name={p.name}
                  basis={basisLabel(p)}
                  note={chipNote(p, day)}
                  disabled={p.loggedOnDate}
                  pressed={people.includes(p.crewMemberId)}
                  onPressedChange={(on) => setPeople((prev) => (on ? [...prev, p.crewMemberId] : prev.filter((x) => x !== p.crewMemberId)))}
                />
              ))}
            </CrewGroup>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-heading text-ink">Why</h2>
            <ChoiceChip
              legend="Reason"
              name="no-work-reason"
              value={reason}
              options={REASONS.map((r) => ({ value: r, label: reasonLabel(r) }))}
              onChange={(v) => setReason(REASONS.find((r) => r === v) ?? "")}
            />
            <Field label="Note" hint="Optional" inputMode="text" value={note} autoComplete="off" onChange={(e) => setNote(e.target.value)} />
          </section>

          <div ref={barRef} data-slot="primary-action" className="pin-action flex flex-col gap-3">
            {error ? <ErrorMessage>{error}</ErrorMessage> : null}
            <Button
              disabled={!ready}
              reason={ready ? undefined : "Choose who didn't work and why."}
              loading={saving}
              loadingLabel="Saving"
              onClick={save}
              className="w-full"
            >
              Save
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** No-work while it loads (`?demo=loading`). */
export function NoWorkSkeleton() {
  return (
    <div data-screen="log-no-work" aria-busy="true" className={cx("flex flex-col gap-6", ENTRY_WIDTH)}>
      <h1 className="text-title text-ink">Log</h1>
      <Skeleton height={60} />
      <div className="flex flex-col gap-2">
        <Skeleton width={60} height={20} />
        <Skeleton width={200} height={24} />
      </div>
      <Skeleton height={52} />
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
