import type { PlantData } from './types';
import type { Dict } from './i18n/core';

// Single source of truth for every boolean plant field. Form bindings, CSV
// columns, filter/badge colors, the table PDF's chips and all UI labels are
// derived from this table — adding a field here is the whole job (plus its
// checkbox markup), instead of editing half a dozen parallel lists.

export type BoolFieldKey = {
  [K in keyof PlantData]-?: PlantData[K] extends boolean ? K : never
}[keyof PlantData];

export type FieldGroup = 'usage' | 'function' | 'sun' | 'water' | 'ph' | 'growth';

export interface BoolFieldDef {
  key: BoolFieldKey;
  group: FieldGroup;
  label: { de: string; en: string };
  /** Column header in the app's own CSV export/import. */
  csv: string;
  /** Column in the legacy PowerShell override.csv format, if it had one. */
  legacyCsv?: string;
  /** Badge/dot/chip styling. Fields without it get no badge or PDF chip. */
  badge?: {
    /** Tailwind classes for the pill badge (literal strings so the JIT sees them). */
    pill: string;
    /** Dot/chip color. Where the Baumscheibe template has a color wedge for the
     *  field, this is that wedge's exact color (median of its opaque pixels);
     *  the rest are chosen to fit the palette. */
    hex: string;
    /** Short code printed on the table PDF's chips, legible in black & white. */
    pdfCode: string;
  };
}

