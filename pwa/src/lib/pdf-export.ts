import { PDFDocument, PDFPage, PDFRef, StandardFonts, degrees, rgb, drawImage as pdfDrawImage, pushGraphicsState, popGraphicsState, moveTo, appendBezierCurve, closePath, clip, endPath } from 'pdf-lib';
import { renderPolyCardToCanvas, renderStripeCardToCanvas } from './card-canvas';
import { renderBaumscheibeSvg } from './baumscheibe-render';
import { renderGardenPlanFullSvg } from './gartenplan-render';
import type { GardenPlan, PlantData } from './types';
import { escapeHtml } from './html';
import { packCircles } from './circle-pack';

// Card dimensions in mm
const POLY_MM   = { w: 70,  h: 120 };
const STRIPE_MM = { w: 290, h: 17  };

// mm → PDF points (1 pt = 1/72 inch)
const pt = (mm: number) => mm * 72 / 25.4;

// ── Image embedding (RGB, no alpha, no SMask) ────────────────────────────────
// pdf-lib always creates an SMask for RGBA PNG images. LibreWolf's pdf.js has
// a rendering bug with SMask. Workaround: embed raw RGB pixel data directly as
// a /FlateDecode image stream without alpha channel.

function canvasToRgbBytes(canvas: HTMLCanvasElement): Uint8Array {
  const { width, height } = canvas;
  const src = canvas.getContext('2d')!.getImageData(0, 0, width, height).data;
  const rgb = new Uint8Array(width * height * 3);
  let di = 0;
  for (let i = 0; i < src.length; i += 4) {
    rgb[di++] = src[i];
    rgb[di++] = src[i + 1];
    rgb[di++] = src[i + 2];
  }
  return rgb;
}

function embedCanvasRgb(pdfDoc: PDFDocument, canvas: HTMLCanvasElement): PDFRef {
  const ctx = pdfDoc.context as any;
  const stream = ctx.flateStream(canvasToRgbBytes(canvas), {
    Type:             'XObject',
    Subtype:          'Image',
    BitsPerComponent: 8,
    Width:            canvas.width,
    Height:           canvas.height,
    ColorSpace:       'DeviceRGB',
  });
  return ctx.register(stream);
}

function drawCanvasOnPage(
  page: PDFPage,
  imageRef: PDFRef,
  x: number, y: number,
  drawW: number, drawH: number,
) {
  const name = page.node.newXObject('Img', imageRef);
  page.pushOperators(
    ...pdfDrawImage(name, {
      x, y,
      width:  drawW,
      height: drawH,
      rotate: degrees(0),
      xSkew:  degrees(0),
      ySkew:  degrees(0),
    }),
  );
}

// ── Wikimedia / image fetch helpers ─────────────────────────────────────────

async function resolveWikimediaUrl(url: string): Promise<string> {
  const match = url.match(/Special:FilePath\/([^?]+)/);
  if (!match) return url;
  const filename = decodeURIComponent(match[1]);
  const apiUrl =
    `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(filename)}` +
    `&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*`;
  try {
    const res  = await fetch(apiUrl);
    const data = await res.json();
    const pages = data.query?.pages;
    const page: any = Object.values(pages as object)[0];
    return page?.imageinfo?.[0]?.thumburl || url;
  } catch { return url; }
}

async function imageUrlToDataUrl(url: string): Promise<string | null> {
  const resolved = await resolveWikimediaUrl(url);
  try {
    const res = await fetch(resolved, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
  } catch { /* fall through */ }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width  = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d')!.drawImage(img, 0, 0);
      try { resolve(c.toDataURL('image/jpeg', 0.85)); } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = resolved;
  });
}

async function plantImageDataUrl(plant: PlantData): Promise<string | undefined> {
  if (!plant.imageUrl) return undefined;
  return (await imageUrlToDataUrl(plant.imageUrl)) ?? undefined;
}

