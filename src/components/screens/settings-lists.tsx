"use client";

import { useState } from "react";
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
import { ErrorMessage } from "@/components/ui/error-message";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { bpText, readShare, shareErrors } from "./settings-input";
import { FORM_GRID, SettingsForm, useSave, type Errors } from "./settings-forms";

const UNITS: { value: Unit | ""; label: string }[] = [
  { value: "", label: "No unit" },
  { value: "m2", label: "Square metres" },
  { value: "lm", label: "Linear metres" },
  { value: "each", label: "Each" },
];

type Row = { key: number; name: string; unit: Unit | ""; labour: string; materials: string };

/** One job type's stage list: name, unit and the labour and materials share of each stage. */
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
  const patch = (key: number, p: Partial<Row>) =>
    setRows((all) => all.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const read = () => rows.map((r) => ({ labour: readShare(r.labour), materials: readShare(r.materials) }));
  const bps = (which: "labour" | "materials") => read().map((r) => ("bp" in r[which] ? r[which].bp : 0));
  const labourTotal = bps("labour").reduce((a, b) => a + b, 0);
  const materialsTotal = bps("materials").reduce((a, b) => a + b, 0);
  const submit = () => {
    const found: Errors = {};
    const parsed = read();
    rows.forEach((r, k) => {
      if (!r.name.trim()) found[`name-${r.key}`] = "Add a name for the stage.";
      const l = parsed[k]!.labour;
      const m = parsed[k]!.materials;
      if ("error" in l) found[`labour-${r.key}`] = l.error;
      if ("error" in m) found[`materials-${r.key}`] = m.error;
    });
    if (!rows.length) found.rows = "Add at least one stage.";
    else if (!Object.keys(found).length) Object.assign(found, shareErrors(bps("labour"), bps("materials")));
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
    <SettingsForm s={s} onSubmit={submit}>
      <ol className="flex flex-col gap-4">
        {rows.map((r, k) => (
          <li key={r.key} className="flex flex-col gap-4 rounded-md border border-line p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-body-strong text-ink">Stage {k + 1}</h2>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))}
              >
                Remove stage {k + 1}
              </Button>
            </div>
            <div className={FORM_GRID}>
              <Field
                label={`Stage ${k + 1} name`}
                inputMode="text"
                value={r.name}
                onChange={(e) => patch(r.key, { name: e.target.value })}
                error={s.errors[`name-${r.key}`]}
              />
              <Select
                label={`Stage ${k + 1} unit`}
                options={UNITS}
                value={r.unit}
                onChange={(e) => patch(r.key, { unit: e.target.value as Unit | "" })}
              />
              <Field
                label={`Stage ${k + 1} labour share`}
                inputMode="decimal"
                suffix="%"
                value={r.labour}
                onChange={(e) => patch(r.key, { labour: e.target.value })}
                error={s.errors[`labour-${r.key}`]}
              />
              <Field
                label={`Stage ${k + 1} materials share`}
                inputMode="decimal"
                suffix="%"
                value={r.materials}
                onChange={(e) => patch(r.key, { materials: e.target.value })}
                error={s.errors[`materials-${r.key}`]}
              />
            </div>
          </li>
        ))}
      </ol>
      {s.errors.rows ? <ErrorMessage>{s.errors.rows}</ErrorMessage> : null}
      <div className="flex flex-col gap-1">
        <p className="text-body text-ink-2">
          Labour adds up to {bpText(labourTotal)}%. Materials add up to {bpText(materialsTotal)}%.
        </p>
        {s.errors.labour ? <ErrorMessage>{s.errors.labour}</ErrorMessage> : null}
        {s.errors.materials ? <ErrorMessage>{s.errors.materials}</ErrorMessage> : null}
      </div>
      <Button
        type="button"
        variant="secondary"
        className="w-full sm:w-auto sm:self-start"
        onClick={() => {
          setRows((all) => [...all, { key: next, name: "", unit: "", labour: "0", materials: "0" }]);
          setNext(next + 1);
        }}
      >
        Add stage
      </Button>
    </SettingsForm>
  );
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Rename the categories and add a new one; the names show in the expense form. */
export function CategoriesForm({
  categories,
  demoOffline,
}: {
  categories: ExpenseCategory[];
  demoOffline: boolean;
}) {
  const s = useSave(demoOffline);
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(categories.map((c) => [c.id, c.name])),
  );
  const [added, setAdded] = useState("");
  const submit = () => {
    const found: Errors = {};
    const all = [
      ...categories.map((c) => ({ key: c.id, name: names[c.id] ?? c.name })),
      ...(added.trim() ? [{ key: "new", name: added }] : []),
    ];
    all.forEach((c, i) => {
      if (!c.name.trim()) found[c.key] = "Add a name for the category.";
      else if (all.some((o, j) => j < i && sameName(o.name, c.name)))
        found[c.key] = `There's already a category called ${c.name.trim()}.`;
    });
    return s.run(
      () => found,
      async () => {
        for (const c of categories) {
          const name = (names[c.id] ?? c.name).trim();
          if (name === c.name) continue;
          const r = await saveCategory({ id: c.id, name, position: c.position });
          if (!r.ok) return r;
        }
        if (added.trim()) {
          const position = Math.max(0, ...categories.map((c) => c.position)) + 1;
          const r = await saveCategory({ id: null, name: added.trim(), position });
          if (!r.ok) return r;
          setAdded("");
        }
        return { ok: true } as const;
      },
    );
  };
  return (
    <SettingsForm s={s} onSubmit={submit}>
      <div className={FORM_GRID}>
        {categories.map((c) => (
          <Field
            key={c.id}
            label={`Rename ${c.name}`}
            inputMode="text"
            value={names[c.id] ?? c.name}
            onChange={(e) => setNames({ ...names, [c.id]: e.target.value })}
            error={s.errors[c.id]}
          />
        ))}
        <Field
          label="New category"
          inputMode="text"
          value={added}
          onChange={(e) => setAdded(e.target.value)}
          error={s.errors.new}
          hint="Optional. Add a name to create it when you save."
        />
      </div>
    </SettingsForm>
  );
}

