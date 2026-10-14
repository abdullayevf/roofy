/**
 * The roofing defaults a new workspace is offered in set-up ("Use these"): stage templates per job type,
 * expense categories and crew levels with their floor rates. The fake seed and the real onboarding
 * service both read them, so the prototype and the database start from the same lists.
 */
import type { BasisPoints, Cents, Unit } from "@/domain/types";

/** The job types a roofing workspace has templates for (the same union as `JobType` in the contracts). */
export type RoofingJobType = "metal_reroof" | "tile_reroof" | "restoration" | "repair" | "new_build";

export interface RoofingTemplateItem {
  name: string;
  unit: Unit | null;
  labourShareBp: BasisPoints;
  materialsShareBp: BasisPoints;
}

export interface RoofingTemplate {
  name: string;
  items: RoofingTemplateItem[];
}

export interface RoofingLevel {
  name: string;
  floorRateCents: Cents;
}

const LEVELS: readonly RoofingLevel[] = [
  { name: "Labourer", floorRateCents: 2800 },
  { name: "Apprentice yr 1", floorRateCents: 1800 },
  { name: "Apprentice yr 2", floorRateCents: 2200 },
  { name: "Apprentice yr 3", floorRateCents: 2500 },
  { name: "Apprentice yr 4", floorRateCents: 2800 },
  { name: "Roofer", floorRateCents: 3200 },
  { name: "Leading hand", floorRateCents: 3600 },
  { name: "Foreman", floorRateCents: 4000 },
];

const CATEGORIES: readonly string[] = [
  "Materials",
  "Equipment hire",
  "Scaffolding",
  "Skip/tip fees",
  "Fuel & travel",
  "Parking & tolls",
  "Subcontractor (non-crew)",
  "Permits",
  "Other",
];

const item = (
  name: string,
  unit: Unit | null,
  labourShareBp: number,
  materialsShareBp: number,
): RoofingTemplateItem => ({
  name,
  unit,
  labourShareBp,
  materialsShareBp,
});

const TEMPLATES: Record<RoofingJobType, RoofingTemplate> = {
  metal_reroof: {
    name: "Metal re-roof",
    items: [
      item("Site setup & safety", null, 500, 0),
      item("Strip & remove", null, 1500, 0),
      item("Battens / structural repairs", null, 1500, 1000),
      item("Sarking & insulation", null, 1000, 1500),
      item("Sheet install", "m2", 3500, 6500),
      item("Flashings, gutters & downpipes", "lm", 1500, 1000),
      item("Clean-up & handover", null, 500, 0),
    ],
  },
  tile_reroof: {
    name: "Tile re-roof",
    items: [
      item("Site setup & safety", null, 500, 0),
      item("Strip & remove", null, 1500, 0),
      item("Battens", null, 1500, 1000),
      item("Sarking", null, 1000, 1000),
      item("Tile install", "m2", 3500, 7000),
      item("Ridge bedding & pointing", null, 1500, 1000),
      item("Clean-up & handover", null, 500, 0),
    ],
  },
  restoration: {
    name: "Restoration",
    items: [
      item("Site setup", null, 500, 0),
      item("Pressure clean", "m2", 1500, 0),
      item("Repairs & replacements", null, 2000, 2500),
      item("Re-bed & re-point", null, 2500, 2500),
      item("Coat / paint", "m2", 3000, 5000),
      item("Clean-up", null, 500, 0),
    ],
  },
  repair: {
    name: "Repair",
    items: [
      item("Inspect", null, 1500, 0),
      item("Repair", null, 7000, 10000),
      item("Clean-up", null, 1500, 0),
    ],
  },
  new_build: {
    name: "New build",
    items: [
      item("Battens", null, 2000, 1500),
      item("Sarking & insulation", null, 1500, 1500),
      item("Roof sheeting/tiles", "m2", 3500, 5000),
      item("Flashings", "lm", 1500, 1000),
      item("Gutters & downpipes", "lm", 1500, 1000),
    ],
  },
};

export const ROOFING_DEFAULTS: {
  templates: Record<RoofingJobType, RoofingTemplate>;
  categories: readonly string[];
  levels: readonly RoofingLevel[];
} = { templates: TEMPLATES, categories: CATEGORIES, levels: LEVELS };
