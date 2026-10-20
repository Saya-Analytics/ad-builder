import 'server-only';

// Short-lived in-memory cache for Google reads. Google allows 60 Sheets reads a minute per
// service account, and one page view needs several, so repeated views reuse recent reads.
// Memory only (per server instance); nothing is stored anywhere else.

interface Entry {
  at: number;
  value: Promise<unknown>;
}

const g = globalThis as unknown as { __adBuilderCache?: Map<string, Entry> };
const store = (g.__adBuilderCache ??= new Map());

export async function memo<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = load();
  store.set(key, { at: Date.now(), value });
  // A failed read is not kept, so the next view tries again.
  value.catch(() => {
    if (store.get(key)?.value === value) store.delete(key);
  });
  return value;
}

/** Drops cached reads whose key contains `part` (a sheet id), or everything. */
export function bust(part?: string) {
  if (!part) return store.clear();
  for (const key of store.keys()) if (key.includes(part)) store.delete(key);
}
