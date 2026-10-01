import {
  createEmptyPlant, createEmptyPolyculture, createEmptyGardenPlan,
  type PlantData, type Polyculture, type GardenPlan, type DataSource, type PolycultureRole,
} from './types';
import { newId } from './id';

// Everything that arrives from outside the app — JSON import, backup restore,
// Gist/WebDAV pull, CSV — goes through here before it touches IndexedDB. Each
// record is rebuilt on top of the empty default, taking a field only when it
// has the expected type. That keeps old files (missing newer fields like
// `groups`) working, and keeps a crafted file from smuggling markup-shaped
// values into fields the renderers treat as numbers or safe URLs.

const DATA_SOURCES = new Set<DataSource>(['wikidata', 'pfaf', 'efg', 'naturadb', 'manual', 'csv', 'sample']);
const ROLES = new Set<PolycultureRole>(['companion', 'groundCover', 'nFixer', 'mineralFixer', 'insectary', 'pestConfuser', 'fruitProducer', 'other']);

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback: string) => typeof v === 'string' ? v : fallback;
const nonEmptyStr = (v: unknown, fallback: string) => typeof v === 'string' && v.trim() ? v : fallback;

function finite(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function months(v: unknown): boolean[] {
  return Array.from({ length: 12 }, (_, i) => Array.isArray(v) && v[i] === true);
}

/** Only http(s) — keeps javascript:/data: URLs out of <img src> and links. */
function safeUrl(v: unknown): string {
  return typeof v === 'string' && /^https?:\/\//i.test(v.trim()) ? v.trim() : '';
}

export function normalizePlant(raw: unknown): PlantData | null {
  if (!isObject(raw)) return null;
  const p = createEmptyPlant();

  for (const key of Object.keys(p) as (keyof PlantData)[]) {
    const v = raw[key];
    const def = p[key];
    if (typeof def === 'boolean') (p as any)[key] = v === true;
    else if (typeof def === 'string') (p as any)[key] = str(v, def);
  }

  p.id = nonEmptyStr(raw.id, p.id);
  const h = finite(raw.heightM), w = finite(raw.widthM);
  p.heightM = h != null && h >= 0 ? h : null;
  p.widthM = w != null && w >= 0 ? w : null;
  p.eatableScore = clamp(Math.round(finite(raw.eatableScore) ?? 0), 0, 5);
  p.medsScore = clamp(Math.round(finite(raw.medsScore) ?? 0), 0, 5);
  p.materialScore = clamp(Math.round(finite(raw.materialScore) ?? 0), 0, 5);
  p.printCount = clamp(Math.round(finite(raw.printCount) ?? 1), 0, 99);
  p.fruitMonths = months(raw.fruitMonths);
  p.flowerMonths = months(raw.flowerMonths);
  p.imageUrl = safeUrl(raw.imageUrl);
  p.groups = Array.isArray(raw.groups)
    ? [...new Set(raw.groups.filter((g): g is string => typeof g === 'string').map(g => g.trim()).filter(Boolean))]
    : [];

  if (isObject(raw._sources)) {
    const sources: PlantData['_sources'] = {};
    for (const [k, v] of Object.entries(raw._sources)) {
      if (k in p && DATA_SOURCES.has(v as DataSource)) (sources as any)[k] = v;
    }
    p._sources = sources;
  }

  if (!p.latinName.trim() && !p.commonName.trim()) return null;
  return p;
}

export function normalizePlants(raw: unknown): PlantData[] {
  return Array.isArray(raw) ? raw.map(normalizePlant).filter((p): p is PlantData => p !== null) : [];
}

export function normalizePolyculture(raw: unknown): Polyculture | null {
  if (!isObject(raw)) return null;
  const d = createEmptyPolyculture();
  return {
    id: nonEmptyStr(raw.id, d.id),
    name: str(raw.name, ''),
    description: str(raw.description, ''),
    anchorPlantId: typeof raw.anchorPlantId === 'string' ? raw.anchorPlantId : null,
    members: Array.isArray(raw.members)
      ? raw.members.filter(isObject).filter(m => typeof m.plantId === 'string').map(m => ({
          plantId: m.plantId as string,
          role: ROLES.has(m.role as PolycultureRole) ? m.role as PolycultureRole : 'other',
          notes: str(m.notes, ''),
        }))
      : [],
    notes: str(raw.notes, ''),
    createdAt: str(raw.createdAt, d.createdAt),
    updatedAt: str(raw.updatedAt, d.updatedAt),
  };
}

export function normalizeGardenPlan(raw: unknown): GardenPlan | null {
  if (!isObject(raw)) return null;
  const d = createEmptyGardenPlan();
  const point = (v: unknown) => isObject(v) && finite(v.xM) != null && finite(v.yM) != null
    ? { xM: finite(v.xM)!, yM: finite(v.yM)! } : null;
  return {
    id: nonEmptyStr(raw.id, d.id),
    name: str(raw.name, ''),
    description: str(raw.description, ''),
    polycultureId: typeof raw.polycultureId === 'string' ? raw.polycultureId : null,
    areaWidthM: clamp(finite(raw.areaWidthM) ?? d.areaWidthM, 1, 500),
    areaHeightM: clamp(finite(raw.areaHeightM) ?? d.areaHeightM, 1, 500),
    gridSpacingM: finite(raw.gridSpacingM) ?? d.gridSpacingM,
    boundary: Array.isArray(raw.boundary) ? raw.boundary.map(point).filter((q): q is { xM: number; yM: number } => q !== null) : [],
    placements: Array.isArray(raw.placements)
      ? raw.placements.filter(isObject).filter(pl => typeof pl.plantId === 'string' && point(pl)).map(pl => ({
          id: nonEmptyStr(pl.id, newId()),
          plantId: pl.plantId as string,
          xM: finite(pl.xM)!,
          yM: finite(pl.yM)!,
          notes: str(pl.notes, ''),
        }))
      : [],
    yearsSincePlanting: clamp(finite(raw.yearsSincePlanting) ?? 0, 0, 100),
    notes: str(raw.notes, ''),
    createdAt: str(raw.createdAt, d.createdAt),
    updatedAt: str(raw.updatedAt, d.updatedAt),
  };
}

export function normalizePolycultures(raw: unknown): Polyculture[] {
  return Array.isArray(raw) ? raw.map(normalizePolyculture).filter((x): x is Polyculture => x !== null) : [];
}

export function normalizeGardenPlans(raw: unknown): GardenPlan[] {
  return Array.isArray(raw) ? raw.map(normalizeGardenPlan).filter((x): x is GardenPlan => x !== null) : [];
}
