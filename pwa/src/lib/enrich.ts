import { createEmptyPlant, type PlantData, type DataSource } from './types';
import { isSourceEnabled, getSourcePriority, type EnrichSource } from './settings';
import {
  fetchPlantDetails, fetchProxySources, findWikidataId, fetchCommonsCredit, commonsFileName, needsImageCredit,
  type SearchResult, type SourceData,
} from './plant-search';
import { newId } from './id';

// Filling plant data from PFAF, Edible Forest Gardens (EFG) and Wikidata.
//
// Per field, the value comes from the highest-ranked source (settings: source
// priority, default PFAF > EFG > Wikidata) that has an opinion on it — a value,
// or for yes/no fields an explicit "no". A value from a lower-ranked source is
// replaced on re-enrich; values the user entered (or imported via CSV/sample
// data) are never touched. Exception: the German common name always comes from
// Wikidata, the only source that has German names — PFAF/EFG names are English
// and go to commonNameEn.

/** Record non-empty fields in data as coming from source. */
export function trackSources(plant: PlantData, data: Partial<PlantData>, source: DataSource) {
  if (!plant._sources) plant._sources = {};
  for (const [key, val] of Object.entries(data) as [keyof PlantData, any][]) {
    if (key === '_sources' || key === 'id') continue;
    const isEmpty = val === null || val === undefined || val === '' || val === false ||
      (Array.isArray(val) && (val as boolean[]).every((v: boolean) => !v));
    if (!isEmpty) plant._sources[key] = source;
  }
}

/** Ratings default to 0 (unrated), which must count as empty. */
export const SCORE_FIELDS = new Set(['eatableScore', 'medsScore', 'materialScore']);
/** Sources whose values a higher-ranked source may replace. */
const ENRICH_SOURCES = new Set<DataSource>(['pfaf', 'efg', 'wikidata', 'naturadb']);

