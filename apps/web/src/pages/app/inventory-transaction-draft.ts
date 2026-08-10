export type InventoryTransactionMode = 'sales' | 'purchase';

export interface DurableInventoryDraft<T = unknown> {
  mode: InventoryTransactionMode;
  eventId: string;
  payload: T;
  updatedAt: string;
}

const DATABASE = 'ebisnis-inventory-drafts';
const VERSION = 1;
const STORE = 'drafts';
let databasePromise: Promise<IDBDatabase> | null = null;

function database(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: 'mode' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Database draft tidak dapat dibuka.'));
  });
  return databasePromise;
}

export function createTransactionEventId(mode: InventoryTransactionMode): string {
  return `WEB_${mode.toUpperCase()}_${crypto.randomUUID()}`;
}

export async function saveInventoryDraft<T>(
  mode: InventoryTransactionMode,
  eventId: string,
  payload: T,
): Promise<void> {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put({
      mode,
      eventId,
      payload,
      updatedAt: new Date().toISOString(),
    } satisfies DurableInventoryDraft<T>);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Draft gagal disimpan.'));
  });
}

export async function loadInventoryDraft<T>(
  mode: InventoryTransactionMode,
): Promise<DurableInventoryDraft<T> | null> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(mode);
    request.onsuccess = () => resolve((request.result as DurableInventoryDraft<T> | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('Draft gagal dibaca.'));
  });
}

export async function deleteInventoryDraft(mode: InventoryTransactionMode): Promise<void> {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).delete(mode);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Draft gagal dihapus.'));
  });
}

/** Hanya untuk isolasi test; tidak dipakai oleh aplikasi. */
export function resetInventoryDraftDatabaseForTest(): void {
  databasePromise = null;
}
