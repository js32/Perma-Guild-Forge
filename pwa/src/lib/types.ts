import { newId } from './id';

// ── Polycultures ────────────────────────────────────────────────────────────

export type PolycultureRole =
  | 'companion'      // allgemeiner Begleiter
  | 'groundCover'    // Bodendecker
  | 'nFixer'         // Stickstoff-Fixierer
  | 'mineralFixer'   // Mineralien-Sammler / Tiefwurzler
  | 'insectary'      // Insektenpflanze (Bestäuber, Nützlinge)
  | 'pestConfuser'   // Schädlings-Konfusor (Duft / Abwehr)
  | 'fruitProducer'  // Obst-/Beerenträger neben dem Anker
  | 'other';

export const ROLE_LABEL: Record<PolycultureRole, string> = {
  companion:     'Begleiter',
  groundCover:   'Bodendecker',
  nFixer:        'Stickstoff-Fixierer',
  mineralFixer:  'Mineraliensammler',
  insectary:     'Insektenpflanze',
  pestConfuser:  'Duftverwirrer',
  fruitProducer: 'Obst/Beere',
  other:         'Sonstiges',
};

// Welche PlantData-Boolean-Felder eine Pflanze qualifizieren, eine Rolle zu füllen.
// Verwendet im mechanischen Vorschlags-Filter.
export const ROLE_REQUIREMENT: Record<PolycultureRole, (keyof PlantData)[]> = {
  companion:     [],
  groundCover:   ['groundCover'],
  nFixer:        ['nitrogenFix'],
  mineralFixer:  ['mineralFix'],
  insectary:     ['insects'],
  pestConfuser:  ['pest'],
  fruitProducer: ['eatable'],
  other:         [],
};

export interface PolycultureMember {
  plantId: string;
  role: PolycultureRole;
  notes: string;
}

