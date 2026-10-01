import type { PlantData } from './types';
import { isSourceEnabled } from './settings';

// ── Local plant database ─────────────────────────────────────────────────────

interface DBEntry { latinName: string; commonName?: string; }
let _dbCache: DBEntry[] | null = null;

async function getPlantDB(): Promise<DBEntry[]> {
  if (_dbCache !== null) return _dbCache;
  try {
    const res = await fetch('/plants-db.json');
    _dbCache = res.ok ? await res.json() : [];
  } catch {
    _dbCache = [];
  }
  return _dbCache!;
}

function searchDB(db: DBEntry[], query: string): SearchResult[] {
  const q = query.toLowerCase();
  return db
    .filter(p =>
      p.latinName.toLowerCase().includes(q) ||
      (p.commonName && p.commonName.toLowerCase().includes(q))
    )
    .slice(0, 8)
    .map(p => ({
      latinName: p.latinName,
      commonName: p.commonName || p.latinName,
      description: 'Lokale Datenbank',
    }));
}

export interface SearchResult {
  latinName: string;
  commonName: string;
  wikidataId?: string;
  description?: string;
}

// Whole-word match, not substring: bare .includes() flagged "species of
// plant" — Wikidata's generic fallback description for thousands of minor
// taxa that lack a richer one — as a non-plant, because "ant" is a
// substring of "plant". Confirmed live: this silently dropped e.g. Cynara
// cardunculus itself from search results while its cultivars/subspecies
// (which happen to have richer, non-generic descriptions) still showed up.
// Word-boundary matching also incidentally fixes German compound
// false-positives like "Vogelbeere" (contains "vogel" but isn't one) and
// "Wurmfarn" (contains "wurm"). `s?` allows the plural (birds, insects, …)
// without reintroducing the "plant(s)" false-positive, since the boundary
// before the root word still requires a non-letter.
const NON_PLANT_WORDS = [
  'animal', 'mammal', 'bird', 'fish', 'reptile', 'insect', 'amphibian',
  'beetle', 'butterfly', 'moth', 'spider', 'bee', 'wasp', 'ant', 'worm',
  'tier', 'säugetier', 'vogel', 'fisch', 'reptil', 'insekt', 'käfer',
  'schmetterling', 'spinne', 'wurm',
];
const NON_PLANT_RE = new RegExp(`\\b(${NON_PLANT_WORDS.join('|')})s?\\b`);

/** Return false if the description clearly identifies a non-plant organism. */
function looksLikePlant(descDe: string, descEn: string): boolean {
  const text = `${descDe} ${descEn}`.toLowerCase();
  if (!text.trim()) return true; // no description → keep
  return !NON_PLANT_RE.test(text);
}

/** Collects Wikidata P1843 ("taxon common name") claims by language, first
 *  value per language wins. Distinct from `entity.labels` — Wikidata bots
 *  commonly mirror the scientific name into every language's `labels` entry
 *  when no vernacular name exists for that language, so `labels.de` being
 *  non-empty does NOT mean a real German common name exists. */
function taxonCommonNames(entity: any): Record<string, string> {
  const out: Record<string, string> = {};
  const claims = entity.claims?.P1843 || [];
  for (const c of claims) {
    const v = c.mainsnak?.datavalue?.value;
    if (v?.language && v?.text && !(v.language in out)) out[v.language] = v.text;
  }
  return out;
}

/** Picks the best available common name for an entity, preferring a real
 *  German vernacular name (P1843/de) over `labels.de`, since the latter is
 *  often just the scientific name mirrored in by Wikidata when no true
 *  German common name has been entered (e.g. Tagetes patula → labels.de is
 *  literally "Tagetes patula", identical to the Latin name). Falls through
 *  German → the German Wikipedia article title (a human-picked name even
 *  when the Wikidata item's own label was never properly set — e.g. Malus
 *  domestica's item has labels.de/en AND P1843 both mirrored/missing, yet
 *  its dewiki sitelink is "Kulturapfel") → English (same de-first logic) →
 *  the raw labels as a last resort, so behavior never regresses to an
 *  empty name where one was shown before. */
