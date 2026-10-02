// Standalone replacement for the old Netlify Function (netlify/functions/plant-proxy.mts,
// removed). Scrapes PFAF for plant data — the browser can't do this directly due to CORS.
//
// Runs as its own long-lived process (see /etc/systemd/system/plant-proxy.service on the
// VPS), bound to 127.0.0.1 only. It's reached at /api/plant-proxy via a dev-server proxy
// rule (astro.config.mjs) locally, or should be reverse-proxied the same way in any other
// deployment — the frontend (src/lib/plant-search.ts) always calls the relative path and
// has no knowledge of where this process runs.
import { createServer } from 'node:http';
import { parsePfafHtml } from './pfaf-parse.mjs';
import { lookupEfg, efgIndex } from './efg.mjs';

const PORT = process.env.PLANT_PROXY_PORT || 8787;
const UPSTREAM_TIMEOUT_MS = 15_000;

// PFAF filters on the outbound User-Agent: a self-identifying string like
// "PermaGuildForge/1.0" got a server-side "200 OK, full page, every field
// empty" response every time, while an ordinary browser UA worked every
// time (confirmed by alternating the two back to back, same IP, same
// moment — see ROADMAP.md "Lizenz & Datenquellen" for the full writeup).
//
// This is a deliberate, discussed choice, not an oversight: PFAF's CC BY 4.0
// license explicitly permits reuse of their data, but UA filtering signals
// they don't want *automated* access, which is a separate question from
// whether reusing the data itself is allowed. Weighed masking as a browser
// against leaving PFAF enrichment broken (as chosen for NaturaDB, which
// grants no reuse license at all — a materially different situation) or
// asking PFAF first. Decided to proceed with a browser UA: the data use
// itself is within license, and PFAF is a small non-profit whose own
// licensing text is unusually welcoming to reuse ("we ask that you let us
// know if you ... do anything groovy with this information"). Revisit if
// that balance ever seems off — e.g. if PFAF's ToS explicitly addresses
// automated access, or if request volume grows enough to matter to them.
// The result cache below keeps repeat lookups of the same plant off PFAF.
const OUTBOUND_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0';

// --- Origin allowlist ---
// This process is bind-only to 127.0.0.1, so in practice only the dev-server proxy (or a
// same-host reverse proxy) can reach it. Kept anyway as defense in depth in case that
// ever changes (e.g. a reverse-proxy misconfiguration exposing the port directly).
const ALLOWED_ORIGIN_HOSTS = new Set(['localhost', '127.0.0.1', 'permadesignkit.org', 'www.permadesignkit.org']);

function isAllowedOrigin(origin) {
  if (!origin) return true; // same-origin / non-browser / proxied request, no Origin header
  try {
    return ALLOWED_ORIGIN_HOSTS.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin && isAllowedOrigin(origin) ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

// --- Best-effort in-process rate limiting ---
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const requestLog = new Map();

// X-Real-IP is set (overwritten) by nginx from the TCP peer, so a client can't
// forge it. X-Forwarded-For is NOT safe here: nginx appends the real address to
// whatever the client sent, so its first entry is attacker-controlled and
// rotating it bypassed the limit entirely. In dev (Astro's proxy) neither header
// is trustworthy or needed — the socket address is the local browser.
function clientIp(req) {
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real) return real.trim();
  return req.socket.remoteAddress || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

// Periodically drop IPs with no recent activity so the map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of requestLog) {
    if (timestamps.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) requestLog.delete(ip);
  }
}, RATE_LIMIT_WINDOW_MS).unref();

// --- Result cache ---
// PFAF pages change rarely; caching keeps "Lade alle fehlenden Daten" and repeated
// imports of the same plant from re-scraping PFAF. Plants PFAF doesn't know are
// cached briefly too, so a typo loop doesn't hammer it; upstream errors are not cached.
const CACHE_TTL_HIT_MS = 24 * 60 * 60_000;
const CACHE_TTL_MISS_MS = 10 * 60_000;
const CACHE_MAX_ENTRIES = 1000;
const resultCache = new Map();

