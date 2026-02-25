/**
 * Simple in-process TTL cache.
 * Survives across multiple requests within a warm Vercel lambda instance.
 * Keys auto-expire after `ttlMs` milliseconds.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key) as Entry<T> | undefined;
  if (!entry || Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function cacheSet<T>(key: string, value: T, ttlMs = 8_000): T {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function cacheDel(...keys: string[]) {
  keys.forEach((k) => store.delete(k));
}

export function cacheInvalidatePrefix(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function cacheClear() {
  store.clear();
}
