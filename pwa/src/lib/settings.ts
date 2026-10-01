/** Data source configuration — persisted in localStorage */

export interface DataSource {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  needsApiKey: boolean;
  apiKey: string;
  url: string;
}

export type ViewMode = 'grid' | 'list' | 'cards';
export type CardVariant = 'poly' | 'stripe' | 'baumscheibe';
export type ThemePref = 'auto' | 'light' | 'dark';

/** Sources that fill plant data, in the order the user ranked them. */
export type EnrichSource = 'pfaf' | 'efg' | 'wikidata';
export const DEFAULT_SOURCE_PRIORITY: EnrichSource[] = ['pfaf', 'efg', 'wikidata'];

export interface AppSettings {
  sources: DataSource[];
  defaultView: ViewMode;
  defaultCardVariant: CardVariant;
  /** Highest priority first: per field, the first source with data wins. */
  sourcePriority: EnrichSource[];
}

const STORAGE_KEY = "perma-design-kit-settings";
/** Key earlier versions (Perma Guild Forge) saved settings under — read as a
 *  fallback so existing users don't lose their preferences on upgrade. */
const STORAGE_KEY_LEGACY = "guild-designer-settings";

const DEFAULT_PREFS: Omit<AppSettings, 'sources'> = {
  defaultView: 'grid',
  defaultCardVariant: 'baumscheibe',
  sourcePriority: DEFAULT_SOURCE_PRIORITY,
};

/** Keeps a saved priority list valid: known sources only, each once, any
 *  missing one appended in default order (so a newly added source still runs). */
function normalizePriority(saved: unknown): EnrichSource[] {
  const list = Array.isArray(saved) ? saved.filter((s): s is EnrichSource => DEFAULT_SOURCE_PRIORITY.includes(s as EnrichSource)) : [];
  const unique = [...new Set(list)];
  return [...unique, ...DEFAULT_SOURCE_PRIORITY.filter(s => !unique.includes(s))];
}

export const DEFAULT_SOURCES: DataSource[] = [
  {
    id: "wikidata",
    name: "Wikidata",
    description: "Freie Wissensdatenbank — Taxon-Namen, Bilder, Grunddaten. CORS-frei, kein Proxy nötig.",
    enabled: true,
    needsApiKey: false,
    apiKey: "",
    url: "https://www.wikidata.org/w/api.php",
  },
  {
    id: "pfaf",
    name: "PFAF (Plants For A Future)",
    description: "Essbarkeit, Medizin, Material-Scores, pH, Sonne, Wasser, Wachstum. Läuft über Proxy.",
    enabled: true,
    needsApiKey: false,
    apiKey: "",
    url: "https://pfaf.org",
  },
  {
    id: "efg",
    name: "Edible Forest Gardens (Jacke & Toensmeier)",
    description: "Artentabelle aus „Edible Forest Gardens\" Bd. 2 (aufbereitet von Lally Luck Farm): Licht, Feuchte, pH, Größe, Wuchs, Nutzungen, Funktionen. Rund 600 vor allem nordamerikanische Arten; liegt auf unserem Server.",
    enabled: true,
    needsApiKey: false,
    apiKey: "",
    url: "https://www.chelseagreen.com/product/edible-forest-gardens-volume-ii/",
  },
  {
    id: "naturadb",
    name: "NaturaDB",
    description: "Deutsche Namen, Höhe/Breite, Frucht-/Blütemonate, Licht, Wasser. Vorerst deaktiviert (ungeklärte Lizenzlage, siehe CHANGELOG.md) — der Proxy liefert dafür keine Daten mehr, unabhängig von diesem Schalter.",
    enabled: false,
    needsApiKey: false,
    apiKey: "",
    url: "https://www.naturadb.de",
  },
];

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY_LEGACY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<AppSettings>;
      const savedSources = Array.isArray(saved.sources) ? saved.sources : [];
      const sources = DEFAULT_SOURCES.map((def) => {
        const existing = savedSources.find((s) => s?.id === def.id);
        return existing
          ? { ...def, enabled: existing.enabled === true, apiKey: typeof existing.apiKey === 'string' ? existing.apiKey : '' }
          : { ...def };
      });
      // Settings can arrive from a restored backup file, so only accept known values.
      const views: ViewMode[] = ['grid', 'list', 'cards'];
      const variants: CardVariant[] = ['poly', 'stripe', 'baumscheibe'];
      return {
        sources,
        defaultView: views.includes(saved.defaultView as ViewMode) ? saved.defaultView! : DEFAULT_PREFS.defaultView,
        defaultCardVariant: variants.includes(saved.defaultCardVariant as CardVariant) ? saved.defaultCardVariant! : DEFAULT_PREFS.defaultCardVariant,
        sourcePriority: normalizePriority(saved.sourcePriority),
      };
    }
  } catch {}
  return { sources: DEFAULT_SOURCES.map((s) => ({ ...s })), ...DEFAULT_PREFS, sourcePriority: [...DEFAULT_SOURCE_PRIORITY] };
}

export function getSourcePriority(): EnrichSource[] {
  return loadSettings().sourcePriority;
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function isSourceEnabled(id: string): boolean {
  return loadSettings().sources.find((s) => s.id === id)?.enabled ?? false;
}

export function getApiKey(id: string): string {
  return loadSettings().sources.find((s) => s.id === id)?.apiKey ?? "";
}

// ── Theme: stored under a separate key so the pre-paint inline script in
// Layout.astro stays independent of the JSON-encoded settings blob.
// Values: 'light' | 'dark' | (absent = 'auto', follow OS).

export function getTheme(): ThemePref {
  try {
    const v = localStorage.getItem('theme');
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch { return 'auto'; }
}

export function setTheme(t: ThemePref): void {
  try {
    if (t === 'auto') localStorage.removeItem('theme');
    else localStorage.setItem('theme', t);
  } catch {}
}

export function applyTheme(t: ThemePref): void {
  const isDark = t === 'dark'
    || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}

// ── Analytics opt-out: uses Umami's own localStorage key so the tracking
// script honors it automatically (self-hosted Umami replaced Plausible
// Cloud 2026-09-22, see CHANGELOG.md). A prior Plausible opt-out is
// migrated once so an earlier choice isn't silently lost by the switch.

export function isAnalyticsOptedOut(): boolean {
  try {
    if (localStorage.getItem('plausible_ignore') === 'true' && !localStorage.getItem('umami.disabled')) {
      localStorage.setItem('umami.disabled', 'true');
      localStorage.removeItem('plausible_ignore');
    }
    return localStorage.getItem('umami.disabled') === 'true';
  } catch {
    return false;
  }
}

export function setAnalyticsOptOut(v: boolean): void {
  try {
    if (v) localStorage.setItem('umami.disabled', 'true');
    else localStorage.removeItem('umami.disabled');
  } catch {}
}
