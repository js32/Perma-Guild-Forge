// "Edible Forest Gardens" species data (Dave Jacke & Eric Toensmeier, Edible
// Forest Gardens Vol. 2, 2005), in the "Species Toolkit" spreadsheet compiled
// by Lally Luck Farm. The raw sheet lives in data/efg-species.csv (refresh with
// `npm run efg:update`); this module turns it into plant fields, looked up by
// Latin name. Column codes are explained on the sheet's "Table Key" tab.

import { readFileSync } from 'node:fs';

export const EFG_CSV_URL = 'https://docs.google.com/spreadsheets/d/1_PgxV4pxlNTa0Ep9TDY_57oJfVtrofmu/export?format=csv&gid=1609043836';

/** RFC 4180-style CSV parser (quoted fields may contain commas and newlines). */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  row.push(field); rows.push(row);
  return rows;
}

/** Quality code → 0–5 score on PFAF's scale (E excellent, G good, F fair,
 *  Y = yields but unrated; anything else present = unrated). */
function qualityScore(code) {
  const c = (code || '').trim().toUpperCase();
  if (!c) return 0;
  return { E: 5, G: 4, F: 2 }[c] ?? 3;
}

/** "75-100'" / "6-12\"" / "3'" → metres, upper end of the range. */
export function parseLength(text) {
  const t = (text || '').trim();
  const nums = (t.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  if (nums.length === 0) return null;
  const feet = t.includes('"') ? Math.max(...nums) / 12 : Math.max(...nums);
  const m = feet * 0.3048;
  return Math.round(m * (m < 1 ? 100 : 10)) / (m < 1 ? 100 : 10);
}

const normalizeName = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Converts one sheet row into plant fields (same keys as PFAF's proxy fields). */
/** "Form" column: "Tree (l)", "Shrub (m-l)", "Herb (s)", "Vine (h)". */
function efgHabit(form) {
  const m = form.trim().toLowerCase().match(/^(tree|shrub|herb|vine)\b/);
  if (!m) return '';
  return m[1] === 'vine' ? 'climber' : m[1];
}

function rowToFields(get) {
  const has = (col) => get(col).trim() !== '';
  const light = get('Light'), moisture = get('Moisture');
  const growth = get('Growth Rate').toUpperCase();

  const edibleScore = Math.max(...['Edible Fruit', 'Edible Nuts/Mast', 'Edible Greens etc', 'Edible Roots', 'Edible Other']
    .map(c => qualityScore(get(c))));
  const medsScore = qualityScore(get('Medicinal'));
  const cold = get('Zone cold').trim(), warm = get('Zone warm').trim();
  const validZone = (z) => /^\d+[ab]?$/.test(z);

  return {
    commonName: get('Common Name').trim(),
    heightM: parseLength(get('Height')),
    widthM: parseLength(get('Width')),
    habit: efgHabit(get('Form')),
    climateZone: validZone(cold) && validZone(warm) ? (cold === warm ? cold : `${cold}-${warm}`)
      : validZone(cold) ? `ab ${cold}` : '',
    // Same thresholds as the PFAF parser: a use counts from a "real" rating
    // up; a "fair" one only sets the score.
    eatableScore: edibleScore,
    eatable: edibleScore >= 3,
    medsScore,
    meds: medsScore >= 3,
    culinaric: has('Culinary') || has('Tea'),
    nitrogenFix: get('N2 Fixer').trim().toUpperCase() === 'Y',
    mineralFix: get('Dynamic Accumulator').trim().toUpperCase() === 'Y',
    groundCover: get('Groundcover').trim().toUpperCase() === 'Y',
    insects: get('Invertebrate Shelter').trim().toUpperCase() === 'Y' || has('Nectary'),
    animalProtection: has('Wildlife'),
    // Light/Moisture: □ / ◘ / ■ for the low / middle / high end, combinable.
    sunFull: light.includes('□'),
    sunMid: light.includes('◘'),
    sunShadow: light.includes('■'),
    waterDry: moisture.includes('□'),
    waterMid: moisture.includes('◘'),
    waterWet: moisture.includes('■'),
    phVeryAcid: has('Strongly Acidic - 3.5-5.0'),
    phAcid: has('Acidic - 5.1-6.0'),
    phNeutral: has('Garden Soil - 6.1-7.0'),
    phAlkaline: has('Basic - 7.1-8.5'),
    growSpeedLow: /\bS\b/.test(growth.replace(/-/g, ' ')),
    growSpeedMid: /\bM\b/.test(growth.replace(/-/g, ' ')),
    growSpeedHigh: /\bF\b/.test(growth.replace(/-/g, ' ')),
  };
}

// Current names for species the sheet lists under an older synonym or a typo.
const SYNONYMS = {
  'malus domestica': 'malus pumila',
  'prunus armeniaca': 'prunus armenaica',
};

const SIZE_SUFFIX = /,\s*(minidwarf|dwarf|semidwarf|standard)\s*$/i;

/** Several rows per species (e.g. apple minidwarf/dwarf/semidwarf/standard):
 *  size and name come from the "standard" row (else the tallest), yes/no
 *  traits and ratings are combined across all rows. */
function mergeRows(rows) {
  const base = rows.find(r => SIZE_SUFFIX.test(r.commonName) && /standard/i.test(r.commonName))
    ?? rows.reduce((a, b) => ((b.heightM ?? 0) > (a.heightM ?? 0) ? b : a));
  const merged = { ...base, commonName: base.commonName.replace(SIZE_SUFFIX, '').trim() };
  for (const r of rows) {
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === 'boolean') merged[k] = merged[k] || v;
      if (k === 'eatableScore' || k === 'medsScore') merged[k] = Math.max(merged[k], v);
    }
  }
  merged.eatable = merged.eatableScore >= 3;
  merged.meds = merged.medsScore >= 3;
  return merged;
}

