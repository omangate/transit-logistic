import type { PrismaService } from '../database/prisma.service';

import type { CacheLike } from './cache.types';

export class PostgresCacheClient implements CacheLike {
  private initialized = false;

  constructor(private readonly prisma: PrismaService) {}

  private async ensureTable() {
    if (this.initialized) return;
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "app_cache" (
        "key" TEXT NOT NULL,
        "value" TEXT NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        CONSTRAINT "app_cache_pkey" PRIMARY KEY ("key")
      );
    `);
    await this.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "app_cache_expires_at_idx" ON "app_cache" ("expires_at");
    `);
    this.initialized = true;
  }

  private parseTtlSeconds(args: unknown[]): number {
    if (args[0] === 'EX' && typeof args[1] === 'number') return args[1];
    if (args[0] === 'EX' && typeof args[1] === 'string') return Number.parseInt(args[1], 10);
    return 86_400;
  }

  async get(key: string): Promise<string | null> {
    await this.ensureTable();
    const rows = await this.prisma.$queryRaw<Array<{ value: string }>>`
      SELECT value FROM app_cache
      WHERE key = ${key} AND expires_at > NOW()
      LIMIT 1
    `;
    return rows[0]?.value ?? null;
  }

  async set(key: string, value: string, ...args: unknown[]): Promise<'OK'> {
    await this.ensureTable();
    const ttlSeconds = this.parseTtlSeconds(args);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await this.prisma.$executeRaw`
      INSERT INTO app_cache (key, value, expires_at)
      VALUES (${key}, ${value}, ${expiresAt})
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at
    `;
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    if (!keys.length) return 0;
    await this.ensureTable();
    let deleted = 0;
    for (const key of keys) {
      const count = await this.prisma.$executeRaw`
        DELETE FROM app_cache WHERE key = ${key}
      `;
      deleted += Number(count) || 0;
    }
    return deleted;
  }

  async ping(): Promise<'PONG'> {
    await this.ensureTable();
    await this.prisma.$queryRaw`SELECT 1`;
    return 'PONG';
  }
}
