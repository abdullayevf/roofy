"use client";

import { useId, useState } from "react";
import type { ExpenseCategory, Id, JobType, Member, Role, StageTemplateItem } from "@/data/contracts";
import type { Unit } from "@/domain/types";
import {
  inviteMember,
  saveCategory,
  saveTemplate,
  setAssignments,
  setMemberRole,
} from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { ErrorMessage } from "@/components/ui/error-message";
import { Field } from "@/components/ui/field";
import { List } from "@/components/ui/list";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { Toast } from "@/components/ui/toast";
import { bpText, CATEGORY_NAME_MAX, nameLengthError, readShare, shareErrors } from "./settings-input";
import { FORM_GRID, SettingsForm, useSave, type Errors } from "./settings-forms";
import { NEEDS_CONNECTION } from "./use-online";

const UNITS: { value: Unit | ""; label: string }[] = [
  { value: "", label: "No unit" },
  { value: "m2", label: "Square metres" },
  { value: "lm", label: "Linear metres" },
  { value: "each", label: "Each" },
];

type Row = { key: number; name: string; unit: Unit | ""; labour: string; materials: string };
/** A stage open in the edit sheet. It joins the list only when Done is pressed. */
type Draft = Row & { isNew: boolean };

const unitName = (u: Unit | "") => UNITS.find((x) => x.value === u)?.label ?? "No unit";
/** A share as the list shows it: tidied when it reads, as typed when it does not. */
const shareText = (text: string) => {
  const r = readShare(text);
  return "bp" in r ? bpText(r.bp) : text;
};

/**
 * One job type's stage list: a row per stage (name, unit, shares) that opens an edit sheet, with the running
 * Labour and Materials totals above it. Edits stay on the page until Save changes; Remove sits in the sheet, behind a confirm.
 */
