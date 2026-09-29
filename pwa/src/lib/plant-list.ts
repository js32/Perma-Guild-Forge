import type { PlantData } from './types';
import { displayName } from './plant-name';
import { deriveLayer, type PlantLayer } from './plant-layer';
import { completenessPercent } from './plant-detail';

// Filtering and sorting of the plant list (grid, table and card views on the
// Pflanzen page), kept as pure functions over plain state so they can be
// tested without the page.

export interface ListFilters {
  /** Boolean field keys; a plant matches a facet if ANY selected key is set. */
  usage: Set<string>;
  function: Set<string>;
  sun: Set<string>;
  water: Set<string>;
  growSpeed: Set<string>;
  layer: Set<string>;
  /** Month indices "0".."11". */
  flowerMonths: Set<string>;
  fruitMonths: Set<string>;
  /** Group names; the empty string selects plants without any group. */
  groups: Set<string>;
  heightMin: number;
  completenessMin: number;
  text: string;
}

export function emptyFilters(): ListFilters {
  return {
    usage: new Set(), function: new Set(), sun: new Set(), water: new Set(), growSpeed: new Set(),
    layer: new Set(), flowerMonths: new Set(), fruitMonths: new Set(), groups: new Set(),
    heightMin: 0, completenessMin: 0, text: '',
  };
}

const anyKey = (p: PlantData, keys: Set<string>) => [...keys].some(k => Boolean((p as any)[k]));

/** Facets combine with AND; within a facet the selected values combine with OR
 *  (picking two usages widens the result instead of requiring both). */
export function applyFilters(plants: PlantData[], f: ListFilters): PlantData[] {
  const q = f.text.trim().toLowerCase();
  return plants.filter(p =>
    (f.usage.size === 0 || anyKey(p, f.usage)) &&
    (f.function.size === 0 || anyKey(p, f.function)) &&
    (f.sun.size === 0 || anyKey(p, f.sun)) &&
    (f.water.size === 0 || anyKey(p, f.water)) &&
    (f.growSpeed.size === 0 || anyKey(p, f.growSpeed)) &&
    (f.layer.size === 0 || f.layer.has(deriveLayer(p))) &&
    (f.flowerMonths.size === 0 || [...f.flowerMonths].some(m => !!p.flowerMonths?.[Number(m)])) &&
    (f.fruitMonths.size === 0 || [...f.fruitMonths].some(m => !!p.fruitMonths?.[Number(m)])) &&
    (f.groups.size === 0 || matchesGroups(p, f.groups)) &&
    (f.heightMin <= 0 || (p.heightM != null && p.heightM >= f.heightMin)) &&
    (f.completenessMin <= 0 || completenessPercent(p) >= f.completenessMin) &&
    (!q || p.latinName.toLowerCase().includes(q) ||
      [p.commonName, p.commonNameEn, p.varietyName].some(n => n && n.toLowerCase().includes(q)))
  );
}

function matchesGroups(p: PlantData, selected: Set<string>): boolean {
  const groups = p.groups ?? [];
  if (groups.length === 0) return selected.has('');
  return groups.some(g => selected.has(g));
}

/** All group names in use, alphabetically — the options of the group filter. */
export function allGroups(plants: PlantData[]): string[] {
  const set = new Set<string>();
  for (const p of plants) for (const g of p.groups ?? []) set.add(g);
  return [...set].sort((a, b) => a.localeCompare(b, 'de'));
}

export type SortField =
  | 'commonName' | 'latinName' | 'heightM' | 'widthM' | 'completeness'
  | 'growSpeed' | 'layer' | 'flowerMonth' | 'fruitMonth' | 'groups';

/** Slow=1 / Mid=2 / High=3; unset sorts last. */
function growSpeedRank(p: PlantData): number {
  if (p.growSpeedHigh) return 3;
  if (p.growSpeedMid) return 2;
  if (p.growSpeedLow) return 1;
  return Infinity;
}

const LAYER_RANK: Record<PlantLayer, number> = { herb: 1, shrub: 2, tree: 3 };

/** Earliest active month (0=Jan..11=Dec); unset sorts last. */
function earliestMonth(months: boolean[] | undefined): number {
  const i = months?.findIndex(Boolean) ?? -1;
  return i === -1 ? Infinity : i;
}

/** Numbers and strings compared uniformly; missing values sort last. */
function sortKey(p: PlantData, field: SortField): string | number {
  switch (field) {
    case 'completeness': return completenessPercent(p);
    case 'heightM': return p.heightM ?? Infinity;
    case 'widthM': return p.widthM ?? Infinity;
    case 'growSpeed': return growSpeedRank(p);
    case 'layer': return LAYER_RANK[deriveLayer(p)];
    case 'flowerMonth': return earliestMonth(p.flowerMonths);
    case 'fruitMonth': return earliestMonth(p.fruitMonths);
    // Plants without a group go last (U+FFFF sorts after every real name).
    case 'groups': return [...(p.groups ?? [])].sort((a, b) => a.localeCompare(b, 'de'))[0]?.toLowerCase() ?? '￿';
    case 'commonName': return displayName(p).toLowerCase();
    case 'latinName': return (p.latinName || '').toLowerCase();
  }
}

// German collation, so "Äpfel" sorts with A instead of after Z.
const collator = new Intl.Collator('de', { sensitivity: 'base', numeric: true });

function compare(a: string | number, b: string | number): number {
  if (typeof a === 'string' && typeof b === 'string') {
    // Keep the "no value" marker last regardless of collation rules.
    if (a === '￿' || b === '￿') return a === b ? 0 : a === '￿' ? 1 : -1;
    return collator.compare(a, b);
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

export function sortPlants(plants: PlantData[], field: SortField, dir: 'asc' | 'desc'): PlantData[] {
  const sign = dir === 'asc' ? 1 : -1;
  const keyed = plants.map(p => ({ p, k: sortKey(p, field), name: displayName(p).toLowerCase() }));
  keyed.sort((a, b) =>
    sign * compare(a.k, b.k) ||
    // Tie-breaker: A-Z by name, always ascending, so e.g. sorting by "Ebene"
    // reads alphabetically within Baum/Strauch/Kraut either way.
    collator.compare(a.name, b.name));
  return keyed.map(x => x.p);
}
