import { z } from "zod";

// The shape Claude must return for every garden redesign. The frontend imports
// the inferred type, so this file is the single source of truth.

export const ZONE_KINDS = [
  "bed",
  "lawn",
  "path",
  "patio",
  "water",
  "tree",
  "container",
  "vegetable",
  "meadow",
  "seating",
] as const;

export const PLANT_ROLES = [
  "focal",
  "structure",
  "filler",
  "groundcover",
  "climber",
  "edible",
] as const;

export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;

export const GardenDesignSchema = z.object({
  title: z.string().describe("Evocative 2-5 word name for this garden design"),
  tagline: z.string().describe("One sentence that sells the vibe"),
  summary: z.string().describe("2-3 sentence overview of the redesign"),
  siteAnalysis: z.object({
    observations: z.array(z.string()).describe("What you can see in the current space"),
    sunlight: z.string().describe("Best estimate of sun exposure and why"),
    challenges: z.array(z.string()),
    opportunities: z.array(z.string()),
  }),
  palette: z
    .array(z.object({ name: z.string(), hex: z.string().describe("#RRGGBB") }))
    .describe("4-5 colors capturing the planting and materials palette"),
  zones: z
    .array(
      z.object({
        id: z.string().describe("Short slug, e.g. 'z1'"),
        name: z.string(),
        kind: z.enum(ZONE_KINDS),
        x: z.number().describe("Left edge, 0-100, percent of plan width"),
        y: z.number().describe("Top edge, 0-100, percent of plan depth (0 = far/back, 100 = nearest the viewer/house)"),
        w: z.number().describe("Width, percent of plan"),
        h: z.number().describe("Depth, percent of plan"),
        notes: z.string(),
      }),
    )
    .describe("Top-down layout of the redesigned space. Zones may touch but should not overlap much."),
  plants: z.array(
    z.object({
      commonName: z.string(),
      botanicalName: z.string(),
      zoneId: z.string().describe("id of the zone this plant goes in"),
      quantity: z.number().int(),
      role: z.enum(PLANT_ROLES),
      bloomSeason: z.string(),
      sun: z.string(),
      water: z.string(),
      matureSize: z.string(),
      estCostUSD: z.number().describe("Total for the quantity listed"),
      whyItWorks: z.string(),
      beginnerTip: z.string(),
    }),
  ),
  hardscape: z.array(
    z.object({ item: z.string(), estCostUSD: z.number(), notes: z.string() }),
  ),
  steps: z
    .array(z.object({ title: z.string(), detail: z.string(), weekend: z.number().int() }))
    .describe("Ordered build plan; weekend = which weekend (1-based) a beginner would do it"),
  careCalendar: z.array(
    z.object({ season: z.enum(SEASONS), tasks: z.array(z.string()) }),
  ),
  budget: z.object({
    plantsUSD: z.number(),
    materialsUSD: z.number(),
    totalUSD: z.number(),
  }),
  difficulty: z.enum(["beginner", "intermediate", "ambitious"]),
});

export type GardenDesign = z.infer<typeof GardenDesignSchema>;

export interface DesignRequest {
  space: string;
  style: string;
  sun: string;
  maintenance: string;
  budget: string;
  climate: string;
  notes: string;
}