function cacheGet(key) {
  const entry = resultCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { resultCache.delete(key); return null; }
  return entry.body;
}

function cacheSet(key, body, ttl) {
  if (resultCache.size >= CACHE_MAX_ENTRIES) resultCache.delete(resultCache.keys().next().value);
  resultCache.set(key, { body, expires: Date.now() + ttl });
}

function emptyResult(latinName) {
  return {
    latinName,
    commonName: '',
    heightM: null, widthM: null,
    habit: '',
    climateZone: '',
    eatableScore: null, medsScore: null, materialScore: null,
    eatable: false, meds: false, material: false, culinaric: false,
    fodder: false, fuel: false,
    nitrogenFix: false, mineralFix: false, groundCover: false,
    insects: false, pest: false, animalProtection: false,
    windBreaking: false, windBreakingOnSea: false,
    sunFull: false, sunMid: false, sunShadow: false,
    waterDry: false, waterMid: false, waterWet: false, waterPlant: false,
    growSpeedLow: false, growSpeedMid: false, growSpeedHigh: false,
    phVeryAcid: false, phAcid: false, phNeutral: false,
    phAlkaline: false, phVeryAlkaline: false, phSaline: false,
    fruitMonths: Array(12).fill(false),
    flowerMonths: Array(12).fill(false),
    source: '',
  };
}

/** Returns parsed fields, {} when PFAF has no data for the name, or null on an upstream failure. */
async function fetchPfaf(name) {
  // PFAF's canonical URL form uses '+' for spaces; encode first, then swap %20 for '+'
  // (the reverse order double-encodes the '+' into %2B and PFAF finds nothing).
  const url = `https://pfaf.org/user/Plant.aspx?LatinName=${encodeURIComponent(name).replace(/%20/g, '+')}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': OUTBOUND_USER_AGENT },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return parsePfafHtml(await res.text());
  } catch {
    return null;
  }
}

// --- NaturaDB ---
//
// Disabled for now (see ROADMAP.md "Lizenz & Datenquellen"): naturadb.de grants no reuse
// license for its editorial plant database, and its robots.txt has an explicit
// "Datenbank Crawler: Disallow /" entry — a clear anti-scraping signal. Re-enable only
// after obtaining permission or API access from NaturaDB.
const NATURADB_ENABLED = false;

function getTableValue(html, key) {
  const re = new RegExp(`<td[^>]*>\\s*${key}:?\\s*</td>\\s*<td[^>]*>([\\s\\S]*?)</td>`, 'i');
  const m = html.match(re);
  return m ? m[1] : '';
}

function parseMonthIndicators(html) {
  const months = Array(12).fill(false);
  const indicators = html.match(/month-indicator[^>]*>/gi) || [];
  indicators.forEach((indicator, i) => {
    if (i < 12) months[i] = /data-active/i.test(indicator);
  });
  return months;
}

async function fetchNaturaDb(name) {
  if (!NATURADB_ENABLED) return {};

  const slug = name.toLowerCase().replace(/ /g, '-');
  const url = `https://www.naturadb.de/pflanzen/${slug}/`;
  let html;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': OUTBOUND_USER_AGENT },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch { return null; }

  const result = { source: 'naturadb' };

  const h1Match = html.match(/<h1[^>]*>([^<]+)/i);
  if (h1Match) result.commonName = h1Match[1].trim();

  const heightStr = getTableValue(html, 'Höhe');
  const hMatch = heightStr.match(/([\d,]+)\s*(?:-\s*([\d,]+))?\s*(m|cm)/);
  if (hMatch) {
    const val = parseFloat(hMatch[2] || hMatch[1]);
    result.heightM = hMatch[3] === 'cm' ? val / 100 : val;
  }

  const widthStr = getTableValue(html, 'Breite');
  const wMatch = widthStr.match(/([\d,]+)\s*(?:-\s*([\d,]+))?\s*(m|cm)/);
  if (wMatch) {
    const val = parseFloat(wMatch[2] || wMatch[1]);
    result.widthM = wMatch[3] === 'cm' ? val / 100 : val;
  }

  const licht = getTableValue(html, 'Licht');
  result.sunFull = licht.includes('sun_0') || licht.includes('Sonne');
  result.sunMid = licht.includes('sun_1') || licht.includes('Halbschatten');
  result.sunShadow = licht.includes('sun_2') || licht.includes('Schatten');

  const wasser = getTableValue(html, 'Wasser');
  result.waterDry = wasser.includes('water_0') || /trocken/i.test(wasser);
  result.waterMid = wasser.includes('water_1') || /frisch|feucht/i.test(wasser);
  result.waterWet = wasser.includes('water_2') || /nass/i.test(wasser);
  result.waterPlant = /wasserpflanze/i.test(wasser);

  result.fruitMonths = parseMonthIndicators(getTableValue(html, 'Fruchtreife'));
  result.flowerMonths = parseMonthIndicators(getTableValue(html, 'Blühzeit'));

  return result;
}

