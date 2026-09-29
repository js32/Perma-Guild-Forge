import { openDB, type DBSchema } from 'idb';
import type { PlantData, Polyculture, GardenPlan } from './types';

interface PlantDB extends DBSchema {
  plants: {
    key: string;
    value: PlantData;
    indexes: { 'by-latin': string };
  };
  polycultures: {
    key: string;
    value: Polyculture;
  };
  gardenPlans: {
    key: string;
    value: GardenPlan;
  };
}

const DB_NAME = 'permaculture-guilds';
// v3: idempotent self-healing upgrade. Some browsers ended up with a v2 DB
// that was missing the 'plants' store after an inconsistent upgrade path
// (Symptom: "Failed to execute 'transaction' … object store not found").
// Bumping to v3 forces the upgrade to run for everyone; the handler then
// checks each store individually and creates any that are missing — so
// fresh installs, legacy v1 plants-only DBs, and broken v2 DBs all
// converge to the same shape.
// v4: renamed the 'guilds' store to 'polycultures' (Gilde → Polykultur
// terminology rename). Existing records are copied over, then the old
// store is dropped, so nobody's saved polycultures disappear.
// v5: adds the 'gardenPlans' store for the Gartenplan feature. Additive/
// idempotent, same self-healing pattern as prior bumps.
const DB_VERSION = 5;

// One shared connection per page instead of opening a fresh one on every call.
// Dropped (and re-opened on next use) if another tab upgrades the schema or
// the browser closes it, so a newer tab's upgrade is never blocked by this one.
let dbPromise: ReturnType<typeof openPlantDB> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openPlantDB();
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

function openPlantDB() {
  return openDB<PlantDB>(DB_NAME, DB_VERSION, {
    blocking() {
      // A newer version was requested elsewhere: release our handle.
      dbPromise?.then(db => db.close());
      dbPromise = null;
    },
    terminated() {
      dbPromise = null;
    },
    async upgrade(db, _oldVersion, _newVersion, transaction) {
      if (!db.objectStoreNames.contains('plants')) {
        const store = db.createObjectStore('plants', { keyPath: 'id' });
        store.createIndex('by-latin', 'latinName');
      }
      if (!db.objectStoreNames.contains('polycultures')) {
        const newStore = db.createObjectStore('polycultures', { keyPath: 'id' });
        if (db.objectStoreNames.contains('guilds' as never)) {
          const oldStore = transaction.objectStore('guilds' as never);
          const all = await oldStore.getAll();
          for (const item of all) await newStore.put(item);
          db.deleteObjectStore('guilds' as never);
        }
      }
      if (!db.objectStoreNames.contains('gardenPlans')) {
        db.createObjectStore('gardenPlans', { keyPath: 'id' });
      }
    },
  });
}

export async function getAllPlants(): Promise<PlantData[]> {
  const db = await getDB();
  return db.getAll('plants');
}

export async function getPlant(id: string): Promise<PlantData | undefined> {
  const db = await getDB();
  return db.get('plants', id);
}

export async function savePlant(plant: PlantData): Promise<void> {
  const db = await getDB();
  await db.put('plants', plant);
}

export async function deletePlant(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('plants', id);
}

export async function importPlants(plants: PlantData[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('plants', 'readwrite');
  for (const plant of plants) {
    await tx.store.put(plant);
  }
  await tx.done;
}

export async function exportPlants(): Promise<PlantData[]> {
  return getAllPlants();
}

export async function clearAllPlants(): Promise<void> {
  const db = await getDB();
  await db.clear('plants');
}

// ── Polycultures ──────────────────────────────────────────────────────────

export async function getAllPolycultures(): Promise<Polyculture[]> {
  const db = await getDB();
  return db.getAll('polycultures');
}

export async function getPolyculture(id: string): Promise<Polyculture | undefined> {
  const db = await getDB();
  return db.get('polycultures', id);
}

export async function savePolyculture(polyculture: Polyculture): Promise<void> {
  polyculture.updatedAt = new Date().toISOString();
  const db = await getDB();
  await db.put('polycultures', polyculture);
}

export async function deletePolyculture(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('polycultures', id);
}

export async function importPolycultures(polycultures: Polyculture[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('polycultures', 'readwrite');
  for (const polyculture of polycultures) {
    await tx.store.put(polyculture);
  }
  await tx.done;
}

// ── Garden plans ──────────────────────────────────────────────────────────

export async function getAllGardenPlans(): Promise<GardenPlan[]> {
  const db = await getDB();
  return db.getAll('gardenPlans');
}

export async function getGardenPlan(id: string): Promise<GardenPlan | undefined> {
  const db = await getDB();
  return db.get('gardenPlans', id);
}

export async function saveGardenPlan(plan: GardenPlan): Promise<void> {
  plan.updatedAt = new Date().toISOString();
  const db = await getDB();
  await db.put('gardenPlans', plan);
}

export async function deleteGardenPlan(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('gardenPlans', id);
}

export async function importGardenPlans(plans: GardenPlan[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('gardenPlans', 'readwrite');
  for (const plan of plans) {
    await tx.store.put(plan);
  }
  await tx.done;
}