const ROLES: { value: Role; label: string }[] = [
  { value: "manager", label: "Manager" },
  { value: "foreman", label: "Foreman" },
  { value: "accountant", label: "Accountant" },
];

/** Who is in the workspace and what each person can do. The Owner's role is fixed. */
export function MembersForm({ members, demoOffline }: { members: Member[]; demoOffline: boolean }) {
  const s = useSave(demoOffline);
  const [roles, setRoles] = useState<Record<string, Role>>(() =>
    Object.fromEntries(members.map((m) => [m.id, m.role])),
  );
  const submit = () =>
    s.run(
      () => ({}),
      async () => {
        for (const m of members) {
          const role = roles[m.id] ?? m.role;
          if (m.role === "owner" || role === m.role) continue;
          const r = await setMemberRole(m.id, role);
          if (!r.ok) return r;
        }
        return { ok: true } as const;
      },
    );
  return (
    <SettingsForm s={s} onSubmit={submit}>
      <ul className="flex flex-col gap-4">
        {members.map((m) => (
          <li
            key={m.id}
            className="flex flex-col gap-3 rounded-md border border-line p-4 lg:flex-row lg:items-end lg:justify-between"
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
                onChange={(e) => setRoles({ ...roles, [m.id]: e.target.value as Role })}
                className="lg:w-64"
              />
            )}
          </li>
        ))}
      </ul>
    </SettingsForm>
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
    <SettingsForm s={s} onSubmit={submit}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start lg:gap-x-8">
        {foremen.map((f) => (
          <fieldset
            key={f.memberId}
            className="flex min-w-0 flex-col gap-1 rounded-md border border-line p-4"
          >
            <legend className="max-w-full break-words px-1 text-body-strong text-ink">{f.name}</legend>
            {jobs.map((j) => (
              <Checkbox
                key={j.id}
                label={j.name}
                checked={(picked[f.memberId] ?? f.projectIds).includes(j.id)}
                onCheckedChange={(on) => toggle(f.memberId, j.id, on)}
              />
            ))}
          </fieldset>
        ))}
      </div>
    </SettingsForm>
  );
}
