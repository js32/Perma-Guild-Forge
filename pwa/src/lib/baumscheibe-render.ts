import type { PlantData } from './types';
import { dataCredits } from './types';
import { TEXT_FIELDS, BOOL_FIELDS } from './baumscheibe-mapping';
import { deriveLayer, type PlantLayer } from './plant-layer';
import { displayCommonName } from './plant-name';

const TEMPLATE_URL = '/baumscheibe-template.svg';
let templatePromise: Promise<SVGSVGElement> | null = null;

async function loadTemplate(): Promise<SVGSVGElement> {
  if (templatePromise) return templatePromise;
  templatePromise = (async () => {
    const res = await fetch(TEMPLATE_URL);
    if (!res.ok) throw new Error(`Baumscheibe-Template fehlt (${res.status})`);
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (doc.querySelector('parsererror')) throw new Error('Template-SVG kann nicht geparst werden');
    return doc.documentElement as unknown as SVGSVGElement;
  })();
  return templatePromise;
}

const INK_NS = 'http://www.inkscape.org/namespaces/inkscape';

function findByLabel(root: Element, labels: string[]): Element[] {
  const out: Element[] = [];
  for (const el of Array.from(root.querySelectorAll('*'))) {
    const v = el.getAttributeNS(INK_NS, 'label') ?? el.getAttribute('inkscape:label');
    if (v && labels.includes(v)) out.push(el);
  }
  return out;
}

function setText(el: Element, value: string) {
  const tspan = el.querySelector('tspan');
  (tspan ?? el).textContent = value;
}

// commonName / latinName in the SVG template are <image> placeholder rasters,
// not text elements. We hide the placeholder and inject a real <text> element,
// centered horizontally over the same box (measured from the SVG source) but
// using the *original decorative placeholder text's own baseline y* — at the
// template's font-size (125), the old box-height-fraction formula (tuned for
// a much smaller font) sat wrong; the designer's own y for "COMMON NAME" /
// "Botanical name" is the reliable reference for where 125px text belongs in
// the dome. fontFamily likewise matches that placeholder text: Raleway
// (OFL-licensed, loaded via Google Fonts in Layout.astro) for commonName —
// shown uppercase, matching the placeholder's own "COMMON NAME" styling;
// "Voice-of-the-Highlander" for latinName is a DaFont personal-use-only
// script font — not legally embeddable here without buying a commercial
// license from the designer, so it's requested but not loaded, falling back
// to a serif italic that's at least in the spirit of a handwritten label.
const NAME_BOXES = {
  commonName: { x: 661, w: 975, yBaseline: 680.25, fontSize: 125, growCap: 165, italic: false, uppercase: true,  fontFamily: "'Raleway', sans-serif" },
  latinName:  { x: 819, w: 619, yBaseline: 522.75, fontSize: 125, growCap: 125, italic: true,  uppercase: false, fontFamily: "'Voice-of-the-Highlander', Georgia, serif" },
} as const;

// The template's own placeholder text ("COMMON NAME" / "Botanical name") is
// short and fits comfortably at font-size 125 — real plant names vary wildly
// in length and regularly wouldn't (e.g. "Robinia pseudoacacia var.
// longissima" spills well past the dome's edges at that size). Shrink the
// font just enough to fit the box width, floored at the old pre-2.3 sizes so
// a long name is never worse off than before, using canvas measureText
// rather than SVG layout APIs since this <text> lives in a detached,
// never-attached SVG (getComputedTextLength requires live layout).
// commonName additionally grows past the base 125 (up to growCap) for short
// names, so e.g. "Efeu" fills the box instead of sitting small in a frame
// sized for long names — latinName's growCap equals its base size, so it
// keeps the old shrink-only behavior (script/serif names read oddly if
// blown up, and this wasn't asked for).
const NAME_MIN_FONT_SIZE = { commonName: 65, latinName: 55 } as const;
let measureCtx: CanvasRenderingContext2D | null = null;
function fitFontSize(text: string, fontFamily: string, italic: boolean, baseFontSize: number, minFontSize: number, maxWidth: number, growCap: number): number {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return baseFontSize;
  const style = italic ? 'italic ' : '';
  measureCtx.font = `${style}${baseFontSize}px ${fontFamily}`;
  const widthAtBase = measureCtx.measureText(text).width;
  if (widthAtBase === 0) return baseFontSize;
  const scaled = Math.floor(baseFontSize * (maxWidth / widthAtBase));
  return Math.min(growCap, Math.max(minFontSize, scaled));
}

