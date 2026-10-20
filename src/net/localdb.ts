/** Minimal IndexedDB key/value store (guest progress, §11.1) with localStorage fallback. */
const DB = 'turbo-rally';
const STORE = 'kv';
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise<T | undefined>((res, rej) => {
      const tx = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      tx.onsuccess = () => res(tx.result as T | undefined);
      tx.onerror = () => rej(tx.error);
    });
  } catch {
    const raw = localStorage.getItem('tr.' + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  }
}
export async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch {
    try {
      localStorage.setItem('tr.' + key, JSON.stringify(value));
    } catch {
      /* quota */
    }
  }
}