// ── Download helper ──────────────────────────────────────────────────────────

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── Exports ──────────────────────────────────────────────────────────────────

// exportPolyCardsPDF/exportStripeCardsPDF used to be one exportCardsPDF()
// that always put Poly cards first, then Stripe cards, in the same PDF —
// so exporting while the "Streifen" card type was selected still produced
// a PDF that opened on (and was mostly) Poly cards. Split so each card
// type's export contains only that type, matching what's currently shown.

export async function exportPolyCardsPDF(plants: PlantData[]): Promise<void> {
  plants = expandByPrintCount(plants);
  if (plants.length === 0) return;

  const pdfDoc = await PDFDocument.create();

  // Portrait A4 – poly cards
  const pageW = pt(210), pageH = pt(297), margin = pt(5);
  const cardW = pt(POLY_MM.w), cardH = pt(POLY_MM.h);
  const cols  = Math.floor((pageW - margin) / (cardW + margin));

  let page = pdfDoc.addPage([pageW, pageH]);
  let col = 0, row = 0;

  for (let i = 0; i < plants.length; i++) {
    const x        = margin + col * (cardW + margin);
    const yFromTop = margin + row * (cardH + margin);

    const imgDataUrl = await plantImageDataUrl(plants[i]);
    const canvas     = await renderPolyCardToCanvas(plants[i], imgDataUrl);
    const imageRef   = embedCanvasRgb(pdfDoc, canvas);
    drawCanvasOnPage(page, imageRef, x, pageH - yFromTop - cardH, cardW, cardH);

    col++;
    if (col >= cols) {
      col = 0; row++;
      if (margin + (row + 1) * (cardH + margin) > pageH) {
        row = 0;
        if (i < plants.length - 1) page = pdfDoc.addPage([pageW, pageH]);
      }
    }
  }

  downloadPdf(await pdfDoc.save(), 'perma-design-kit-poly-cards.pdf');
}

export async function exportStripeCardsPDF(plants: PlantData[]): Promise<void> {
  plants = expandByPrintCount(plants);
  if (plants.length === 0) return;

  const pdfDoc = await PDFDocument.create();

  // Landscape A4 – stripe cards
  const sPageW = pt(297), sPageH = pt(210), sMargin = pt(3);
  const sCardW = pt(STRIPE_MM.w), sCardH = pt(STRIPE_MM.h);

  let sPage = pdfDoc.addPage([sPageW, sPageH]);
  let sy = sMargin;

  for (const plant of plants) {
    if (sy + sCardH > sPageH - sMargin) {
      sPage = pdfDoc.addPage([sPageW, sPageH]);
      sy = sMargin;
    }
    const imgDataUrl = await plantImageDataUrl(plant);
    const canvas     = await renderStripeCardToCanvas(plant, imgDataUrl);
    const imageRef   = embedCanvasRgb(pdfDoc, canvas);
    drawCanvasOnPage(sPage, imageRef, sMargin, sPageH - sy - sCardH, sCardW, sCardH);
    sy += sCardH + pt(2);
  }

  downloadPdf(await pdfDoc.save(), 'perma-design-kit-stripe-cards.pdf');
}

export async function exportSingleCardPDF(plant: PlantData): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const cardW  = pt(POLY_MM.w), cardH = pt(POLY_MM.h);
  const page   = pdfDoc.addPage([cardW, cardH]);

  const imgDataUrl = await plantImageDataUrl(plant);
  const canvas     = await renderPolyCardToCanvas(plant, imgDataUrl);
  const imageRef   = embedCanvasRgb(pdfDoc, canvas);
  drawCanvasOnPage(page, imageRef, 0, 0, cardW, cardH);

  downloadPdf(await pdfDoc.save(), `${plant.latinName || 'plant'}-card.pdf`);
}

