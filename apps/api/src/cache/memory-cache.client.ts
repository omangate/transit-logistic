import type { CacheLike } from './cache.types';

type Entry = { value: string; expiresAt: number };

export class MemoryCacheClient implements CacheLike {
  private readonly store = new Map<string, Entry>();

  private purgeExpired(key: string) {
    const entry = this.store.get(key);
    if (!entry) return;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
    }
  }

  private parseTtlSeconds(args: unknown[]): number {
    if (args[0] === 'EX' && typeof args[1] === 'number') return args[1];
    if (args[0] === 'EX' && typeof args[1] === 'string') return Number.parseInt(args[1], 10);
    return 86_400;
  }

  async get(key: string): Promise<string | null> {
    this.purgeExpired(key);
    return this.store.get(key)?.value ?? null;
  }

  async set(key: string, value: string, ...args: unknown[]): Promise<'OK'> {
    const ttlSeconds = this.parseTtlSeconds(args);
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.store.delete(key)) deleted += 1;
    }
    return deleted;
  }

  async ping(): Promise<'PONG'> {
    return 'PONG';
  }
}
