import type { PlantData } from './types';

// Maps PlantData fields to inkscape:label values inside baumscheibe-template.svg.
// Multiple labels per field cover the original code names ("eatable", "phAcid"),
// the renamed Data-field_new variant from baumscheibe3-data-fields.ods
// ("Edible", "PH-acid"), and — since the baumscheibe2.3_inkl-label.svg template
// swap — the raw Photoshop layer names from the psd2svg export ("u_edible",
// "ph2_acid"). Renderer matches any label in the array. The u_*/f_*/ph<N>_*
// correspondence was derived by comparing this template's element positions
// (getBBox) against the previous template's already-correct labels, not by
// guessing from the names — see CHANGELOG.md "SVG neu generiert:
// baumscheibe2.3_inkl-label.svg".

export const TEXT_FIELDS: Partial<Record<keyof PlantData, string[]>> = {
  // latinName / commonName are handled separately in the renderer —
  // the SVG has image placeholders there, not text elements.
  heightM:     ['heightM',     'Dim-height'],
  widthM:      ['widthM',      'Dim-diameter'],
  climateZone: ['climateZone'],
};

export const BOOL_FIELDS: Partial<Record<keyof PlantData, string[]>> = {
  // Wachstum — the template's "growth speed" group actually has three
  // distinct icons (speed1/speed2/speed3, only one shown as a design
  // preview in the PSD) — as of the 2026-09-21 reconversion all three are
  // included and individually selected by setGrowthSpeedIcon() in
  // baumscheibe-render.ts (via deriveLayer()-style logic, not this generic
  // alias list — the labels below are legacy/aspirational and don't match
  // the real speed1/2/3 layer names, kept only so a hand-relabeled future
  // template revision using these names would work without a code change).
  growSpeedLow:  ['Growth-slow', 'growSpeedLow'],
  growSpeedMid:  ['Growth-mod',  'growSpeedMid'],
  growSpeedHigh: ['Growth-fast', 'growSpeedHigh'],
  // Sonne/Wasser are handled by setSunIcon()/setWaterIcon() in
  // baumscheibe-render.ts, not this generic list — see the comment there
  // for why: the template only had one live icon each (semishade2, humid1)
  // until fullshade2/wet1 — real artwork, just switched off in Photoshop,
  // confirmed by force-compositing them with psd-tools — were pulled from
  // the PSD and spliced into baumscheibe-template.svg on 2026-09-22 (same
  // process as the rating2 stripes — see CHANGELOG.md). sunFull/waterDry
  // still have no icon in the PSD at all (any state), so a single generic
  // on/off mapping can't express the resulting 3-way choice.
  // pH — 2.3 template numbers all 5 states (ph1_v_acid..ph6_v_alk, skipping 4),
  // newly enabling phVeryAcid/phVeryAlkaline which had no element before.
  phVeryAcid:     ['PH-Veryacid',    'phVeryAcid',   'ph1_v_acid'],
  phAcid:         ['phAcid',         'PH-acid',      'ph2_acid'],
  phNeutral:      ['phNeutral',      'PH-neutral',   'ph3_neutral1'],
  phAlkaline:     ['phAlkaline',     'PH-alkaline',  'ph5_alk'],
  phVeryAlkaline: ['PH-veralkaline', 'phVeryAlkaline', 'ph6_v_alk'],
  // Nutzung — the trailing single/short label ('e', 'cul', 'med', …) is the
  // color-wedge fill behind the icon (2.3 template's "color" group), added so
  // hiding a field hides its background color along with the icon, not just
  // the icon on its own. Each verified unique in the template (grep count 1).
  eatable:    ['eatable',   'Edible',    'u_edible',    'e'],
  culinaric:  ['culinaric', 'Culinary',  'u_culinary',  'cul'],
  meds:       ['meds',      'Mecidinal', 'u_medicinal', 'med'],
  material:   ['material',  'Material',  'u_material'],
  fodder:     ['fodder',    'Fodder',    'u_fodder'],
  fuel:       ['fuel',      'Fuel',      'u_fuel'],
  // Template icons that had no field until wood/fiber existed — unmapped
  // icons are never hidden, so they showed on every disc.
  wood:       ['wood',      'u_timber'],
  fiber:      ['fiber',     'u_fiber'],
  // Funktionen — same color-wedge aliases where the "color" group has one.
  nitrogenFix:      ['nitrogenFix',      'NitrogenFix',   'f_Nfixer',      'n+'],
  mineralFix:       ['mineralFix',       'MineralFix',    'f_dynacc',      'DAnew', 'da'],
  groundCover:      ['groundCover',      'GroundCover',   'f_groundcover', 'gc'],
  insects:          ['insects',          'Insects',       'f_pollinators', 'i'],
  // "apc" is the pest-confuser icon (Duftverwirrer); `pest` covers pest control.
  pest:             ['pest',             'f_apc',         'apc'],
  animalProtection: ['animalProtection', 'Animalshelter', 'f_shelter',     'sh'],
  windBreaking:     ['windBreaking',     'Windbreak',     'f_windbreak2',  'w'],
};
