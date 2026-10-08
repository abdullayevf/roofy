"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DoneProposal } from "@/data/contracts";
import { confirmStageDone, proposeStageDone } from "@/app/actions/stages";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/cx";
import { KeepTogether } from "@/components/keep-together";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ENTRY_WIDTH,
  FieldSkeleton,
  LoadError,
  PinnedAction,
  usePinnedBar,
} from "./field-entry";
import { hundredthsText, parseHundredths, sharesFromText } from "./field-input";
import { doneHint, doneSplit, equalSplitNote, sharesLeftText, splitEdited, unreadableShare } from "./stage-done-input";
import { useOnline } from "./use-online";

const FAILED = "Couldn't mark this stage done. Try again.";

function BackToStage({ jobId, stageId }: { jobId: string; stageId: string }) {
  return (
    <Button variant="link" href={`/jobs/${jobId}/stages/${stageId}`} className="self-start">
      Back to stage
    </Button>
  );
}

/**
 * Stage done (screen 13, Manager/Owner): completion date, note, photo and the lump-sum split.
 * Shares are typed as percentages; every dollar figure comes from the server's proposal, never from here.
 */
export function StageDone({
  proposal,
  today,
  demoOffline,
}: {
  proposal: DoneProposal;
  today: string;
  demoOffline?: boolean;
}) {
  const router = useRouter();
  const online = useOnline(demoOffline);
  const [date, setDate] = useState(proposal.completedOn);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(false);
  const [shareText, setShareText] = useState<Record<string, string>>(() =>
    Object.fromEntries(proposal.crew.map((p) => [p.crewMemberId, hundredthsText(p.shareBp)])),
  );
  // Server amounts for a custom split; the proposal's own amounts while the split is untouched.
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { style, barProps } = usePinnedBar(null);

  const lump = proposal.lumpSumCents;
  const splitNeeded = lump !== null && proposal.crew.length > 0;
  const nobodyLogged = lump !== null && proposal.crew.length === 0;
  const texts = proposal.crew.map((p) => shareText[p.crewMemberId] ?? "");
  const typed = sharesFromText(texts);
  const edited = splitEdited(
    proposal.crew.map((p) => p.shareBp),
    texts,
  );
  const unreadable = unreadableShare(proposal.crew.map((p, i) => ({ name: p.name, text: texts[i]! })));
  const people = proposal.crew.map((p, i) => ({ crewMemberId: p.crewMemberId, bp: typed.bp[i] ?? 0 }));
  const left = splitNeeded ? sharesLeftText(typed.total) : null;
  // The equal split's working line comes from the server's own amounts; once the shares are edited it goes.
  const splitNote = splitNeeded && !edited ? equalSplitNote(proposal.crew.map((p) => ({ name: p.name, amountCents: p.amountCents }))) : null;
  const hint =
    doneHint({ total: typed.total, online, splitNeeded, unreadable, nobodyLogged }) ??
    (date ? undefined : "Pick the date the stage was finished.");
  const ready = hint === undefined;
  const sendKey = JSON.stringify(doneSplit(people, edited, splitNeeded));

  // An edited split that adds up to 100% goes back to the server for its amounts (largest remainder lives there).
  useEffect(() => {
    if (!edited || !splitNeeded || unreadable || typed.total !== 10000) return;
    const send = JSON.parse(sendKey) as ReturnType<typeof doneSplit>;
    if (send.shares.mode !== "custom") return;
    let live = true;
    const bp = [...send.shares.bp];
    void proposeStageDone(proposal.stageId, date || today, { crewMemberIds: send.crewMemberIds, bp })
      .then((r) => {
        if (live && r.ok)
          setCustomAmounts(Object.fromEntries(r.proposal.crew.map((p) => [p.crewMemberId, p.amountCents])));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [sendKey, edited, splitNeeded, unreadable, typed.total, proposal.stageId, date, today]);

  function typeShare(id: string, text: string) {
    setCustomAmounts({});
    setShareText((prev) => ({ ...prev, [id]: text }));
  }

  async function confirm() {
    setSaving(true);
    setError(null);
    try {
      const split = doneSplit(people, edited, splitNeeded);
      const result = await confirmStageDone({
        stageId: proposal.stageId,
        completedOn: date,
        note: note.trim() || null,
        photoFileId: null,
        ...split,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/jobs/${proposal.projectId}/stages/${proposal.stageId}`);
      router.refresh();
    } catch {
      setError(FAILED);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div data-screen="stage-done" style={style} className={cx("flex flex-col gap-6 pin-pad", ENTRY_WIDTH)}>
      <div className="flex flex-col gap-2">
        <BackToStage jobId={proposal.projectId} stageId={proposal.stageId} />
        <h1 className="text-title text-ink [overflow-wrap:anywhere]">
          Mark <KeepTogether text={proposal.stageName} /> done
        </h1>
        <p className="text-meta text-ink-2 [overflow-wrap:anywhere]">{proposal.projectName}</p>
        {lump !== null ? (
          <p data-key-figure="" className="flex flex-wrap items-baseline gap-x-2 pt-2">
            <span data-figure="" className="num text-figure-xl text-ink">
              {formatMoney(lump)}
            </span>
            <span className="text-body text-ink-2">lump sum</span>
          </p>
        ) : null}
      </div>
      <Field
        label="Finished on"
        type="date"
        inputMode="none"
        max={today}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="max-w-60"
      />
      <Field
        label="Note"
        hint="Optional"
        inputMode="text"
        autoComplete="off"
        value={note}
        maxLength={500}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex flex-col gap-1.5">
        <p className="text-body-strong text-ink">Photo</p>
        <span data-photo-optional="" className="text-meta text-ink-2">
          Optional
        </span>
        {photo ? (
          <div className="flex items-center justify-between gap-3">
            <p data-photo="" className="text-body text-ink">
              Photo added
            </p>
            <Button variant="link" onClick={() => setPhoto(false)}>
              Remove photo
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setPhoto(true)} className="self-start">
            Add photo
          </Button>
        )}
      </div>
      {splitNeeded ? (
        <section data-split="" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-heading text-ink">Lump sum split</h2>
            <p className="text-body text-ink-2">
              Shared by everyone who logged work on this stage. Change the shares if it wasn&apos;t equal.
            </p>
          </div>
          <ul className="flex flex-col gap-4">
            {proposal.crew.map((p) => {
              const text = shareText[p.crewMemberId] ?? "";
              const amount = edited ? customAmounts[p.crewMemberId] : p.amountCents;
              const inputId = `share-${p.crewMemberId}`;
              return (
                <li key={p.crewMemberId} data-share-row={p.name} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <label
                    htmlFor={inputId}
                    data-share-name=""
                    className="min-w-24 flex-1 text-body-strong text-ink [overflow-wrap:anywhere]"
                  >
                    {p.name}
                  </label>
                  <Input
                    id={inputId}
                    aria-label={`${p.name}'s share`}
                    inputMode="decimal"
                    suffix="%"
                    autoComplete="off"
                    value={text}
                    invalid={left !== null || parseHundredths(text) === null}
                    onChange={(e) => typeShare(p.crewMemberId, e.target.value)}
                    className="w-28 shrink-0"
                  />
                  <span data-share-amount="" className="num ml-auto min-w-24 text-right text-body text-ink">
                    {amount !== undefined ? formatMoney(amount) : ""}
                  </span>
                </li>
              );
            })}
          </ul>
          {splitNote ? (
            <p data-split-note="" className="text-body text-ink-2">
              {splitNote}
            </p>
          ) : null}
          <p data-shares-left="" className={cx("text-body", left ? "text-ink" : "text-ink-2")}>
            {left ?? "Shares add up to 100%"}
          </p>
        </section>
      ) : nobodyLogged ? (
        <section data-split="" data-split-empty="" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-heading text-ink">Lump sum split</h2>
            <p className="text-body text-ink-2">
              {formatMoney(lump)} is shared by everyone who logged work on this stage. Nobody has logged work on it
              yet.
            </p>
          </div>
          <Button variant="secondary" href={`/log?project=${proposal.projectId}&stage=${proposal.stageId}`} className="self-start">
            Log crew time
          </Button>
        </section>
      ) : null}
      <PinnedAction barProps={barProps} error={error} hint={hint}>
        <Button
          disabled={!ready}
          loading={saving}
          loadingLabel="Marking done"
          onClick={confirm}
          className="w-full"
        >
          Confirm done
        </Button>
      </PinnedAction>
    </div>
  );
}

