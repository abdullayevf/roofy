"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { Receipt, WarningDiamond } from "@phosphor-icons/react/dist/ssr";
import { updateExpense } from "@/app/actions/records";
import type { CrewRowForeman, ExpenseCategory, PaidBy, ProjectPick } from "@/data/contracts";
import { submit } from "@/offline/submit";
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
  expensePatch,
  gstEdit,
  jobCostFigure,
  receiptToSend,
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

/** From 1024 px the form uses the width: two columns, and Save sits in the title row (the pinned bar passed as children). */
const FORM_WIDE = cx(FORM_WIDTH, "lg:max-w-240");

/** The back row and the title; the pinned bar goes in the title row, where it is the Save button on a desktop (fixed on a phone). */
function Heading({
  backHref,
  title = "Add expense",
  back = "Back to expenses",
  children,
}: {
  backHref: string;
  title?: string;
  back?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Button variant="link" href={backHref} className="self-start">
        {back}
      </Button>
      <div className="flex items-start justify-between gap-6">
        <h1 className="text-title text-ink lg:flex lg:min-h-13 lg:items-center">{title}</h1>
        {children}
      </div>
    </div>
  );
}

/**
 * The receipt photo: the camera, or a photo already on the phone; once attached (just picked, or kept with a saved
 * expense) a thumbnail row with Replace and Remove.
 */
function ReceiptPhoto({
  file,
  onFile,
  kept = null,
  onRemoveKept,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  /** Edit: the receipt saved with the expense, until it is replaced or removed. */
  kept?: string | null;
  onRemoveKept?: () => void;
}) {
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
    if (file) onFile(null);
    else onRemoveKept?.();
  }
  const attached = file !== null || kept !== null;
  return (
    <div data-field="expense-photo" className="flex flex-col gap-1.5">
      <p className={LABEL}>Receipt photo (optional)</p>
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
      {attached ? (
        <div className="flex flex-col gap-3">
          <div data-receipt-line="" className="flex items-center gap-3">
            {file && preview ? (
              // A local photo shown straight from the phone (a blob address), so not through the image optimiser.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Receipt photo"
                className="size-16 rounded-control border-control object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex size-16 shrink-0 items-center justify-center rounded-control border-control bg-surface text-ink-2"
              >
                <Receipt size={32} />
              </span>
            )}
            {file ? (
              <p data-photo="" className="min-w-0 flex-1 truncate text-body text-ink">
                Photo added
              </p>
            ) : (
              <p
                data-receipt-kept=""
                title={kept ?? undefined}
                className="min-w-0 flex-1 truncate text-body text-ink"
              >
                {kept}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => library.current?.click()}>
              Replace photo
            </Button>
            <Button variant="secondary" onClick={remove}>
              Remove photo
            </Button>
          </div>
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
  /** The workspace is GST registered: the cost to the job is ex GST; when not, GST is a real cost (pay rules §11). Left out for a foreman, so the page's data never names it. */
  gstRegistered?: boolean;
  /** Fake data only: the stand-in receipt id sent when a photo was picked (uploads arrive in Phase 5). */
  placeholderReceiptId?: string | null;
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
  gstRegistered = true,
  placeholderReceiptId = null,
}: ExpenseFormProps) {
  const router = useRouter();
  const online = useOnline(edit?.demoOffline ?? false);
  const [start] = useState(() =>
    edit
      ? { values: edit.values, check: false, saved: false }
      : expenseFromQuery(query, today, { projects, categories, crew }),
  );
  const { values: initial, check: initialCheck, saved: initialWaiting } = start;
  const fromJob = initial.projectId !== "";
  const [v, setV] = useState(initial);
  const [photo, setPhoto] = useState<File | null>(null);
  const [kept, setKept] = useState<string | null>(edit?.receiptName ?? null);
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
  const cost = foreman ? null : jobCostFigure(v, gstRegistered);

  async function save() {
    // A tap on Save may not blur the amount still being typed (iOS): commit it now, so the check sees what it became.
    flushSync(() => (document.activeElement as HTMLElement | null)?.blur());
    const now = latest.current;
    setChecked(true);
    const input = expenseInput(now, receiptToSend(photo !== null, placeholderReceiptId));
    if (!input) return;
    setSaving(true);
    setFailed(null);
    if (edit) {
      // A new photo sends the stand-in id (fake data; uploads arrive in Phase 5), else the saved receipt is kept or removed.
      const receipt =
        photo !== null
          ? (placeholderReceiptId ?? "keep")
          : kept === null && edit.receiptName !== null
            ? null
            : "keep";
      const patch = expensePatch(now, receipt);
      if (!patch) return;
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
          <Button onClick={another}>Add another expense</Button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-screen={edit ? "expense-edit" : "expense-new"}
      data-view={foreman ? "foreman" : "manager"}
      style={style}
      className={cx("flex flex-col gap-6", FORM_WIDE, "pin-pad pin-edge")}
    >
      <Heading backHref={backHref} {...(edit ? { title: "Edit expense", back: "Back to this expense" } : {})}>
        <PinnedAction
          barProps={barProps}
          className="pin-head"
          error={failed}
          hintOnSide
          hint={edit && !online ? NEEDS_CONNECTION : expenseMissingHint(problems)}
          figure={
            cost === null ? undefined : (
              <p data-expense-cost="" className="flex flex-col num">
                <span className="text-meta text-ink-2">Cost to the job</span>
                <span className="text-body-strong text-ink">
                  <KeepTogether text={cost} />
                </span>
              </p>
            )
          }
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
      </Heading>
      {edit?.inApprovedPayRun ? (
        <p
          role="note"
          data-approved-warning=""
          className="flex items-start gap-2 text-body-strong text-watch"
        >
          <WarningDiamond size={24} aria-hidden="true" className="shrink-0" />
          <span>{APPROVED_PAY_RUN_WARNING}</span>
        </p>
      ) : null}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10">
        <div className="flex flex-col gap-6">
          <ReceiptPhoto file={photo} onFile={setPhoto} kept={kept} onRemoveKept={() => setKept(null)} />
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
              equal
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
                onCentsChange={(c) => {
                  const change = gstEdit(latest.current, c);
                  if (change) set(change);
                }}
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
            error={problems.date}
          />
        </div>
        <div className="flex flex-col gap-6">
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
              equal
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
      </div>
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
      className={cx("flex flex-col gap-6", FORM_WIDE, "pin-pad pin-edge")}
    >
      <div className="flex flex-col gap-1">
        <Skeleton width={160} height={24} className="my-3" />
        <div className="flex items-start justify-between gap-6">
          <h1 className="text-title text-ink lg:flex lg:min-h-13 lg:items-center">
            {edit ? "Edit expense" : "Add expense"}
          </h1>
          <PinnedAction barProps={barProps} className="pin-head">
            <Skeleton height={52} className="w-full lg:w-48 lg:self-end" />
          </PinnedAction>
        </div>
      </div>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10">
        <div className="flex flex-col gap-6">
          {chips([120, 130])}
          <FieldSkeleton />
          <div className="flex flex-col gap-1.5">
            <Skeleton width={60} height={24} />
            <Skeleton height={56} />
          </div>
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
        <div className="flex flex-col gap-6">
          {chips([140, 120, 160])}
          {chips([100, 90, 110])}
          <div className="flex flex-col gap-1.5">
            <Skeleton width={80} height={24} />
            <Skeleton height={60} />
          </div>
        </div>
      </div>
    </div>
  );
}
