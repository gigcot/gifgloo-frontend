const DB_NAME = "gifgloo-compose";
const STORE_NAME = "pending-files";
const PHOTO_KEY = "photo";

let pendingPhoto: File | null = null;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function setPendingPhoto(file: File): Promise<void> {
  pendingPhoto = file;

  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).put(file, PHOTO_KEY);
  await waitForTransaction(transaction);
  database.close();
}

export async function getPendingPhoto(): Promise<File | null> {
  if (pendingPhoto) return pendingPhoto;

  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readonly");
  const request = transaction.objectStore(STORE_NAME).get(PHOTO_KEY);
  const stored = await new Promise<unknown>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();

  if (!(stored instanceof File)) return null;
  pendingPhoto = stored;
  return stored;
}

export async function clearPendingPhoto(file: File): Promise<void> {
  if (pendingPhoto !== file) return;
  pendingPhoto = null;

  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).delete(PHOTO_KEY);
  await waitForTransaction(transaction);
  database.close();
}
