import { describe, it, expect } from 'vitest';
import { applySources, type GatheredSources } from '../src/lib/enrich';
import { createEmptyPlant } from '../src/lib/types';

const plant = () => {
  const p = createEmptyPlant();
  p.latinName = 'Robinia pseudoacacia';
  return p;
};

const data: GatheredSources = {
  pfaf: { fields: { heightM: 25, sunFull: true, commonName: 'Black Locust' }, reportedFalse: ['waterWet'] },
  efg: { fields: { heightM: 24.4, waterWet: true, nitrogenFix: true }, reportedFalse: [] },
  wikidata: { fields: { commonName: 'Gewöhnliche Robinie', heightM: 30 }, reportedFalse: [] },
};

describe('applySources', () => {
  it('takes each field from the highest-ranked source with an opinion', () => {
    const p = plant();
    applySources(p, data, ['pfaf', 'efg', 'wikidata']);
    expect(p.heightM).toBe(25);
    expect(p._sources?.heightM).toBe('pfaf');
    expect(p.nitrogenFix).toBe(true);
    expect(p._sources?.nitrogenFix).toBe('efg');
    // PFAF's explicit "no" outranks EFG's yes
    expect(p.waterWet).toBe(false);
  });

  it('follows a changed order and replaces lower-ranked values on re-enrich', () => {
    const p = plant();
    applySources(p, data, ['pfaf', 'efg', 'wikidata']);
    applySources(p, data, ['efg', 'pfaf', 'wikidata']);
    expect(p.heightM).toBe(24.4);
    expect(p._sources?.heightM).toBe('efg');
    expect(p.waterWet).toBe(true);
  });

  it('never overwrites values the user entered', () => {
    const p = plant();
    p.heightM = 12;
    p._sources = { heightM: 'manual' };
    applySources(p, data, ['pfaf', 'efg', 'wikidata']);
    expect(p.heightM).toBe(12);
    expect(p._sources?.heightM).toBe('manual');
  });

  it('takes the German name from Wikidata, English names only as fallback', () => {
    const p = plant();
    applySources(p, data, ['pfaf', 'efg', 'wikidata']);
    expect(p.commonName).toBe('Gewöhnliche Robinie');

    const q = plant();
    applySources(q, { pfaf: data.pfaf }, ['pfaf', 'efg', 'wikidata']);
    expect(q.commonName).toBe('Black Locust');
    expect(q._sources?.commonName).toBe('pfaf');
  });
});
