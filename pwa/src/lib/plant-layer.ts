import type { PlantData, PlantHabit } from './types';

export type PlantLayer = Exclude<PlantHabit, ''>;

/** All layers, top (canopy) to bottom — order for legends, filters, selects. */
export const PLANT_LAYERS: readonly PlantLayer[] = ['tree', 'shrub', 'climber', 'herb', 'rhizo'];

/** i18n key of each layer's name (dict-index / dict-gartenplan). */
export const LAYER_I18N: Record<PlantLayer, string> = {
  tree: 'layerTree', shrub: 'layerShrub', herb: 'layerHerb', climber: 'layerClimber', rhizo: 'layerRhizo',
};

/**
 * Layer for display. The growth form (`habit`, from PFAF/EFG or set by the
 * user) decides; a 3 m bramble is still a shrub. Without a habit, the layer
 * is guessed from heightM — which can only ever yield tree/shrub/herb.
 */
export function deriveLayer(p: Pick<PlantData, 'heightM' | 'groundCover'> & { habit?: PlantData['habit'] }): PlantLayer {
  if (p.habit) return p.habit;
  if (p.groundCover && (p.heightM == null || p.heightM < 0.5)) return 'herb';
  if (p.heightM == null) return 'shrub';
  if (p.heightM >= 3) return 'tree';
  if (p.heightM >= 0.5) return 'shrub';
  return 'herb';
}

/** Fill/stroke + blob-shape parameters per layer — see blob-shape.ts for
 *  how lobes/wobble turn into an actual outline. */
export const LAYER_STYLE: Record<PlantLayer, { fill: string; stroke: string; lobes: number; wobble: number }> = {
  tree:  { fill: '#166534', stroke: '#14532d', lobes: 9, wobble: 0.35 },
  shrub: { fill: '#65a30d', stroke: '#4d7c0f', lobes: 7, wobble: 0.28 },
  herb:  { fill: '#a3e635', stroke: '#65a30d', lobes: 6, wobble: 0.22 },
  climber: { fill: '#0d9488', stroke: '#0f766e', lobes: 8, wobble: 0.4 },
  rhizo: { fill: '#a16207', stroke: '#854d0e', lobes: 5, wobble: 0.18 },
};
