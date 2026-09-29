import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parsePfafHtml } from '../server/pfaf-parse.mjs';

// Real PFAF pages saved on 2026-09-29. When PFAF changes its markup, refresh a
// fixture with curl (browser User-Agent, see plant-proxy-server.mjs) and see
// which of these break.
const page = (name: string) => parsePfafHtml(readFileSync(new URL(`./fixtures/pfaf/${name}.html`, import.meta.url), 'utf8'));
const months = (m: boolean[] | undefined) => (m ?? []).flatMap((on, i) => on ? [i + 1] : []);

describe('parsePfafHtml', () => {
  it('reads a shade plant as shade only — not full sun (sun.jpg is a substring of partsun/fullsun.jpg)', () => {
    const r = page('Galium_odoratum');
    expect(r.sunFull).toBe(false);
    expect(r.sunMid).toBe(true);
    expect(r.sunShadow).toBe(true);
  });

  it('reads sun, dimensions, ratings and months of a typical shrub', () => {
    const r = page('Sambucus_nigra');
    expect(r.commonName).toBe('Elderberry - European Elder');
    expect(r.heightM).toBe(6);
    expect(r.widthM).toBe(6);
    expect([r.eatableScore, r.medsScore, r.materialScore]).toEqual([4, 3, 5]);
    expect(r.eatable).toBe(true);
    expect(r.climateZone).toBe('5-10');
    expect([r.sunFull, r.sunMid, r.sunShadow]).toEqual([true, true, false]);
    expect([r.waterDry, r.waterMid, r.waterWet]).toEqual([false, true, false]);
    expect(months(r.flowerMonths)).toEqual([6, 7]);
    expect(months(r.fruitMonths)).toEqual([8, 9]);
  });

  it('converts cm dimensions to metres', () => {
    const r = page('Symphytum_officinale');
    expect(r.heightM).toBe(1.2);
    expect(r.widthM).toBe(0.6);
  });

  it('only sets use tags PFAF actually assigns (Comfrey is no fuel, fodder or ground cover)', () => {
    const r = page('Symphytum_officinale');
    expect(r.mineralFix).toBe(true);
    expect(r.fuel).toBe(false);
    expect(r.fodder).toBe(false);
    expect(r.groundCover).toBe(false);
  });

  it('reads nitrogen fixers and month ranges that wrap past December', () => {
    const r = page('Robinia_pseudoacacia');
    expect(r.nitrogenFix).toBe(true);
    expect(r.fuel).toBe(true);
    expect(months(r.fruitMonths)).toEqual([1, 2, 3, 11, 12]);
  });

  it('returns an empty result for a name PFAF does not know', () => {
    expect(page('Nonexistus_plantus')).toEqual({});
  });
});
