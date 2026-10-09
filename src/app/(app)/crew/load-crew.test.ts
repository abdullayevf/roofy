import { describe, expect, it, vi } from "vitest";
import type { DataContext } from "@/data";
import type { CrewList } from "@/data/contracts";
import { loadCrew } from "./load-crew";

const row = (id: string, active: boolean) => ({ id, name: id, type: "employee", active, defaultBasis: "hourly", defaultUnit: null });
const ctx = (rows: ReturnType<typeof row>[]) => {
  const list = vi.fn(async () => ({ view: "foreman", access: {}, rows }) as unknown as CrewList);
  return { list, ctx: { data: { crew: { list } }, actor: {} } as unknown as DataContext };
};

describe("loadCrew", () => {
  it("asks for everyone once and keeps the active rows for the Active filter", async () => {
    const { list, ctx: c } = ctx([row("a", true), row("b", false)]);
    const r = await loadCrew(c, false);
    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledWith({}, { includeInactive: true });
    expect(r).toMatchObject({ kind: "ok", anyCrew: true });
    if (r.kind === "ok") expect(r.list.rows.map((x) => x.id)).toEqual(["a"]);
  });

  it("knows the workspace has crew when only people who left remain", async () => {
    const { ctx: c } = ctx([row("b", false)]);
    const r = await loadCrew(c, false);
    expect(r).toMatchObject({ kind: "ok", anyCrew: true });
    if (r.kind === "ok") expect(r.list.rows).toEqual([]);
  });

  it("shows everyone under All, and says when there is no crew at all", async () => {
    const all = await loadCrew(ctx([row("a", true), row("b", false)]).ctx, true);
    if (all.kind === "ok") expect(all.list.rows).toHaveLength(2);
    expect(await loadCrew(ctx([]).ctx, false)).toMatchObject({ kind: "ok", anyCrew: false });
  });
});
