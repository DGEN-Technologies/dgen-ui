import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'dgen-logs';
const DB_VERSION = 2;
const STORE_NAME = 'logs';

const MAX_LOGS = 5000;          
const CLEANUP_INTERVAL = 100;

let dbPromise: Promise<IDBPDatabase> | null = null;
let writesSinceCleanup = 0;

async function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }

        db.createObjectStore(STORE_NAME, {
          autoIncrement: true,
        });
      },
    });
  }
  return dbPromise;
}

/**
 * Append a single log line as plain text.
 */
export async function appendLog(line: string): Promise<void> {
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
  if (count <= MAX_LOGS) return;

  const toDelete = count - MAX_LOGS;
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.store;

  let remaining = toDelete;
  let cursor = await store.openCursor();

  while (cursor && remaining > 0) {
    await cursor.delete();
    remaining -= 1;
    cursor = await cursor.continue();
  }

  await tx.done;
}

/**
 * Get all log lines, ordered by insertion.
 */
export async function getLogs(): Promise<string[]> {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}

/**
 * Clear all persisted logs.
 */
export async function clearLogs(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.store.clear();
  await tx.done;
}
