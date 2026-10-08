import { describe, expect, it } from "vitest";
import { doneHint, doneSplit, NOBODY_LOGGED, sharesLeftText, splitEdited, unreadableShare } from "./stage-done-input";

describe("sharesLeftText (what is left to share)", () => {
  it("says how much is left under 100%", () => expect(sharesLeftText(8800)).toBe("12% left to share"));
  it("keeps two decimals", () => expect(sharesLeftText(6667)).toBe("33.33% left to share"));
  it("says how far over when above 100%", () => expect(sharesLeftText(10500)).toBe("5% too much"));
  it("is null at exactly 100%", () => expect(sharesLeftText(10000)).toBeNull());
});

describe("doneSplit (what Confirm done sends)", () => {
  const people = [
    { crewMemberId: "a", bp: 3334 },
    { crewMemberId: "b", bp: 3333 },
    { crewMemberId: "c", bp: 3333 },
  ];
  it("sends the equal split when the shares were not edited", () =>
    expect(doneSplit(people, false)).toEqual({ crewMemberIds: ["a", "b", "c"], shares: { mode: "equal" } }));
  it("sends custom basis points when edited", () =>
    expect(doneSplit([{ crewMemberId: "a", bp: 6000 }, { crewMemberId: "b", bp: 4000 }], true)).toEqual({
      crewMemberIds: ["a", "b"],
      shares: { mode: "custom", bp: [6000, 4000] },
    }));
  it("leaves out anyone set to 0%", () =>
    expect(doneSplit([{ crewMemberId: "a", bp: 10000 }, { crewMemberId: "b", bp: 0 }], true)).toEqual({
      crewMemberIds: ["a"],
      shares: { mode: "custom", bp: [10000] },
    }));
  it("sends nobody when there is no lump sum", () =>
    expect(doneSplit(people, false, false)).toEqual({ crewMemberIds: [], shares: { mode: "equal" } }));
});

describe("doneHint (why Confirm done is off)", () => {
  it("names the share total first", () =>
    expect(doneHint({ total: 8800, online: true, splitNeeded: true })).toBe("Shares must add up to 100%. Currently 88%."));
  it("asks for a connection when offline", () =>
    expect(doneHint({ total: 10000, online: false, splitNeeded: true })).toMatch(/^Needs connection/));
  it("ignores shares when there is no lump sum", () => expect(doneHint({ total: 0, online: true, splitNeeded: false })).toBeUndefined());
  it("is undefined when ready", () => expect(doneHint({ total: 10000, online: true, splitNeeded: true })).toBeUndefined());
});

describe("splitEdited (equal split kept unless the shares really changed)", () => {
  const proposal = [3334, 3333, 3333];
  it("E5.1: retyping the equal split keeps equal mode, so cents stay 666.67 / 666.67 / 666.66", () => {
    expect(splitEdited(proposal, ["33.34", " 33.33", "33.33"])).toBe(false);
    const people = proposal.map((bp, i) => ({ crewMemberId: String(i), bp }));
    expect(doneSplit(people, splitEdited(proposal, ["33.34", "33.33", "33.33"])).shares).toEqual({ mode: "equal" });
  });
  it("is edited once a share differs from the proposal", () => expect(splitEdited(proposal, ["50", "25", "25"])).toBe(true));
  it("is edited when a box can't be read", () => expect(splitEdited(proposal, ["", "33.33", "33.33"])).toBe(true));
});

describe("unreadableShare (empty or unreadable boxes never count as 0%)", () => {
  it("names the person whose box is empty", () =>
    expect(unreadableShare([{ name: "Sam", text: "50" }, { name: "Tom", text: "" }])).toBe("Check Tom's share"));
  it("names the person whose box says abc", () =>
    expect(unreadableShare([{ name: "Sam", text: "abc" }, { name: "Tom", text: "" }])).toBe("Check Sam's share"));
  it("accepts a typed 0", () => expect(unreadableShare([{ name: "Sam", text: "100" }, { name: "Tom", text: "0" }])).toBeNull());
  it("blocks Confirm before the share total", () =>
    expect(doneHint({ total: 5000, online: true, splitNeeded: true, unreadable: "Check Tom's share" })).toBe("Check Tom's share"));
});

describe("doneHint with a lump sum and nobody logged", () => {
  it("keeps Confirm off with a plain hint", () =>
    expect(doneHint({ total: 0, online: true, splitNeeded: false, nobodyLogged: true })).toBe(NOBODY_LOGGED));
  it("says to log crew time first", () => expect(NOBODY_LOGGED).toBe("Nobody has logged work on this stage yet. Log crew time first."));
});
