import { describe, expect, it } from "vitest";
import { v7 as uuidv7 } from "uuid";
import type { MutationEnvelope } from "./contracts";
import { parseMutation, parsePushRequest, PAYLOAD_SCHEMAS } from "./mutations";

const envelope = (type: MutationEnvelope["type"], payload: unknown, extra: Record<string, unknown> = {}) => ({
  id: uuidv7(),
  type,
  schemaVersion: 1,
  appVersion: "0.1.0",
  createdAt: "2026-09-27T21:00:00.000Z",
  payload,
  ...extra,
});

const crewDay = {
  date: "2026-09-28",
  projectId: "p1",
  stageId: "s1",
  entries: [
    { crewMemberId: "sam", basis: "daily", days: 50, hours: 400, multiplier: null },
    { crewMemberId: "jake", basis: "hourly", days: null, hours: 750, multiplier: 150 },
    { crewMemberId: "dima", basis: "time_only", days: null, hours: 800, multiplier: null },
  ],
};

const expense = {
  date: "2026-09-23",
  supplier: "Bunnings",
  totalCents: 11000,
  gstCents: null,
  projectId: "p1",
  stageId: null,
  categoryId: "c1",
  paidBy: "crew",
  crewMemberId: "dima",
  receiptFileId: null,
};

const rejected = (raw: unknown) => {
  const r = parseMutation(raw);
  if (r.ok) throw new Error("expected a rejection");
  return r.message;
};

describe("mutation envelope", () => {
  it("accepts every field entry type with a UUIDv7 id", () => {
    const payloads: Record<MutationEnvelope["type"], unknown> = {
      crew_day: crewDay,
      progress: {
        stageId: "s1",
        date: "2026-09-28",
        quantity: 12000,
        crewMemberIds: ["sam", "dima"],
        shares: { mode: "equal" },
        photoFileId: null,
        note: null,
      },
      no_work: { crewMemberIds: ["jake"], date: "2026-09-28", reason: "rain", note: null },
      stage_pause: {
        stageId: "s1",
        date: "2026-09-28",
        reason: "weather",
        note: "Forecast clearing Thursday",
      },
      stage_resume: { stageId: "s1", date: "2026-10-01" },
      expense,
    };
    for (const [type, payload] of Object.entries(payloads)) {
      const r = parseMutation(envelope(type as MutationEnvelope["type"], payload));
      expect(r.ok, type).toBe(true);
    }
  });

  it("rejects a non-v7 id, another schema version, an unknown type and a bad instant, in plain words", () => {
    expect(
      rejected(envelope("stage_resume", { stageId: "s", date: "2026-10-01" }, { id: crypto.randomUUID() })),
    ).toBe("This entry has a bad id. Discard it and enter it again.");
    expect(
      rejected(envelope("stage_resume", { stageId: "s", date: "2026-10-01" }, { schemaVersion: 2 })),
    ).toBe("This entry came from a newer version of the app. Update the app, then send it again.");
    expect(rejected(envelope("stage_resume", { stageId: "s", date: "2026-10-01" }, { type: "payout" }))).toBe(
      "This kind of entry can't be sent from the phone.",
    );
    expect(
      rejected(envelope("stage_resume", { stageId: "s", date: "2026-10-01" }, { createdAt: "yesterday" })),
    ).toMatch(/^Check the created time/);
  });

  it("the parsed envelope keeps the payload typed by its type", () => {
    const r = parseMutation(envelope("crew_day", crewDay));
    if (!r.ok || r.envelope.type !== "crew_day") throw new Error("expected crew_day");
    expect(r.envelope.payload.entries[1]).toEqual(crewDay.entries[1]);
  });
});

describe("crew_day payload", () => {
  const bad = (patch: Record<string, unknown>) =>
    rejected(envelope("crew_day", { ...crewDay, entries: [{ ...crewDay.entries[0], ...patch }] }));

  it("needs at least one person", () => {
    expect(rejected(envelope("crew_day", { ...crewDay, entries: [] }))).toBe(
      "Tick at least one person who worked.",
    );
  });
  it("hours go in quarter-hour steps; a day is 1 or ½", () => {
    expect(bad({ basis: "hourly", days: null, hours: 740 })).toBe(
      "Hours go in quarter-hour steps, like 7.5 or 7.75.",
    );
    expect(bad({ days: 75 })).toBe("A day is 1 or ½.");
    expect(bad({ days: null })).toBe("Choose 1 day or ½ day.");
  });
  it("hourly and time-only need hours; overtime is hourly only, ×1.0 to ×3.0", () => {
    expect(bad({ basis: "hourly", days: null, hours: 0 })).toBe("Add the hours worked.");
    expect(bad({ basis: "time_only", days: null, hours: 0 })).toBe("Add the hours worked.");
    expect(bad({ basis: "hourly", days: null, hours: 200, multiplier: 350 })).toBe(
      "Overtime is between ×1.0 and ×3.0.",
    );
    expect(bad({ multiplier: 150 })).toBe("Overtime only applies to hourly work.");
  });
  it("needs a real date", () => {
    expect(rejected(envelope("crew_day", { ...crewDay, date: "2026-02-30" }))).toBe("Pick a date.");
  });
});

