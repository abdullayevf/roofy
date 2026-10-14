import { describe, expect, it } from "vitest";
import { ROOFING_DEFAULTS } from "./roofing-defaults";

const { levels, categories, templates } = ROOFING_DEFAULTS;

describe("ROOFING_DEFAULTS", () => {
  it("eight crew levels with their floor rates (cents an hour)", () => {
    expect(levels.map((l) => [l.name, l.floorRateCents])).toEqual([
      ["Labourer", 2800],
      ["Apprentice yr 1", 1800],
      ["Apprentice yr 2", 2200],
      ["Apprentice yr 3", 2500],
      ["Apprentice yr 4", 2800],
      ["Roofer", 3200],
      ["Leading hand", 3600],
      ["Foreman", 4000],
    ]);
  });

  it("nine expense categories, in order", () => {
    expect(categories).toEqual([
      "Materials",
      "Equipment hire",
      "Scaffolding",
      "Skip/tip fees",
      "Fuel & travel",
      "Parking & tolls",
      "Subcontractor (non-crew)",
      "Permits",
      "Other",
    ]);
  });

  it("five job-type templates with their stage names and units", () => {
    const shape = Object.fromEntries(
      Object.entries(templates).map(([type, t]) => [type, [t.name, t.items.map((i) => [i.name, i.unit])]]),
    );
    expect(shape).toEqual({
      metal_reroof: [
        "Metal re-roof",
        [
          ["Site setup & safety", null],
          ["Strip & remove", null],
          ["Battens / structural repairs", null],
          ["Sarking & insulation", null],
          ["Sheet install", "m2"],
          ["Flashings, gutters & downpipes", "lm"],
          ["Clean-up & handover", null],
        ],
      ],
      tile_reroof: [
        "Tile re-roof",
        [
          ["Site setup & safety", null],
          ["Strip & remove", null],
          ["Battens", null],
          ["Sarking", null],
          ["Tile install", "m2"],
          ["Ridge bedding & pointing", null],
          ["Clean-up & handover", null],
        ],
      ],
      restoration: [
        "Restoration",
        [
          ["Site setup", null],
          ["Pressure clean", "m2"],
          ["Repairs & replacements", null],
          ["Re-bed & re-point", null],
          ["Coat / paint", "m2"],
          ["Clean-up", null],
        ],
      ],
      repair: [
        "Repair",
        [
          ["Inspect", null],
          ["Repair", null],
          ["Clean-up", null],
        ],
      ],
      new_build: [
        "New build",
        [
          ["Battens", null],
          ["Sarking & insulation", null],
          ["Roof sheeting/tiles", "m2"],
          ["Flashings", "lm"],
          ["Gutters & downpipes", "lm"],
        ],
      ],
    });
  });

  it("in every template the labour shares and the materials shares each add up to 100% (10000 bp)", () => {
    for (const t of Object.values(templates)) {
      const sum = (key: "labourShareBp" | "materialsShareBp") => t.items.reduce((s, i) => s + i[key], 0);
      expect([t.name, sum("labourShareBp"), sum("materialsShareBp")]).toEqual([t.name, 10000, 10000]);
    }
  });

  it("is deeply frozen, so no reader can change another workspace's defaults", () => {
    const all: object[] = [ROOFING_DEFAULTS, levels, categories, templates, ...levels];
    for (const t of Object.values(templates)) all.push(t, t.items, ...t.items);
    expect(all.filter((o) => !Object.isFrozen(o))).toEqual([]);
  });
});