export interface Polyculture {
  id: string;
  name: string;
  description: string;
  anchorPlantId: string | null;
  members: PolycultureMember[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export function createEmptyPolyculture(): Polyculture {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name: '',
    description: '',
    anchorPlantId: null,
    members: [],
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

// ── Garden plans ────────────────────────────────────────────────────────────

export interface GardenPlanPoint { xM: number; yM: number; }

export interface GardenPlanPlacement {
  id: string;        // own id — a plant can be placed more than once (e.g. a row of carrots)
  plantId: string;
  xM: number;
  yM: number;
  notes: string;
}

export interface GardenPlan {
  id: string;
  name: string;
  description: string;
  polycultureId: string | null;  // one-time prefill source only — no ongoing sync
  areaWidthM: number;
  areaHeightM: number;
  gridSpacingM: number;          // 0.5 | 1 | 2
  boundary: GardenPlanPoint[];   // polygon vertices, meters, plan-local origin (top-left)
  placements: GardenPlanPlacement[];
  yearsSincePlanting: number;    // last slider position — persisted so reopening restores the view
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export function createEmptyGardenPlan(): GardenPlan {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name: '',
    description: '',
    polycultureId: null,
    areaWidthM: 10,
    areaHeightM: 10,
    gridSpacingM: 1,
    boundary: [],
    placements: [],
    yearsSincePlanting: 0,
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

// ── Data sources ────────────────────────────────────────────────────────────

export type DataSource = 'wikidata' | 'pfaf' | 'efg' | 'naturadb' | 'manual' | 'csv' | 'sample';

/** Growth forms = layers: Baum, Strauch, Kraut, Kletterpflanze, Rhizom/Wurzel. */
export const PLANT_HABITS = ['tree', 'shrub', 'herb', 'climber', 'rhizo'] as const;
export type PlantHabit = typeof PLANT_HABITS[number] | '';

/** Maps free-text growth forms (PFAF "deciduous Shrub", "Bulb", EFG "Vine (l)",
 *  CSV "Strauch") to a habit; '' when unrecognised. */
export function parseHabit(raw: unknown): PlantHabit {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!s) return '';
  if ((PLANT_HABITS as readonly string[]).includes(s)) return s as PlantHabit;
  if (/climber|vine|kletter|liane/.test(s)) return 'climber';
  if (/rhizo|wurzel|root|bulb|corm|tuber|knolle|zwiebel|geophyt/.test(s)) return 'rhizo';
  if (/tree|baum/.test(s)) return 'tree';
  if (/shrub|strauch|bamboo|bambus/.test(s)) return 'shrub';
  if (/herb|kraut|perennial|annual|biennial|fern|staude|farn|einjährig|zweijährig/.test(s)) return 'herb';
  return '';
}

export const SOURCE_LABEL: Record<DataSource, string> = {
  wikidata: 'Wikidata',
  pfaf:     'PFAF',
  efg:      'Edible Forest Gardens',
  naturadb: 'NaturaDB',
  manual:   'Manuell',
  csv:      'CSV',
  sample:   'Beispiel',
};

export const SOURCE_COLOR: Record<DataSource, string> = {
  wikidata: 'bg-blue-100 text-blue-700',
  efg:      'bg-amber-100 text-amber-800',
  pfaf:     'bg-green-100 text-green-700',
  naturadb: 'bg-orange-100 text-orange-700',
  manual:   'bg-stone-100 text-stone-600',
  csv:      'bg-purple-100 text-purple-700',
  sample:   'bg-teal-100 text-teal-700',
};

/** True if any field on this plant was populated from the given source — used to
 *  decide whether a card needs that source's attribution (e.g. PFAF's CC BY 4.0). */
export function hasSource(plant: { _sources?: Partial<Record<string, DataSource>> }, source: DataSource): boolean {
  return !!plant._sources && Object.values(plant._sources).includes(source);
}

/** Credit for each published source a plant's data comes from — printed on
 *  cards and discs (PFAF's CC BY 4.0 requires it; the Edible Forest Gardens
 *  book is credited the same way). `short` for very narrow spaces. */
export function dataCredits(plant: { _sources?: Partial<Record<string, DataSource>> }, short = false): string[] {
  const credits: string[] = [];
  if (hasSource(plant, 'pfaf')) credits.push(short ? 'PFAF.org CC BY 4.0' : 'PFAF.org (CC BY 4.0)');
  if (hasSource(plant, 'efg')) credits.push(short ? 'Jacke & Toensmeier' : 'Jacke & Toensmeier, Edible Forest Gardens');
  return credits;
}

export interface PlantData {
  id: string;
  latinName: string;
  commonName: string;
  /** English common name, shown instead of commonName when the UI language is English. */
  commonNameEn: string;
  // User-chosen cultivar/variety name (e.g. "Black Krim") — never filled by
  // Wikidata/PFAF, purely a manual field for the grower's own record.
  varietyName: string;
  // Free-form personal notes, manual only, never filled by any import path.
  notes: string;
  // User-defined group names (e.g. "Vorgarten", "Waldgarten Nord") a plant is
  // sorted into — free-form, manual only, a plant can belong to several.
  groups: string[];
  // Dimensions
  heightM: number | null;
  widthM: number | null;
  // Scores (0-5)
  eatableScore: number;
  medsScore: number;
  materialScore: number;
  // Human usages (boolean)
  eatable: boolean;
  culinaric: boolean;
  meds: boolean;
  material: boolean;
  fodder: boolean;
  fuel: boolean;
  wood: boolean;
  fiber: boolean;
  ornamental: boolean;
  dyes: boolean;
  // Ecosystem functions
  nitrogenFix: boolean;
  mineralFix: boolean;
  groundCover: boolean;
  insects: boolean;
  pest: boolean;
  animalProtection: boolean;
  windBreaking: boolean;
  windBreakingOnSea: boolean;
  // Sun preference
  sunFull: boolean;
  sunMid: boolean;
  sunShadow: boolean;
  // Water preference
  waterDry: boolean;
  waterMid: boolean;
  waterWet: boolean;
  // Soil pH
  phVeryAcid: boolean;
  phAcid: boolean;
  phNeutral: boolean;
  phAlkaline: boolean;
  phVeryAlkaline: boolean;
  // Growth speed
  growSpeedLow: boolean;
  growSpeedMid: boolean;
  growSpeedHigh: boolean;
  // Growth form as stated by PFAF/EFG or the user ('' = unknown). Drives the
  // layer (Baum/Strauch/Kraut); height is only the fallback.
  habit: PlantHabit;
  // Climate
  climateZone: string;
  // Phenology - months 0-11
  fruitMonths: boolean[];
  flowerMonths: boolean[];
  // Image
  imageUrl: string;
  // Attribution line for imageUrl (author · license · source), required by
  // most Wikimedia Commons licenses (CC BY / CC BY-SA) wherever the image is shown.
  imageCredit: string;
  // Number of times to print this plant's card (0 = excluded from exports, default 1)
  printCount: number;
  // Provenance: source per field (optional, not all plants have this)
  _sources?: Partial<Record<keyof PlantData, DataSource>>;
}

export function createEmptyPlant(): PlantData {
  return {
    id: newId(),
    latinName: '',
    commonName: '',
    commonNameEn: '',
    varietyName: '',
    notes: '',
    groups: [],
    heightM: null,
    widthM: null,
    eatableScore: 0,
    medsScore: 0,
    materialScore: 0,
    eatable: false,
    culinaric: false,
    meds: false,
    material: false,
    fodder: false,
    fuel: false,
    wood: false,
    fiber: false,
    ornamental: false,
    dyes: false,
    nitrogenFix: false,
    mineralFix: false,
    groundCover: false,
    insects: false,
    pest: false,
    animalProtection: false,
    windBreaking: false,
    windBreakingOnSea: false,
    sunFull: false,
    sunMid: false,
    sunShadow: false,
    waterDry: false,
    waterMid: false,
    waterWet: false,
    phVeryAcid: false,
    phAcid: false,
    phNeutral: false,
    phAlkaline: false,
    phVeryAlkaline: false,
    growSpeedLow: false,
    growSpeedMid: false,
    growSpeedHigh: false,
    habit: '',
    climateZone: '',
    fruitMonths: Array(12).fill(false),
    flowerMonths: Array(12).fill(false),
    imageUrl: '',
    imageCredit: '',
    printCount: 1,
  };
}
