import { describe, expect, it } from 'vitest';
import { buildCSV, buildCSVTemplate, importFromCSV, parseCSV } from '../src/lib/csv';
import { createEmptyPlant } from '../src/lib/types';

describe('CSV export/import', () => {
  it('round-trips every exported field', () => {
    const p = createEmptyPlant();
    Object.assign(p, {
      latinName: 'Sambucus nigra', commonName: 'Schwarzer Holunder', commonNameEn: 'Elder',
      varietyName: 'Haschberg', heightM: 6, widthM: 4.5, climateZone: '5-10',
      eatable: true, wood: true, sunMid: true, growSpeedHigh: true,
      eatableScore: 4, medsScore: 3, materialScore: 5,
      groups: ['Waldgarten', 'Hecke'], notes: 'Zeile 1\nZeile "2", mit Komma',
      imageUrl: 'https://example.org/a.jpg', imageCredit: 'Foo · CC BY', printCount: 2,
    });
    p.flowerMonths[5] = true; p.flowerMonths[6] = true;
    p.fruitMonths[7] = true;

    const [back] = importFromCSV(buildCSV([p]));
    for (const key of Object.keys(p) as (keyof typeof p)[]) {
      if (key === 'id' || key === '_sources') continue;
      expect(back[key], key).toEqual(p[key]);
    }
  });

  it('keeps a quoted multi-line field in one record', () => {
    const rows = parseCSV('Lateinisch,Notizen\r\n"A","x\r\ny"\r\n"B",z\r\n');
    expect(rows).toEqual([{ Lateinisch: 'A', Notizen: 'x\ny' }, { Lateinisch: 'B', Notizen: 'z' }]);
  });

  it('imports files from before the newer columns existed', () => {
    const old = 'Lateinisch,Deutsch,Höhe_m,Breite_m,Klimazone,Essbar,Bild_URL\r\n"Malus domestica","Apfel",6,5,"4-8",1,""';
    const [p] = importFromCSV(old);
    expect(p.latinName).toBe('Malus domestica');
    expect(p.heightM).toBe(6);
    expect(p.eatable).toBe(true);
    expect(p.groups).toEqual([]);
  });

  it('reads the legacy PowerShell format with ; delimiter', () => {
    const legacy = 't_latin-name_text;t_common-name_text;t_height_text;b_eatable_element;b_sun-full_element;b_fruit-8_element\r\nAcer saccharum;Zucker-Ahorn;25 m;Visible;Hidden;Visible';
    const [p] = importFromCSV(legacy);
    expect(p.latinName).toBe('Acer saccharum');
    expect(p.heightM).toBe(25);
    expect(p.eatable).toBe(true);
    expect(p.sunFull).toBe(false);
    expect(p.fruitMonths[8]).toBe(true);
  });

  it('produces an importable template', () => {
    const [p] = importFromCSV(buildCSVTemplate());
    expect(p.latinName).toBe('Sambucus nigra');
    expect(p.eatable).toBe(true);
  });

  it('skips rows without any name', () => {
    expect(importFromCSV('Lateinisch,Deutsch,Essbar\r\n"","",1\r\n"A","",0')).toHaveLength(1);
  });
});