export const BOOL_FIELDS: readonly BoolFieldDef[] = [
  // ── Nutzung ──
  { key: 'eatable', group: 'usage', label: { de: 'Essbarkeit', en: 'Edibility' }, csv: 'Essbar', legacyCsv: 'b_eatable_element',
    badge: { pill: 'bg-amber-100 text-amber-800', hex: '#dc330c', pdfCode: 'Es' } },
  { key: 'culinaric', group: 'usage', label: { de: 'Küche', en: 'Culinary' }, csv: 'Kulinarisch', legacyCsv: 'b_culinaric_element',
    badge: { pill: 'bg-yellow-100 text-yellow-800', hex: '#f88a70', pdfCode: 'Ku' } },
  { key: 'meds', group: 'usage', label: { de: 'Gesundheit', en: 'Medicinal' }, csv: 'Medizinisch', legacyCsv: 'b_meds_element',
    badge: { pill: 'bg-rose-100 text-rose-700', hex: '#fa512a', pdfCode: 'Me' } },
  { key: 'material', group: 'usage', label: { de: 'Materialien', en: 'Materials' }, csv: 'Material', legacyCsv: 'b_material_element',
    badge: { pill: 'bg-orange-100 text-orange-800', hex: '#fb923c', pdfCode: 'Ma' } },
  { key: 'fodder', group: 'usage', label: { de: 'Tierfutter', en: 'Fodder' }, csv: 'Futter', legacyCsv: 'b_fodder_element',
    badge: { pill: 'bg-lime-100 text-lime-700', hex: '#a3e635', pdfCode: 'Fu' } },
  { key: 'fuel', group: 'usage', label: { de: 'Brennstoff', en: 'Fuel' }, csv: 'Brennstoff', legacyCsv: 'b_fuel_element',
    badge: { pill: 'bg-red-100 text-red-700', hex: '#f87171', pdfCode: 'Br' } },
  { key: 'wood', group: 'usage', label: { de: 'Nutzholz', en: 'Wood' }, csv: 'Nutzholz',
    badge: { pill: 'bg-amber-200 text-amber-900', hex: '#92400e', pdfCode: 'Nu' } },
  { key: 'fiber', group: 'usage', label: { de: 'Fasern', en: 'Fiber' }, csv: 'Fasern',
    badge: { pill: 'bg-stone-200 text-stone-700', hex: '#78716c', pdfCode: 'Fa' } },
  { key: 'ornamental', group: 'usage', label: { de: 'Ästhetik', en: 'Ornamental' }, csv: 'Ästhetik',
    badge: { pill: 'bg-pink-100 text-pink-700', hex: '#ec4899', pdfCode: 'As' } },
  { key: 'dyes', group: 'usage', label: { de: 'Farbstoff', en: 'Dyes' }, csv: 'Farbstoff',
    badge: { pill: 'bg-purple-100 text-purple-700', hex: '#a855f7', pdfCode: 'Fb' } },

  // ── Funktionen ──
  { key: 'nitrogenFix', group: 'function', label: { de: 'Stickstoff-Fixierer', en: 'Nitrogen fixer' }, csv: 'N_Fixierung', legacyCsv: 'b_nitrogen-fix-element',
    badge: { pill: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300', hex: '#92d051', pdfCode: 'N' } },
  { key: 'mineralFix', group: 'function', label: { de: 'Mineraliensammler', en: 'Dynamic accumulator' }, csv: 'Mineralien', legacyCsv: 'b_mineral-fix-element',
    badge: { pill: 'bg-emerald-100 text-emerald-800', hex: '#3cbbe4', pdfCode: 'Mi' } },
  { key: 'groundCover', group: 'function', label: { de: 'Bodendecker', en: 'Ground cover' }, csv: 'Bodendecker', legacyCsv: 'b_ground-cover_element',
    badge: { pill: 'bg-teal-100 text-teal-800', hex: '#d4a525', pdfCode: 'Bo' } },
  { key: 'insects', group: 'function', label: { de: 'Insekten', en: 'Invertebrates' }, csv: 'Insekten', legacyCsv: 'b_insects_element',
    badge: { pill: 'bg-cyan-100 text-cyan-800', hex: '#fadb07', pdfCode: 'In' } },
  { key: 'pest', group: 'function', label: { de: 'Schädlingsschutz', en: 'Pest control' }, csv: 'Schädling', legacyCsv: 'b_pest_element',
    badge: { pill: 'bg-red-100 text-red-800', hex: '#ef4444', pdfCode: 'Sc' } },
  { key: 'windBreaking', group: 'function', label: { de: 'Windschutz', en: 'Windbreak' }, csv: 'Windschutz', legacyCsv: 'b_wind-breaking_element',
    badge: { pill: 'bg-sky-100 text-sky-800', hex: '#c6c6c6', pdfCode: 'Wi' } },
  { key: 'animalProtection', group: 'function', label: { de: 'Kleintiere', en: 'Wildlife' }, csv: 'Tierschutz', legacyCsv: 'b_animal-protection_element',
    badge: { pill: 'bg-violet-100 text-violet-800', hex: '#ba7010', pdfCode: 'Ti' } },
  { key: 'windBreakingOnSea', group: 'function', label: { de: 'Wind (See)', en: 'Wind (coastal)' }, csv: 'Wind_See', legacyCsv: 'b_wind-breaking-on-sea_icon' },

  // ── Sonne ──
  { key: 'sunFull', group: 'sun', label: { de: 'Volle Sonne', en: 'Full sun' }, csv: 'Sonne_voll', legacyCsv: 'b_sun-full_element',
    badge: { pill: 'bg-yellow-100 text-yellow-800', hex: '#fbbf24', pdfCode: 'V' } },
  { key: 'sunMid', group: 'sun', label: { de: 'Halbschatten', en: 'Partial shade' }, csv: 'Halbschatten', legacyCsv: 'b_sun_mid_element',
    badge: { pill: 'bg-orange-100 text-orange-800', hex: '#fb923c', pdfCode: 'H' } },
  { key: 'sunShadow', group: 'sun', label: { de: 'Schatten', en: 'Shade' }, csv: 'Schatten', legacyCsv: 'b_sun_shadow_element',
    badge: { pill: 'bg-slate-200 text-slate-700', hex: '#64748b', pdfCode: 'S' } },

  // ── Wasser ──
  { key: 'waterDry', group: 'water', label: { de: 'Trocken', en: 'Dry' }, csv: 'Wasser_trocken', legacyCsv: 'b_water-dry_element',
    badge: { pill: 'bg-amber-100 text-amber-800', hex: '#d97706', pdfCode: 'T' } },
  { key: 'waterMid', group: 'water', label: { de: 'Mittel', en: 'Medium' }, csv: 'Wasser_mittel', legacyCsv: 'b_water-mid_element',
    badge: { pill: 'bg-sky-100 text-sky-800', hex: '#38bdf8', pdfCode: 'M' } },
  { key: 'waterWet', group: 'water', label: { de: 'Nass', en: 'Wet' }, csv: 'Wasser_nass', legacyCsv: 'b_water-wet_element',
    badge: { pill: 'bg-blue-100 text-blue-800', hex: '#1d4ed8', pdfCode: 'F' } },

  // ── pH ──
  { key: 'phVeryAcid', group: 'ph', label: { de: 'Sehr sauer', en: 'Very acidic' }, csv: 'pH_sehr_sauer', legacyCsv: 'b_ph-very-acid_element' },
  { key: 'phAcid', group: 'ph', label: { de: 'Sauer', en: 'Acidic' }, csv: 'pH_sauer', legacyCsv: 'b_ph-acid_element' },
  { key: 'phNeutral', group: 'ph', label: { de: 'Neutral', en: 'Neutral' }, csv: 'pH_neutral', legacyCsv: 'b_ph-neutral_element' },
  { key: 'phAlkaline', group: 'ph', label: { de: 'Alkalisch', en: 'Alkaline' }, csv: 'pH_alkalisch', legacyCsv: 'b_ph-alkaline_element' },
  { key: 'phVeryAlkaline', group: 'ph', label: { de: 'Sehr alk.', en: 'Very alk.' }, csv: 'pH_sehr_alk', legacyCsv: 'b_ph-very-alkaline_element' },

  // ── Wuchs ──
  { key: 'growSpeedLow', group: 'growth', label: { de: 'Langsam', en: 'Slow' }, csv: 'Wachstum_langsam', legacyCsv: 'b_grow-speed-low_icon',
    badge: { pill: 'bg-red-100 text-red-800', hex: '#ef4444', pdfCode: '1' } },
  { key: 'growSpeedMid', group: 'growth', label: { de: 'Mittel', en: 'Medium' }, csv: 'Wachstum_mittel', legacyCsv: 'b_grow-speed-mid_icon',
    badge: { pill: 'bg-amber-100 text-amber-800', hex: '#f59e0b', pdfCode: '2' } },
  { key: 'growSpeedHigh', group: 'growth', label: { de: 'Schnell', en: 'Fast' }, csv: 'Wachstum_schnell', legacyCsv: 'b_grow-speed-high_icon',
    badge: { pill: 'bg-green-100 text-green-800', hex: '#22c55e', pdfCode: '3' } },
];

export const BOOL_FIELD_KEYS: readonly BoolFieldKey[] = BOOL_FIELDS.map(f => f.key);

export function fieldsOf(group: FieldGroup): readonly BoolFieldDef[] {
  return BOOL_FIELDS.filter(f => f.group === group);
}

/** Only the fields that carry badge styling — what tiles, dots and PDF chips show. */
export function badgedFieldsOf(group: FieldGroup): readonly (BoolFieldDef & { badge: NonNullable<BoolFieldDef['badge']> })[] {
  return BOOL_FIELDS.filter((f): f is BoolFieldDef & { badge: NonNullable<BoolFieldDef['badge']> } => f.group === group && !!f.badge);
}

/** i18n key of a field's label — `data-i18n="fld_eatable"` in markup, `t(fieldLabelKey('eatable'))` in code. */
export function fieldLabelKey(key: BoolFieldKey): string {
  return `fld_${key}`;
}

/** Dictionary entries for every field label; merged into plantDetailDict. */
export const fieldLabelDict: Dict = Object.fromEntries(BOOL_FIELDS.map(f => [fieldLabelKey(f.key), f.label]));
