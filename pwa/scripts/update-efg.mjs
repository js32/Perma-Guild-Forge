// Refreshes server/data/efg-species.csv from the "Species Toolkit" Google
// Sheet. Only replaces the file if the download parses into species, so a
// changed sheet layout can't silently empty the dataset. Restart the
// plant-proxy service afterwards.
import { writeFile } from 'node:fs/promises';
import { EFG_CSV_URL, parseEfgCsv } from '../server/efg.mjs';

const res = await fetch(EFG_CSV_URL, { signal: AbortSignal.timeout(30_000) });
if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
const csv = await res.text();
const species = parseEfgCsv(csv).size;
if (species < 100) throw new Error(`Only ${species} species parsed — sheet layout changed? Keeping the old file.`);
await writeFile(new URL('../server/data/efg-species.csv', import.meta.url), csv);
console.log(`efg-species.csv updated: ${species} species`);
