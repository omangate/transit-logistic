#!/usr/bin/env bash
set -euo pipefail

echo "[netlify-build] Installing dependencies..."
pnpm install --ignore-scripts

echo "[netlify-build] Building shared package..."
pnpm --filter @transit-logistic/shared build

echo "[netlify-build] Generating Prisma client..."
pnpm --filter @transit-logistic/api exec prisma generate --schema=prisma/schema.prisma

echo "[netlify-build] Building API..."
pnpm --filter @transit-logistic/api build

if [ -n "${DATABASE_URL:-}" ]; then
  echo "[netlify-build] Running Prisma migrations..."
  if ! pnpm --filter @transit-logistic/api exec prisma migrate deploy --schema=prisma/schema.prisma; then
    echo "[netlify-build] WARNING: prisma migrate deploy failed"
  fi

  if [ "${NETLIFY_TEST_SEED:-true}" = "true" ]; then
    echo "[netlify-build] Seeding test database..."
    SEED_DEMO_ACCOUNTS=true pnpm --filter @transit-logistic/api exec ts-node prisma/seed.ts || echo "[netlify-build] Seed skipped or failed (non-fatal)"
  fi
elif [ -n "${NETLIFY_DATABASE_URL:-}" ] || [ -n "${NETLIFY_DB_URL:-}" ]; then
  export DATABASE_URL="${NETLIFY_DATABASE_URL:-${NETLIFY_DB_URL}}"
  echo "[netlify-build] Using Netlify-injected database URL"
  echo "[netlify-build] Running Prisma migrations..."
  if ! pnpm --filter @transit-logistic/api exec prisma migrate deploy --schema=prisma/schema.prisma; then
    echo "[netlify-build] WARNING: prisma migrate deploy failed"
  fi

  if [ "${NETLIFY_TEST_SEED:-true}" = "true" ]; then
    echo "[netlify-build] Seeding test database..."
    SEED_DEMO_ACCOUNTS=true pnpm --filter @transit-logistic/api exec ts-node prisma/seed.ts || echo "[netlify-build] Seed skipped or failed (non-fatal)"
  fi
else
  echo "[netlify-build] DATABASE_URL not set — skipping migrate/seed"
fi

echo "[netlify-build] Building web app..."
pnpm --filter @transit-logistic/web build

echo "[netlify-build] Done."
