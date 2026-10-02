import { createEmptyPlant, parseHabit, type PlantData } from './types';
import { BOOL_FIELDS } from './plant-fields';
import { normalizePlant } from './plant-normalize';

// The app's own CSV format: one column list drives export, the import
// template and import, so the three can't drift apart. Import matches columns
// by header name, so column order doesn't matter and files from older
// versions (which lack the later columns) still import.

interface Column {
  header: string;
  get: (p: PlantData) => string;
  set: (p: PlantData, v: string) => void;
  /** Example value for the import template (Sambucus nigra). */
  example: string;
}

const num = (v: string): number | null => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** Months as "4,5,6" (1-based), the readable form for a spreadsheet cell. */
const monthsToCsv = (m: boolean[]) => m.map((on, i) => on ? i + 1 : 0).filter(Boolean).join(',');
const monthsFromCsv = (v: string): boolean[] => {
  const months = Array(12).fill(false);
  for (const part of v.split(/[,;\s]+/)) {
    const n = parseInt(part, 10);
    if (n >= 1 && n <= 12) months[n - 1] = true;
  }
  return months;
};

export function parseBool(val: string): boolean {
  const lower = (val ?? '').trim().toLowerCase();
  return lower === 'true' || lower === '1' || lower === 'visible' || lower === 'yes' || lower === 'ja' || lower === 'x';
}

const text = (header: string, key: 'latinName' | 'commonName' | 'commonNameEn' | 'varietyName' | 'climateZone' | 'imageUrl' | 'imageCredit' | 'notes', example: string): Column => ({
  header, example,
  get: p => p[key] ?? '',
  set: (p, v) => { p[key] = v; },
});

const COLUMNS: Column[] = [
  text('Lateinisch', 'latinName', 'Sambucus nigra'),
  text('Deutsch', 'commonName', 'Schwarzer Holunder'),
  { header: 'Höhe_m', example: '6', get: p => p.heightM == null ? '' : String(p.heightM), set: (p, v) => { p.heightM = num(v); } },
  { header: 'Breite_m', example: '4', get: p => p.widthM == null ? '' : String(p.widthM), set: (p, v) => { p.widthM = num(v); } },
  text('Klimazone', 'climateZone', '5-10'),
  { header: 'Wuchsform', example: 'shrub', get: p => p.habit ?? '', set: (p, v) => { p.habit = parseHabit(v); } },
  ...BOOL_FIELDS.map((f): Column => ({
    header: f.csv,
    example: ['eatable', 'meds', 'mineralFix', 'insects', 'sunFull', 'sunMid', 'waterMid', 'phNeutral', 'growSpeedHigh'].includes(f.key) ? '1' : '0',
    get: p => p[f.key] ? '1' : '0',
    set: (p, v) => { p[f.key] = parseBool(v); },
  })),
  text('Bild_URL', 'imageUrl', ''),
  { header: 'Gruppen', example: 'Waldgarten', get: p => (p.groups ?? []).join(', '), set: (p, v) => { p.groups = v.split(',').map(s => s.trim()).filter(Boolean); } },
  text('Englisch', 'commonNameEn', 'Elder'),
  text('Sorte', 'varietyName', ''),
  { header: 'Score_Essbar', example: '3', get: p => String(p.eatableScore ?? 0), set: (p, v) => { p.eatableScore = num(v) ?? 0; } },
  { header: 'Score_Medizin', example: '3', get: p => String(p.medsScore ?? 0), set: (p, v) => { p.medsScore = num(v) ?? 0; } },
  { header: 'Score_Material', example: '2', get: p => String(p.materialScore ?? 0), set: (p, v) => { p.materialScore = num(v) ?? 0; } },
  { header: 'Blüte_Monate', example: '6,7', get: p => monthsToCsv(p.flowerMonths ?? []), set: (p, v) => { p.flowerMonths = monthsFromCsv(v); } },
  { header: 'Frucht_Monate', example: '8,9', get: p => monthsToCsv(p.fruitMonths ?? []), set: (p, v) => { p.fruitMonths = monthsFromCsv(v); } },
  text('Bildnachweis', 'imageCredit', ''),
  text('Notizen', 'notes', ''),
  { header: 'Druckanzahl', example: '1', get: p => String(p.printCount ?? 1), set: (p, v) => { const n = num(v); if (n != null) p.printCount = n; } },
];

