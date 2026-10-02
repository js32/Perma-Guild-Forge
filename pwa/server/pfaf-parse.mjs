// Pure PFAF HTML → plant-field parser, split out of plant-proxy-server.mjs so it
// can be unit-tested against saved PFAF pages (test/fixtures/pfaf/*.html)
// without network access.

function parsePfafScore(text) {
  const m = text.match(/\((\d) of \d\)/);
  return m ? parseInt(m[1]) : null;
}

function parsePfafDimension(text) {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(m|cm)/);
  if (!m) return null;
  const val = parseFloat(m[1]);
  return m[2] === 'cm' ? val / 100 : val;
}

// PFAF's physical-description text ("It is in flower from April to June...
// the seeds ripen from November to March") gives exact month ranges, in the
// same sentence structure across every plant page checked. There's also a
// separate "Main Bloom Time" field on some pages that only gives a season
// (e.g. "Early spring, Late spring, Mid spring") — that field's format is
// inconsistent (sometimes genus-level essay text instead) and coarser than
// what's already available here, so it's not used.
const MONTH_NAMES_EN = ['january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'];

function parseMonthRange(fromName, toName) {
  const months = Array(12).fill(false);
  const from = MONTH_NAMES_EN.indexOf(fromName.toLowerCase());
  if (from === -1) return months;
  const to = toName ? MONTH_NAMES_EN.indexOf(toName.toLowerCase()) : from;
  if (to === -1) { months[from] = true; return months; }
  for (let i = from; ; i = (i + 1) % 12) {
    months[i] = true;
    if (i === to) break;
  }
  return months;
}

function extractMonths(phys, kind) {
  const re = kind === 'flower'
    ? /in flower (?:in|from) (\w+)(?:\s+to\s+(\w+))?/i
    : /seeds? ripens? (?:in|from) (\w+)(?:\s+to\s+(\w+))?/i;
  const m = phys.match(re);
  return m ? parseMonthRange(m[1], m[2]) : null;
}

// PFAF shows sun/water requirements as icons (/user/images/PFAF_Icon/<name>.jpg).
// The names overlap as substrings — "sun.jpg" is contained in "partsun.jpg" and
// "fullsun.jpg" — so a plain includes('sun.jpg') marked every semi-shade and
// shade plant as full sun too. Require a path separator or quote right before
// the file name. (PFAF's own naming: sun = full sun, partsun = semi-shade,
// fullsun = full shade.)
/** PFAF habit phrase ("deciduous Tree", "evergreen Climber", "PERENNIAL",
 *  "Bulb", "Fern") → 'tree' | 'shrub' | 'herb' | 'climber' | 'rhizo' | ''. */
export function pfafHabit(text) {
  const s = text.toLowerCase();
  if (/climber/.test(s)) return 'climber';
  if (/bulb|corm|tuber/.test(s)) return 'rhizo';
  if (/\btree\b/.test(s)) return 'tree';
  if (/\bshrub\b|bamboo/.test(s)) return 'shrub';
  if (/perennial|annual|biennial|fern|herb/.test(s)) return 'herb';
  return '';
}

function hasIcon(html, file) {
  return new RegExp(`[/"']${file.replace('.', '\\.')}`, 'i').test(html);
}

/**
 * Parse a PFAF Plant.aspx page. Returns {} when the page carries no plant data.
 * @param {string} html
 * @returns {Record<string, any>}
 */
