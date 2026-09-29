import { describe, expect, it } from 'vitest';
import { createEmptyPlant } from '../src/lib/types';
import { BOOL_FIELDS } from '../src/lib/plant-fields';

describe('central field table', () => {
  it('covers every boolean PlantData field exactly once', () => {
    const plant = createEmptyPlant();
    const booleanKeys = Object.keys(plant).filter(k => typeof (plant as any)[k] === 'boolean').sort();
    const tableKeys = BOOL_FIELDS.map(f => f.key as string).sort();
    expect(tableKeys).toEqual(booleanKeys);
  });

  it('has unique CSV headers', () => {
    const headers = BOOL_FIELDS.map(f => f.csv);
    expect(new Set(headers).size).toBe(headers.length);
  });

  it('has unique PDF chip codes within each group', () => {
    for (const group of new Set(BOOL_FIELDS.map(f => f.group))) {
      const codes = BOOL_FIELDS.filter(f => f.group === group && f.badge).map(f => f.badge!.pdfCode);
      expect(new Set(codes).size, group).toBe(codes.length);
    }
  });
});
