import type { PlantData } from './types';
import { hasSource } from './types';
import { escapeHtml, imageCreditOverlayHtml } from './html';
import { displayCommonName } from './plant-name';

/** PFAF's database text is CC BY 4.0, which requires attribution wherever the
 *  data is republished — including on printed/exported cards, not just in the
 *  app's own UI. Only shown when the plant actually has PFAF-sourced fields. */
const PFAF_ATTRIBUTION = 'Daten: PFAF.org (CC BY 4.0)';

// Colour palette matching the original SVG templates
const C = {
  fruit: '#ff0000',
  flower: '#ff00cc',
  eatable: '#8bc34a',
  culinaric: '#e1b2d3',
  meds: '#f44336',
  material: '#7b6a58',
  fodder: '#79c197',
  fuel: '#fbec53',
  nitrogenFix: '#95c11f',
  mineralFix: '#1d71b8',
  groundCover: '#f39200',
  insects: '#dedc00',
  pest: '#c8db85',
  animalProtection: '#b17f4a',
  windBreaking: '#de87cd',
  windBreakingOnSea: '#b0d0ff',
  sunFull: '#ffdd00',
  sunMid: '#ffee66',
  sunShadow: '#b0bec5',
  waterDry: '#e8d5b7',
  waterMid: '#81d4fa',
  waterWet: '#1565c0',
  phVeryAcid: '#ff5555',
  phAcid: '#ffd42a',
  phNeutral: '#00d400',
  phAlkaline: '#2ca089',
  phVeryAlkaline: '#0066ff',
  inactive: '#e8e8e8',
  border: '#cccccc',
  header: '#004754',
} as const;

const MONTHS = ['J','F','M','A','M','J','J','A','S','O','N','D'];

/** Square function badge (38×38px) */
function badge(label: string, active: boolean, color: string, score?: number | null): string {
  const bg = active ? color : C.inactive;
  const tc = active ? '#1a1a1a' : '#999';
  return (
    `<div style="display:inline-flex;flex-direction:column;align-items:center;justify-content:center;` +
    `width:38px;height:38px;background:${bg};border:1px solid ${C.border};border-radius:3px;` +
    `font-size:9px;font-family:Arial,sans-serif;color:${tc};font-weight:${active ? 'bold' : 'normal'};` +
    `text-align:center;line-height:1.1;box-sizing:border-box;flex-shrink:0;">` +
    `${label}` +
    (active && score ? `<span style="font-size:7px;font-weight:normal;">${score}</span>` : '') +
    `</div>`
  );
}

/** Month box (18×18px) */
function monthBox(active: boolean, color: string, label: string, size = 18): string {
  return (
    `<div style="width:${size}px;height:${size}px;background:${active ? color : C.inactive};` +
    `border:1px solid ${C.border};border-radius:2px;display:inline-flex;align-items:center;` +
    `justify-content:center;font-size:${size <= 16 ? 6 : 7}px;font-family:Arial,sans-serif;` +
    `color:${active ? '#1a1a1a' : '#aaa'};box-sizing:border-box;flex-shrink:0;">` +
    `${label}</div>`
  );
}

/** Small pill indicator */
function pill(label: string, active: boolean, color: string, lightText = false): string {
  return (
    `<span style="display:inline-block;padding:1px 5px;margin:1px;border-radius:3px;` +
    `background:${active ? color : C.inactive};font-size:9px;font-family:Arial,sans-serif;` +
    `color:${active ? (lightText ? '#ffffff' : '#1a1a1a') : '#aaa'};` +
    `border:1px solid ${C.border};">` +
    `${label}</span>`
  );
}

/** Translate function shape shared with src/lib/i18n/core.ts's createT() —
 *  duplicated here instead of imported to keep this module framework/page
 *  agnostic (it has no i18n dict of its own; callers pass their own `t`). */
type Translate = (key: string, vars?: Record<string, string | number>) => string;

/** Stepper for PlantData.printCount — how often this plant's card is
 *  exported. 0 = deactivated (excluded from PDF exports), clicking the count
 *  toggles 0/1. Shared between index.astro's grid/list/cards views and
 *  cards.astro — each page passes its own page-scoped `t`, and wires up
 *  .btn-print-inc/.btn-print-dec/.print-count-toggle click handlers itself
 *  since they touch each page's own plant-list state. */
