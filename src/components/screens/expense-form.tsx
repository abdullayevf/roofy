"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { WarningDiamond } from "@phosphor-icons/react/dist/ssr";
import { updateExpense } from "@/app/actions/records";
import type { CrewRowForeman, ExpenseCategory, PaidBy, ProjectPick } from "@/data/contracts";
import { submit } from "@/offline/submit";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/cx";
import { KeepTogether } from "@/components/keep-together";
import { Button } from "@/components/ui/button";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { ErrorMessage } from "@/components/ui/error-message";
import { Field } from "@/components/ui/field";
import { MoneyField } from "@/components/ui/money-field";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { FORM_WIDTH, FieldSkeleton, LoadError, PinnedAction, usePinnedBar } from "./field-entry";
import { NEEDS_CONNECTION, useOnline } from "./use-online";
import {
  PAID_BY,
  emptyExpense,
  expenseInput,
  expenseMissingHint,
  expenseFromQuery,
  expenseProblems,
  gstShown,
  reimbursementNote,
  APPROVED_PAY_RUN_WARNING,
  type ExpenseFormValues,
} from "./expense-input";

const LABEL = "text-body-strong text-ink";
const GST_CHOICES = [
  { value: "with", label: "Includes GST" },
  { value: "none", label: "No GST" },
];

function Heading({ backHref, title = "Add expense", back = "Back to expenses" }: { backHref: string; title?: string; back?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <Button variant="link" href={backHref} className="self-start">
        {back}
      </Button>
      <h1 className="text-title text-ink">{title}</h1>
    </div>
  );
}

/** The receipt photo: the camera, or a photo already on the phone; a preview once chosen, and a way to take it off. */
function ReceiptPhoto({ file, onFile }: { file: File | null; onFile: (f: File | null) => void }) {
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
    onFile(f);
  }
  function remove() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    onFile(null);
  }
  return (
    <div data-field="expense-photo" className="flex flex-col gap-1.5">
      <p className={LABEL}>Receipt photo</p>
      <span className="text-meta text-ink-2">Optional. You can save without one.</span>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={choose}
        data-photo-input="camera"
      />
      <input ref={library} type="file" accept="image/*" hidden onChange={choose} data-photo-input="library" />
      {file ? (
        <div className="flex items-center gap-3">
          {preview ? (
            // A local photo shown straight from the phone (a blob address), so not through the image optimiser.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Receipt photo"
              className="size-16 rounded-control border-control object-cover"
            />
          ) : null}
          <p data-photo="" className="min-w-0 flex-1 text-body text-ink [overflow-wrap:anywhere]">
            Photo added
          </p>
          <Button variant="link" onClick={remove}>
            Remove photo
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => camera.current?.click()}>
            Take photo
          </Button>
          <Button variant="secondary" onClick={() => library.current?.click()}>
            Choose photo
          </Button>
        </div>
      )}
    </div>
  );
}

export type ExpenseFormProps = {
  foreman: boolean;
  projects: ProjectPick[];
  categories: ExpenseCategory[];
  crew: CrewRowForeman[];
  /** The workspace's today: the date a new expense starts on. */
  today: string;
  /**
   * The address's fill-ins (`expenseFromQuery`: job, stage, total, supplier, category, paid, crew, gst, check, saved).
   * Read here, not on the server, so the page sends no money-named keys to a foreman.
   */
  query: Record<string, string>;
  /** Reached from a job: the job is already chosen and its picker stays folded. */
  fromJob?: boolean;
  backHref: string;
  /** Editing a saved expense (Owner/Manager, online only): the form starts filled in and saves straight away. */
  edit?: ExpenseEdit;
};

export type ExpenseEdit = {
  expenseId: string;
  values: ExpenseFormValues;
  /** Saving will adjust a later pay run (flows.md "Expense edit"): the warning shows above the form. */
  inApprovedPayRun: boolean;
  /** The receipt already kept with this expense, or null. */
  receiptName: string | null;
  demoOffline: boolean;
};


