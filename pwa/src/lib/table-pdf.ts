import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import type { PlantData } from './types';
import { deriveLayer } from './plant-layer';
import { displayCommonName } from './plant-name';
import { downloadPdf } from './pdf-export';
import { badgedFieldsOf, type FieldGroup } from './plant-fields';

/** Printable plant table (landscape A4). Every criterion has a fixed slot per
 *  row with its own letter code, so the meaning survives black-and-white
 *  printing: present = filled chip with the letter, absent = faint outline.
 *  Color mode additionally fills chips with the criterion's color; grayscale
 *  mode uses only black/gray. */

type Chip = { key: keyof PlantData; code: string; hex: string };
export interface TablePdfLabels {
  title: string; page: string; name: string; latin: string; layer: string;
  uses: string; functions: string; sun: string; water: string; growth: string;
  bloom: string; fruit: string; legend: string; monthsNote: string; layerNames: Record<'tree' | 'shrub' | 'herb', string>;
  /** label per chip key */
  chip: Record<string, string>;
}

const PAGE = { w: 297, h: 210 }, MARGIN = 8;
const ROW_H = 6.4, CHIP = 4.0, SLOT = 4.4, FONT = 7;
const pt = (mm: number) => mm * 72 / 25.4;

type GroupName = 'uses' | 'functions' | 'sun' | 'water' | 'growth';
const GROUP_ORDER: GroupName[] = ['uses', 'functions', 'sun', 'water', 'growth'];
const FIELD_GROUP: Record<GroupName, FieldGroup> = { uses: 'usage', functions: 'function', sun: 'sun', water: 'water', growth: 'growth' };

// Chips come straight from the central field table, so a new field gets its
// own slot (and legend entry) here without touching this file.
const CHIP_GROUPS = Object.fromEntries(GROUP_ORDER.map(g => [g,
  badgedFieldsOf(FIELD_GROUP[g]).map(f => ({ key: f.key, code: f.badge.pdfCode, hex: f.badge.hex })),
])) as Record<GroupName, Chip[]>;

// Column layout (mm). Chip groups are sized from their slot count; the text
// columns take what's left of the landscape page width.
const COLS = {
  name: 40, latin: 38, h: 9, b: 9, layer: 22,
  uses: CHIP_GROUPS.uses.length * SLOT, functions: CHIP_GROUPS.functions.length * SLOT,
  sun: CHIP_GROUPS.sun.length * SLOT, water: CHIP_GROUPS.water.length * SLOT, growth: CHIP_GROUPS.growth.length * SLOT,
  months: 12 * 2.3,
};
const COL_GAP = 1.5;

const hexRgb = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255] as const;
};
const luminance = (h: string) => { const [r, g, b] = hexRgb(h); return 0.299 * r + 0.587 * g + 0.114 * b; };

/** Standard PDF fonts only cover WinAnsi — fold anything else to ASCII. */
function pdfText(s: string): string {
  return s.replace(/[–—]/g, '-').replace(/[’‘]/g, "'").replace(/[“”„]/g, '"')
    .replace(/[^\x20-\x7E -ÿ]/g, c => c.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '?'));
}

function fitText(font: PDFFont, text: string, size: number, maxW: number): string {
  let s = pdfText(text);
  if (font.widthOfTextAtSize(s, size) <= maxW) return s;
  while (s.length > 1 && font.widthOfTextAtSize(s + '…', size) > maxW) s = s.slice(0, -1);
  return s + '.';
}