function bestCommonName(entity: any, latin: string): string {
  const common = taxonCommonNames(entity);
  const labelDe = entity.labels?.de?.value;
  const labelEn = entity.labels?.en?.value;
  const dewikiTitle = entity.sitelinks?.dewiki?.title;
  const latinLower = latin.trim().toLowerCase();
  const isMirrored = (s?: string) => !s || s.trim().toLowerCase() === latinLower;
  if (common.de) return common.de;
  if (labelDe && !isMirrored(labelDe)) return labelDe;
  if (dewikiTitle && !isMirrored(dewikiTitle)) return dewikiTitle;
  if (common.en) return common.en;
  if (labelEn && !isMirrored(labelEn)) return labelEn;
  return labelDe || labelEn || '';
}

/** English counterpart of bestCommonName: P1843[en], then the English label
 *  (unless it just mirrors the Latin name). Empty if Wikidata has nothing. */
function bestEnglishName(entity: any, latin: string): string {
  const common = taxonCommonNames(entity);
  const labelEn = entity.labels?.en?.value;
  if (common.en) return common.en;
  if (labelEn && labelEn.trim().toLowerCase() !== latin.trim().toLowerCase()) return labelEn;
  return '';
}

/** Active request controller — cancelled when a newer search starts */
let activeController: AbortController | null = null;

/**
 * Search for plants. Strategy depends on enabled sources:
 * - Wikidata enabled: autocomplete search via MediaWiki CirrusSearch
 * - Only PFAF/NaturaDB: direct lookup by Latin name via proxy
 * - All enabled: Wikidata autocomplete + proxy enrichment on import
 */
