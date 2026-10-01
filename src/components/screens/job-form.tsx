"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { CaretDown, CaretLeft, CaretUp, CheckCircle } from "@phosphor-icons/react";
import type { ActionResult, Client, Id, JobType, ProjectStatus, StageDraft, StageProposal } from "@/data/contracts";
import { createClient, createProject, updateProject } from "@/app/actions/projects";
import { sum } from "@/domain/money";
import { cx } from "@/lib/cx";
import { formatMoney, formatQuantity } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { ErrorMessage } from "@/components/ui/error-message";
import { Field } from "@/components/ui/field";
import { MoneyField } from "@/components/ui/money-field";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { KeepTogether } from "@/components/keep-together";
import { FORM_WIDTH, FieldSkeleton, PinnedAction, usePinnedBar } from "./field-entry";
import { FOCUS } from "./home-parts";
import {
  JOB_TYPES,
  STATUSES,
  finishProblem,
  jobNameFor,
  jobSaveState,
  proposalSource,
  refusalBarMessage,
  renumber,
  type JobFormValues,
} from "./job-input";
import { NEEDS_CONNECTION, useOnline } from "./use-online";

type StageItem = { uid: number; draft: StageDraft };

export type JobFormProps = {
  mode: "new" | "edit";
  /** Edit only. */
  projectId?: Id;
  clients: Client[];
  /** What the form starts with (a new job: blank, or filled in from the address; an edit: the job). */
  initial: JobFormValues;
  /** The stage list proposed for each job type (last same-type job, else the template); null where there is none. New only. */
  proposals: Partial<Record<JobType, StageProposal | null>>;
  /** The stages are already accepted when the form opens (from the address). */
  initialAccepted?: boolean;
  /** The `?demo=offline` state: the prototype's way to show no signal. */
  demoOffline?: boolean;
};

let nextUid = 1;
const items = (stages: StageDraft[]): StageItem[] => stages.map((draft) => ({ uid: nextUid++, draft }));

/** Server messages that belong under one field, by the field's name in the input. */
function issueFor(result: ActionResult<object> | null, field: string): string | undefined {
  return result && !result.ok ? result.issues.find((i) => i.field === field)?.message : undefined;
}