export async function exportPlantTablePDF(plants: PlantData[], grayscale: boolean, L: TablePdfLabels): Promise<void> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const black = rgb(0, 0, 0);
  const gray = (v: number) => rgb(v, v, v);

  const groupLabel: Record<GroupName, string> = { uses: L.uses, functions: L.functions, sun: L.sun, water: L.water, growth: L.growth };
  const legendH = 17, headerH = 9, titleH = 9;
  const rowsPerPage = Math.floor((PAGE.h - 2 * MARGIN - titleH - headerH - legendH) / ROW_H);
  const pageCount = Math.max(1, Math.ceil(plants.length / rowsPerPage));

  // x offsets per column
  const order = ['name', 'latin', 'h', 'b', 'layer', 'uses', 'functions', 'sun', 'water', 'growth', 'months'] as const;
  const x0: Record<string, number> = {};
  let cx = MARGIN;
  for (const k of order) { x0[k] = cx; cx += COLS[k] + COL_GAP; }

  const text = (page: PDFPage, s: string, xMm: number, yTopMm: number, size: number, f: PDFFont, color = black) =>
    page.drawText(pdfText(s), { x: pt(xMm), y: pt(PAGE.h - yTopMm), size, font: f, color });

  const drawChip = (page: PDFPage, xMm: number, yMm: number, c: { code: string; hex: string }, on: boolean) => {
    const y = PAGE.h - yMm - CHIP;
    if (!on) {
      page.drawRectangle({ x: pt(xMm), y: pt(y), width: pt(CHIP), height: pt(CHIP), borderColor: gray(0.82), borderWidth: 0.4 });
      return;
    }
    const fill = grayscale ? gray(0.15) : rgb(...hexRgb(c.hex));
    page.drawRectangle({ x: pt(xMm), y: pt(y), width: pt(CHIP), height: pt(CHIP), color: fill, borderColor: black, borderWidth: 0.4 });
    const light = !grayscale && luminance(c.hex) > 0.6;
    const w = bold.widthOfTextAtSize(c.code, 5.5);
    page.drawText(c.code, { x: pt(xMm + CHIP / 2) - w / 2, y: pt(y + 1.15), size: 5.5, font: bold, color: grayscale || !light ? rgb(1, 1, 1) : black });
  };

  const drawHeader = (page: PDFPage, pageNo: number, yTop: number) => {
    text(page, L.title + (grayscale ? ' (S/W)' : ''), MARGIN, MARGIN + 4, 11, bold);
    const pg = `${L.page} ${pageNo}/${pageCount}`;
    text(page, pg, PAGE.w - MARGIN - font.widthOfTextAtSize(pdfText(pg), 8) * 25.4 / 72, MARGIN + 4, 8, font, gray(0.4));
    const y = yTop + 5.5;
    text(page, L.name, x0.name, y, 7, bold); text(page, L.latin, x0.latin, y, 7, bold);
    text(page, 'H', x0.h, y, 7, bold); text(page, 'B', x0.b, y, 7, bold);
    text(page, L.layer, x0.layer, y, 7, bold);
    for (const g of GROUP_ORDER) text(page, groupLabel[g], x0[g], y, 7, bold);
    text(page, `${L.bloom} / ${L.fruit}`, x0.months, y, 7, bold);
    page.drawLine({ start: { x: pt(MARGIN), y: pt(PAGE.h - yTop - headerH + 1) }, end: { x: pt(PAGE.w - MARGIN), y: pt(PAGE.h - yTop - headerH + 1) }, thickness: 0.7, color: black });
  };

  const drawLegend = (page: PDFPage) => {
    let y = PAGE.h - MARGIN - legendH + 3;
    let x = MARGIN;
    text(page, L.legend, x, y, 6.5, bold);
    x += 14;
    const groupLine = (g: GroupName) =>
      `${groupLabel[g]}: ${CHIP_GROUPS[g].map(c => `${c.code} ${L.chip[c.key]}`).join(', ')}`;
    // Nutzung and Funktionen each fill a line on their own; the three short
    // groups share one.
    const rows = [
      groupLine('uses'),
      groupLine('functions'),
      (['sun', 'water', 'growth'] as const).map(groupLine).join('   |   '),
      L.monthsNote,
    ];
    rows.forEach((r, i) => text(page, r, x, y + i * 3.2, 6, font, gray(0.25)));
  };

  for (let pi = 0; pi < pageCount; pi++) {
    const page = pdf.addPage([pt(PAGE.w), pt(PAGE.h)]);
    const top = MARGIN + titleH;
    drawHeader(page, pi + 1, top);
    const slice = plants.slice(pi * rowsPerPage, (pi + 1) * rowsPerPage);
    slice.forEach((p, ri) => {
      const yTop = top + headerH + ri * ROW_H;
      if (ri % 2 === 1) page.drawRectangle({ x: pt(MARGIN), y: pt(PAGE.h - yTop - ROW_H), width: pt(PAGE.w - 2 * MARGIN), height: pt(ROW_H), color: gray(0.95) });
      const baseY = yTop + 4.3;
      text(page, fitText(bold, displayCommonName(p) || p.latinName, FONT, COLS.name * 72 / 25.4), x0.name, baseY, FONT, bold);
      text(page, fitText(italic, p.latinName, FONT, COLS.latin * 72 / 25.4), x0.latin, baseY, FONT, italic, gray(0.25));
      if (p.heightM != null) text(page, String(p.heightM), x0.h, baseY, FONT, font);
      if (p.widthM != null) text(page, String(p.widthM), x0.b, baseY, FONT, font);
      text(page, fitText(font, L.layerNames[deriveLayer(p)], FONT, COLS.layer * 72 / 25.4), x0.layer, baseY, FONT, font);
      const cy = yTop + (ROW_H - CHIP) / 2;
      for (const g of GROUP_ORDER) {
        CHIP_GROUPS[g].forEach((c, i) => drawChip(page, x0[g] + i * SLOT, cy, c, !!p[c.key as keyof PlantData]));
      }
      // bloom (top) / fruit (bottom) mini-calendars, 12 cells each
      const cw = 2.3, ch = 2.1;
      for (let m = 0; m < 12; m++) {
        for (const [row, arr, colHex, gv] of [[0, p.flowerMonths, '#fbbf24', 0.1], [1, p.fruitMonths, '#22c55e', 0.55]] as const) {
          const on = !!arr?.[m];
          const y = PAGE.h - (yTop + 0.9 + row * (ch + 0.3)) - ch;
          page.drawRectangle({
            x: pt(x0.months + m * cw), y: pt(y), width: pt(cw - 0.3), height: pt(ch),
            color: on ? (grayscale ? gray(gv) : rgb(...hexRgb(colHex))) : gray(0.92),
          });
        }
      }
    });
    drawLegend(page);
  }
  downloadPdf(await pdf.save(), grayscale ? 'pflanzentabelle-sw.pdf' : 'pflanzentabelle.pdf');
}
