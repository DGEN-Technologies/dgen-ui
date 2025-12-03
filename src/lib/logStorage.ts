import { openDB, type IDBPDatabase, type DBSchema } from 'idb';

export type PersistedLogEntry = {
  timestamp: string;
  source: 'breez' | 'app';
  level: string;
  message: string;
  tag?: string;
  context?: unknown;
};

interface LogDB extends DBSchema {
  logs: {
    key: number;
    value: PersistedLogEntry;
    indexes: {
      'by-timestamp': string;
    };
  };
}

const DB_NAME = 'dgen-logs';
const DB_VERSION = 1;
const STORE_NAME = 'logs';
const MAX_LOGS = 5000; // retention: keep last 5000 entries

let dbPromise: Promise<IDBPDatabase<LogDB>> | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

async function getDB(): Promise<IDBPDatabase<LogDB>> {
  if (!isBrowser()) {
    throw new Error('IndexedDB is not available (non-browser environment)');
  }

  if (!dbPromise) {
    dbPromise = openDB<LogDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('by-timestamp', 'timestamp');
        }
      },
    });
  }

  return dbPromise;
}

/**
 * Append a log entry to IndexedDB.
 * Enforces a simple retention policy: keep only the last MAX_LOGS entries.
 */
export async function appendLog(entry: PersistedLogEntry): Promise<void> {
  if (!isBrowser()) return;

  try {
    const db = await getDB();

    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.store;

    await store.put(entry);

    // Enforce retention: delete oldest when over MAX_LOGS
    const count = await store.count();
    if (count > MAX_LOGS) {
      const toDelete = count - MAX_LOGS;
      let deleted = 0;

      // Iterate in key order (timestamp-like ids) and delete the oldest
      let cursor = await store.openCursor();
      while (cursor && deleted < toDelete) {
        await cursor.delete();
        deleted++;
        cursor = await cursor.continue();
      }
    }

    await tx.done;
  } catch (err) {
    console.warn('[logStorage] Failed to append log entry:', err);
  }
}

/**
 * Retrieve all logs from IndexedDB, sorted by id (oldest first).
 */
export async function getLogs(): Promise<PersistedLogEntry[]> {
  if (!isBrowser()) return [];

  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.store;

    const logs = await store.getAll();
    await tx.done;

    // Ensure deterministic order
    return logs.sort((a, b) => a.id - b.id);
  } catch (err) {
    console.warn('[logStorage] Failed to get logs:', err);
    return [];
  }
}

/**
 * Clear all logs from IndexedDB.
 */
export async function clearLogs(): Promise<void> {
  if (!isBrowser()) return;

  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await tx.store.clear();
    await tx.done;
  } catch (err) {
    console.warn('[logStorage] Failed to clear logs:', err);
  }
}