describe("progress payload", () => {
  const progress = {
    stageId: "s1",
    date: "2026-09-28",
    quantity: 12000,
    crewMemberIds: ["sam", "dima"],
    shares: { mode: "custom", bp: [5000, 4200] },
    photoFileId: null,
    note: null,
  };
  it("custom shares must add up to 100%, one per person", () => {
    expect(rejected(envelope("progress", progress))).toBe("Shares must add up to 100%. Currently 92%.");
    expect(
      rejected(envelope("progress", { ...progress, shares: { mode: "custom", bp: [3333, 3333, 3334] } })),
    ).toBe("Give each person in the split a share.");
    expect(rejected(envelope("progress", { ...progress, shares: { mode: "custom", bp: [10000, 0] } }))).toBe(
      "Each share must be more than 0%.",
    );
  });
  it("needs a quantity and people, each once", () => {
    expect(rejected(envelope("progress", { ...progress, quantity: 0, shares: { mode: "equal" } }))).toBe(
      "Add the quantity done.",
    );
    expect(
      rejected(envelope("progress", { ...progress, crewMemberIds: [], shares: { mode: "equal" } })),
    ).toBe("Pick who did the work.");
    expect(
      rejected(
        envelope("progress", { ...progress, crewMemberIds: ["sam", "sam"], shares: { mode: "equal" } }),
      ),
    ).toBe("Each person can be in the split once.");
  });
});

describe("expense payload", () => {
  it("GST null means the default; paid by crew needs the person; nobody else takes one", () => {
    expect(parseMutation(envelope("expense", expense)).ok).toBe(true);
    expect(rejected(envelope("expense", { ...expense, crewMemberId: null }))).toBe("Pick who paid.");
    expect(rejected(envelope("expense", { ...expense, paidBy: "cash" }))).toBe(
      "Only a crew-paid expense names a crew member.",
    );
  });
  it("needs a total and a supplier; GST can't exceed the total", () => {
    expect(rejected(envelope("expense", { ...expense, totalCents: 0 }))).toBe("Add a total before saving.");
    expect(rejected(envelope("expense", { ...expense, supplier: "  " }))).toBe("Add the supplier.");
    expect(rejected(envelope("expense", { ...expense, gstCents: 12000 }))).toBe(
      "GST can't be more than the total.",
    );
  });
});

describe("no-work and stage payloads", () => {
  it("no-work needs people and a reason", () => {
    expect(
      rejected(envelope("no_work", { crewMemberIds: [], date: "2026-09-28", reason: "rain", note: null })),
    ).toBe("Pick who didn't work.");
    expect(
      rejected(
        envelope("no_work", { crewMemberIds: ["jake"], date: "2026-09-28", reason: "fishing", note: null }),
      ),
    ).toBe("Pick a reason: rain, leave, sick or other.");
  });
  it("a pause needs a reason", () => {
    expect(
      rejected(envelope("stage_pause", { stageId: "s1", date: "2026-09-28", reason: null, note: null })),
    ).toBe("Pick why the stage is paused.");
  });
  it("every payload schema is exported by type", () => {
    expect(Object.keys(PAYLOAD_SCHEMAS).sort()).toEqual(
      ["crew_day", "expense", "no_work", "progress", "stage_pause", "stage_resume"].sort(),
    );
  });
});

describe("push request", () => {
  const m = () => envelope("stage_resume", { stageId: "s1", date: "2026-10-01" });
  it("takes 0 to 25 mutations, each with a string id", () => {
    expect(parsePushRequest({ mutations: Array.from({ length: 25 }, m) }).ok).toBe(true);
    expect(parsePushRequest({ mutations: [] }).ok).toBe(true);
  });
  it("refuses 26 or more, a missing list and ids that aren't strings", () => {
    const tooMany = parsePushRequest({ mutations: Array.from({ length: 26 }, m) });
    expect(tooMany).toEqual({ ok: false, message: "Send at most 25 entries at a time." });
    expect(parsePushRequest({})).toEqual({ ok: false, message: "Send a list of entries." });
    expect(parsePushRequest(null).ok).toBe(false);
    expect(parsePushRequest({ mutations: [{ id: 7 }] })).toEqual({
      ok: false,
      message: "Every entry needs an id.",
    });
  });
});