// --- Main handler ---

/** Copies a source's fields, minus its 'source' tag. */
const fieldsOf = (r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'source'));

async function lookup(name) {
  const result = emptyResult(name);
  const [pfaf, naturaDb] = await Promise.all([fetchPfaf(name), fetchNaturaDb(name)]);
  const efg = lookupEfg(name);

  // Per-source results, so the client can merge them in the order the user
  // chose (Einstellungen → Quellen-Priorität). The flat fields are a legacy
  // merge (first source wins, the others fill gaps) for older clients.
  const bySource = {};
  if (pfaf && Object.keys(pfaf).length > 1) bySource.pfaf = fieldsOf(pfaf);
  if (Object.keys(efg).length > 1) bySource.efg = fieldsOf(efg);
  if (naturaDb && Object.keys(naturaDb).length > 1) bySource.naturadb = fieldsOf(naturaDb);

  for (const fields of Object.values(bySource)) {
    for (const [key, value] of Object.entries(fields)) {
      const current = result[key];
      const isEmpty = current === null || current === undefined || current === '' || current === false ||
        (Array.isArray(current) && current.every((v) => !v));
      if (isEmpty && value !== null && value !== undefined && value !== '' && value !== false) result[key] = value;
    }
  }

  const sources = Object.keys(bySource);
  result.source = sources.join('+');
  result.sources = bySource;
  const upstreamFailed = pfaf === null || naturaDb === null;
  return { body: JSON.stringify(result), found: sources.length > 0, upstreamFailed };
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const origin = req.headers.origin || null;
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    return res.end();
  }

  if (origin && !isAllowedOrigin(origin)) {
    res.writeHead(403, headers);
    return res.end(JSON.stringify({ error: 'Origin not allowed' }));
  }

  const name = (url.searchParams.get('name') || '').trim();
  if (!name || name.length > 200) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'Missing or invalid ?name= parameter' }));
  }

  const cacheKey = name.toLowerCase();
  const cached = cacheGet(cacheKey);
  if (cached) {
    res.writeHead(200, headers);
    return res.end(cached);
  }

  if (isRateLimited(clientIp(req))) {
    res.writeHead(429, headers);
    return res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
  }

  const { body, found, upstreamFailed } = await lookup(name);
  if (found) cacheSet(cacheKey, body, CACHE_TTL_HIT_MS);
  else if (!upstreamFailed) cacheSet(cacheKey, body, CACHE_TTL_MISS_MS);

  res.writeHead(200, headers);
  res.end(body);
}

const server = createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error('plant-proxy-server error:', err);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal error' }));
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`plant-proxy-server listening on http://127.0.0.1:${PORT} (EFG: ${efgIndex().size} species; NaturaDB: ${NATURADB_ENABLED ? 'enabled' : 'disabled'})`);
});
