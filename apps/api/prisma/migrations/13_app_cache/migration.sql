-- Postgres-backed cache for Netlify test (replaces Redis for TTL keys)
CREATE TABLE IF NOT EXISTS "app_cache" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "app_cache_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "app_cache_expires_at_idx" ON "app_cache" ("expires_at");
