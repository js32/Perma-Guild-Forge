import { describe, expect, it } from 'vitest';
import { lookupEfg, parseLength, efgIndex } from '../server/efg.mjs';

describe('EFG (Edible Forest Gardens) data', () => {
  it('loads the species sheet', () => {
    expect(efgIndex().size).toBeGreaterThan(500);
  });

  it('converts feet and inches to metres (upper end of the range)', () => {
    expect(parseLength("75-100'")).toBe(30.5);
    expect(parseLength('6-12"')).toBe(0.3);
    expect(parseLength("3'")).toBe(0.91);
    expect(parseLength('')).toBeNull();
  });

  it('decodes light, moisture, functions and ratings', () => {
    const r = lookupEfg('Robinia pseudoacacia');
    expect(r.source).toBe('efg');
    expect(r.commonName).toBe('black locust');
    expect(r.nitrogenFix).toBe(true);
    expect([r.sunFull, r.sunMid, r.sunShadow]).toEqual([true, false, false]);
    expect([r.waterDry, r.waterMid, r.waterWet]).toEqual([true, true, false]);
    expect(r.climateZone).toBe('ab 3b');
  });

  it('treats a "fair" rating as score only, like the PFAF parser', () => {
    const r = lookupEfg('Acer saccharum');
    expect(r.medsScore).toBe(2);
    expect(r.meds).toBe(false);
  });

  it('uses the standard-size row for species listed per rootstock, and resolves synonyms', () => {
    const apple = lookupEfg('Malus domestica');
    expect(apple.commonName).toBe('apple');
    expect(apple.heightM).toBe(10.7);
    expect(apple.eatable).toBe(true);
  });

  it('matches names case- and whitespace-insensitively and returns {} for unknown plants', () => {
    expect(lookupEfg('  symphytum   OFFICINALE ').mineralFix).toBe(true);
    expect(lookupEfg('Nonexistus plantus')).toEqual({});
  });
});
