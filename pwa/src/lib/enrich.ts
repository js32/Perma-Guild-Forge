import type { PlantData, DataSource } from './types';
import { isSourceEnabled } from './settings';
import { fetchPlantDetails, fetchProxyResult, fetchCommonsCredit, commonsFileName, needsImageCredit } from './plant-search';

// "Ergänzen" / "Lade alle fehlenden Daten": fills a plant's empty fields from
// Wikidata and PFAF, recording where each value came from in plant._sources.

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




// A field counts as "fillable" if it's genuinely empty, OR — commonName
// specifically — if it's just the Latin name mirrored in by a prior
// enrichment run. Wikidata mirrors the scientific name into labels.de/en
// when no real vernacular name exists (see bestCommonName() in
// plant-search.ts), and enrichment never overwrites a non-empty field —
// so a plant enriched before that mirroring was detected keeps showing
// its Latin name as "commonName" forever, even after re-running
// "ergänzen", because PFAF/a later Wikidata pass never gets a chance to
// try a better value. Re-checking against the Latin name here lets a
// later source (e.g. PFAF's "Silver-Bell Tree" for Halesia carolina)
// supersede that stale mirrored value without a one-off migration.
// eatableScore/medsScore/materialScore default to 0 (unrated), which isn't
// caught by the null/undefined/''/false checks below — without this, a
// freshly-imported plant's 0 looks "already set" and PFAF's real score
// (fetched separately from the eatable/meds/material booleans) can never
// fill it in, silently keeping every rating stripe empty.
export const SCORE_FIELDS = new Set(['eatableScore', 'medsScore', 'materialScore']);
function isFillable(key: string, cur: unknown, plant: PlantData): boolean {
  if (cur === null || cur === undefined || cur === '' || cur === false) return true;
  if (SCORE_FIELDS.has(key) && cur === 0) return true;
  if (Array.isArray(cur) && cur.every(v => !v)) return true;
  // Never override a value the user typed themselves, even if it happens
  // to equal the Latin name.
  if (plant._sources?.[key as keyof PlantData] === 'manual') return false;
  if (key === 'commonName' && typeof cur === 'string' &&
      cur.trim().toLowerCase() === plant.latinName.trim().toLowerCase()) return true;
  return false;
}

// A REAL (non-manual, non-mirrored) commonName already stored — e.g.
// PFAF's English "Apple" — doesn't count as "fillable" above, so it stays
// stuck even after bestCommonName()'s German-preferring logic (in
// plant-search.ts) improves and could now offer "Kulturapfel" instead.
// Wikidata specifically (never PFAF — PFAF is English-only and must never
// clobber a German name) gets one extra chance per commonName: replace an
// existing non-manual value if its own answer is both real (not just its
// own mirrored-Latin-name fallback) and actually different.
function isCommonNameUpgrade(newValue: unknown, cur: unknown, plant: PlantData): boolean {
  if (typeof newValue !== 'string' || !newValue) return false;
  if (plant._sources?.commonName === 'manual') return false;
  const latinLower = plant.latinName.trim().toLowerCase();
  const newLower = newValue.trim().toLowerCase();
  if (newLower === latinLower) return false;
  const curLower = typeof cur === 'string' ? cur.trim().toLowerCase() : '';
  return newLower !== curLower;
}

export async function enrichPlant(plant: PlantData): Promise<number> {
  if (!plant.latinName) return 0;
  if (!plant._sources) plant._sources = {};
  let enriched = 0;

  // Wikidata first, deliberately: it's the source with a German commonName
  // (fetchPlantDetails prefers labels.de). PFAF only has an English common
  // name ("Apple"). Since enrichment only ever fills currently-empty
  // fields (never overwrites), whichever of the two runs first "wins" — so
  // Wikidata has to go first or its German name never gets a chance,
  // silently losing to PFAF's English one. Previously PFAF ran first here
  // (unlike the search-import flow below, which already had this right),
  // which is why bulk-enriching e.g. the Crawford sample set produced
  // English common names in a German-language app.
  if (isSourceEnabled('wikidata')) {
    const searchUrl = new URL('https://www.wikidata.org/w/api.php');
    searchUrl.searchParams.set('action', 'wbsearchentities');
    searchUrl.searchParams.set('search', plant.latinName);
    searchUrl.searchParams.set('language', 'en');
    searchUrl.searchParams.set('type', 'item');
    searchUrl.searchParams.set('limit', '1');
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('origin', '*');
    const sr = await fetch(searchUrl.toString());
    if (sr.ok) {
      const sd = await sr.json();
      const wdId = sd.search?.[0]?.id;
      if (wdId) {
        const details = await fetchPlantDetails(wdId);
        const filled: Partial<PlantData> = {};
        for (const [key, value] of Object.entries(details)) {
          const cur = (plant as any)[key];
          // The credit belongs to Wikidata's image — only take it if that's
          // the image this plant ended up with (imageUrl is filled first).
          if (key === 'imageCredit' && plant.imageUrl !== details.imageUrl) continue;
          const fillable = isFillable(key, cur, plant) ||
            (key === 'commonName' && isCommonNameUpgrade(value, cur, plant));
          if (fillable && value) {
            (plant as any)[key] = value; (filled as any)[key] = value; enriched++;
          }
        }
        if (Object.keys(filled).length > 0) trackSources(plant, filled, 'wikidata');
      }
    }
  }

  if (isSourceEnabled('pfaf') || isSourceEnabled('naturadb')) {
    const { fields: proxyData, reportedFalse } = await fetchProxyResult(plant.latinName);
    const src: DataSource = isSourceEnabled('pfaf') ? 'pfaf' : 'naturadb';
    const filled: Partial<PlantData> = {};
    for (const [key, value] of Object.entries(proxyData)) {
      const cur = (plant as any)[key];
      if (isFillable(key, cur, plant) &&
          value !== null && value !== undefined && value !== '' && value !== false) {
        (plant as any)[key] = value; (filled as any)[key] = value; enriched++;
      }
    }
    if (Object.keys(filled).length > 0) trackSources(plant, filled, src);
    // A `true` this same source set earlier but now reports as false (e.g.
    // the old PFAF parser marking every semi-shade plant as full sun) gets
    // corrected. Manually entered values are never touched.
    for (const key of reportedFalse) {
      if ((plant as any)[key] === true && plant._sources[key] === src) {
        (plant as any)[key] = false;
        delete plant._sources[key];
        enriched++;
      }
    }
  }

  // Existing plants whose Commons image predates attribution support.
  if (needsImageCredit(plant)) {
    const credit = await fetchCommonsCredit(commonsFileName(plant.imageUrl)!);
    if (credit) { plant.imageCredit = credit; enriched++; }
  }

  return enriched;
}