export async function searchPlants(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 2) return [];

  // Cancel any in-flight request
  if (activeController) activeController.abort();
  activeController = new AbortController();
  const signal = activeController.signal;

  const wikidataEnabled = isSourceEnabled('wikidata');
  const proxyEnabled = isSourceEnabled('pfaf') || isSourceEnabled('efg');

  // 1. Local DB first (instant, no network)
  const db = await getPlantDB();
  const results: SearchResult[] = searchDB(db, query);
  const localLatinNames = new Set(results.map(r => r.latinName.toLowerCase()));

  // Wikidata autocomplete search
  if (wikidataEnabled) {
    try {
      const searchUrl = new URL('https://www.wikidata.org/w/api.php');
      searchUrl.searchParams.set('action', 'query');
      searchUrl.searchParams.set('list', 'search');
      searchUrl.searchParams.set('srsearch', `haswbstatement:P225 ${query}`);
      searchUrl.searchParams.set('srnamespace', '0');
      searchUrl.searchParams.set('srlimit', '15');
      searchUrl.searchParams.set('format', 'json');
      searchUrl.searchParams.set('origin', '*');

      const res = await fetch(searchUrl.toString(), { signal });
      if (res.ok) {
        const data = await res.json();
        const items = data.query?.search;
        if (items?.length) {
          const ids = items.map((s: any) => s.title).join('|');
          const detailUrl = new URL('https://www.wikidata.org/w/api.php');
          detailUrl.searchParams.set('action', 'wbgetentities');
          detailUrl.searchParams.set('ids', ids);
          detailUrl.searchParams.set('props', 'labels|descriptions|claims|sitelinks');
          detailUrl.searchParams.set('sitefilter', 'dewiki');
          detailUrl.searchParams.set('languages', 'de|en|la');
          detailUrl.searchParams.set('format', 'json');
          detailUrl.searchParams.set('origin', '*');

          const detailRes = await fetch(detailUrl.toString(), { signal });
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            for (const item of items) {
              const entity = detailData.entities?.[item.title];
              if (!entity) continue;
              const taxonClaim = entity.claims?.P225?.[0]?.mainsnak?.datavalue?.value;
              const descDe = entity.descriptions?.de?.value;
              const descEn = entity.descriptions?.en?.value;
              const latin = taxonClaim || '';
              // Skip if already found in local DB
              if (latin && localLatinNames.has(latin.toLowerCase())) continue;
              // Skip obvious non-plants based on description
              if (!looksLikePlant(descDe || '', descEn || '')) continue;
              results.push({
                latinName: latin,
                commonName: bestCommonName(entity, latin),
                wikidataId: item.title,
                description: descDe || descEn || '',
              });
            }
          }
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError') throw e;
      // Wikidata failed, continue with proxy if available
    }
  }

  // Direct proxy lookup if no Wikidata results or Wikidata disabled
  if (results.length === 0 && proxyEnabled && query.length >= 3) {
    try {
      const proxyUrl = `/api/plant-proxy?name=${encodeURIComponent(query)}`;
      const res = await fetch(proxyUrl, { signal });
      if (res.ok) {
        const data = await res.json();
        if (data.source && (data.commonName || data.latinName)) {
          results.push({
            latinName: data.latinName || query,
            commonName: data.commonName || '',
            description: `Quelle: ${data.source.toUpperCase()}`,
          });
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError') throw e;
    }
  }

  return results;
}

/** File name (spaces, no "File:" prefix) if `url` is a Commons Special:FilePath link. */
export function commonsFileName(url: string): string | null {
  const m = url.match(/commons\.wikimedia\.org\/wiki\/Special:FilePath\/([^?]+)/);
  if (!m) return null;
  try { return decodeURIComponent(m[1]).replace(/_/g, ' '); } catch { return null; }
}

/** True for plants with a Commons image but no attribution stored yet. */
export function needsImageCredit(p: Pick<PlantData, 'imageUrl' | 'imageCredit'>): boolean {
  return !!p.imageUrl && !p.imageCredit && !!commonsFileName(p.imageUrl);
}

/** Attribution line ("Foto: <author> · <license> · Wikimedia Commons") built
 *  from the Commons file's own metadata — most Commons licenses (CC BY, CC
 *  BY-SA) require author + license wherever the image is shown. Empty string
 *  if Commons has no usable metadata (or the request fails). */
export async function fetchCommonsCredit(fileName: string): Promise<string> {
  try {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('titles', `File:${fileName}`);
    url.searchParams.set('prop', 'imageinfo');
    url.searchParams.set('iiprop', 'extmetadata');
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');
    const res = await fetch(url.toString());
    if (!res.ok) return '';
    const data = await res.json();
    const page: any = Object.values(data.query?.pages ?? {})[0];
    const meta = page?.imageinfo?.[0]?.extmetadata;
    if (!meta) return '';
    // Artist is an HTML snippet (often a link) — reduce to plain text.
    const artistHtml: string = meta.Artist?.value ?? '';
    const artist = artistHtml
      ? (new DOMParser().parseFromString(artistHtml, 'text/html').body.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60)
      : '';
    const license: string = (meta.LicenseShortName?.value ?? '').trim();
    if (!artist && !license) return '';
    return [artist ? `Foto: ${artist}` : '', license, 'Wikimedia Commons'].filter(Boolean).join(' · ');
  } catch {
    return '';
  }
}

/**
 * Fetch detailed plant data from Wikidata for a specific entity.
 */
export async function fetchPlantDetails(wikidataId: string): Promise<Partial<PlantData>> {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.searchParams.set('action', 'wbgetentities');
  url.searchParams.set('ids', wikidataId);
  url.searchParams.set('props', 'labels|claims|sitelinks');
  url.searchParams.set('sitefilter', 'dewiki');
  url.searchParams.set('languages', 'de|en|la');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');

  const res = await fetch(url.toString());
  if (!res.ok) return {};

  const data = await res.json();
  const entity = data.entities?.[wikidataId];
  if (!entity) return {};

  const claim = (prop: string) => entity.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;

  const result: Partial<PlantData> = {};

  const taxon = claim('P225');
  if (taxon) result.latinName = taxon;

  const commonName = bestCommonName(entity, taxon || '');
  if (commonName) result.commonName = commonName;
  const commonNameEn = bestEnglishName(entity, taxon || '');
  if (commonNameEn) result.commonNameEn = commonNameEn;

  const imageName = claim('P18');
  if (imageName) {
    const encoded = encodeURIComponent(imageName.replace(/ /g, '_'));
    result.imageUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=400`;
    const credit = await fetchCommonsCredit(imageName.replace(/_/g, ' '));
    if (credit) result.imageCredit = credit;
  }

  const height = claim('P2048') || claim('P2044');
  if (height?.amount) result.heightM = parseFloat(height.amount);

  const width = claim('P2043');
  if (width?.amount) result.widthM = parseFloat(width.amount);

  const hardiness = claim('P1088');
  if (hardiness) result.climateZone = typeof hardiness === 'string' ? hardiness : String(hardiness);

  return result;
}

/** Wikidata item id for a Latin name (first search hit), or undefined. */
export async function findWikidataId(latinName: string): Promise<string | undefined> {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.searchParams.set('action', 'wbsearchentities');
  url.searchParams.set('search', latinName);
  url.searchParams.set('language', 'en');
  url.searchParams.set('type', 'item');
  url.searchParams.set('limit', '1');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return undefined;
    return (await res.json()).search?.[0]?.id;
  } catch {
    return undefined;
  }
}

const PROXY_DIRECT_FIELDS = [
  'commonName', 'heightM', 'widthM', 'climateZone',
  'eatableScore', 'medsScore', 'materialScore',
  'eatable', 'culinaric', 'meds', 'material', 'fodder', 'fuel',
  'nitrogenFix', 'mineralFix', 'groundCover', 'insects', 'pest',
  'animalProtection', 'windBreaking', 'windBreakingOnSea',
  'sunFull', 'sunMid', 'sunShadow',
  'waterDry', 'waterMid', 'waterWet',
  'growSpeedLow', 'growSpeedMid', 'growSpeedHigh',
  'phVeryAcid', 'phAcid', 'phNeutral',
  'phAlkaline', 'phVeryAlkaline',
] as const;

export interface SourceData {
  /** Fields the source has a real value for. */
  fields: Partial<PlantData>;
  /** Boolean fields the source explicitly reports as false for a plant it
   *  knows — an opinion too, which lets it outrank or correct a `true`. */
  reportedFalse: (keyof PlantData)[];
}

export type ProxySource = 'pfaf' | 'efg';

/** One source's raw proxy fields → SourceData. Common names from PFAF and EFG
 *  are English, so they also fill commonNameEn. */
export function proxyFieldsToSourceData(raw: Record<string, any>): SourceData {
  const fields: Partial<PlantData> = {};
  const reportedFalse: (keyof PlantData)[] = [];
  for (const f of PROXY_DIRECT_FIELDS) {
    const v = raw[f];
    if (v !== null && v !== undefined && v !== '' && v !== false) (fields as any)[f] = v;
    else if (v === false) reportedFalse.push(f);
  }
  if (typeof raw.commonName === 'string' && raw.commonName.trim()) fields.commonNameEn = raw.commonName.trim();
  if (Array.isArray(raw.fruitMonths) && raw.fruitMonths.some(Boolean)) fields.fruitMonths = raw.fruitMonths;
  if (Array.isArray(raw.flowerMonths) && raw.flowerMonths.some(Boolean)) fields.flowerMonths = raw.flowerMonths;
  return { fields, reportedFalse };
}

/**
 * Data from the server proxy (PFAF scraped live, Edible Forest Gardens from
 * the sheet on the server), per source. Sources the proxy doesn't know the
 * plant in are absent.
 */
export async function fetchProxySources(latinName: string): Promise<Partial<Record<ProxySource, SourceData>>> {
  try {
    const res = await fetch(`/api/plant-proxy?name=${encodeURIComponent(latinName)}`);
    if (!res.ok) return {};
    const data = await res.json();
    const out: Partial<Record<ProxySource, SourceData>> = {};
    if (data.sources && typeof data.sources === 'object') {
      for (const src of ['pfaf', 'efg'] as const) {
        if (data.sources[src]) out[src] = proxyFieldsToSourceData(data.sources[src]);
      }
    } else if (typeof data.source === 'string' && data.source.includes('pfaf')) {
      out.pfaf = proxyFieldsToSourceData(data); // older proxy: one merged PFAF result
    }
    return out;
  } catch {
    return {};
  }
}