const quote = (v: string) => `"${v.replace(/"/g, '""')}"`;

export function buildCSV(plants: PlantData[]): string {
  const rows = plants.map(p => COLUMNS.map(c => quote(c.get(p))).join(','));
  return [COLUMNS.map(c => c.header).join(','), ...rows].join('\r\n');
}

export function buildCSVTemplate(): string {
  return [COLUMNS.map(c => c.header).join(','), COLUMNS.map(c => quote(c.example)).join(',')].join('\r\n');
}

// ── Import ────────────────────────────────────────────────────────────────

/** RFC 4180-style parser: quoted fields may contain the delimiter, doubled
 *  quotes and line breaks (a multi-line note must not split the record). */
export function parseCSV(input: string): Record<string, string>[] {
  const textIn = input.replace(/^﻿/, '');
  const firstLine = textIn.slice(0, textIn.search(/\r?\n|$/));
  // PowerShell's -UseCulture writes ';' on German systems.
  const delimiter = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';

  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < textIn.length; i++) {
    const ch = textIn[i];
    if (inQuotes) {
      if (ch === '"' && textIn[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else if (ch === '\r' && textIn[i + 1] === '\n') { /* CRLF inside a field → LF */ }
      else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      record.push(field.trim()); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && textIn[i + 1] === '\n') i++;
      record.push(field.trim()); field = '';
      if (record.some(v => v !== '')) records.push(record);
      record = [];
    } else {
      field += ch;
    }
  }
  record.push(field.trim());
  if (record.some(v => v !== '')) records.push(record);

  if (records.length < 2) return [];
  const headers = records[0];
  return records.slice(1).map(values => Object.fromEntries(headers.map((h, j) => [h, values[j] ?? ''])));
}

function importAppFormat(row: Record<string, string>): PlantData {
  const plant = createEmptyPlant();
  for (const col of COLUMNS) {
    if (row[col.header] !== undefined && row[col.header] !== '') col.set(plant, row[col.header]);
  }
  return plant;
}

/** Legacy PowerShell override.csv (b_* / t_* columns). */
function importLegacyFormat(row: Record<string, string>): PlantData {
  const plant = createEmptyPlant();
  if (row['t_latin-name_text']) plant.latinName = row['t_latin-name_text'];
  if (row['t_common-name_text']) plant.commonName = row['t_common-name_text'];
  if (row['t_climate-zone_text']) plant.climateZone = row['t_climate-zone_text'];
  const dim = (v: string | undefined) => v ? num(v.replace(/[^\d.,-]/g, '')) : null;
  plant.heightM = dim(row['t_height_text']);
  plant.widthM = dim(row['t_width_text']);
  const score = (v: string | undefined) => v ? (num(v) ?? 0) : 0;
  plant.eatableScore = score(row['t_eatable-score_text']);
  plant.medsScore = score(row['t_meds-score_text']);
  plant.materialScore = score(row['t_material_score_text']);
  for (const f of BOOL_FIELDS) {
    if (f.legacyCsv && row[f.legacyCsv] !== undefined) plant[f.key] = parseBool(row[f.legacyCsv]);
  }
  for (let i = 0; i < 12; i++) {
    if (row[`b_fruit-${i}_element`] !== undefined) plant.fruitMonths[i] = parseBool(row[`b_fruit-${i}_element`]);
    if (row[`b_flower-${i}_element`] !== undefined) plant.flowerMonths[i] = parseBool(row[`b_flower-${i}_element`]);
  }
  return plant;
}

export function importFromCSV(input: string): PlantData[] {
  const rows = parseCSV(input);
  if (rows.length === 0) return [];
  const keys = Object.keys(rows[0]);
  const isAppFormat = keys.includes('Lateinisch') || keys.includes('Deutsch');
  return rows
    .map(row => normalizePlant(isAppFormat ? importAppFormat(row) : importLegacyFormat(row)))
    .filter((p): p is PlantData => p !== null);
}