/** Parses the sheet's CSV export into a Map: normalized Latin name → fields. */
export function parseEfgCsv(text) {
  const rows = parseCsv(text);
  const headerIdx = rows.findIndex(r => (r[0] || '').trim() === 'Genus');
  if (headerIdx === -1) throw new Error('EFG sheet: header row with "Genus" not found');
  const header = rows[headerIdx].map(h => h.trim());
  const grouped = new Map();
  for (const r of rows.slice(headerIdx + 1)) {
    const genus = (r[0] || '').trim(), species = (r[1] || '').trim();
    if (!genus || !species) continue;
    const get = (col) => { const i = header.indexOf(col); return i === -1 ? '' : (r[i] ?? ''); };
    const latinName = `${genus} ${species}`;
    const key = normalizeName(latinName);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push({ latinName, ...rowToFields(get) });
  }
  const index = new Map();
  for (const [key, group] of grouped) index.set(key, mergeRows(group));
  return index;
}

let cached = null;
/** Lazily loads data/efg-species.csv. A missing or broken file only disables
 *  EFG (empty index, logged) — it must not take the PFAF proxy down with it. */
export function efgIndex() {
  if (!cached) {
    try {
      cached = parseEfgCsv(readFileSync(new URL('./data/efg-species.csv', import.meta.url), 'utf8'));
    } catch (err) {
      console.error(`EFG data unavailable, continuing without it: ${err.message}`);
      cached = new Map();
    }
  }
  return cached;
}

/** Fields for a Latin name, or {} if the sheet doesn't list the plant. */
export function lookupEfg(latinName, index = efgIndex()) {
  const key = normalizeName(latinName || '');
  const hit = index.get(key) ?? index.get(SYNONYMS[key]);
  if (!hit) return {};
  const { latinName: _ignored, ...fields } = hit;
  return { source: 'efg', ...fields };
}
