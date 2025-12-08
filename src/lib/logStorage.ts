import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'dgen-logs';
const DB_VERSION = 1;
const STORE_NAME = 'logs';

const MAX_LOGS = 5000;
const CLEANUP_INTERVAL = 100;
const CLEANUP_BUFFER = 100;

let dbPromise: Promise<IDBPDatabase> | null = null;
let writesSinceCleanup = 0;

const WRITE_BATCH_SIZE = 20;
const WRITE_FLUSH_INTERVAL_MS = 500;

let pendingLines: string[] = [];
let flushTimeout: number | null = null;
let isFlushing = false;

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
    }).catch(err => {
      dbPromise = null;
      console.error('[logStorage] Failed to open database:', err);
      throw err;
    });
  }
  return dbPromise;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

async function flushPendingLines(): Promise<void> {
  if (!isBrowser()) return;
  if (isFlushing) return;
  if (pendingLines.length === 0) return;

  isFlushing = true;

  const batch = pendingLines;
  pendingLines = [];

  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.store;

    for (const line of batch) {
      await store.add(line);
    }

    await tx.done;

    writesSinceCleanup += batch.length;
    if (writesSinceCleanup >= CLEANUP_INTERVAL) {
      writesSinceCleanup = 0;
      void enforceRetention().catch((err) => {
        console.warn('[logStorage] Failed to enforce retention:', err);
      });
    }
  } catch (err) {
    console.error('[logStorage] Failed to flush logs batch:', err);
  } finally {
    isFlushing = false;
  }
}

if (isBrowser()) {
  window.addEventListener('beforeunload', () => {
    void flushPendingLines();
  });
}


export async function appendLog(line: string): Promise<void> {
  if (!isBrowser()) return;

  pendingLines.push(line);

  if (pendingLines.length >= WRITE_BATCH_SIZE) {
    void flushPendingLines();
    return;
  }

  if (flushTimeout === null) {
    flushTimeout = window.setTimeout(() => {
      flushTimeout = null;
      void flushPendingLines();
    }, WRITE_FLUSH_INTERVAL_MS);
  }
}


async function enforceRetention(): Promise<void> {
  const db = await getDB();
  const count = await db.count(STORE_NAME);

  if (count <= MAX_LOGS + CLEANUP_BUFFER) return;

  const toDelete = count - MAX_LOGS;
  const tx = db.transaction(STORE_NAME, 'readwrite');

  let deleted = 0;
  let cursor = await tx.store.openCursor();

  while (cursor && deleted < toDelete) {
    await cursor.delete();
    deleted++;
    cursor = await cursor.continue();
  }

  await tx.done;
}

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

export async function clearLogs(): Promise<void> {
  if (!isBrowser()) return;

  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await tx.store.clear();
    await tx.done;
  } catch (err) {
    console.error('[logStorage] Failed to clear logs:', err);
  }
}
