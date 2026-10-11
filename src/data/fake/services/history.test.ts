import { describe, expect, it } from "vitest";
import { getSeed } from "../store";
import { fake } from "./testing";

const { meta } = getSeed();

describe("record history: filter by job and by crew member", () => {
  it("?job= keeps only rows about that job, newest first, each with its job name", async () => {
    const { data, actor } = fake("manager");
    const all = await data.audit.history(actor);
    const rows = await data.audit.history(actor, { projectId: meta.projects.smith });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(all.length);
    expect(rows.every((r) => r.projectId === meta.projects.smith)).toBe(true);
    expect(rows.map((r) => r.id)).toEqual(all.filter((r) => r.projectId === meta.projects.smith).map((r) => r.id));
    expect(rows.some((r) => r.table === "expense" && r.rowId === meta.expenses.smithSheets)).toBe(true);
    expect(rows[0]!.projectName).toContain("Smith job");
    expect(rows[0]!.subject.length).toBeGreaterThan(0);
  });

  it("?crew= keeps only rows about that person (their rate, advance, logs)", async () => {
    const { data, actor } = fake("owner");
    const all = await data.audit.history(actor);
    const rows = await data.audit.history(actor, { crewMemberId: meta.crew.dima });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(all.length);
    // A pay run belongs to everyone paid in it, so it shows for each of them.
    expect(rows.every((r) => r.crewMemberId === meta.crew.dima || r.table === "pay_run")).toBe(true);
    expect(rows.some((r) => r.table === "ledger_entry")).toBe(true);
    const sam = await data.audit.history(actor, { crewMemberId: meta.crew.sam });
    expect(sam.some((r) => r.table === "rate")).toBe(true);
    expect(sam.some((r) => r.table !== "pay_run" && rows.some((d) => d.id === r.id))).toBe(false);
  });

  it("an unknown job or person has no rows; filters combine", async () => {
    const { data, actor } = fake("manager");
    expect(await data.audit.history(actor, { projectId: "nope" })).toEqual([]);
    expect(await data.audit.history(actor, { crewMemberId: "nope" })).toEqual([]);
    const both = await data.audit.history(actor, { projectId: meta.projects.smith, table: "expense" });
    expect(both.every((r) => r.table === "expense" && r.projectId === meta.projects.smith)).toBe(true);
  });

  it("history is for Owner and Manager: Accountant and Foreman are forbidden", async () => {
    for (const role of ["accountant", "foreman"] as const) {
      const { data, actor } = fake(role);
      await expect(data.audit.history(actor, { projectId: meta.projects.smith })).rejects.toMatchObject({ code: "forbidden" });
    }
  });
});