async function injectNameText(svg: SVGSVGElement, field: keyof typeof NAME_BOXES, value: string) {
  const cfg = NAME_BOXES[field];
  for (const el of findByLabel(svg, [field])) el.setAttribute('display', 'none');
  if (!value) return;
  const displayValue = cfg.uppercase ? value.toUpperCase() : value;
  // The Google Fonts <link> only registers the @font-face — the actual file
  // isn't fetched until something on the page needs it, which never
  // otherwise happens since this text lives in a detached SVG, not the DOM.
  // Force it so the font is ready before the SVG gets rasterized to canvas
  // for PDF export (an <img>-decoded SVG can use fonts the page has already
  // loaded, but won't trigger loading them itself) — and before fitFontSize()
  // measures it below, so the measurement uses the real font, not a fallback.
  try { await document.fonts.load(`500 ${cfg.fontSize}px Raleway`); } catch { /* offline first load, falls back gracefully */ }
  const fontSize = fitFontSize(
    displayValue, cfg.fontFamily, cfg.italic, cfg.fontSize, NAME_MIN_FONT_SIZE[field], cfg.w * 0.92, cfg.growCap,
  );
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', String(cfg.x + cfg.w / 2));
  text.setAttribute('y', String(cfg.yBaseline));
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('font-family', cfg.fontFamily);
  text.setAttribute('font-size', String(fontSize));
  text.setAttribute('fill', '#000000');
  text.setAttribute('fill-opacity', '0.63');
  if (cfg.italic) text.setAttribute('font-style', 'italic');
  text.textContent = displayValue;
  svg.appendChild(text);
}

function setVisible(el: Element, on: boolean) {
  if (on) el.removeAttribute('display');
  else el.setAttribute('display', 'none');
}

// Fruit/flower month calendar. The 2.3 template's "harvest" and "flowering"
// labeled groups each contain one <image> per month, in DOM order by
// angular position around the ring (month 0 = Jan at the left/180°, sweeping
// through the bottom to month 11 = Dec at the right/0° — same convention the
// old hardcoded-arc approach used). Confirmed by measuring each image's
// angle from the ring center (1140, 1130) and checking the order is
// monotonic. "harvest" (fruit) has only 11 images — no April (index 3) icon
// exists in this artwork — while "flowering" has the full 12; matched by
// nearest angle against flowering's evenly-spaced 12 positions.
const HARVEST_MONTH_INDEX = [0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11];

function setMonthRing(svg: SVGSVGElement, groupLabel: string, months: boolean[], monthIndexByOrder?: number[]) {
  const [group] = findByLabel(svg, [groupLabel]);
  if (!group) return;
  Array.from(group.querySelectorAll('image')).forEach((el, order) => {
    const monthIdx = monthIndexByOrder ? monthIndexByOrder[order] : order;
    if (monthIdx == null) return;
    setVisible(el, !!months[monthIdx]);
  });
}

function injectMonthCalendar(svg: SVGSVGElement, fruitMonths: boolean[], flowerMonths: boolean[]) {
  setMonthRing(svg, 'harvest', fruitMonths, HARVEST_MONTH_INDEX);
  setMonthRing(svg, 'flowering', flowerMonths);
}

/** Source credits (PFAF's CC BY 4.0 requires attribution wherever its data
 *  is republished; Edible Forest Gardens is credited the same way). Placed in
 *  the dome's otherwise-empty area, right of the name text, below the month
 *  calendar — one line per source. */
function injectDataCredits(svg: SVGSVGElement, credits: string[]) {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  credits.forEach((credit, i) => {
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', '1250');
    text.setAttribute('y', String(700 + i * 24));
    text.setAttribute('font-family', 'Inter, sans-serif');
    text.setAttribute('font-size', '18');
    text.setAttribute('fill', '#999999');
    text.textContent = i === 0 ? `Daten: ${credit}` : credit;
    svg.appendChild(text);
  });
}

