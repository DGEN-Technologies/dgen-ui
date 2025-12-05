import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'dgen-logs';
const DB_VERSION = 1;
const STORE_NAME = 'logs';

const MAX_LOGS = 5000;
const CLEANUP_INTERVAL = 100;
const CLEANUP_BUFFER = 100;

let dbPromise: Promise<IDBPDatabase> | null = null;
let writesSinceCleanup = 0;

async function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          if (db.objectStoreNames.contains(STORE_NAME)) {
            db.deleteObjectStore(STORE_NAME);
          }
          db.createObjectStore(STORE_NAME, { autoIncrement: true });
        }
        // Future migrations: if (oldVersion < 2) { ... }
      },
    });
  }
  return dbPromise;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

/**
 * Append a single log line as plain text.
 */
export async function appendLog(line: string): Promise<void> {
  if (!isBrowser()) return;

  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await tx.store.add(line);
    await tx.done;

    writesSinceCleanup += 1;
    if (writesSinceCleanup >= CLEANUP_INTERVAL) {
      writesSinceCleanup = 0;
      void enforceRetention().catch((err) => {
        console.warn('[logStorage] Failed to enforce retention:', err);
      });
    }
  } catch (err) {
    console.error('[logStorage] Failed to append log line:', err);
  }
}

/**
 * Retention policy: keep at most MAX_LOGS newest entries.
 */
async function enforceRetention(): Promise<void> {
  const db = await getDB();
  const count = await db.count(STORE_NAME);

  if (count <= MAX_LOGS + CLEANUP_BUFFER) return;

  const toDelete = count - MAX_LOGS;
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const keys = await tx.store.getAllKeys(undefined, toDelete);
  for (const key of keys) {
    tx.store.delete(key);
  }
  await tx.done;
}

/**
 * Get all log lines, ordered by insertion.
 */
export async function getLogs(): Promise<string[]> {
  if (!isBrowser()) return [];

  try {
    const db = await getDB();
    return db.getAll(STORE_NAME);
  } catch (err) {
    console.error('[logStorage] Failed to get logs:', err);
    return [];
  }
}

/**
 * Clear all logs
 */
export async function clearLogs(): Promise<void> {
  if (!isBrowser()) return;

  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.store.clear();
    await tx.done;
  } catch (err) {
    console.error('[logStorage] Failed to clear logs:', err);
  }
}
