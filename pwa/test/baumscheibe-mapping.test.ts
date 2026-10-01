import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BOOL_FIELDS } from '../src/lib/baumscheibe-mapping';

describe('Baumscheibe mapping', () => {
  it('maps every use (u_*) and function (f_*) icon of the template to a field', () => {
    // An icon without a mapping is never hidden, so it shows on every disc.
    const svg = readFileSync(new URL('../public/baumscheibe-template.svg', import.meta.url), 'utf8');
    const iconLabels = [...svg.matchAll(/inkscape:label="((?:u|f)_[^"]+)"/g)].map(m => m[1]);
    const mapped = new Set(Object.values(BOOL_FIELDS).flat());
    expect(iconLabels.length).toBeGreaterThan(0);
    expect(iconLabels.filter(l => !mapped.has(l))).toEqual([]);
  });
});