export function printStepperHtml(plant: PlantData, t: Translate): string {
  const count = plant.printCount ?? 1;
  const off = count === 0;
  return `
    <div class="print-stepper inline-flex items-center gap-1" title="${escapeHtml(t('printStepperTitle'))}">
      <button type="button" class="btn-print-dec inline-flex h-5 w-5 items-center justify-center rounded bg-stone-100 dark:bg-stone-800 text-xs font-medium leading-none text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700" title="${escapeHtml(t('printStepperLess'))}">−</button>
      <span class="print-count-toggle w-4 cursor-pointer text-center text-xs tabular-nums ${off ? 'font-semibold text-red-500' : 'text-stone-600 dark:text-stone-300'}" title="${escapeHtml(off ? t('printStepperToggleOff') : t('printStepperToggleOn'))}">${count}</span>
      <button type="button" class="btn-print-inc inline-flex h-5 w-5 items-center justify-center rounded bg-stone-100 dark:bg-stone-800 text-xs font-medium leading-none text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700" title="${escapeHtml(t('printStepperMore'))}">+</button>
    </div>`;
}

/**
 * Render a poly plant card as an inline-styled HTML string.
 * Width: 280px, Height: 480px — maps to 70×120mm in the PDF.
 * Pass `imgSrc` as a pre-fetched data-URL for offline/PDF use.
 */