/**
 * Add expense (flows.md screen 17): receipt photo, date, supplier, total, GST (total ÷ 11 unless changed, or No GST),
 * job, stage, category and who paid. A field entry: it goes through the outbox, so with no signal it is saved on
 * the phone and sends later. A foreman sees no amount but the total they type. Props only.
 */
export function ExpenseForm({
  foreman,
  projects,
  categories,
  crew,
  today,
  query,
  backHref,
  edit,
}: ExpenseFormProps) {
  const router = useRouter();
  const online = useOnline(edit?.demoOffline ?? false);
  const [start] = useState(() =>
    edit ? { values: edit.values, check: false, saved: false } : expenseFromQuery(query, today, { projects, categories, crew }),
  );
  const { values: initial, check: initialCheck, saved: initialWaiting } = start;
  const fromJob = initial.projectId !== "";
  const [v, setV] = useState(initial);
  const [photo, setPhoto] = useState<File | null>(null);
  const [checked, setChecked] = useState(initialCheck);
  const [pickJob, setPickJob] = useState(!fromJob || initial.projectId === "");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<string | null>(initialWaiting ? savedText(initial) : null);
  const { style, barProps } = usePinnedBar(`${checked}|${waiting}`);
  const latest = useRef(v);
  useLayoutEffect(() => {
    latest.current = v;
  });

  function savedText(x: ExpenseFormValues): string {
    const job = projects.find((p) => p.id === x.projectId)?.name;
    return [x.supplier.trim() || "Expense", job].filter(Boolean).join(" on ");
  }
  const set = (patch: Partial<ExpenseFormValues>) => {
    setV((prev) => ({ ...prev, ...patch }));
    setFailed(null);
  };
  const problems = checked ? expenseProblems(v) : { ready: true };
  const project = projects.find((p) => p.id === v.projectId) ?? null;
  const payer = crew.find((c) => c.id === v.crewMemberId) ?? null;
  const gst = gstShown(v);

  async function save() {
    // A tap on Save may not blur the amount still being typed (iOS): commit it now, so the check sees what it became.
    flushSync(() => (document.activeElement as HTMLElement | null)?.blur());
    const now = latest.current;
    setChecked(true);
    const input = expenseInput(now, null);
    if (!input) return;
    setSaving(true);
    setFailed(null);
    if (edit) {
      // The photo stays on this phone until uploads arrive, so an edit leaves the kept receipt alone.
      const patch = { ...input, receiptFileId: undefined };
      try {
        const r = await updateExpense(edit.expenseId, patch);
        if (r.ok) {
          router.replace(`/expenses/${edit.expenseId}?saved=1`);
          return;
        }
        setFailed(r.message);
      } catch {
        setFailed(`Couldn't save the changes. ${NEEDS_CONNECTION}`);
      }
      setSaving(false);
      return;
    }
    try {
      const result = await submit("expense", input);
      if (result.status === "rejected") {
        setFailed(result.message);
        return;
      }
      if (result.status === "applied") {
        router.replace(`/expenses?job=${input.projectId}`);
        return;
      }
      setWaiting(savedText(now));
    } catch {
      setFailed("Couldn't save the expense. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function another() {
    setV(emptyExpense(initial.date, fromJob ? initial.projectId : ""));
    setPhoto(null);
    setChecked(false);
    setWaiting(null);
  }

  if (waiting !== null) {
    return (
      <div data-screen="expense-new" className={cx("flex flex-col gap-6", FORM_WIDTH)}>
        <Heading backHref={backHref} />
        <div
          role="status"
          className="flex flex-col items-start gap-3 rounded-group border-group bg-surface p-4"
        >
          <StatusChip plain status="waiting" />
          <p className="text-body-strong text-ink [overflow-wrap:anywhere]">
            <KeepTogether text={`Saved on this device: ${waiting}.`} />
          </p>
          <p className="text-meta text-ink-2">It will send when you have signal.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={another}>Add another expense</Button>
            <Button variant="secondary" href={backHref}>
              Back to expenses
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-screen={edit ? "expense-edit" : "expense-new"}
      data-view={foreman ? "foreman" : "manager"}
      style={style}
      className={cx("flex flex-col gap-6", FORM_WIDTH, "pin-pad")}
    >
      {edit ? <Heading backHref={backHref} title="Edit expense" back="Back to this expense" /> : <Heading backHref={backHref} />}
      {edit?.inApprovedPayRun ? (
        <p role="note" data-approved-warning="" className="flex items-start gap-2 text-body-strong text-watch">
          <WarningDiamond size={24} aria-hidden="true" className="shrink-0" />
          <span>{APPROVED_PAY_RUN_WARNING}</span>
        </p>
      ) : null}
      <div className="flex flex-col gap-4">
        {edit ? (
          <p data-receipt-kept="" className="text-body text-ink [overflow-wrap:anywhere]">
            {edit.receiptName ? `Receipt attached: ${edit.receiptName}` : "No receipt attached."}
          </p>
        ) : null}
        <ReceiptPhoto file={photo} onFile={setPhoto} />
        <div data-field="expense-total">
          <MoneyField
            label="Total paid"
            hint="Including GST"
            defaultCents={typeof v.totalCents === "number" ? v.totalCents : undefined}
            onCentsChange={(c) => set({ totalCents: c })}
            error={problems.total}
          />
        </div>
        <div data-field="expense-gst" className="flex flex-col gap-1.5">
          <p className={LABEL}>GST</p>
          <Segmented
            legend="GST"
            fill
            name="expense-gst"
            options={GST_CHOICES}
            value={v.gst === "none" ? "none" : "with"}
            onChange={(g) => set({ gst: g === "none" ? "none" : "default", gstCents: null })}
          />
          {v.gst !== "none" && !foreman ? (
            <MoneyField
              // Follows the total (÷ 11) until changed by hand; then it keeps what was typed.
              key={v.gst === "default" ? `gst-${String(v.totalCents)}` : "gst-typed"}
              label="GST amount"
              ariaLabel="GST amount"
              hint={
                v.gst === "default"
                  ? "Worked out as the total ÷ 11. Change it if the receipt differs."
                  : undefined
              }
              defaultCents={gst ?? undefined}
              onCentsChange={(c) => set({ gst: "typed", gstCents: c })}
              error={problems.gst}
            />
          ) : null}
          {v.gst === "none" ? (
            <p data-gst-none="" className="text-meta text-ink-2">
              No GST on this receipt: the whole total is the cost.
            </p>
          ) : null}
          {foreman && v.gst !== "none" ? (
            <p className="text-meta text-ink-2">The office works out the GST from the total.</p>
          ) : null}
        </div>
        <Field
          label="Supplier (optional)"
          inputMode="text"
          autoComplete="off"
          value={v.supplier}
          maxLength={120}
          onChange={(e) => set({ supplier: e.target.value })}
        />
        <Field
          label="Date"
          inputMode="text"
          type="date"
          value={v.date}
          onChange={(e) => set({ date: e.target.value })}
        />
        <div data-field="expense-job" className="flex flex-col gap-1.5">
          <p className={LABEL}>Job</p>
          {pickJob || project === null ? (
            <ChoiceChip
              legend="Job"
              name="expense-job"
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              value={v.projectId}
              onChange={(id) => set({ projectId: id, stageId: null })}
            />
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p data-job-chosen="" className="min-w-0 text-body text-ink [overflow-wrap:anywhere]">
                <KeepTogether text={project.name} />
              </p>
              <Button variant="link" onClick={() => setPickJob(true)}>
                Change job
              </Button>
            </div>
          )}
          {problems.project ? <ErrorMessage>{problems.project}</ErrorMessage> : null}
        </div>
        {project && project.stages.length > 0 ? (
          <div data-field="expense-stage" className="flex flex-col gap-1.5">
            <p className={LABEL}>Stage (optional)</p>
            <ChoiceChip
              legend="Stage (optional)"
              name="expense-stage"
              options={[
                { value: "", label: "Whole job" },
                ...project.stages.map((s) => ({ value: s.id, label: s.name })),
              ]}
              value={v.stageId ?? ""}
              onChange={(id) => set({ stageId: id === "" ? null : id })}
            />
          </div>
        ) : null}
        <div data-field="expense-category" className="flex flex-col gap-1.5">
          <p className={LABEL}>Category</p>
          <ChoiceChip
            legend="Category"
            name="expense-category"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            value={v.categoryId}
            onChange={(id) => set({ categoryId: id })}
          />
          {problems.category ? <ErrorMessage>{problems.category}</ErrorMessage> : null}
        </div>
        <div data-field="expense-paid-by" className="flex flex-col gap-1.5">
          <p className={LABEL}>Paid by</p>
          <Segmented
            legend="Paid by"
            fill
            name="expense-paid-by"
            options={PAID_BY}
            value={v.paidBy}
            onChange={(p) => set({ paidBy: p as PaidBy, crewMemberId: null })}
          />
        </div>
        {v.paidBy === "crew" ? (
          <div data-field="expense-crew" className="flex flex-col gap-1.5">
            <p className={LABEL}>Who paid</p>
            <ChoiceChip
              legend="Who paid"
              name="expense-crew"
              options={crew.map((c) => ({ value: c.id, label: c.name }))}
              value={v.crewMemberId ?? ""}
              onChange={(id) => set({ crewMemberId: id })}
            />
            {payer ? (
              <p data-reimbursement="" className="text-body text-ink">
                {reimbursementNote(payer.name)}
              </p>
            ) : null}
            {problems.crew ? <ErrorMessage>{problems.crew}</ErrorMessage> : null}
          </div>
        ) : null}
      </div>
      {!foreman &&
      typeof v.totalCents === "number" &&
      v.totalCents > 0 &&
      gst !== null &&
      gst <= v.totalCents ? (
        <p data-expense-cost="" className="text-meta text-ink-2 num">
          <KeepTogether text={`Cost to the job ${formatMoney(v.totalCents - gst)} ex GST.`} />
        </p>
      ) : null}
      <PinnedAction
        barProps={barProps}
        error={failed}
        hintOnSide
        hint={edit && !online ? NEEDS_CONNECTION : expenseMissingHint(problems)}
      >
        <Button
          loading={saving}
          loadingLabel={edit ? "Saving changes" : "Saving expense"}
          onClick={save}
          disabled={edit !== undefined && !online}
          className="w-full"
        >
          {edit ? "Save changes" : "Save expense"}
        </Button>
      </PinnedAction>
    </div>
  );
}

/** A server failure: the back row stays, the body says so and offers Try again as the one primary button. */
export function ExpenseFormError({
  backHref,
  title,
  back,
}: {
  backHref: string;
  title?: string;
  back?: string;
}) {
  return (
    <div data-screen="expense-new" className={cx("flex flex-col gap-6", FORM_WIDTH)}>
      <Heading backHref={backHref} title={title} back={back} />
      <LoadError primary />
    </div>
  );
}

/** The form while it loads (`?demo=loading`): the title is real; the fields and the pinned bar are blocks shaped like them. */
export function ExpenseFormSkeleton({ edit = false }: { edit?: boolean }) {
  const { style, barProps } = usePinnedBar(null);
  const chips = (widths: number[]) => (
    <div className="flex flex-col gap-1.5">
      <Skeleton width={120} height={24} />
      <div className="flex flex-wrap gap-2">
        {widths.map((w, i) => (
          <Skeleton key={i} width={w} height={48} rounded="full" />
        ))}
      </div>
    </div>
  );
  return (
    <div
      data-screen="expense-new"
      aria-busy="true"
      style={style}
      className={cx("flex flex-col gap-6", FORM_WIDTH, "pin-pad")}
    >
      <div className="flex flex-col gap-1">
        <Skeleton width={160} height={24} className="my-3" />
        <h1 className="text-title text-ink">{edit ? "Edit expense" : "Add expense"}</h1>
      </div>
      <div className="flex flex-col gap-4">
        {chips([120, 130])}
        <FieldSkeleton />
        <div className="flex flex-col gap-1.5">
          <Skeleton width={60} height={24} />
          <Skeleton height={56} />
        </div>
        <FieldSkeleton />
        <FieldSkeleton />
        {chips([140, 120, 160])}
        {chips([100, 90, 110])}
      </div>
      <PinnedAction barProps={barProps}>
        <Skeleton height={52} />
      </PinnedAction>
    </div>
  );
}