export function TemplateForm({
  jobType,
  items,
  demoOffline,
}: {
  jobType: JobType;
  items: StageTemplateItem[];
  demoOffline: boolean;
}) {
  const s = useSave(demoOffline);
  const [next, setNext] = useState(items.length + 1);
  const [rows, setRows] = useState<Row[]>(() =>
    items.map((i, k) => ({
      key: k,
      name: i.name,
      unit: i.defaultUnit ?? "",
      labour: bpText(i.labourShareBp),
      materials: bpText(i.materialsShareBp),
    })),
  );
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftErrors, setDraftErrors] = useState<Errors>({});
  const [removing, setRemoving] = useState<Row | null>(null);
  const bps = (which: "labour" | "materials") =>
    rows.map((r) => {
      const v = readShare(r[which]);
      return "bp" in v ? v.bp : 0;
    });
  const labourTotal = bps("labour").reduce((a, b) => a + b, 0);
  const materialsTotal = bps("materials").reduce((a, b) => a + b, 0);
  const open = (d: Draft) => {
    setDraftErrors({});
    setDraft(d);
  };
  const patchDraft = (p: Partial<Row>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const done = () => {
    if (!draft) return;
    const found: Errors = {};
    if (!draft.name.trim()) found.name = "Add a name for the stage.";
    const l = readShare(draft.labour);
    const m = readShare(draft.materials);
    if ("error" in l) found.labour = l.error;
    if ("error" in m) found.materials = m.error;
    setDraftErrors(found);
    if (Object.keys(found).length) return;
    const { isNew, ...row } = draft;
    setRows((all) => (isNew ? [...all, row] : all.map((r) => (r.key === row.key ? row : r))));
    if (isNew) setNext((n) => n + 1);
    setDraft(null);
  };
  const submit = () => {
    const found: Errors = {};
    if (!rows.length) found.rows = "Add at least one stage.";
    else Object.assign(found, shareErrors(bps("labour"), bps("materials")));
    return s.run(
      () => found,
      () =>
        saveTemplate({
          jobType,
          items: rows.map((r, k) => ({
            name: r.name.trim(),
            position: k + 1,
            defaultUnit: r.unit || null,
            labourShareBp: bps("labour")[k]!,
            materialsShareBp: bps("materials")[k]!,
          })),
        }),
    );
  };
  return (
    <>
      <SettingsForm s={s} onSubmit={submit} pinned>
        <div className="flex flex-col gap-1">
          <p className="text-body-strong text-ink">
            Labour {bpText(labourTotal)}%. Materials {bpText(materialsTotal)}%.
          </p>
          {s.errors.labour ? <ErrorMessage>{s.errors.labour}</ErrorMessage> : null}
          {s.errors.materials ? <ErrorMessage>{s.errors.materials}</ErrorMessage> : null}
        </div>
        {rows.length ? (
          <List
            className="lg:max-w-3xl"
            rows={rows.map((r) => ({
              key: String(r.key),
              primary: r.name,
              meta: [r.unit ? unitName(r.unit) : "", `Labour ${shareText(r.labour)}%, materials ${shareText(r.materials)}%`]
                .filter(Boolean)
                .join("\n"),
              onClick: () => open({ ...r, isNew: false }),
            }))}
          />
        ) : null}
        {s.errors.rows ? <ErrorMessage>{s.errors.rows}</ErrorMessage> : null}
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto sm:self-start"
          onClick={() => open({ key: next, name: "", unit: "", labour: "0", materials: "0", isNew: true })}
        >
          Add stage
        </Button>
      </SettingsForm>
      <Sheet
        open={draft !== null}
        onOpenChange={(o) => {
          if (!o) setDraft(null);
        }}
        title={draft?.isNew ? "Add a stage" : "Edit stage"}
        primaryAction={
          <Button type="button" onClick={done} className="w-full">
            Done
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Field
            label="Stage name"
            inputMode="text"
            autoComplete="off"
            value={draft?.name ?? ""}
            onChange={(e) => patchDraft({ name: e.target.value })}
            error={draftErrors.name}
          />
          <Select
            label="Unit"
            options={UNITS}
            value={draft?.unit ?? ""}
            onChange={(e) => patchDraft({ unit: e.target.value as Unit | "" })}
          />
          <Field
            label="Labour share"
            inputMode="decimal"
            suffix="%"
            value={draft?.labour ?? ""}
            onChange={(e) => patchDraft({ labour: e.target.value })}
            error={draftErrors.labour}
          />
          <Field
            label="Materials share"
            inputMode="decimal"
            suffix="%"
            value={draft?.materials ?? ""}
            onChange={(e) => patchDraft({ materials: e.target.value })}
            error={draftErrors.materials}
          />
          {draft && !draft.isNew ? (
            <Button
              type="button"
              variant="ghost"
              tone="danger"
              className="w-full sm:w-auto sm:self-start"
              onClick={() => {
                setRemoving(rows.find((r) => r.key === draft.key) ?? null);
                setDraft(null);
              }}
            >
              Remove stage
            </Button>
          ) : null}
        </div>
      </Sheet>
      <Dialog
        open={removing !== null}
        onOpenChange={(o) => {
          if (!o) setRemoving(null);
        }}
        title={`Remove ${removing?.name ?? "this stage"}?`}
        description="The stage leaves this list when you save changes. Jobs you have already made keep their stages."
        confirmLabel="Remove stage"
        tone="danger"
        onConfirm={() => {
          if (removing) setRows((all) => all.filter((x) => x.key !== removing.key));
        }}
      />
    </>
  );
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The expense categories as a list of names. A row opens a sheet to rename it; Add category opens the same sheet. */
export function CategoriesForm({
  categories,
  demoOffline,
}: {
  categories: ExpenseCategory[];
  demoOffline: boolean;
}) {
  const s = useSave(demoOffline);
  const [edit, setEdit] = useState<{ id: Id | null; name: string } | null>(null);
  const open = (id: Id | null, name: string) => {
    s.setErrors({});
    setEdit({ id, name });
  };
  const submit = () => {
    if (!edit) return;
    const found: Errors = {};
    const lengthError = nameLengthError(edit.name, CATEGORY_NAME_MAX);
    if (!edit.name.trim()) found.name = "Add a name for the category.";
    else if (lengthError) found.name = lengthError;
    else if (categories.some((c) => c.id !== edit.id && sameName(c.name, edit.name)))
      found.name = `There's already a category called ${edit.name.trim()}.`;
    const existing = categories.find((c) => c.id === edit.id);
    return s.run(
      () => found,
      async () => {
        const name = edit.name.trim();
        if (existing?.name === name) {
          setEdit(null);
          return { ok: true } as const;
        }
        const position = existing?.position ?? Math.max(0, ...categories.map((c) => c.position)) + 1;
        const r = await saveCategory({ id: edit.id, name, position });
        if (r.ok) setEdit(null);
        return r;
      },
    );
  };
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={!s.online}
          className="w-full sm:w-auto sm:self-start"
          onClick={() => open(null, "")}
        >
          Add category
        </Button>
        {s.online ? null : (
          <p role="status" className="text-body text-ink">
            {NEEDS_CONNECTION}
          </p>
        )}
      </div>
      {categories.length ? (
        <List
          className="lg:max-w-3xl"
          rows={categories.map((c) => ({ key: c.id, primary: c.name, onClick: () => open(c.id, c.name) }))}
        />
      ) : null}
      <Sheet
        open={edit !== null}
        onOpenChange={(o) => {
          if (!o) setEdit(null);
        }}
        title={edit?.id ? "Rename category" : "Add a category"}
        primaryAction={
          <Button
            type="button"
            onClick={submit}
            loading={s.busy}
            loadingLabel="Saving category"
            disabled={!s.online}
            reason={s.online ? undefined : NEEDS_CONNECTION}
            className="w-full"
          >
            Save category
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Field
            label="Category name"
            inputMode="text"
            autoComplete="off"
            value={edit?.name ?? ""}
            onChange={(e) => setEdit((d) => (d ? { ...d, name: e.target.value } : d))}
            error={s.errors.name}
          />
          {s.failed ? <ErrorMessage>{s.failed}</ErrorMessage> : null}
        </div>
      </Sheet>
      <Toast open={s.saved} onOpenChange={s.setSaved} message={s.savedMessage} viewportClassName="toast-above-tabs" />
    </div>
  );
}

const ROLES: { value: Role; label: string }[] = [
  { value: "manager", label: "Manager" },
  { value: "foreman", label: "Foreman" },
  { value: "accountant", label: "Accountant" },
];

/**
 * Who is in the workspace and what each person can do. The Owner's role is fixed. Picking a role saves it at once
 * (there is no Save button here, so Send invite below is the one primary action on the page).
 */
export function MembersForm({ members, demoOffline }: { members: Member[]; demoOffline: boolean }) {
  const s = useSave(demoOffline);
  const [roles, setRoles] = useState<Record<string, Role>>(() =>
    Object.fromEntries(members.map((m) => [m.id, m.role])),
  );
  const pick = (m: Member, role: Role) => {
    const before = roles[m.id] ?? m.role;
    setRoles((r) => ({ ...r, [m.id]: role }));
    void s.run(
      () => ({}),
      async () => {
        const r = await setMemberRole(m.id, role);
        if (!r.ok) setRoles((x) => ({ ...x, [m.id]: before }));
        return r;
      },
      "Role changed.",
    );
  };
  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-line overflow-hidden rounded-group border-group bg-surface">
        {members.map((m) => (
          <li
            key={m.id}
            className="flex min-h-[64px] flex-col justify-center gap-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6"
          >
            <div className="min-w-0 flex-1">
              <p className="break-words text-body-strong text-ink">{m.name}</p>
              <p className="break-all text-body text-ink-2">{m.email}</p>
            </div>
            {m.role === "owner" ? (
              <p className="text-body text-ink">Owner</p>
            ) : (
              <Select
                label={`Role for ${m.name}`}
                options={ROLES}
                value={roles[m.id] ?? m.role}
                disabled={!s.online || s.busy}
                onChange={(e) => pick(m, e.target.value as Role)}
                className="[&>label]:sr-only lg:w-56"
              />
            )}
          </li>
        ))}
      </ul>
      {s.online ? null : (
        <p role="status" className="text-body text-ink">
          {NEEDS_CONNECTION}
        </p>
      )}
      {s.failed ? <ErrorMessage>{s.failed}</ErrorMessage> : null}
      <Toast open={s.saved} onOpenChange={s.setSaved} message={s.savedMessage} viewportClassName="toast-above-tabs" />
    </div>
  );
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Invite someone: a name, an email and a role. `quiet` leaves out the Needs connection sentence when the list above already says it. */
export function InviteForm({ demoOffline, quiet = false }: { demoOffline: boolean; quiet?: boolean }) {
  const s = useSave(demoOffline);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("foreman");
  const submit = () =>
    s.run(
      () => ({
        name: name.trim() ? undefined : "Add the person's name.",
        email: EMAIL_SHAPE.test(email.trim()) ? undefined : "Check the email address.",
      }),
      async () => {
        const r = await inviteMember({ name: name.trim(), email: email.trim(), role });
        if (r.ok) {
          setName("");
          setEmail("");
        } else if (r.code === "conflict") return { ...r, issues: [{ field: "email", message: r.message }] };
        return r;
      },
      "Invite sent.",
    );
  return (
    <SettingsForm s={s} onSubmit={submit} label="Send invite" quiet={quiet}>
      <div className={FORM_GRID}>
        <Field
          label="Name"
          inputMode="text"
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={s.errors.name}
        />
        <Field
          label="Email"
          inputMode="email"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={s.errors.email}
        />
        <Select label="Role" options={ROLES} value={role} onChange={(e) => setRole(e.target.value as Role)} />
      </div>
    </SettingsForm>
  );
}

export type AssignJob = { id: Id; name: string };
export type AssignForeman = { memberId: Id; name: string; projectIds: Id[] };

/** Tick the jobs each foreman can see and log to. */
export function AssignmentsForm({
  foremen,
  jobs,
  demoOffline,
}: {
  foremen: AssignForeman[];
  jobs: AssignJob[];
  demoOffline: boolean;
}) {
  const s = useSave(demoOffline);
  const base = useId();
  const [picked, setPicked] = useState<Record<string, Id[]>>(() =>
    Object.fromEntries(foremen.map((f) => [f.memberId, f.projectIds])),
  );
  const toggle = (member: Id, job: Id, on: boolean) =>
    setPicked((p) => {
      const now = p[member] ?? foremen.find((f) => f.memberId === member)?.projectIds ?? [];
      return { ...p, [member]: on ? [...now, job] : now.filter((x) => x !== job) };
    });
  const submit = () =>
    s.run(
      () => ({}),
      async () => {
        for (const f of foremen) {
          const now = picked[f.memberId] ?? f.projectIds;
          if (now.length === f.projectIds.length && now.every((x) => f.projectIds.includes(x))) continue;
          const r = await setAssignments(f.memberId, now);
          if (!r.ok) return r;
        }
        return { ok: true } as const;
      },
    );
  return (
    <SettingsForm s={s} onSubmit={submit} pinned>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start lg:gap-x-8">
        {foremen.map((f) => (
          <div key={f.memberId} role="group" aria-labelledby={`${base}-${f.memberId}`} className="flex min-w-0 flex-col gap-2">
            <h2 id={`${base}-${f.memberId}`} className="max-w-full break-words text-body-strong text-ink">
              {f.name}
            </h2>
            <div className="divide-y divide-line overflow-hidden rounded-group border-group bg-surface">
              {jobs.map((j) => (
                <Checkbox
                  key={j.id}
                  grouped
                  label={j.name}
                  checked={(picked[f.memberId] ?? f.projectIds).includes(j.id)}
                  onCheckedChange={(on) => toggle(f.memberId, j.id, on)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </SettingsForm>
  );
}
