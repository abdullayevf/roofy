import { describe, expect, it } from "vitest";
import type { AttentionItem } from "../../contracts";
import { splitAttention, sortAttention } from "./home";

const stage = { projectId: "p", projectName: "Smith job", stageId: "s", stageName: "Sheet install", href: "/x" };
const amber = (n: number): AttentionItem => ({
  ...stage,
  id: `gap:${n}`,
  kind: "unpaid_too_long",
  severity: "watch",
  crewMemberId: "c",
  name: "Kev",
  balanceCents: 100,
  since: "2026-09-07",
  href: "/crew/c",
}) as AttentionItem;
const items = (n: number): AttentionItem[] => Array.from({ length: n }, (_, i) => amber(i));

describe("splitAttention", () => {
  it.each([0, 1, 6])("%i items: all shown, no Show row", (n) => {
    const s = splitAttention(items(n));
    expect(s.needsAttention).toHaveLength(n);
    expect(s.moreAttention).toEqual([]);
  });
  it("exactly 7 items: 7 rows and no Show row", () => {
    const s = splitAttention(items(7));
    expect(s.needsAttention).toHaveLength(7);
    expect(s.moreAttention).toEqual([]);
  });
  it.each([
    [8, 2],
    [12, 6],
  ])("%i items: 6 rows, then Show %i more", (n, more) => {
    const all = items(n);
    const s = splitAttention(all);
    expect(s.needsAttention).toEqual(all.slice(0, 6));
    expect(s.moreAttention).toEqual(all.slice(6));
    expect(s.moreAttention).toHaveLength(more);
  });
});

describe("sortAttention", () => {
  it("lifts a red outbox item above every amber kind, keeping the spec order among the rest", () => {
    const outbox: AttentionItem = { id: "o", kind: "outbox_attention", severity: "over", href: "/outbox", count: 1 } as AttentionItem;
    const paused = { ...stage, id: "p", kind: "paused_too_long", severity: "watch", reason: "weather", since: "2026-09-01", workingDays: 6 } as AttentionItem;
    const trending = { ...stage, id: "t", kind: "trending_over", severity: "watch", byCents: 100 } as AttentionItem;
    const over = { ...stage, id: "b", kind: "over_budget", severity: "over", byCents: 50 } as AttentionItem;
    const sorted = sortAttention([paused, amber(1), outbox, trending, over]);
    expect(sorted.map((i) => i.id)).toEqual(["b", "o", "t", "p", "gap:1"]);
  });
});