export function renderPolyCardHtml(plant: PlantData, imgSrc?: string): string {
  const img = imgSrc ?? plant.imageUrl;

  const row1 =
    badge('Eat',  plant.eatable,       C.eatable,        plant.eatableScore) +
    badge('Cul',  plant.culinaric,     C.culinaric) +
    badge('Med',  plant.meds,          C.meds,           plant.medsScore) +
    badge('Mat',  plant.material,      C.material,       plant.materialScore) +
    badge('Fod',  plant.fodder,        C.fodder) +
    badge('Fuel', plant.fuel,          C.fuel);

  const row2 =
    badge('N\u2082',  plant.nitrogenFix,    C.nitrogenFix) +
    badge('Min',      plant.mineralFix,     C.mineralFix) +
    badge('Grnd',     plant.groundCover,    C.groundCover) +
    badge('Ins',      plant.insects,        C.insects) +
    badge('Pest',     plant.pest,           C.pest) +
    badge('Ani',      plant.animalProtection, C.animalProtection);

  const fruits  = MONTHS.map((m, i) => monthBox(plant.fruitMonths[i],  C.fruit,  m)).join('');
  const flowers = MONTHS.map((m, i) => monthBox(plant.flowerMonths[i], C.flower, m)).join('');

  const growthLabel = [
    plant.growSpeedLow  && 'langsam',
    plant.growSpeedMid  && 'mittel',
    plant.growSpeedHigh && 'schnell',
  ].filter(Boolean).join('/');

  return (
    `<div style="width:280px;height:480px;background:#fff;border:1px solid #ccc;` +
    `border-radius:4px;overflow:hidden;font-family:Arial,sans-serif;` +
    `display:flex;flex-direction:column;box-sizing:border-box;">` +

    // ── Header ────────────────────────────────────────────────────────────────
    `<div style="background:${C.header};color:#fff;padding:6px 8px;flex-shrink:0;">` +
      `<div style="font-size:13px;font-weight:bold;line-height:1.2;white-space:nowrap;` +
           `overflow:hidden;text-overflow:ellipsis;">${escapeHtml(plant.latinName || '—')}</div>` +
      `<div style="font-size:11px;opacity:0.85;white-space:nowrap;overflow:hidden;` +
           `text-overflow:ellipsis;">${escapeHtml(displayCommonName(plant) || '\u00a0')}</div>` +
    `</div>` +

    // ── Photo ─────────────────────────────────────────────────────────────────
    `<div style="height:128px;background:#e8e8e8;flex-shrink:0;overflow:hidden;position:relative;">` +
      (img
        ? `<img src="${escapeHtml(img)}" style="width:100%;height:100%;object-fit:cover;" />` +
          imageCreditOverlayHtml(plant.imageCredit)
        : `<div style="height:100%;display:flex;align-items:center;justify-content:center;` +
               `color:#aaa;font-size:11px;">Kein Bild</div>`) +
    `</div>` +

    // ── Info bar ──────────────────────────────────────────────────────────────
    `<div style="background:#f5f5f5;padding:3px 8px;font-size:9px;color:#555;flex-shrink:0;` +
         `display:flex;gap:6px;flex-wrap:wrap;align-items:center;">` +
      (plant.heightM  != null ? `<span>H:${escapeHtml(String(plant.heightM))}m</span>`   : '') +
      (plant.widthM   != null ? `<span>B:${escapeHtml(String(plant.widthM))}m</span>`    : '') +
      (plant.climateZone      ? `<span>Zone\u00a0${escapeHtml(plant.climateZone)}</span>` : '') +
      (growthLabel            ? `<span style="color:#777;">${growthLabel}</span>` : '') +
    `</div>` +

    // ── Function badges ───────────────────────────────────────────────────────
    `<div style="padding:4px 4px 2px;display:flex;gap:2px;flex-shrink:0;">${row1}</div>` +
    `<div style="padding:2px 4px 4px;display:flex;gap:2px;flex-shrink:0;">${row2}</div>` +

    // ── Wind ──────────────────────────────────────────────────────────────────
    `<div style="padding:2px 8px;font-size:9px;flex-shrink:0;min-height:20px;">` +
      (plant.windBreaking
        ? `<span style="background:${C.windBreaking};border-radius:2px;padding:1px 4px;` +
               `margin-right:3px;color:#1a1a1a;">Wind</span>` : '') +
      (plant.windBreakingOnSea
        ? `<span style="background:${C.windBreakingOnSea};border-radius:2px;padding:1px 4px;` +
               `color:#1a1a1a;">Wind (See)</span>` : '') +
    `</div>` +

    // ── Sun ───────────────────────────────────────────────────────────────────
    `<div style="padding:2px 8px;flex-shrink:0;">` +
      `<span style="font-size:9px;color:#888;margin-right:3px;">Sonne:</span>` +
      pill('Voll',  plant.sunFull,   C.sunFull) +
      pill('Halb',  plant.sunMid,    C.sunMid) +
      pill('Schat', plant.sunShadow, C.sunShadow) +
    `</div>` +

    // ── Water ─────────────────────────────────────────────────────────────────
    `<div style="padding:2px 8px;flex-shrink:0;">` +
      `<span style="font-size:9px;color:#888;margin-right:3px;">Wasser:</span>` +
      pill('Tro', plant.waterDry,   C.waterDry) +
      pill('Mit', plant.waterMid,   C.waterMid) +
      pill('Nas', plant.waterWet,   C.waterWet,   true) +
    `</div>` +

    // ── pH ────────────────────────────────────────────────────────────────────
    `<div style="padding:2px 8px;flex-shrink:0;">` +
      `<span style="font-size:9px;color:#888;margin-right:3px;">pH:</span>` +
      pill('vS',  plant.phVeryAcid,    C.phVeryAcid) +
      pill('S',   plant.phAcid,        C.phAcid) +
      pill('N',   plant.phNeutral,     C.phNeutral) +
      pill('A',   plant.phAlkaline,    C.phAlkaline) +
      pill('vA',  plant.phVeryAlkaline, C.phVeryAlkaline, true) +
    `</div>` +

    // ── Fruit months ──────────────────────────────────────────────────────────
    `<div style="padding:4px 8px 2px;flex-shrink:0;">` +
      `<div style="display:flex;align-items:center;gap:2px;">` +
        `<span style="font-size:9px;color:#888;min-width:36px;">Frucht:</span>` +
        `<div style="display:flex;gap:1px;">${fruits}</div>` +
      `</div>` +
    `</div>` +

    // ── Flower months ─────────────────────────────────────────────────────────
    `<div style="padding:2px 8px 2px;flex-shrink:0;">` +
      `<div style="display:flex;align-items:center;gap:2px;">` +
        `<span style="font-size:9px;color:#888;min-width:36px;">Bl\u00fcte:</span>` +
        `<div style="display:flex;gap:1px;">${flowers}</div>` +
      `</div>` +
    `</div>` +

    (hasSource(plant, 'pfaf')
      ? `<div style="padding:1px 8px 3px;font-size:7px;color:#aaa;flex-shrink:0;">${PFAF_ATTRIBUTION}</div>`
      : '') +

    `</div>` // end card
  );
}

/**
 * Render a stripe card as an inline-styled HTML string.
 * Width: 870px, Height: 50px — maps to ~290×17mm in the PDF (landscape).
 */
