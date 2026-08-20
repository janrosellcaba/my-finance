// Pure native IndexedDB client store for offline caching and outbox queuing.
// Zero external dependencies.

const DB_NAME = "myfinance_offline_db";
const DB_VERSION = 1;
const STORE_CACHE = "cache";
const STORE_OUTBOX = "outbox";

export type OutboxItem = {
    id: string;
    type: "transaction" | "todo";
    payload: Record<string, unknown>;
    timestamp: number;
};

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof window === "undefined" || !("indexedDB" in window)) {
            return reject(new Error("IndexedDB not available in this environment"));
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_CACHE)) {
                db.createObjectStore(STORE_CACHE, { keyPath: "key" });
            }
            if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
                db.createObjectStore(STORE_OUTBOX, { keyPath: "id" });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ---------- Cache Operations ----------

export async function saveToCache(key: string, data: unknown): Promise<void> {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_CACHE, "readwrite");
        tx.objectStore(STORE_CACHE).put({ key, data, updatedAt: Date.now() });
    } catch {
        // Silently fail if storage is restricted
    }
}

export async function getFromCache<T>(key: string): Promise<T | null> {
    try {
        const db = await openDb();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_CACHE, "readonly");
            const req = tx.objectStore(STORE_CACHE).get(key);
            req.onsuccess = () => resolve(req.result ? (req.result.data as T) : null);
            req.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}

// ---------- Outbox Operations ----------

export async function enqueueOutbox(item: Omit<OutboxItem, "timestamp">): Promise<void> {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_OUTBOX, "readwrite");
        tx.objectStore(STORE_OUTBOX).put({ ...item, timestamp: Date.now() });
    } catch (err) {
        console.error("Failed to enqueue offline item:", err);
    }
}

export async function getOutbox(): Promise<OutboxItem[]> {
    try {
        const db = await openDb();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_OUTBOX, "readonly");
            const req = tx.objectStore(STORE_OUTBOX).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    } catch {
        return [];
    }
}

export async function dequeueOutbox(id: string): Promise<void> {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_OUTBOX, "readwrite");
        tx.objectStore(STORE_OUTBOX).delete(id);
    } catch (err) {
        console.error("Failed to dequeue item:", err);
    }
}

export async function syncOutbox(): Promise<{ syncedCount: number; errors: number }> {
    if (typeof window === "undefined" || !navigator.onLine) {
        return { syncedCount: 0, errors: 0 };
    }

    const items = await getOutbox();
    if (items.length === 0) return { syncedCount: 0, errors: 0 };

    let syncedCount = 0;
    let errors = 0;

    for (const item of items) {
        try {
            const endpoint = item.type === "transaction" ? "/api/transactions" : "/api/todos";
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(item.payload),
            });

            if (res.ok || res.status === 409) {
                await dequeueOutbox(item.id);
                syncedCount++;
            } else {
                errors++;
            }
        } catch {
            errors++;
            break; // Stop loop if network drops mid-sync
        }
    }

    return { syncedCount, errors };
}
