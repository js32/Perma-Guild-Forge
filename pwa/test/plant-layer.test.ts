import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parsePfafHtml, pfafHabit } from '../server/pfaf-parse.mjs';
import { lookupEfg } from '../server/efg.mjs';
import { deriveLayer } from '../src/lib/plant-layer';
import { parseHabit } from '../src/lib/types';
import { normalizePlant } from '../src/lib/plant-normalize';

const page = (name: string) => parsePfafHtml(readFileSync(new URL(`./fixtures/pfaf/${name}.html`, import.meta.url), 'utf8'));

describe('growth form (habit)', () => {
  it('reads the habit from PFAF pages', () => {
    expect(page('Robinia_pseudoacacia').habit).toBe('tree');
    expect(page('Sambucus_nigra').habit).toBe('shrub');
    expect(page('Hedera_helix').habit).toBe('climber');
    expect(page('Symphytum_officinale').habit).toBe('herb');
    expect(pfafHabit('Bulb')).toBe('herb');
    expect(pfafHabit('something odd')).toBe('');
  });

  it('reads the habit from the EFG "Form" column', () => {
    expect(lookupEfg('Rubus fruticosus').habit).toBe('shrub');
    expect(lookupEfg('Robinia pseudoacacia').habit).toBe('tree');
  });

  it('a 3 m bramble is a shrub, not a tree', () => {
    expect(deriveLayer({ heightM: 3, groundCover: false, habit: 'shrub' })).toBe('shrub');
    // without a habit the height still decides
    expect(deriveLayer({ heightM: 8, groundCover: false, habit: '' })).toBe('tree');
    expect(deriveLayer({ heightM: 1, groundCover: false })).toBe('shrub');
    // climbers count as shrubs at most
    expect(deriveLayer({ heightM: 15, groundCover: false, habit: 'climber' })).toBe('shrub');
  });

  it('parses free text and rejects junk on import', () => {
    expect(parseHabit('Strauch')).toBe('shrub');
    expect(parseHabit('Vine (l)')).toBe('climber');
    expect(parseHabit('tree')).toBe('tree');
    expect(normalizePlant({ latinName: 'x', habit: 'banana' })?.habit).toBe('');
    expect(normalizePlant({ latinName: 'x', habit: 'herb' })?.habit).toBe('herb');
  });
});