export async function exportSingleStripeCardPDF(plant: PlantData): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const cardW  = pt(STRIPE_MM.w), cardH = pt(STRIPE_MM.h);
  const page   = pdfDoc.addPage([cardW, cardH]);

  const imgDataUrl = await plantImageDataUrl(plant);
  const canvas     = await renderStripeCardToCanvas(plant, imgDataUrl);
  const imageRef   = embedCanvasRgb(pdfDoc, canvas);
  drawCanvasOnPage(page, imageRef, 0, 0, cardW, cardH);

  downloadPdf(await pdfDoc.save(), `${plant.latinName || 'plant'}-stripe.pdf`);
}

// ── Baumscheibe (SVG template) export ────────────────────────────────────────

// Firefox path: the 5 MB Baumscheibe SVG is slow to rasterize via canvas in
// Firefox and the resulting image XObject mis-decodes in pdf.js. Use native
// browser print instead — vector SVG, fast, correct everywhere.
//
// Chrome/Safari path: rasterize SVG → JPEG → embed via DCTDecode for an
// auto-downloaded PDF (the familiar UX for the existing card exports).

const isFirefox = typeof navigator !== 'undefined' && /Firefox\//.test(navigator.userAgent);

// The SVG viewBox is 2286×2482 (≈ 7.62×8.27 inch).
const BAUMSCHEIBE_MM = { w: 193.5, h: 210.2 };