export function renderStripeCardHtml(plant: PlantData, imgSrc?: string): string {
  const img = imgSrc ?? plant.imageUrl;

  const dots = ([
    [plant.eatable,            C.eatable,          'E'],
    [plant.culinaric,          C.culinaric,         'C'],
    [plant.meds,               C.meds,              'M'],
    [plant.material,           C.material,          'Ma'],
    [plant.fodder,             C.fodder,            'F'],
    [plant.fuel,               C.fuel,              'Br'],
    [plant.nitrogenFix,        C.nitrogenFix,       'N\u2082'],
    [plant.mineralFix,         C.mineralFix,        'Mi'],
    [plant.groundCover,        C.groundCover,       'Gd'],
    [plant.insects,            C.insects,           'In'],
    [plant.pest,               C.pest,              'Ps'],
    [plant.animalProtection,   C.animalProtection,  'An'],
  ] as [boolean, string, string][]).map(([a, c, l]) => monthBox(a, c, l, 22)).join('');

  const fruits  = MONTHS.map((m, i) => monthBox(plant.fruitMonths[i],  C.fruit,  m, 16)).join('');
  const flowers = MONTHS.map((m, i) => monthBox(plant.flowerMonths[i], C.flower, m, 16)).join('');

  return (
    `<div style="width:870px;height:50px;background:#fff;border:1px solid #ccc;` +
    `border-radius:2px;overflow:hidden;font-family:Arial,sans-serif;` +
    `display:flex;align-items:center;box-sizing:border-box;">` +

    // Photo
    `<div title="${escapeHtml(plant.imageCredit || '')}" style="width:50px;height:50px;flex-shrink:0;background:#e8e8e8;overflow:hidden;">` +
      (img ? `<img src="${escapeHtml(img)}" style="width:100%;height:100%;object-fit:cover;" />` : '') +
    `</div>` +

    // Name
    `<div style="padding:0 8px;width:150px;flex-shrink:0;">` +
      `<div style="font-size:11px;font-weight:bold;color:${C.header};white-space:nowrap;` +
           `overflow:hidden;text-overflow:ellipsis;">${escapeHtml(plant.latinName || '—')}</div>` +
      `<div style="font-size:9px;color:#666;white-space:nowrap;overflow:hidden;` +
           `text-overflow:ellipsis;">${escapeHtml(displayCommonName(plant))}</div>` +
    `</div>` +

    // Specs
    `<div style="font-size:9px;color:#555;width:70px;flex-shrink:0;padding:0 4px;line-height:1.4;">` +
      (plant.heightM  != null ? `<div>H: ${escapeHtml(String(plant.heightM))}m</div>` : '') +
      (plant.widthM   != null ? `<div>B: ${escapeHtml(String(plant.widthM))}m</div>`  : '') +
      (plant.climateZone      ? `<div>Z: ${escapeHtml(plant.climateZone)}</div>` : '') +
    `</div>` +

    // Function dots
    `<div style="display:flex;gap:1px;flex-shrink:0;padding:0 4px;">${dots}</div>` +

    // Months
    `<div style="flex-shrink:0;padding:0 8px;">` +
      `<div style="display:flex;gap:1px;">${fruits}</div>` +
      `<div style="display:flex;gap:1px;margin-top:1px;">${flowers}</div>` +
    `</div>` +

    // Sun / Water
    `<div style="font-size:8px;flex-shrink:0;padding:0 4px;display:flex;flex-direction:column;gap:2px;">` +
      `<div style="display:flex;gap:1px;">` +
        (plant.sunFull   ? `<span style="background:${C.sunFull};padding:1px 3px;border-radius:2px;">Voll</span>`  : '') +
        (plant.sunMid    ? `<span style="background:${C.sunMid};padding:1px 3px;border-radius:2px;">Halb</span>`   : '') +
        (plant.sunShadow ? `<span style="background:${C.sunShadow};padding:1px 3px;border-radius:2px;">Scha</span>` : '') +
      `</div>` +
      `<div style="display:flex;gap:1px;">` +
        (plant.waterDry   ? `<span style="background:${C.waterDry};padding:1px 2px;border-radius:2px;">Tro</span>` : '') +
        (plant.waterMid   ? `<span style="background:${C.waterMid};padding:1px 2px;border-radius:2px;">Mit</span>` : '') +
        (plant.waterWet   ? `<span style="background:${C.waterWet};color:#fff;padding:1px 2px;border-radius:2px;">Nas</span>` : '') +
      `</div>` +
    `</div>` +

    // Attribution (fixed column, not truncated like the name field would be)
    (hasSource(plant, 'pfaf')
      ? `<div style="font-size:6px;color:#aaa;flex-shrink:0;padding:0 4px;line-height:1.3;white-space:nowrap;">PFAF.org<br/>CC BY 4.0</div>`
      : '') +

    `</div>`
  );
}
