import type { Sector } from "@/lib/types/database";

/**
 * The sector profile.
 *
 * One product, two starting points. The profile never hides a feature; it
 * decides what is seeded, what is defaulted, which reports are pinned on
 * the overview and which words the interface uses for the same thing. A
 * contractor that does both mining and commercial work picks whichever
 * fits most of its people and loses nothing.
 */

export interface SectorProfile {
  value: Sector;
  label: string;
  short: string;
  blurb: string;
  /** What the register answers to on the overview. */
  gateNoun: string;
  /** The Act the reader thinks of first. */
  primaryAct: string;
  defaultSeta: string | null;
  /** Report keys to pin on the overview, in order. */
  pinnedReports: string[];
  /** Guide slugs most relevant to this sector, in order. */
  guides: string[];
  /** Whether the onboarding tracker shows the TEBA stage by default. */
  showTeba: boolean;
  /** Example training types shown on the signup card. */
  sampleTypes: string[];
}

export const SECTORS: SectorProfile[] = [
  {
    value: "mining",
    label: "Mining and minerals",
    short: "Mining",
    blurb:
      "Contractors working on a mine or a plant. TEBA, Mines Legal Liability and section cards are on the register from day one.",
    gateNoun: "gate",
    primaryAct: "Mine Health and Safety Act 29 of 1996",
    defaultSeta: "MQA",
    pinnedReports: ["staff-movement", "labour-unavailability", "labour-plan", "employment-equity"],
    guides: ["contractor-safety-file", "workplace-skills-plan", "employment-equity-report", "letter-of-good-standing"],
    showTeba: true,
    sampleTypes: ["Onsite induction", "TEBA", "Mines Legal Liability", "Section cards", "Conveyor belt safety"],
  },
  {
    value: "general",
    label: "General industry",
    short: "General",
    blurb:
      "Construction, manufacturing, facilities, logistics, security, cleaning and anyone else who sends people onto a client's site.",
    gateNoun: "site access",
    primaryAct: "Occupational Health and Safety Act 85 of 1993",
    defaultSeta: null,
    pinnedReports: ["employment-equity", "skills-development", "labour-unavailability", "staff-movement"],
    guides: ["employment-equity-report", "workplace-skills-plan", "letter-of-good-standing", "contractor-safety-file"],
    showTeba: false,
    sampleTypes: ["Induction", "First aid", "Working at heights", "Forklift operator", "SHE rep"],
  },
];

export function isSector(v: unknown): v is Sector {
  return SECTORS.some((s) => s.value === v);
}

export function sectorProfile(sector: Sector | null | undefined): SectorProfile {
  return SECTORS.find((s) => s.value === sector) ?? SECTORS[1];
}
