import { describe, expect, it } from 'vitest';
import { applyFilters, emptyFilters, sortPlants, allGroups } from '../src/lib/plant-list';
import { completenessPercent } from '../src/lib/plant-detail';
import { createEmptyPlant, type PlantData } from '../src/lib/types';

function plant(props: Partial<PlantData>): PlantData {
  return { ...createEmptyPlant(), ...props };
}

const a = plant({ latinName: 'Alnus glutinosa', commonName: 'Erle', nitrogenFix: true, groups: ['Hecke'], heightM: 20 });
const b = plant({ latinName: 'Malus domestica', commonName: 'Apfel', eatable: true, groups: ['Obst', 'Waldgarten'], heightM: 6 });
const c = plant({ latinName: 'Symphytum officinale', commonName: 'Beinwell', mineralFix: true, meds: true });
const all = [a, b, c];

describe('applyFilters', () => {
  it('ORs values within a facet and ANDs across facets', () => {
    const f = emptyFilters();
    f.function = new Set(['nitrogenFix', 'mineralFix']);
    expect(applyFilters(all, f)).toEqual([a, c]);
    f.usage = new Set(['meds']);
    expect(applyFilters(all, f)).toEqual([c]);
  });

  it('filters by group, including plants without a group', () => {
    const f = emptyFilters();
    f.groups = new Set(['Waldgarten']);
    expect(applyFilters(all, f)).toEqual([b]);
    f.groups = new Set(['Hecke', '']);
    expect(applyFilters(all, f)).toEqual([a, c]);
  });

  it('matches the text filter on names and variety', () => {
    const f = emptyFilters();
    f.text = 'apf';
    expect(applyFilters(all, f)).toEqual([b]);
  });

  it('applies minimum height', () => {
    const f = emptyFilters();
    f.heightMin = 10;
    expect(applyFilters(all, f)).toEqual([a]);
  });
});

describe('sortPlants', () => {
  it('sorts by first group name, plants without a group last', () => {
    expect(sortPlants(all, 'groups', 'asc')).toEqual([a, b, c]);
  });

  it('sorts names with German collation', () => {
    const ae = plant({ latinName: 'X', commonName: 'Äpfelchen' });
    const z = plant({ latinName: 'Y', commonName: 'Zitrone' });
    expect(sortPlants([z, ae], 'commonName', 'asc')).toEqual([ae, z]);
  });

  it('sorts by completeness in the same order as the displayed percentage', () => {
    const sorted = sortPlants(all, 'completeness', 'desc');
    const pcts = sorted.map(completenessPercent);
    expect(pcts).toEqual([...pcts].sort((x, y) => y - x));
  });
});

describe('allGroups', () => {
  it('lists distinct group names alphabetically', () => {
    expect(allGroups(all)).toEqual(['Hecke', 'Obst', 'Waldgarten']);
  });
});

describe('completenessPercent', () => {
  it('counts the newer uses as a filled Nutzung/Funktion field', () => {
    const withWood = plant({ latinName: 'X', wood: true });
    const without = plant({ latinName: 'X' });
    expect(completenessPercent(withWood)).toBeGreaterThan(completenessPercent(without));
  });
});