export function StageDoneError({ jobId, stageId }: { jobId: string; stageId: string }) {
  return (
    <div data-screen="stage-done" className={cx("flex flex-col gap-6", ENTRY_WIDTH)}>
      <BackToStage jobId={jobId} stageId={stageId} />
      <LoadError primary />
    </div>
  );
}

export function StageDoneSkeleton({ jobId, stageId }: { jobId: string; stageId: string }) {
  const { style, barProps } = usePinnedBar(null);
  return (
    <div data-screen="stage-done" aria-busy="true" style={style} className={cx("flex flex-col gap-6 pin-pad", ENTRY_WIDTH)}>
      <div className="flex flex-col gap-2">
        <BackToStage jobId={jobId} stageId={stageId} />
        <Skeleton width={240} height={32} />
        <Skeleton width={160} height={20} />
        <Skeleton width={200} height={44} />
      </div>
      <div data-skeleton-field="">
        <FieldSkeleton />
      </div>
      <div data-skeleton-field="">
        <FieldSkeleton />
      </div>
      <div className="flex flex-col gap-1.5">
        <Skeleton width={72} height={24} />
        <Skeleton width={72} height={20} />
        <Skeleton width={140} height={48} />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Skeleton width={160} height={28} />
          <Skeleton height={48} />
        </div>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} data-skeleton-share-row="" className="flex items-center gap-3">
            <Skeleton height={24} className="flex-1" />
            <Skeleton width={112} height={52} />
            <Skeleton width={96} height={24} />
          </div>
        ))}
        <Skeleton width={180} height={24} />
      </div>
      <PinnedAction barProps={barProps}>
        <Skeleton height={52} />
      </PinnedAction>
    </div>
  );
}
