import type { Lang } from './i18n/core';
import type { TablePdfLabels } from './table-pdf';
import { BOOL_FIELDS } from './plant-fields';

/**
 * Shared TablePdfLabels builder for exportPlantTablePDF(), used identically
 * by index.astro's table view and kalender.astro (roadmap: "Tabellenansicht
 * ... genauso diese Tabellendruckfunktion im Kalender-Ansicht einfügen" —
 * literally the same export, not a calendar-specific redesign). Kept here
 * instead of duplicated per-page i18n dict entries, since these ~30 labels
 * belong to the table-PDF layout itself, not either page's own UI text.
 */
export function buildTablePdfLabels(lang: Lang): TablePdfLabels {
  const de = lang !== 'en';
  const pick = (deText: string, enText: string) => (de ? deText : enText);
  return {
    title: pick('Pflanzentabelle — Perma Design Kit', 'Plant table — Perma Design Kit'),
    page: pick('Seite', 'Page'),
    name: pick('Name', 'Name'),
    latin: pick('Lateinisch', 'Latin'),
    layer: pick('Ebene', 'Layer'),
    uses: pick('Nutzung', 'Uses'),
    functions: pick('Funktionen', 'Functions'),
    sun: pick('Sonne', 'Sun'),
    water: pick('Wasser', 'Water'),
    growth: pick('Wuchs', 'Growth'),
    bloom: pick('Blüte', 'Bloom'),
    fruit: pick('Frucht', 'Fruit'),
    legend: pick('Legende:', 'Legend:'),
    monthsNote: pick('Blüte: obere Reihe, Frucht: untere Reihe · H/B in m', 'Bloom: top row, fruit: bottom row · H/W in m'),
    layerNames: {
      tree: pick('Baum', 'Tree'),
      shrub: pick('Strauch', 'Shrub'),
      herb: pick('Kraut/Bodendecker', 'Herb/groundcover'),
      climber: pick('Kletterpflanze', 'Climber'),
      rhizo: pick('Rhizom/Wurzel', 'Root/rhizome'),
    },
    chip: Object.fromEntries(BOOL_FIELDS.map(f => [f.key, de ? f.label.de : f.label.en])),
  };
}