export function parsePfafHtml(html) {
  const result = { source: 'pfaf' };

  // ASP.NET control ids (id="ContentPlaceHolder1_XXX") are tied to server-side
  // code rather than page styling, so they survive PFAF redesigns far better
  // than matching adjacent label text did.
  const getById = (id) => {
    const m = html.match(new RegExp(`id="ContentPlaceHolder1_${id}"[^>]*>([^<]*)`, 'i'));
    return m ? m[1].replace(/&nbsp;/g, ' ').trim() : '';
  };

  const commonName = getById('lblCommanName'); // sic — typo in PFAF's own markup
  if (commonName) result.commonName = commonName.split(',')[0].trim();

  const edibleRating = getById('txtEdrating');
  if (edibleRating) {
    result.eatableScore = parsePfafScore(edibleRating);
    result.eatable = (result.eatableScore || 0) > 2;
  }

  const medRating = getById('txtMedRating');
  if (medRating) {
    result.medsScore = parsePfafScore(medRating);
    result.meds = (result.medsScore || 0) > 2;
  }

  const otherUseRating = getById('txtOtherUseRating');
  if (otherUseRating) {
    result.materialScore = parsePfafScore(otherUseRating);
    result.material = (result.materialScore || 0) > 2;
  }

  const climateZone = getById('lblUSDAhardiness');
  if (climateZone) result.climateZone = climateZone;

  const physMatch = html.match(/lblPhystatment[^>]*>([^<]+(?:<[^>]+>[^<]*)*)/i);
  const phys = physMatch ? physMatch[1].replace(/<[^>]+>/g, '') : '';

  // "Rubus fruticosus is a deciduous Shrub growing to 3 m …" — the growth
  // form decides the layer; height alone would make a 3 m bramble a tree.
  const habitMatch = phys.match(/\bis an? ([^.]*?)\s+growing to/i);
  const habit = habitMatch ? pfafHabit(habitMatch[1]) : '';
  if (habit) result.habit = habit;

  const heightMatch = phys.match(/growing to (\d+(?:\.\d+)?)\s*(m|cm)/i);
  if (heightMatch) result.heightM = parsePfafDimension(heightMatch[0]);

  const widthMatch = phys.match(/by (\d+(?:\.\d+)?)\s*(m|cm)/i);
  if (widthMatch) result.widthM = parsePfafDimension(widthMatch[0]);

  result.growSpeedHigh = /at a fast rate/i.test(phys);
  result.growSpeedMid = /at a medium rate/i.test(phys);
  result.growSpeedLow = /at a slow rate/i.test(phys);

  result.phVeryAcid = /pH:.*very acid.*soils\./i.test(phys);
  result.phAcid = /pH:.*mildly acid.*soils\./i.test(phys);
  result.phNeutral = /pH:.*neutral.*soils\./i.test(phys);
  result.phAlkaline = /pH:.*mildly alkaline.*soils\./i.test(phys);
  result.phVeryAlkaline = /pH:.*very alkaline.*soils\./i.test(phys);
  result.phSaline = /pH:.*saline.*soils\./i.test(phys);

  result.windBreakingOnSea = /tolerate maritime exposure/i.test(phys);

  const flowerMonths = extractMonths(phys, 'flower');
  if (flowerMonths) result.flowerMonths = flowerMonths;
  const fruitMonths = extractMonths(phys, 'fruit');
  if (fruitMonths) result.fruitMonths = fruitMonths;

  result.sunFull = hasIcon(html, 'sun.jpg');
  result.sunMid = hasIcon(html, 'partsun.jpg');
  result.sunShadow = hasIcon(html, 'fullsun.jpg');
  result.waterDry = hasIcon(html, 'water1.jpg');
  result.waterMid = hasIcon(html, 'water2.jpg');
  result.waterWet = hasIcon(html, 'water3.jpg');
  result.waterPlant = hasIcon(html, 'water4.jpg');

  // The Uses sections are the class="boots"/"boots2"/… divs. The class=" prefix
  // matters: without it the pattern also hit "bootstrap" in the <head>'s CDN
  // links and swallowed tens of KB of unrelated markup.
  const fieldSection = html.match(/class="boots\d*"[^>]*>([\s\S]*?)<\/div>/gi)?.join(' ') || '';

  // Fields backed by one of PFAF's own use tags (rendered as
  // `<a href='Search_Use.aspx?glossary=Fuel'>Fuel</a>`) match the literal anchor
  // text, not loose prose — prose matching made Beinwell show fuel/groundCover
  // because the Biomass tag's tooltip mentions "fuel" and the Landscape Uses
  // text mentions ground cover in passing.
  const hasUseTag = (tagName) =>
    new RegExp(`>${tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</a>`, 'i').test(fieldSection);
  result.nitrogenFix = hasUseTag('Nitrogen Fixer');
  result.groundCover = hasUseTag('Ground Cover');
  result.insects = hasUseTag('Attracts Wildlife');
  result.fuel = hasUseTag('Fuel');
  result.fodder = hasUseTag('Fodder');
  result.pest = hasUseTag('Repellent');
  result.mineralFix = hasUseTag('Dynamic accumulator');
  result.culinaric = hasUseTag('Condiment');
  // PFAF has no glossary tag for windbreak / living trellis (verified: both
  // glossary searches return "no search result found" even for classic
  // windbreak species), so prose in the Uses sections is the only signal.
  result.windBreaking = /Windbreak/i.test(fieldSection);
  result.animalProtection = /Living trellis/i.test(fieldSection);

  // A page for an unknown name still loads (200 OK) with every field empty.
  const hasData = result.commonName || result.eatableScore != null || result.medsScore != null
    || result.materialScore != null || result.climateZone || phys;
  return hasData ? result : {};
}
