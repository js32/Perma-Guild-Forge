# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git

This is a fork (`tbdal/Perma-Design-Kit`, formerly `tbdal/Perma-Guild-Forge`) of the upstream `js32/Perma-Guild-Forge`. `origin` points to the fork; push there with plain `git`.

## Build & Dev

All commands run from `pwa/` with Node ≥ 22 (managed via nvm; run `nvm use` to pick up `.nvmrc`):

```bash
# Local dev server
npm run dev

# Type check (astro check; the build itself does NOT type-check)
npm run check

# Unit tests (vitest, test/*.test.ts)
npm test

# Production build
npm run build

# Deploy (VPS only): refuses unless on a clean main == origin/main, runs tests + build
npm run deploy
```

Run `npm run check` and `npm test` before committing. `test/fixtures/pfaf/*.html` are saved PFAF pages for the parser tests — refresh them when PFAF changes its markup.

## Architecture

**Astro static PWA** — pages `index.astro` (Pflanzen), `kalender.astro`, `polykulturen.astro`, `gartenplan.astro`, `settings.astro` plus static info pages; `cards.astro` is only a redirect to `/?view=cards`. No framework components, all interactivity is vanilla TypeScript in `<script>` blocks within each page. There is no component folder; shared logic lives in `src/lib/`.

**Central field table** (`src/lib/plant-fields.ts`): every boolean `PlantData` field is listed once in `BOOL_FIELDS` with its DE/EN label, CSV column, legacy CSV column, and badge/dot/PDF-chip styling. Form bindings, CSV import/export, table dots and legend, table-PDF chips and the `fld_<key>` i18n labels are all derived from it. A new boolean field = one entry there + its checkbox markup (`data-field` + `id="f-<key>"`); `test/plant-fields.test.ts` fails if a boolean field is missing from the table.

**Plant list logic** lives outside `index.astro`: filtering/sorting in `src/lib/plant-list.ts`, badges/completeness/group pills in `src/lib/plant-detail.ts`, enrichment (Wikidata + PFAF merge) in `src/lib/enrich.ts`, CSV in `src/lib/csv.ts`.

**Data flow:**
1. Plant data lives in IndexedDB (`permaculture-guilds` DB, `plants` store) — `src/lib/db.ts`
2. Search hits the local `public/plants-db.json` first, then Wikidata API directly, then the server proxy for PFAF enrichment (NaturaDB is currently disabled, see ROADMAP.md)
3. `_sources: Partial<Record<keyof PlantData, DataSource>>` tracks per-field provenance — every import path must call `trackSources()` after writing fields. Re-enriching resets a `true` that PFAF itself set but now reports `false`; manual values are never touched.
4. Everything arriving from outside (JSON import, backup restore, Gist/WebDAV pull, CSV, `plants-db.json`) goes through `normalizePlant()` / `parseBackup()` (`src/lib/plant-normalize.ts`, `src/lib/sync.ts`) before it reaches IndexedDB — never `importPlants(JSON.parse(...))` directly.

**Plant proxy** (`pwa/server/plant-proxy-server.mjs`) is a standalone Node process (not Netlify — migrated off it) that scrapes PFAF HTML server-side, since the browser can't due to CORS. The parsing itself is in `server/pfaf-parse.mjs` (pure, unit-tested). The proxy caches results in memory (24 h hits, 10 min misses), times out upstream after 15 s, and rate-limits per `X-Real-IP` (set by nginx — never trust the first `X-Forwarded-For` entry). After changing it, restart the `plant-proxy` systemd unit. NaturaDB scraping exists in the same file but is hard-disabled (`NATURADB_ENABLED = false`, unresolved license/robots.txt concerns — see ROADMAP.md). Reachable at `/api/plant-proxy?name=LatinName`: in dev, `astro.config.mjs`'s `vite.server.proxy` forwards that path to the standalone process (default port 8787, override via `PLANT_PROXY_PORT`); any other deployment needs an equivalent reverse-proxy rule. Run it with `npm run proxy` (or as the `plant-proxy.service` systemd unit on the VPS this was developed on).

**PDF export** (`src/lib/pdf-export.ts`) uses raw `flateStream` with RGB bytes instead of `embedPng()` for Poly/Stripe cards — this avoids an SMask that breaks rendering in LibreWolf/pdf.js. Don't revert to `embedPng()`. The Baumscheibe export takes a different route: Chrome/Safari rasterize SVG → JPEG → `embedJpg` (DCTDecode, no SMask) and auto-download; **Firefox** opens a native print window with the SVG inline (vector, fast) because canvas-rasterization of the 5 MB SVG is slow in Firefox and pdf.js mis-decodes the resulting raster XObject as diagonal stripes. Branch by `/Firefox\//.test(navigator.userAgent)`.

**Baumscheibe rendering** (`src/lib/baumscheibe-render.ts` + `baumscheibe-mapping.ts`): the template `pwa/public/baumscheibe-template.svg` is fetched once per session, parsed via `DOMParser`, then deep-cloned per plant. The mapping table lists `inkscape:label` values per `PlantData` field (both original code names and the renamed `Data-field_new` variants from `baumscheibe3-data-fields.ods`). Renderer walks elements via `getAttributeNS('http://www.inkscape.org/namespaces/inkscape', 'label')`, sets `<tspan>.textContent` for text fields and `display="none"` for false booleans. Fields without overlay elements in the SVG (e.g. `fruitMonths`, `pioneer`, `layer`, score-stars) are silently skipped — extend the artwork in Inkscape with the same label scheme and the renderer picks them up.

**View modes** on `index.astro`: `'grid' | 'list' | 'cards'` — state variable `viewMode` controls which branch of `renderList()` runs; `?view=` in the URL overrides the saved default. The cards view uses `renderPolyCardHtml`/`renderStripeCardHtml` from `src/lib/card-html.ts` and `renderBaumscheibeCardHtml` from `src/lib/baumscheibe-render.ts`. `cardViewMode: 'poly' | 'stripe' | 'baumscheibe'` selects which renderer to use; the render branch is async because Baumscheibe rendering awaits the SVG fetch.

**CSV** (`src/lib/csv.ts`): one column list drives export, template and import. Import matches columns by header name, detects the app format by `Lateinisch`/`Deutsch` headers vs. the legacy PowerShell `b_*`/`t_*` columns, and handles quoted multi-line fields.

**Content-Security-Policy** (set in nginx, versioned in `pwa/server/nginx/permadesignkit.org.conf`) forbids inline scripts: no `<script is:inline>` with a body, no `onclick=`/`onerror=` attributes in rendered HTML (use listeners; broken images are handled globally via `data-img-wrapper`, see `installBrokenImageCleanup()` in `html.ts`). Pre-paint code lives in `public/boot.js`.

**Settings** (`src/lib/settings.ts`) persist enabled data sources to localStorage. `isSourceEnabled('pfaf')` etc. gate all proxy/Wikidata calls — check these before assuming enrichment will run.

## Key types

```typescript
// src/lib/types.ts
type DataSource = 'wikidata' | 'pfaf' | 'naturadb' | 'manual' | 'csv' | 'sample';

interface PlantData {
  id: string;
  latinName: string;
  commonName: string;
  // ~50 boolean/number fields for plant attributes
  fruitMonths: boolean[];   // length 12
  flowerMonths: boolean[];  // length 12
  _sources?: Partial<Record<keyof PlantData, DataSource>>;
}
```

`createEmptyPlant()` initialises all arrays and defaults — always use it instead of constructing `PlantData` manually.
