# Transit Logistic

Multi-sided logistics platform for Oman (GCC-ready architecture). Monorepo: NestJS API, Next.js Web, PostgreSQL, Redis.

## Production

| Service | URL |
|---------|-----|
| API | https://transit-logistic-production.up.railway.app |
| Web | https://insightful-forgiveness-production-6c81.up.railway.app |

Health: `GET /api/v1/health/live` and `GET /api/v1/health` (DB + Redis).

## Local setup

```bash
pnpm install
pnpm docker:up          # PostgreSQL + Redis (optional)
pnpm db:migrate
pnpm --filter @transit-logistic/api exec prisma db seed
pnpm dev
```

- API: http://localhost:3001/api/v1  
- Web: http://localhost:3000  

## Environment variables (names only — never commit values)

### API

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Redis |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | JWT signing |
| `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | Token TTL |
| `CORS_ORIGIN`, `WEB_APP_URL` | CORS + password-reset links |
| `PORT` / `API_PORT` | Listen port (Railway: 8080) |
| `PAYMENT_PROVIDER` | `mock` (default dev), `thawani`, `stripe`, `myfatoorah` |
| `THAWANI_*` | Thawani credentials when enabled |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email (optional) |
| `STORAGE_PROVIDER` | `local` (default) or `s3` when configured |
| `UPLOAD_DIR` | Local upload root |
| `SEED_DEMO_ACCOUNTS` | Set `true` in production to seed demo users |
| `SEED_DEMO_PASSWORD` or `SEED_ADMIN_PASSWORD`, etc. | Demo account passwords |

### Web

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | API base URL |
| `WEB_APP_URL` | Canonical web URL |

## Demo / verification accounts

**Production:** Demo users are **not** seeded unless `SEED_DEMO_ACCOUNTS=true` and passwords are supplied via `SEED_*_PASSWORD` env vars. Passwords are never logged or committed.

**Development:** Seed creates `admin@transit.dev`, `fleet@transit.dev`, `driver@transit.dev`, `customer@transit.dev` with dev-only defaults documented locally.

**Production verification:**

```bash
VERIFY_ADMIN_PASSWORD=... VERIFY_FLEET_PASSWORD=... VERIFY_DRIVER_PASSWORD=... VERIFY_CUSTOMER_PASSWORD=... node scripts/verify-production.mjs
```

Or set `SEED_DEMO_PASSWORD` for all roles.

## Roles & major workflows

- **Customer:** Register → marketplace → favorites → quote → booking → shipment → payment (mock/Thawani)
- **Fleet owner:** List trucks → availability calendar → quote response → confirm booking → assign driver
- **Driver:** Active jobs → status updates → GPS tracking
- **Admin:** Dashboard, moderation, verification, payouts, support tickets

## Migrations

Forward-only Prisma migrations in `apps/api/prisma/migrations/`. Deploy with:

```bash
pnpm --filter @transit-logistic/api exec prisma migrate deploy
```

Never use `db push` or reset against production.

## Railway deployment

- Project linked to GitHub `main`; API health check `/health/live`, target port **8080**
- Run migrations on deploy; seed geography via one-off job when needed
- Redis and PostgreSQL via Railway service references (`${{Redis.REDISHOST}}`, etc.)

## Payment provider

Default mock provider for dev/CI. Set `PAYMENT_PROVIDER=thawani` and Thawani env vars to enable real checkout (Oman). Webhooks require `THAWANI_WEBHOOK_SECRET`.

## Production verification

```bash
pnpm verify:production
```

Verifies health, auth (when credentials provided), marketplace pagination, shipments, tracking, admin/fleet/driver flows, and web shell pages.
