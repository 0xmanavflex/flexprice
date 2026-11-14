/**
 * The contract files uploaded from this browser, kept so the upload screen can
 * show the document again after a reload.
 *
 * The backend stores the file but has no way to download it, so the preview
 * can only come from the browser that uploaded it. The copy lives in
 * IndexedDB (files are too large for web storage), keyed by contract id, and
 * is bounded: the newest few, for a few days, and cleared on sign-out. It is a
 * convenience, never a source of truth: every call fails soft, and a missing
 * copy only means the preview pane says so.
 */

const DB_NAME = 'fp-contract-files'
const STORE = 'files'

/** How many files are kept, newest first. */
export const CONTRACT_FILES_KEPT = 5
/** How long a file is kept. */
export const CONTRACT_FILE_TTL_MS = 7 * 24 * 60 * 60 * 1000

interface StoredFile {
  contractId: string
  file: Blob
  name: string
  type: string
  lastModified: number
  savedAt: number
}

/** The ids to drop: anything past the newest `kept`, or older than `ttlMs`. */
export function staleContractFiles(
  entries: readonly { contractId: string; savedAt: number }[],
  now: number,
  kept = CONTRACT_FILES_KEPT,
  ttlMs = CONTRACT_FILE_TTL_MS,
): string[] {
  return [...entries]
    .sort((a, b) => b.savedAt - a.savedAt)
    .filter((entry, index) => index >= kept || now - entry.savedAt > ttlMs)
    .map((entry) => entry.contractId)
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'contractId' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T>,
): Promise<T | null> {
  try {
    const db = await open()
    try {
      return await run(db.transaction(STORE, mode).objectStore(STORE))
    } finally {
      db.close()
    }
  } catch {
    return null
  }
}

export async function saveContractFile(contractId: string, file: File): Promise<void> {
  const now = Date.now()
  await withStore('readwrite', async (store) => {
    await done(
      store.put({
        contractId,
        file,
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
        savedAt: now,
      } satisfies StoredFile),
    )
    const all = (await done(store.getAll())) as StoredFile[]
    await Promise.all(staleContractFiles(all, now).map((id) => done(store.delete(id))))
  })
}

export async function loadContractFile(contractId: string): Promise<File | null> {
  return withStore('readonly', async (store) => {
    const entry = (await done(store.get(contractId))) as StoredFile | undefined
    if (!entry || Date.now() - entry.savedAt > CONTRACT_FILE_TTL_MS) return null
    return new File([entry.file], entry.name, {
      type: entry.type,
      lastModified: entry.lastModified,
    })
  })
}

export async function forgetContractFile(contractId: string): Promise<void> {
  await withStore('readwrite', (store) => done(store.delete(contractId)))
}

/** On sign-out: the next person on this browser should not see these contracts. */
export function clearContractFiles(): void {
  try {
    globalThis.indexedDB?.deleteDatabase(DB_NAME)
  } catch {
    // Nothing to clear, or storage is blocked.
  }
}
