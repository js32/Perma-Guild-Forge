import type { PlantData } from './types';

export type PlantLayer = 'tree' | 'shrub' | 'herb';

/**
 * Layer for display (Baum/Strauch/Kraut). The growth form (`habit`, from
 * PFAF/EFG or set by the user) decides; a 3 m bramble is still a shrub.
 * Climbers have no layer of their own here and count as shrubs at most.
 * Without a habit, the layer is guessed from heightM.
 */
export function deriveLayer(p: Pick<PlantData, 'heightM' | 'groundCover'> & { habit?: PlantData['habit'] }): PlantLayer {
  if (p.habit === 'tree' || p.habit === 'shrub' || p.habit === 'herb') return p.habit;
  if (p.habit === 'climber') return p.heightM != null && p.heightM < 0.5 ? 'herb' : 'shrub';
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
};