// The "growth speed" group's three icons (speed1/speed2/speed3, one chevron-
// count per icon) were all stacked at the same position in the PSD with only
// one shown as a design preview — the 2026-09-21 template reconversion
// force-included all three (see psd2svg/psd2svg_skript.py) instead of the
// single generic icon the previous template had, so this can now show the
// actual Low/Mid/High state instead of just "a speed is known".
const GROWTH_SPEED_LABELS = { growSpeedLow: 'speed1', growSpeedMid: 'speed2', growSpeedHigh: 'speed3' } as const;

function setGrowthSpeedIcon(svg: SVGSVGElement, plant: PlantData) {
  const active = plant.growSpeedLow ? 'growSpeedLow' : plant.growSpeedMid ? 'growSpeedMid' : plant.growSpeedHigh ? 'growSpeedHigh' : null;
  for (const [field, label] of Object.entries(GROWTH_SPEED_LABELS)) {
    for (const el of findByLabel(svg, [label])) setVisible(el, field === active);
  }
}

// Sonne/Wasser — the "light" and "water" groups each hold two icon states
// (a half-filled shape for the mid state, a fully-filled one for
// shadow/wet). baumscheibe2.4.psd (2026-09-24 reconversion) ships both
// states already visible and at a single, cleaned-up canvas position —
// unlike the previous PSD, no splicing was needed this time, just a plain
// conversion (see psd2svg/convert_2.4.py). The chosen label per state
// flipped position compared to the previous template (fullshade2→
// fullshade1, semishade2→semishade1, wet1→wet2, humid1→humid2) — purely a
// PSD-side renumbering, not a meaning change. Neither group has a "full
// sun" / "dry" icon in the PSD at all (any state), so sunFull/waterDry
// just mean "hide the whole group".
const SUN_LABELS = { sunShadow: 'fullshade1', sunMid: 'semishade1' } as const;
const WATER_LABELS = { waterWet: 'wet2', waterMid: 'humid2' } as const;

function setSunIcon(svg: SVGSVGElement, plant: PlantData) {
  const active = plant.sunShadow ? 'sunShadow' : plant.sunMid ? 'sunMid' : null;
  for (const [field, label] of Object.entries(SUN_LABELS)) {
    for (const el of findByLabel(svg, [label])) setVisible(el, field === active);
  }
}

function setWaterIcon(svg: SVGSVGElement, plant: PlantData) {
  const active = plant.waterWet ? 'waterWet' : plant.waterMid ? 'waterMid' : null;
  for (const [field, label] of Object.entries(WATER_LABELS)) {
    for (const el of findByLabel(svg, [label])) setVisible(el, field === active);
  }
}

// Same story for "layer" (Baum/Strauch/Kraut/Rhizom/Kletterpflanze), all
// five stacked at the same position with only l_tree previously visible.
// Shows the icon of deriveLayer() — the growth form, or a height guess.
const LAYER_LABELS: Record<PlantLayer, string> = {
  tree: 'l_tree', shrub: 'l_shrub', herb: 'l_herb', climber: 'l_climber', rhizo: 'l_rhizo',
};

function setLayerIcon(svg: SVGSVGElement, plant: PlantData) {
  const active = deriveLayer(plant);
  for (const [layer, label] of Object.entries(LAYER_LABELS)) {
    for (const el of findByLabel(svg, [label])) setVisible(el, layer === active);
  }
}

// The "rating2" group holds five stacked stripe images ("rating 1".."rating 5",
// growing in width) at the top of the disc — only "rating 4" was visible as a
// design preview. Shows the stripe matching the edibility score (eatableScore,
// 0–5; 0 = no stripe). Medicinal/material scores are deliberately not shown.
function setRatingStripe(svg: SVGSVGElement, plant: PlantData) {
  const score = Math.max(0, Math.min(5, Math.round(plant.eatableScore || 0)));
  for (let n = 1; n <= 5; n++) {
    for (const el of findByLabel(svg, [`rating ${n}`])) setVisible(el, n === score);
  }
}