function QuickAddClient({
  open,
  onOpenChange,
  online,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  online: boolean;
  onAdded: (client: Client) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const result = await createClient({ name, phone: phone.trim() || null, email: null, address: null });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onAdded(result.client);
      setName("");
      setPhone("");
    } catch {
      setError(`Couldn't save the client. ${NEEDS_CONNECTION}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add a client"
      primaryAction={
        <Button
          disabled={!online || !name.trim()}
          reason={online ? undefined : NEEDS_CONNECTION}
          loading={saving}
          loadingLabel="Saving client"
          onClick={save}
          className="w-full"
        >
          Save client
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Client name" inputMode="text" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Phone (optional)" inputMode="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} />
        {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      </div>
    </Sheet>
  );
}

function StageRows({ stages }: { stages: StageDraft[] }) {
  if (stages.length === 0) return <p className="text-body text-ink">There are no stages for this job type yet. Add the first one.</p>;
  const total = sum(stages.map((s) => s.labourBudgetCents));
  return (
    <ol className="divide-y divide-line rounded-group border-group bg-surface">
      {stages.map((s) => (
        <li key={s.position} className="flex min-h-16 items-center justify-between gap-4 px-4 py-2">
          <span className="min-w-0">
            <span className="block text-body-strong text-ink [overflow-wrap:anywhere]">
              <KeepTogether text={s.name} />
            </span>
            {s.unit && s.plannedQuantity ? <span className="block text-meta text-ink">{formatQuantity(s.plannedQuantity, s.unit)}</span> : null}
          </span>
          {s.labourBudgetCents > 0 ? <span className="shrink-0 whitespace-nowrap text-figure num text-ink">{formatMoney(s.labourBudgetCents)}</span> : null}
        </li>
      ))}
      {total > 0 ? (
        <li aria-label="Labour budget total" className="flex min-h-16 border-t-2 border-ink items-center justify-between gap-4 px-4 py-2">
          <span className="text-body-strong text-ink">Labour budget total</span>
          <span className="shrink-0 whitespace-nowrap text-figure num text-ink">{formatMoney(total)}</span>
        </li>
      ) : null}
    </ol>
  );
}

/**
 * Editing the stages: one surface, one compact row per stage (name and labour budget). Tap a row to open its fields;
 * one is open at a time. The visible labels are short ("Name"); each field's spoken name still says which stage.
 */
function StageEditor({ rows, onChange }: { rows: StageItem[]; onChange: Dispatch<SetStateAction<StageItem[]>> }) {
  const [open, setOpen] = useState<number | null>(null);
  // Updates build on the latest rows, so a budget committed by a blur is not lost to the tap that caused the blur.
  const set = (uid: number, patch: Partial<StageDraft>) =>
    onChange((cur) => cur.map((r) => (r.uid === uid ? { ...r, draft: { ...r.draft, ...patch } } : r)));
  // A field commits on blur; a tap on a button may not blur it (iOS), so commit before the open row changes.
  const commit = () => (document.activeElement as HTMLElement | null)?.blur();
  const toggle = (uid: number) => {
    commit();
    setOpen((cur) => (cur === uid ? null : uid));
  };
  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Stages" className="divide-y divide-line rounded-group border-group bg-surface">
        {rows.map((r, i) => {
          const isOpen = open === r.uid;
          return (
            <div key={r.uid}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggle(r.uid)}
                className={cx("flex min-h-16 w-full items-center justify-between gap-4 px-4 py-2 text-left active:bg-galv", FOCUS)}
              >
                <span className="min-w-0 text-body-strong text-ink [overflow-wrap:anywhere]">{r.draft.name.trim() || "New stage"}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {r.draft.labourBudgetCents > 0 ? <span className="whitespace-nowrap text-figure num text-ink">{formatMoney(r.draft.labourBudgetCents)}</span> : null}
                  {isOpen ? <CaretUp size={24} aria-hidden="true" className="text-ink-2" /> : <CaretDown size={24} aria-hidden="true" className="text-ink-2" />}
                </span>
              </button>
              {isOpen ? (
                <div role="group" aria-label={`Stage ${i + 1}`} className="flex flex-col gap-4 px-4 pb-4">
                  <Field
                    label="Name"
                    aria-label={`Stage ${i + 1} name`}
                    inputMode="text"
                    autoComplete="off"
                    value={r.draft.name}
                    onChange={(e) => set(r.uid, { name: e.target.value })}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <MoneyField
                      label="Labour budget"
                      ariaLabel={`Stage ${i + 1} labour budget`}
                      defaultCents={r.draft.labourBudgetCents}
                      onCentsChange={(c) => set(r.uid, { labourBudgetCents: c ?? 0 })}
                    />
                    <MoneyField
                      label="Materials budget"
                      ariaLabel={`Stage ${i + 1} materials budget`}
                      defaultCents={r.draft.materialsBudgetCents}
                      onCentsChange={(c) => set(r.uid, { materialsBudgetCents: c ?? 0 })}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    tone="danger"
                    onClick={() => {
                      setOpen(null);
                      onChange((cur) => cur.filter((x) => x.uid !== r.uid));
                    }}
                    className="-ml-4 self-start"
                  >
                    Remove<span className="sr-only"> stage {i + 1}</span>
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <Button
        variant="secondary"
        onClick={() => {
          commit();
          const uid = nextUid++;
          onChange((cur) => [
            ...cur,
            {
              uid,
              draft: {
                name: "",
                position: cur.length + 1,
                unit: null,
                plannedQuantity: null,
                labourBudgetCents: 0,
                materialsBudgetCents: 0,
                lumpSumCents: null,
              },
            },
          ]);
          setOpen(uid);
        }}
      >
        Add stage
      </Button>
    </div>
  );
}

/**
 * New or edit job (flows.md screen 10): client (pick or quick-add), job type, name, address, contract value, dates and
 * status. A new job also shows the stages proposed for its job type (from the last job of that type, else the
 * template) to Accept or Edit. Admin-only: no signal means a disabled Create job saying "Needs connection".
 */
export function JobForm({ mode, projectId, clients: initialClients, initial, proposals, initialAccepted = false, demoOffline = false }: JobFormProps) {
  const online = useOnline(demoOffline);
  const [clients, setClients] = useState(initialClients);
  const [v, setV] = useState<JobFormValues>(initial);
  const [formKey, setFormKey] = useState(0);
  const proposalFor = (t: JobType | "") => (t ? (proposals[t] ?? null) : null);
  const [stages, setStages] = useState<StageItem[]>(() => items(proposalFor(initial.jobType)?.stages ?? []));
  const [accepted, setAccepted] = useState(initialAccepted);
  const [editingStages, setEditingStages] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ActionResult<object> | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: Id; name: string; stageCount: number } | null>(null);

  const isNew = mode === "new";
  // Changing a field clears the refusal it may have caused, so the red words never outlive the fix.
  const set = <K extends keyof JobFormValues>(key: K, value: JobFormValues[K]) => {
    setV((prev) => ({ ...prev, [key]: value }));
    setResult(null);
    setFailed(null);
  };
  const proposal = proposalFor(v.jobType);
  const stagesOk = stages.length > 0 && stages.every((s) => s.draft.name.trim() !== "");
  const stagesAccepted = accepted && !editingStages;
  const stageHint = stages.length === 0 ? "Add at least one stage." : "Give every stage a name.";
  const acceptStages = () => {
    setEditingStages(false);
    setAccepted(true);
    setStages((rows) => items(renumber(rows.map((r) => r.draft))));
  };
  const state = jobSaveState(v, initial, { isNew, stagesAccepted, noClients: clients.length === 0 });
  const ready = online && state.ready;
  // One line naming only the next thing to do.
  const hint = online ? state.hint : NEEDS_CONNECTION;
  const finishError = finishProblem(v.startDate, v.targetFinish) ?? issueFor(result, "targetFinish");

  const { style, barProps } = usePinnedBar(saved);

  function pickType(type: JobType) {
    set("jobType", type);
    setStages(items(proposalFor(type)?.stages ?? []));
    setAccepted(false);
    setEditingStages(false);
  }

  async function save() {
    if (v.jobType === "") return;
    setSaving(true);
    setResult(null);
    setFailed(null);
    const fields = {
      clientId: v.clientId,
      nickname: jobNameFor(v),
      siteAddress: v.siteAddress.trim(),
      jobType: v.jobType,
      contractCents: v.contractCents ?? 0,
      status: v.status,
      startDate: v.startDate || null,
      targetFinish: v.targetFinish || null,
    };
    try {
      const r = isNew
        ? await createProject({ ...fields, stages: renumber(stages.map((s) => ({ ...s.draft, name: s.draft.name.trim() }))) })
        : await updateProject(projectId!, fields);
      setResult(r);
      if (r.ok) setSaved({ id: r.id, name: fields.nickname, stageCount: stages.length });
      else setFailed(refusalBarMessage(r.issues, r.message, v.nickname.trim() === ""));
    } catch {
      setFailed(`Couldn't save this. ${NEEDS_CONNECTION}`);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setV({ ...initial, clientId: "", jobType: "", nickname: "", siteAddress: "", contractCents: null, status: "active", startDate: "", targetFinish: "" });
    setStages([]);
    setAccepted(false);
    setEditingStages(false);
    setResult(null);
    setFailed(null);
    setSaved(null);
    setFormKey((k) => k + 1);
  }

  const title = saved ? (isNew ? "Job added" : "Changes saved") : isNew ? "New job" : "Edit job";
  const heading = (
    <div className="flex flex-col gap-1">
      <Link
        href="/jobs"
        prefetch={false}
        className={cx("flex min-h-12 items-center gap-1 border-b border-line text-body-strong text-chalk-link", FOCUS)}
      >
        <CaretLeft size={24} aria-hidden="true" />
        Back to jobs
      </Link>
      <h1 className="text-title text-ink">{title}</h1>
    </div>
  );

  if (saved) {
    // The title holds its place from state to state; the one link back is above it. A new job goes straight on to its
    // first log.
    return (
      <div data-screen="job-form" className={cx("flex flex-col gap-6", FORM_WIDTH)}>
        {heading}
        <div role="status" className="flex flex-col items-start gap-4 rounded-group border-group bg-surface p-4">
          <p className="flex items-start gap-2 text-body text-ink">
            <CheckCircle size={24} aria-hidden="true" className="shrink-0 text-good" />
            <KeepTogether text={isNew ? `${saved.name} is ready, with ${saved.stageCount} ${saved.stageCount === 1 ? "stage" : "stages"}.` : `Your changes to ${saved.name} are saved.`} />
          </p>
          {isNew ? (
            <div className="flex w-full flex-col gap-3 sm:flex-row">
              <Button variant="primary" href={`/log?project=${saved.id}`} className="w-full sm:w-auto sm:min-w-52">
                Log today on this job
              </Button>
              <Button variant="secondary" onClick={reset} className="w-full sm:w-auto sm:min-w-44">
                Add another job
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div data-screen="job-form" style={style} className={cx("flex flex-col gap-6", FORM_WIDTH, "pin-pad")}>
      {heading}

      <div key={formKey} className="flex flex-col gap-4">
        {clients.length === 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-body-strong text-ink">Client</p>
            <p className="text-body text-ink">No clients yet. Add the first one.</p>
          </div>
        ) : (
          <Select
            label="Client"
            value={v.clientId}
            onChange={(e) => set("clientId", e.target.value)}
            options={[{ value: "", label: "Choose a client" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
            error={issueFor(result, "clientId")}
          />
        )}
        <Button variant={clients.length === 0 ? "primary" : "secondary"} disabled={!online} onClick={() => setAdding(true)}>
          Quick-add client
        </Button>

        <div className="flex flex-col gap-1.5">
          <p className="text-body-strong text-ink">Job type</p>
          <ChoiceChip
            legend="Job type"
            name="job-type"
            options={JOB_TYPES}
            value={v.jobType}
            onChange={(next) => pickType(next as JobType)}
          />
        </div>

        <Field
          label="Site address"
          inputMode="text"
          autoComplete="off"
          value={v.siteAddress}
          onChange={(e) => set("siteAddress", e.target.value)}
          error={issueFor(result, "siteAddress")}
        />
        <Field
          label="Job name (optional)"
          inputMode="text"
          autoComplete="off"
          hint="Left blank, the job is named by its site address."
          value={v.nickname}
          onChange={(e) => set("nickname", e.target.value)}
          error={v.nickname.trim() === "" ? undefined : issueFor(result, "nickname")}
        />
        <MoneyField
          label="Contract value (optional)"
          hint="Before GST."
          defaultCents={v.contractCents ?? undefined}
          onCentsChange={(c) => set("contractCents", c)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Start date (optional)"
            inputMode="text"
            type="date"
            value={v.startDate}
            onChange={(e) => set("startDate", e.target.value)}
            error={issueFor(result, "startDate")}
          />
          <Field
            label="Target finish (optional)"
            inputMode="text"
            type="date"
            value={v.targetFinish}
            onChange={(e) => set("targetFinish", e.target.value)}
            error={finishError ?? undefined}
          />
        </div>
        <Select
          label="Status"
          value={v.status}
          onChange={(e) => set("status", e.target.value as ProjectStatus)}
          options={STATUSES}
        />
      </div>

      {isNew ? (
        <section className="flex flex-col gap-3" aria-label="Stages">
          <h2 className="text-heading text-ink">Stages</h2>
          {v.jobType === "" ? (
            <p className="text-body text-ink">Choose a job type to see its stages.</p>
          ) : (
            <>
              {proposal ? <p className="text-body text-ink">{proposalSource(proposal)}</p> : null}
              {editingStages ? <StageEditor rows={stages} onChange={setStages} /> : <StageRows stages={stages.map((s) => s.draft)} />}
              {editingStages ? null : (
                <div className="flex flex-col gap-3 sm:flex-row">
                  {stagesAccepted ? (
                    <p role="status" className="flex min-h-12 items-center gap-2 text-body-strong text-good">
                      <CheckCircle size={24} aria-hidden="true" />
                      Stages accepted
                    </p>
                  ) : (
                    <Button variant="secondary" disabled={!stagesOk} onClick={() => setAccepted(true)} className="sm:min-w-44">
                      Accept stages
                    </Button>
                  )}
                  <Button variant="secondary" onClick={() => setEditingStages(true)} className="sm:min-w-44">
                    Edit stages
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      ) : null}

      <PinnedAction barProps={barProps} error={failed} hintOnSide hint={editingStages ? (stagesOk ? undefined : stageHint) : ready ? undefined : hint}>
        {editingStages ? (
          <Button disabled={!stagesOk} onClick={acceptStages} className="w-full">
            Accept stages
          </Button>
        ) : (
          <Button
            disabled={!ready}
            loading={saving}
            loadingLabel={isNew ? "Creating job" : "Saving job"}
            onClick={save}
            className="w-full"
          >
            {isNew ? "Create job" : "Save changes"}
          </Button>
        )}
      </PinnedAction>

      <QuickAddClient
        open={adding}
        onOpenChange={setAdding}
        online={online}
        onAdded={(client) => {
          setClients((prev) => [...prev, client].sort((a, b) => a.name.localeCompare(b.name)));
          set("clientId", client.id);
          setAdding(false);
        }}
      />
    </div>
  );
}

/** The form while it loads (`?demo=loading`): the title is real; the fields and the pinned bar are blocks shaped like them. */
export function JobFormSkeleton({ mode }: { mode: "new" | "edit" }) {
  const { style, barProps } = usePinnedBar(null);
  return (
    <div data-screen="job-form" aria-busy="true" style={style} className={cx("flex flex-col gap-6", FORM_WIDTH, "pin-pad")}>
      <div className="flex flex-col gap-1">
        <Skeleton width={120} height={24} className="my-3" />
        <h1 className="text-title text-ink">{mode === "new" ? "New job" : "Edit job"}</h1>
      </div>
      <div className="flex flex-col gap-4">
        <FieldSkeleton />
        <Skeleton height={52} />
        <div className="flex flex-col gap-1.5">
          <Skeleton width={72} height={24} />
          <div className="flex flex-wrap gap-2">
            {[132, 112, 116, 84, 100].map((w, i) => (
              <Skeleton key={i} width={w} height={48} rounded="full" />
            ))}
          </div>
        </div>
        <FieldSkeleton />
        <FieldSkeleton />
        <FieldSkeleton />
        <FieldSkeleton />
        <FieldSkeleton />
      </div>
      {mode === "new" ? (
        <div className="flex flex-col gap-3">
          <Skeleton width={96} height={24} />
          <Skeleton width={260} height={24} />
        </div>
      ) : null}
      <PinnedAction barProps={barProps}>
        <Skeleton height={52} />
      </PinnedAction>
    </div>
  );
}
