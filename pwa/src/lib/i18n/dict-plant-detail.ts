import type { Dict } from './core';
import { fieldLabelDict } from '../plant-fields';

/** Labels shared by anything that renders plant detail info — the plant
 *  tiles/table on the Pflanzen page, the Kalender filters and the
 *  Gartenplan's detail panel (see lib/plant-detail.ts). Field labels
 *  (`fld_<key>`) come from the central table in lib/plant-fields.ts. Merge
 *  it into the page's own dict: createT(pageDict, plantDetailDict). */
export const plantDetailDict: Dict = {
  zoneLabel: { de: 'Zone {zone}', en: 'Zone {zone}' },
  thPhenology: { de: 'Blüte/Frucht', en: 'Bloom/Fruit' },
  ...fieldLabelDict,
};
