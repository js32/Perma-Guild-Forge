import { getAllPlants, getAllPolycultures, getAllGardenPlans } from './db';
import { loadSettings, type AppSettings } from './settings';
import type { PlantData, Polyculture, GardenPlan } from './types';
import { normalizePlants, normalizePolycultures, normalizeGardenPlans } from './plant-normalize';

export const GIST_FILENAME = 'perma-design-kit-backup.json';
/** Filename earlier versions (Perma Guild Forge) wrote to — read as a
 *  fallback so existing synced Gists still import correctly. */
export const GIST_FILENAME_LEGACY = 'perma-guild-forge-backup.json';

export function isAutoSyncEnabled(): boolean {
  try { return localStorage.getItem('auto-sync-enabled') === 'true'; } catch { return false; }
}

export function rememberSyncAt(provider: string) {
  const now = new Date().toISOString();
  try {
    localStorage.setItem('last-backup-at', now);
    localStorage.setItem('last-auto-sync-at', now);
    localStorage.setItem('last-auto-sync-provider', provider);
  } catch {}
}

export async function buildBackupJson(): Promise<string> {
  const [plants, polycultures, gardenPlans] = await Promise.all([getAllPlants(), getAllPolycultures(), getAllGardenPlans()]);
  const settings = loadSettings();
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), settings, plants, polycultures, gardenPlans }, null, 2);
}

export interface ParsedBackup {
  plants: PlantData[];
  polycultures: Polyculture[];
  gardenPlans: GardenPlan[];
  /** Raw settings object, if the backup carried one; saveSettings() merges it onto defaults. */
  settings: Partial<AppSettings> | null;
}

/** Parses a backup file / Gist / WebDAV payload — either the full backup
 *  object or a bare plant array (the plant list's own JSON export). Every
 *  record is normalized; malformed ones are dropped. Throws on invalid JSON. */
export function parseBackup(text: string): ParsedBackup {
  const data: unknown = JSON.parse(text);
  if (Array.isArray(data)) return { plants: normalizePlants(data), polycultures: [], gardenPlans: [], settings: null };
  if (typeof data !== 'object' || data === null) return { plants: [], polycultures: [], gardenPlans: [], settings: null };
  const d = data as Record<string, unknown>;
  return {
    plants: normalizePlants(d.plants),
    polycultures: normalizePolycultures(d.polycultures ?? d.guilds),
    gardenPlans: normalizeGardenPlans(d.gardenPlans),
    settings: typeof d.settings === 'object' && d.settings !== null && !Array.isArray(d.settings) ? d.settings as Partial<AppSettings> : null,
  };
}

export type SyncResult = { ok: boolean; provider: 'webdav' | 'gist' | null; error?: string };

export async function autoSyncIfConfigured(): Promise<SyncResult> {
  if (!isAutoSyncEnabled()) return { ok: true, provider: null };

  const webdavUrl = (localStorage.getItem('webdav-url') || '').trim();
  const webdavUser = (localStorage.getItem('webdav-user') || '').trim();
  const webdavPass = localStorage.getItem('webdav-pass') || '';

  if (webdavUrl && webdavUser) {
    try {
      const content = await buildBackupJson();
      const auth = 'Basic ' + btoa(unescape(encodeURIComponent(`${webdavUser}:${webdavPass}`)));
      const res = await fetch(webdavUrl, {
        method: 'PUT',
        headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
        body: content,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      rememberSyncAt('webdav');
      return { ok: true, provider: 'webdav' };
    } catch (e) {
      return { ok: false, provider: 'webdav', error: (e as Error).message };
    }
  }

  const gistToken = (localStorage.getItem('gist-token') || '').trim();
  const gistId = (localStorage.getItem('gist-id') || '').trim();

  if (gistToken && gistId) {
    try {
      const content = await buildBackupJson();
      const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${gistToken}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({ files: { [GIST_FILENAME]: { content } } }),
      });
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      rememberSyncAt('gist');
      return { ok: true, provider: 'gist' };
    } catch (e) {
      return { ok: false, provider: 'gist', error: (e as Error).message };
    }
  }

  return { ok: true, provider: null };
}
