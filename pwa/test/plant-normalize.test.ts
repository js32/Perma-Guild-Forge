import { describe, expect, it } from 'vitest';
import { normalizePlant, normalizePlants, normalizeGardenPlan } from '../src/lib/plant-normalize';

describe('normalizePlant', () => {
  it('fills fields missing from old export files', () => {
    const p = normalizePlant({ id: 'a', latinName: 'Malus domestica', commonName: 'Apfel' })!;
    expect(p.id).toBe('a');
    expect(p.groups).toEqual([]);
    expect(p.fruitMonths).toHaveLength(12);
    expect(p.wood).toBe(false);
    expect(p.printCount).toBe(1);
  });

  it('gives records without an id a new one', () => {
    const p = normalizePlant({ latinName: 'Acer saccharum', commonName: 'Zucker-Ahorn' })!;
    expect(p.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('drops values of the wrong type instead of keeping them', () => {
    const p = normalizePlant({
      latinName: 'X', heightM: '<img src=x onerror=alert(1)>', widthM: -3,
      eatable: 'yes', eatableScore: 99, fruitMonths: 'all', groups: ['A', 42, ' A ', 'B'],
    })!;
    expect(p.heightM).toBeNull();
    expect(p.widthM).toBeNull();
    expect(p.eatable).toBe(false);
    expect(p.eatableScore).toBe(5);
    expect(p.fruitMonths.every(m => m === false)).toBe(true);
    expect(p.groups).toEqual(['A', 'B']);
  });

  it('accepts numeric strings for dimensions', () => {
    expect(normalizePlant({ latinName: 'X', heightM: '2,5' })!.heightM).toBe(2.5);
  });

  it('only keeps http(s) image URLs', () => {
    expect(normalizePlant({ latinName: 'X', imageUrl: 'javascript:alert(1)' })!.imageUrl).toBe('');
    expect(normalizePlant({ latinName: 'X', imageUrl: 'https://upload.wikimedia.org/a.jpg' })!.imageUrl).toBe('https://upload.wikimedia.org/a.jpg');
  });

  it('keeps only known field sources', () => {
    const p = normalizePlant({ latinName: 'X', _sources: { eatable: 'pfaf', latinName: 'evil', bogusField: 'manual' } })!;
    expect(p._sources).toEqual({ eatable: 'pfaf' });
  });

  it('rejects non-objects and records without any name', () => {
    expect(normalizePlant(null)).toBeNull();
    expect(normalizePlant('plant')).toBeNull();
    expect(normalizePlant({ id: 'x' })).toBeNull();
    expect(normalizePlants([{ latinName: 'A' }, 7, { commonName: 'B' }])).toHaveLength(2);
  });
});

describe('normalizeGardenPlan', () => {
  it('drops malformed placements and boundary points', () => {
    const g = normalizeGardenPlan({
      id: 'g', boundary: [{ xM: 0, yM: 0 }, { xM: 'a' }],
      placements: [{ plantId: 'p', xM: 1, yM: 2 }, { xM: 1, yM: 2 }],
    })!;
    expect(g.boundary).toEqual([{ xM: 0, yM: 0 }]);
    expect(g.placements).toHaveLength(1);
    expect(g.placements[0].plantId).toBe('p');
  });
});