/** Render a plant into the Baumscheibe SVG template; returns serialized SVG markup. */
export async function renderBaumscheibeSvg(plant: PlantData): Promise<string> {
  const tpl = await loadTemplate();
  const svg = tpl.cloneNode(true) as SVGSVGElement;

  // Force the Raleway face to load unconditionally here (not just inside
  // injectNameText, which skips its own load call when commonName/latinName
  // is empty) — heightM/widthM/climateZone need it regardless of whether the
  // name fields are set.
  try { await document.fonts.load(`500 91px Raleway`); } catch { /* offline first load, falls back gracefully */ }

  // heightM/widthM/climateZone are pre-existing template <text> elements
  // (copied over from the old template, still styled with the old font:Inter
  // bold). Override to Raleway (loaded above). The template's own
  // placeholder text for heightM/widthM is literally "x m"/"y m" (a static
  // unit suffix baked into the same <tspan> as the placeholder digit) —
  // setText() replaces the whole tspan, which silently dropped that " m"
  // at render time. Re-added here per field instead of relying on the
  // template text, since climateZone has no unit and mustn't get one.
  const TEXT_UNIT_SUFFIX: Partial<Record<keyof PlantData, string>> = { heightM: ' m', widthM: ' m' };
  for (const [field, labels] of Object.entries(TEXT_FIELDS)) {
    if (!labels) continue;
    const v = (plant as any)[field];
    const text = v == null || v === '' ? '' : String(v) + (TEXT_UNIT_SUFFIX[field as keyof PlantData] ?? '');
    for (const el of findByLabel(svg, labels)) {
      setText(el, text);
      (el as SVGElement).style.fontFamily = "'Raleway', sans-serif";
    }
  }

  await injectNameText(svg, 'commonName', displayCommonName(plant));
  await injectNameText(svg, 'latinName',  plant.latinName  || '');
  injectMonthCalendar(svg, plant.fruitMonths, plant.flowerMonths);
  setGrowthSpeedIcon(svg, plant);
  setSunIcon(svg, plant);
  setWaterIcon(svg, plant);
  setLayerIcon(svg, plant);
  setRatingStripe(svg, plant);
  // The plantlist badge ("A=Agroforestry" …) has no data behind it — always hidden.
  for (const el of findByLabel(svg, ['plantlist'])) setVisible(el, false);
  // The soil-triangle group (clay/silt/sand composition) has no PlantData field
  // behind it either (see ROADMAP.md "Boden-Dreieck mappen und aktivieren") —
  // hidden until that gets built, instead of showing an untethered icon.
  // (baumscheibe2.4.psd already ships this group hidden, so this is a no-op
  // against the current template — kept in case a future export brings it
  // back visible again.)
  for (const el of findByLabel(svg, ['soil'])) setVisible(el, false);
  const credits = dataCredits(plant);
  if (credits.length) injectDataCredits(svg, credits);

  for (const [field, labels] of Object.entries(BOOL_FIELDS)) {
    if (!labels) continue;
    const on = !!(plant as any)[field];
    for (const el of findByLabel(svg, labels)) setVisible(el, on);
  }

  // Replace the original "in" units with the viewBox pixel dims so the SVG has
  // an intrinsic size (needed by Firefox when loading via Image for canvas
  // rasterization). HTML embedding scales it via CSS in the wrapper below.
  const vb = svg.getAttribute('viewBox')?.split(/\s+/);
  if (vb && vb.length === 4) {
    svg.setAttribute('width',  vb[2]);
    svg.setAttribute('height', vb[3]);
  } else {
    svg.removeAttribute('width');
    svg.removeAttribute('height');
  }

  return new XMLSerializer().serializeToString(svg);
}

/** Card-shaped wrapper around the rendered SVG, matching the cards-view layout. */
export async function renderBaumscheibeCardHtml(plant: PlantData): Promise<string> {
  let svg = await renderBaumscheibeSvg(plant);
  // Inline-scale the SVG to fill its container without affecting its intrinsic
  // size when used elsewhere (e.g. PDF rasterization).
  svg = svg.replace('<svg', '<svg style="width:100%;height:auto;display:block;"');
  return (
    `<div style="width:480px;background:#fff;border:1px solid #ccc;` +
    `border-radius:4px;overflow:hidden;box-sizing:border-box;">${svg}</div>`
  );
}