async function svgStringToCanvas(svg: string, width: number, height: number): Promise<HTMLCanvasElement> {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload  = () => resolve();
      img.onerror = () => reject(new Error('SVG kann nicht als Bild geladen werden'));
      img.src     = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width  = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToJpegBytes(canvas: HTMLCanvasElement, quality = 0.9): Uint8Array {
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function embedBaumscheibePage(pdfDoc: PDFDocument, plant: PlantData) {
  const cardW  = pt(BAUMSCHEIBE_MM.w);
  const cardH  = pt(BAUMSCHEIBE_MM.h);
  const page   = pdfDoc.addPage([cardW, cardH]);
  const svg    = await renderBaumscheibeSvg(plant);
  const w      = Math.round(BAUMSCHEIBE_MM.w / 25.4 * 150);
  const h      = Math.round(BAUMSCHEIBE_MM.h / 25.4 * 150);
  const canvas = await svgStringToCanvas(svg, w, h);
  const img    = await pdfDoc.embedJpg(canvasToJpegBytes(canvas));
  page.drawImage(img, { x: 0, y: 0, width: cardW, height: cardH });
}

function buildPrintHtml(svgs: string[], title: string): string {
  const pages = svgs.map((svg, i) => {
    const scaled = svg.replace('<svg', '<svg style="width:100%;height:100%;display:block;"');
    const pb = i < svgs.length - 1 ? ' style="page-break-after:always;"' : '';
    return `<div class="page"${pb}>${scaled}</div>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  html, body { margin: 0; padding: 0; }
  .page { width: 100vw; height: 100vh; overflow: hidden; }
</style></head><body>${pages}</body></html>`;
}

async function openPrintWindow(svgs: string[], title: string): Promise<void> {
  const w = window.open('', '_blank');
  if (!w) {
    alert('Popup-Blocker aktiv? Bitte für diese Seite erlauben und nochmal probieren.');
    return;
  }
  w.document.open();
  w.document.write(buildPrintHtml(svgs, escapeHtml(title)));
  w.document.close();
  await new Promise(r => setTimeout(r, 300));
  w.focus();
  w.print();
}

export async function exportBaumscheibePDF(plant: PlantData): Promise<void> {
  if (isFirefox) {
    const svg = await renderBaumscheibeSvg(plant);
    await openPrintWindow([svg], `${plant.latinName || 'Pflanze'} — Baumscheibe`);
    return;
  }
  const pdfDoc = await PDFDocument.create();
  await embedBaumscheibePage(pdfDoc, plant);
  downloadPdf(await pdfDoc.save(), `${plant.latinName || 'plant'}-baumscheibe.pdf`);
}

export async function exportBaumscheibesPDF(plants: PlantData[]): Promise<void> {
  plants = expandByPrintCount(plants);
  if (plants.length === 0) return;
  if (isFirefox) {
    const svgs = await Promise.all(plants.map(p => renderBaumscheibeSvg(p)));
    await openPrintWindow(svgs, 'Permakultur-Baumscheiben');
    return;
  }
  const pdfDoc = await PDFDocument.create();
  for (const plant of plants) await embedBaumscheibePage(pdfDoc, plant);
  downloadPdf(await pdfDoc.save(), 'permaculture-baumscheiben.pdf');
}

// ── Baumscheibe sheet: 6 discs per A4 page, 9cm diameter each ───────────────
//
// The single-per-page export above prints the full template canvas
// (193.5×210.2mm) — mostly white space around the actual circular disc,
// meant to be cut out by hand. For a compact print-and-cut sheet we instead
// crop tightly to the disc itself before rasterizing.
//
// Geometry is specific to the current baumscheibe-template.svg (viewBox
// 2286×2482) and was measured, not assumed: rendered the template to a
// canvas and sampled outward from the center at 24 angles around the full
// circle to find the outermost ink pixel at each — consistently ~1011-1046
// (one 1077 outlier from a small decorative notch near the top-right, not
// the disc's own edge). If the artwork is redrawn, re-measure and update
// these two numbers.
const DISC_CENTER = { x: 1140, y: 1130 };
const DISC_RADIUS_UNITS = 1030; // measured outer edge of the ink, see above
const CROP_MARGIN_UNITS = 20; // clears the ~stroke-width of the outer ring itself
const CROP_HALF = DISC_RADIUS_UNITS + CROP_MARGIN_UNITS;
const CROP_SIZE_UNITS = CROP_HALF * 2;

const DISC_TARGET_MM = 90; // requested: 9cm diameter
const UNITS_TO_MM = DISC_TARGET_MM / (DISC_RADIUS_UNITS * 2);
const TILE_MM = CROP_SIZE_UNITS * UNITS_TO_MM; // ≈ 91.7mm — disc plus small margin

const SHEET_COLS = 2;
const SHEET_ROWS = 3;
const SHEET_PER_PAGE = SHEET_COLS * SHEET_ROWS;
// Kept minimal on purpose: 3 rows of ~91.7mm tiles (90mm disc + crop margin)
// already total ~275mm against a 297mm-tall A4 page, so there's only ~22mm
// of slack to split between gaps and the outer margin. A larger gap here
// directly eats into that margin — see CHANGELOG.md "Größen angepasst: 6
// Baumscheiben pro Seite, 9cm Durchmesser" for the clipping issue this
// caused when a real device's print pipeline enforced more margin than
// this had room for.
const SHEET_GAP_MM = 1;
const A4_MM = { w: 210, h: 297 };

/** Replace the SVG's viewBox/width/height with a tight square crop centered
 *  on the disc, so rasterizing/printing it fills the box with just the disc
 *  (plus a small margin) instead of the full template canvas. */
function cropSvgToDisc(svg: string): string {
  const vb = `viewBox="${DISC_CENTER.x - CROP_HALF} ${DISC_CENTER.y - CROP_HALF} ${CROP_SIZE_UNITS} ${CROP_SIZE_UNITS}"`;
  return svg
    .replace(/viewBox="[^"]*"/, vb)
    .replace(/\swidth="[^"]*"/, ` width="${CROP_SIZE_UNITS}"`)
    .replace(/\sheight="[^"]*"/, ` height="${CROP_SIZE_UNITS}"`);
}

function sheetGridOrigin() {
  const gridW = SHEET_COLS * TILE_MM + (SHEET_COLS - 1) * SHEET_GAP_MM;
  const gridH = SHEET_ROWS * TILE_MM + (SHEET_ROWS - 1) * SHEET_GAP_MM;
  return { x: (A4_MM.w - gridW) / 2, y: (A4_MM.h - gridH) / 2 };
}

async function embedBaumscheibeSheetPage(pdfDoc: PDFDocument, plants: PlantData[]) {
  const page = pdfDoc.addPage([pt(A4_MM.w), pt(A4_MM.h)]);
  const origin = sheetGridOrigin();
  const tilePx = Math.round(TILE_MM / 25.4 * 150); // 150dpi, matches embedBaumscheibePage

  for (let i = 0; i < plants.length && i < SHEET_PER_PAGE; i++) {
    const col = i % SHEET_COLS;
    const row = Math.floor(i / SHEET_COLS);
    const svg = cropSvgToDisc(await renderBaumscheibeSvg(plants[i]));
    const canvas = await svgStringToCanvas(svg, tilePx, tilePx);
    const img = await pdfDoc.embedJpg(canvasToJpegBytes(canvas));

    const xMm = origin.x + col * (TILE_MM + SHEET_GAP_MM);
    // PDF y-origin is bottom-left; row 0 is the top row on the page.
    const yMmFromTop = origin.y + row * (TILE_MM + SHEET_GAP_MM);
    const yPt = pt(A4_MM.h) - pt(yMmFromTop) - pt(TILE_MM);
    page.drawImage(img, { x: pt(xMm), y: yPt, width: pt(TILE_MM), height: pt(TILE_MM) });
  }
}

function buildSheetPrintHtml(plantGroups: PlantData[][], svgsByGroup: string[][], title: string): string {
  const origin = sheetGridOrigin();
  const pages = plantGroups.map((group, gi) => {
    const cells = svgsByGroup[gi].map(svg =>
      `<div class="cell">${svg.replace('<svg', `<svg style="width:100%;height:100%;display:block;"`)}</div>`
    ).join('');
    const pb = gi < plantGroups.length - 1 ? ' style="page-break-after:always;"' : '';
    return `<div class="page"${pb}><div class="grid" style="margin:${origin.y}mm ${origin.x}mm;">${cells}</div></div>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { size: 210mm 297mm; margin: 0; }
  html, body { margin: 0; padding: 0; }
  .page { width: 210mm; height: 297mm; overflow: hidden; box-sizing: border-box; }
  .grid {
    display: grid;
    grid-template-columns: repeat(${SHEET_COLS}, ${TILE_MM}mm);
    grid-auto-rows: ${TILE_MM}mm;
    gap: ${SHEET_GAP_MM}mm;
  }
  .cell { width: ${TILE_MM}mm; height: ${TILE_MM}mm; overflow: hidden; }
</style></head><body>${pages}</body></html>`;
}

async function openSheetPrintWindow(plantGroups: PlantData[][], title: string): Promise<void> {
  const svgsByGroup = await Promise.all(
    plantGroups.map(group => Promise.all(group.map(async p => cropSvgToDisc(await renderBaumscheibeSvg(p)))))
  );
  const w = window.open('', '_blank');
  if (!w) {
    alert('Popup-Blocker aktiv? Bitte für diese Seite erlauben und nochmal probieren.');
    return;
  }
  w.document.open();
  w.document.write(buildSheetPrintHtml(plantGroups, svgsByGroup, escapeHtml(title)));
  w.document.close();
  await new Promise(r => setTimeout(r, 300));
  w.focus();
  w.print();
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Expands a plant list per plant.printCount before bulk export: 0 = excluded
 *  (deactivated), >1 = repeated that many times. Default (undefined) = 1. */
function expandByPrintCount(plants: PlantData[]): PlantData[] {
  return plants.flatMap(p => Array(p.printCount ?? 1).fill(p));
}

/** Compact print-and-cut sheet: up to 6 Baumscheiben per A4 page, each a
 *  true 9cm-diameter disc (cropped tightly, not the full template canvas). */
export async function exportBaumscheibeSheetPDF(plants: PlantData[]): Promise<void> {
  plants = expandByPrintCount(plants);
  if (plants.length === 0) return;
  const groups = chunk(plants, SHEET_PER_PAGE);
  if (isFirefox) {
    await openSheetPrintWindow(groups, 'Permakultur-Baumscheiben (9cm)');
    return;
  }
  const pdfDoc = await PDFDocument.create();
  for (const group of groups) await embedBaumscheibeSheetPage(pdfDoc, group);
  downloadPdf(await pdfDoc.save(), 'baumscheiben-9cm-sheet.pdf');
}

// ── Maßstabsgetreue Baumscheiben ─────────────────────────────────────────────
//
// Each disc is printed with its plant's real crown width (widthM) at 1:scale,
// e.g. 4 m at 1:50 → 80 mm. Discs are packed onto A4/A3/A2 pages by
// packCircles() so as little paper as possible stays white.
export type ScaledPaper = 'A4' | 'A3' | 'A2';
const PAPER_MM: Record<ScaledPaper, { w: number; h: number }> = {
  A4: { w: 210, h: 297 }, A3: { w: 297, h: 420 }, A2: { w: 420, h: 594 },
};
const SCALED_PAGE_MARGIN_MM = 5; // same outer margin as the Pflanzenkarten sheets
const SCALED_GAP_MM = 2;
const FALLBACK_WIDTH_M = 1;

function discDiameterMm(p: PlantData, scale: number): number {
  const widthM = p.widthM ?? p.heightM ?? FALLBACK_WIDTH_M;
  return Math.max(5, widthM * 1000 / scale);
}

/** Circular clip path (4 bézier arcs) for the following drawing operators. */
function pushCircleClip(page: ReturnType<PDFDocument['addPage']>, cx: number, cy: number, r: number) {
  const k = 0.5522847498 * r;
  page.pushOperators(
    pushGraphicsState(),
    moveTo(cx + r, cy),
    appendBezierCurve(cx + r, cy + k, cx + k, cy + r, cx, cy + r),
    appendBezierCurve(cx - k, cy + r, cx - r, cy + k, cx - r, cy),
    appendBezierCurve(cx - r, cy - k, cx - k, cy - r, cx, cy - r),
    appendBezierCurve(cx + k, cy - r, cx + r, cy - k, cx + r, cy),
    closePath(), clip(), endPath(),
  );
}

/** Returns how many discs had to be shrunk to fit the paper (bigger than the
 *  page), plus the plants left out entirely for falling under minSizeMm
 *  (0 = no minimum, nothing discarded). */
export async function exportBaumscheibeScaledPDF(plants: PlantData[], scale: number, paper: ScaledPaper, minSizeMm = 0): Promise<{ pages: number; shrunk: number; discarded: PlantData[] }> {
  plants = expandByPrintCount(plants);
  if (plants.length === 0 || !(scale > 0)) return { pages: 0, shrunk: 0, discarded: [] };
  const discarded = minSizeMm > 0 ? plants.filter(p => discDiameterMm(p, scale) < minSizeMm) : [];
  if (discarded.length > 0) plants = plants.filter(p => discDiameterMm(p, scale) >= minSizeMm);
  if (plants.length === 0) return { pages: 0, shrunk: 0, discarded };
  const { w: pw, h: ph } = PAPER_MM[paper];
  const packed = packCircles(plants.map(p => discDiameterMm(p, scale)), pw, ph, SCALED_PAGE_MARGIN_MM, SCALED_GAP_MM);
  const pageCount = Math.max(...packed.map(c => c.page)) + 1;
  const shrunk = packed.filter(c => c.shrunk).length;
  // Disc artwork occupies DISC_RADIUS_UNITS of the crop's CROP_HALF; the image
  // is scaled so the disc itself gets exactly the requested diameter.
  const cropOverDisc = CROP_HALF / DISC_RADIUS_UNITS;
  const clipOverDisc = (DISC_RADIUS_UNITS + 10) / DISC_RADIUS_UNITS;

  if (isFirefox) {
    const svgs = await Promise.all(plants.map(async p => cropSvgToDisc(await renderBaumscheibeSvg(p))));
    const pages = Array.from({ length: pageCount }, (_, pg) => {
      const cells = packed.filter(c => c.page === pg).map(c => {
        const side = c.r * 2 * cropOverDisc, clipD = c.r * 2 * clipOverDisc;
        return `<div style="position:absolute;left:${c.cx - clipD / 2}mm;top:${c.cy - clipD / 2}mm;width:${clipD}mm;height:${clipD}mm;border-radius:50%;overflow:hidden;">` +
          `<div style="position:absolute;left:${(clipD - side) / 2}mm;top:${(clipD - side) / 2}mm;width:${side}mm;height:${side}mm;">` +
          `${svgs[c.index].replace('<svg', '<svg style="width:100%;height:100%;display:block;"')}</div></div>`;
      }).join('');
      const caption = `<div style="position:absolute;left:${SCALED_PAGE_MARGIN_MM}mm;bottom:1.2mm;font:6pt Helvetica,Arial,sans-serif;color:#999;">Maßstab 1:${scale}</div>`;
      return `<div style="position:relative;width:${pw}mm;height:${ph}mm;overflow:hidden;${pg < pageCount - 1 ? 'page-break-after:always;' : ''}">${cells}${caption}</div>`;
    }).join('');
    const w = window.open('', '_blank');
    if (!w) { alert('Popup-Blocker aktiv? Bitte für diese Seite erlauben und nochmal probieren.'); return { pages: pageCount, shrunk, discarded }; }
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Baumscheiben 1:${scale}</title><style>@page{size:${pw}mm ${ph}mm;margin:0}html,body{margin:0;padding:0}</style></head><body>${pages}</body></html>`);
    w.document.close();
    await new Promise(r => setTimeout(r, 300));
    w.focus(); w.print();
    return { pages: pageCount, shrunk, discarded };
  }

  const pdfDoc = await PDFDocument.create();
  const pages = Array.from({ length: pageCount }, () => pdfDoc.addPage([pt(pw), pt(ph)]));
  // Small, unobtrusive scale note in the bottom page margin.
  const capFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  for (const pg of pages) pg.drawText(`Maßstab 1:${scale}`, { x: pt(SCALED_PAGE_MARGIN_MM), y: pt(1.2), size: 6, font: capFont, color: rgb(0.6, 0.6, 0.6) });
  for (const c of packed) {
    const page = pages[c.page];
    const sideMm = c.r * 2 * cropOverDisc;
    // ~200 dpi at print size, capped so A2-sized discs don't blow up memory
    const px = Math.min(3000, Math.max(200, Math.round(sideMm / 25.4 * 200)));
    const svg = cropSvgToDisc(await renderBaumscheibeSvg(plants[c.index]));
    const img = await pdfDoc.embedJpg(canvasToJpegBytes(await svgStringToCanvas(svg, px, px)));
    const cxPt = pt(c.cx), cyPt = pt(ph - c.cy);
    pushCircleClip(page, cxPt, cyPt, pt(c.r * clipOverDisc));
    page.drawImage(img, { x: cxPt - pt(sideMm) / 2, y: cyPt - pt(sideMm) / 2, width: pt(sideMm), height: pt(sideMm) });
    page.pushOperators(popGraphicsState());
  }
  downloadPdf(await pdfDoc.save(), `baumscheiben-1zu${scale}-${paper}.pdf`);
  return { pages: pageCount, shrunk, discarded };
}

// ── Gartenplan export ────────────────────────────────────────────────────────
//
// Unlike Baumscheibe (a 5 MB raster-heavy template), the Gartenplan SVG is
// pure vector (a handful of paths/circles/text) — small and fast to
// rasterize, so no Firefox-specific print-window fallback is needed here;
// the same canvas→JPEG→embedJpg path used everywhere else works fine.

const GARDENPLAN_MARGIN_MM = { top: 20, bottom: 18, side: 12 };
const GARDENPLAN_RASTER_PX_PER_MM = 6; // ≈150dpi at typical plan sizes

/** Portrait for a taller-than-wide plan, landscape otherwise — picked from
 *  the plan's own aspect ratio rather than always defaulting to one. */
function gardenPlanPageSizeMm(plan: GardenPlan): { w: number; h: number } {
  return plan.areaWidthM > plan.areaHeightM ? { w: 297, h: 210 } : { w: 210, h: 297 };
}

export async function exportGardenPlanPDF(plan: GardenPlan, plantsById: Map<string, PlantData>): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { w: pageWmm, h: pageHmm } = gardenPlanPageSizeMm(plan);
  const page = pdfDoc.addPage([pt(pageWmm), pt(pageHmm)]);

  const title = plan.name || 'Gartenplan';
  const caption = `${plan.yearsSincePlanting} Jahre seit Pflanzung · ${plan.areaWidthM}×${plan.areaHeightM} m · exportiert ${new Date().toLocaleDateString('de-DE')}`;

  page.drawText(title, { x: pt(GARDENPLAN_MARGIN_MM.side), y: pt(pageHmm - 14), size: 16, font: fontBold });
  page.drawText(caption, { x: pt(GARDENPLAN_MARGIN_MM.side), y: pt(pageHmm - 20), size: 8, font, color: rgb(0.4, 0.4, 0.4) });

  // Fit the plan's own aspect ratio into the remaining space below the
  // title and above the legend, centered — the plan area itself is not
  // necessarily the same aspect ratio as the page.
  const availW = pageWmm - GARDENPLAN_MARGIN_MM.side * 2;
  const availH = pageHmm - GARDENPLAN_MARGIN_MM.top - GARDENPLAN_MARGIN_MM.bottom;
  const planAspect = plan.areaWidthM / plan.areaHeightM;
  let drawWmm = availW, drawHmm = availW / planAspect;
  if (drawHmm > availH) { drawHmm = availH; drawWmm = availH * planAspect; }
  const drawXmm = GARDENPLAN_MARGIN_MM.side + (availW - drawWmm) / 2;
  const drawYmmFromTop = GARDENPLAN_MARGIN_MM.top + (availH - drawHmm) / 2;

  const svg = renderGardenPlanFullSvg(plan, plantsById, plan.yearsSincePlanting);
  const pxW = Math.round(drawWmm * GARDENPLAN_RASTER_PX_PER_MM);
  const pxH = Math.round(drawHmm * GARDENPLAN_RASTER_PX_PER_MM);
  const canvas = await svgStringToCanvas(svg, pxW, pxH);
  const img = await pdfDoc.embedJpg(canvasToJpegBytes(canvas));
  const drawYpt = pt(pageHmm) - pt(drawYmmFromTop) - pt(drawHmm);
  page.drawImage(img, { x: pt(drawXmm), y: drawYpt, width: pt(drawWmm), height: pt(drawHmm) });

  // Layer legend, bottom-left.
  const legend: [string, string][] = [
    ['Baum', '#166534'],
    ['Strauch', '#65a30d'],
    ['Kraut/Bodendecker', '#a3e635'],
  ];
  let legendX = GARDENPLAN_MARGIN_MM.side;
  const legendY = 10;
  for (const [label, hex] of legend) {
    const [r, g, b] = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map(h => parseInt(h, 16) / 255);
    page.drawEllipse({ x: pt(legendX + 1.5), y: pt(legendY + 1.5), xScale: pt(1.5), yScale: pt(1.5), color: rgb(r, g, b) });
    page.drawText(label, { x: pt(legendX + 5), y: pt(legendY), size: 8, font });
    legendX += label.length * 1.8 + 12;
  }

  const filename = `${(plan.name || 'gartenplan').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;
  downloadPdf(await pdfDoc.save(), filename);
}