function isEmptyValue(key: string, v: unknown): boolean {
  return v === null || v === undefined || v === '' || v === false ||
    (SCORE_FIELDS.has(key) && v === 0) ||
    (Array.isArray(v) && v.every(x => !x));
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export type GatheredSources = Partial<Record<EnrichSource, SourceData>>;

/** Fetches every enabled source for a plant (in parallel). */
export async function gatherSources(latinName: string, wikidataId?: string): Promise<GatheredSources> {
  const out: GatheredSources = {};
  const jobs: Promise<void>[] = [];
  if (isSourceEnabled('wikidata')) {
    jobs.push((async () => {
      const id = wikidataId ?? await findWikidataId(latinName);
      if (!id) return;
      const fields = await fetchPlantDetails(id);
      if (Object.keys(fields).length > 0) out.wikidata = { fields, reportedFalse: [] };
    })());
  }
  if (latinName && (isSourceEnabled('pfaf') || isSourceEnabled('efg'))) {
    jobs.push((async () => {
      const proxy = await fetchProxySources(latinName);
      if (proxy.pfaf && isSourceEnabled('pfaf')) out.pfaf = proxy.pfaf;
      if (proxy.efg && isSourceEnabled('efg')) out.efg = proxy.efg;
    })());
  }
  await Promise.all(jobs);
  return out;
}

/** A Latin name mirrored into commonName by an earlier run counts as empty. */
function isMirroredLatin(plant: PlantData): boolean {
  return !!plant.commonName && plant.commonName.trim().toLowerCase() === plant.latinName.trim().toLowerCase();
}

/** Wikidata's German name: fills an empty or mirrored commonName, and replaces
 *  an earlier non-manual name when Wikidata now offers a different real one. */
function applyGermanName(plant: PlantData, wikidata: SourceData | undefined): number {
  const name = wikidata?.fields.commonName;
  if (typeof name !== 'string' || !name.trim()) return 0;
  const src = plant._sources?.commonName;
  if (src === 'manual' || src === 'csv' || src === 'sample') {
    if (!isMirroredLatin(plant)) return 0;
  }
  if (name.trim().toLowerCase() === plant.latinName.trim().toLowerCase() && plant.commonName) return 0;
  if (plant.commonName === name) return 0;
  plant.commonName = name;
  plant._sources!.commonName = 'wikidata';
  return 1;
}

/**
 * Merges gathered source data into the plant by priority. Returns the number
 * of fields that changed.
 */
export function applySources(plant: PlantData, data: GatheredSources, order: EnrichSource[]): number {
  if (!plant._sources) plant._sources = {};
  const sources = plant._sources;
  const rank = (s: DataSource | undefined) => {
    const i = order.indexOf(s as EnrichSource);
    return i === -1 ? Infinity : i;
  };
  let changed = applyGermanName(plant, data.wikidata);

  const keys = new Set<keyof PlantData>();
  for (const d of Object.values(data)) {
    for (const k of Object.keys(d.fields) as (keyof PlantData)[]) keys.add(k);
    for (const k of d.reportedFalse) keys.add(k);
  }
  keys.delete('commonName');
  // imageCredit is checked against the final imageUrl, so it goes last
  // (sources arrive in parallel, so collection order is arbitrary).
  const ordered = [...keys].sort((a, b) => Number(a === 'imageCredit') - Number(b === 'imageCredit'));

  for (const key of ordered) {
    // Highest-ranked source with an opinion on this field decides.
    const decider = order.find(s => {
      const d = data[s];
      return d && ((key in d.fields && !isEmptyValue(key, d.fields[key])) || d.reportedFalse.includes(key));
    });
    if (!decider) continue;
    const next = decider in data && key in data[decider]!.fields ? data[decider]!.fields[key] : false;

    // Wikidata's image credit belongs to Wikidata's image only.
    if (key === 'imageCredit' && data.wikidata?.fields.imageUrl !== plant.imageUrl) continue;

    const current = plant[key];
    const currentSource = sources[key];
    const writable = isEmptyValue(key, current)
      || currentSource === decider
      || (currentSource !== undefined && ENRICH_SOURCES.has(currentSource) && rank(currentSource) > rank(decider));
    if (!writable || sameValue(current, next)) continue;

    (plant as any)[key] = next;
    if (isEmptyValue(key, next)) delete sources[key];
    else sources[key] = decider;
    changed++;
  }

  // English-only sources fill commonName only when nothing better exists.
  if (!plant.commonName || isMirroredLatin(plant)) {
    const fallback = order.map(s => data[s]?.fields.commonName).find(n => typeof n === 'string' && n.trim());
    if (fallback && fallback !== plant.commonName) {
      plant.commonName = fallback;
      sources.commonName = order.find(s => data[s]?.fields.commonName === fallback)!;
      changed++;
    }
  }
  return changed;
}

/** Labels of the sources that contributed, in priority order — for status text. */
export function contributingSourceLabels(data: GatheredSources, order: EnrichSource[]): string[] {
  const label: Record<EnrichSource, string> = { pfaf: 'PFAF', efg: 'Edible Forest Gardens', wikidata: 'Wikidata' };
  return order.filter(s => data[s]).map(s => label[s]);
}

/** "Ergänzen" / "Lade alle fehlenden Daten" for an existing plant. */
export async function enrichPlant(plant: PlantData): Promise<number> {
  if (!plant.latinName) return 0;
  const data = await gatherSources(plant.latinName);
  let changed = applySources(plant, data, getSourcePriority());

  // Existing plants whose Commons image predates attribution support.
  if (needsImageCredit(plant)) {
    const credit = await fetchCommonsCredit(commonsFileName(plant.imageUrl)!);
    if (credit) { plant.imageCredit = credit; changed++; }
  }
  return changed;
}

/** A new plant from a search hit, filled from all enabled sources. The name
 *  shown in the search result is kept as the user's choice. */
export async function createPlantFromSearch(result: SearchResult): Promise<{ plant: PlantData; sourceLabels: string[] }> {
  const plant = createEmptyPlant();
  plant._sources = {};
  plant.latinName = result.latinName;
  plant.commonName = result.commonName;
  if (plant.latinName) plant._sources.latinName = 'manual';
  if (plant.commonName && plant.commonName !== plant.latinName) plant._sources.commonName = 'manual';

  const order = getSourcePriority();
  const data = await gatherSources(plant.latinName, result.wikidataId);
  applySources(plant, data, order);
  plant.id = newId();
  return { plant, sourceLabels: contributingSourceLabels(data, order) };
}
