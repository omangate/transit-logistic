# Production Deployment Guide

**Stack:** Vercel (frontend) · Railway (API + PostgreSQL + Redis)  
**Repository:** `transit-logistic` (pnpm monorepo)  
**Last updated:** June 2026

This guide deploys the project without code changes. It reflects the current configuration in `apps/api`, `apps/web`, and `packages/shared`.

---

## Architecture overview

```
                    ┌─────────────────────────────────┐
                    │  Users (HTTPS)                  │
                    └───────────────┬─────────────────┘
                                    │
                    ┌───────────────▼─────────────────┐
                    │  Vercel                         │
                    │  apps/web — Next.js 15          │
                    │  https://app.yourdomain.com     │
                    └───────────────┬─────────────────┘
                                    │ REST (JWT)
                    ┌───────────────▼─────────────────┐
                    │  Railway — NestJS API           │
                    │  apps/api                       │
                    │  https://api.yourdomain.com     │
                    └───┬─────────────────────┬───────┘
                        │                     │
            ┌───────────▼──────────┐  ┌───────▼──────────┐
            │  Railway PostgreSQL  │  │  Railway Redis   │
            │  (Prisma)            │  │  (GPS live cache)│
            └──────────────────────┘  └──────────────────┘
```

| Component | Location | Host |
|-----------|----------|------|
| Frontend | `apps/web` | Vercel |
| Backend API | `apps/api` | Railway (Node service) |
| PostgreSQL | Prisma datasource | Railway PostgreSQL plugin |
| Redis | `ioredis` via `REDIS_HOST/PORT/PASSWORD` | Railway Redis plugin |

---

## 1. Required environment variables

### 1.1 Railway — PostgreSQL (auto-injected)

When you add PostgreSQL to the Railway project and **link** it to the API service, Railway sets:

| Variable | Source | Notes |
|----------|--------|-------|
| `DATABASE_URL` | Railway PostgreSQL | Prisma connection string; use as-is |

No manual editing required if the service is linked.

---

### 1.2 Railway — Redis (map from plugin)

The API reads **host/port/password** separately (`apps/api/src/config/configuration.ts`). Railway Redis typically exposes `REDIS_URL` and/or individual variables. Map them on the **API service**:

| API variable | Railway source | Example |
|--------------|----------------|---------|
| `REDIS_HOST` | Redis service host / private hostname | `redis.railway.internal` or public host |
| `REDIS_PORT` | Redis service port | `6379` |
| `REDIS_PASSWORD` | Redis service password | (from Railway dashboard) |

> If Railway only provides `REDIS_URL` (`redis://default:password@host:port`), parse it manually into the three variables above, or set them from the Redis service **Variables** tab in Railway.

---

### 1.3 Railway — API service (required)

Set these on the **NestJS API** Railway service.

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NODE_ENV` | Yes | Must be `production` | `production` |
| `API_PORT` | Yes | **Must match Railway `PORT`** | `${{PORT}}` (Railway variable reference) |
| `DATABASE_URL` | Yes | From linked PostgreSQL | (auto) |
| `REDIS_HOST` | Yes | Redis hostname | (from Redis plugin) |
| `REDIS_PORT` | Yes | Redis port | `6379` |
| `REDIS_PASSWORD` | Yes | Redis password | (from Redis plugin) |
| `JWT_ACCESS_SECRET` | Yes | Min ~48 random bytes | Generate (see below) |
| `JWT_REFRESH_SECRET` | Yes | Min ~48 random bytes | Generate (see below) |
| `JWT_ACCESS_EXPIRES_IN` | No | Access token TTL | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | No | Refresh token TTL | `7d` |
| `CORS_ORIGIN` | Yes | Frontend origin(s), comma-separated | `https://app.yourdomain.com` |
| `WEB_APP_URL` | Yes | Public frontend base URL (payments, emails) | `https://app.yourdomain.com` |
| `PAYMENT_PROVIDER` | Yes | `mock` \| `thawani` \| `myfatoorah` \| `stripe` | `thawani` |
| `RESEND_API_KEY` | Recommended | Email delivery | `re_...` |
| `EMAIL_FROM` | Recommended | Sender address | `Transit Logistic <noreply@yourdomain.com>` |
| `TRACKING_GEOFENCE_RADIUS_M` | No | Geofence radius (meters) | `500` |
| `TRACKING_LIVE_CACHE_TTL_S` | No | Redis TTL for live GPS | `86400` |
| `TRACKING_DEVIATION_THRESHOLD_M` | No | Route deviation alert (meters) | `3000` |
| `UPLOAD_DIR` | No | Local upload folder | `uploads` (see checklist — ephemeral on Railway) |

**Generate JWT secrets (run locally once):**

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Run twice — one value for `JWT_ACCESS_SECRET`, one for `JWT_REFRESH_SECRET`.

---

### 1.4 Railway — API service (payment provider)

Set only the block matching `PAYMENT_PROVIDER`.

#### Thawani (default in `.env.example`)

| Variable | Required | Example |
|----------|----------|---------|
| `THAWANI_SECRET_KEY` | Yes | (from Thawani dashboard) |
| `THAWANI_PUBLISHABLE_KEY` | Yes | (from Thawani dashboard) |
| `THAWANI_WEBHOOK_SECRET` | Yes | (from Thawani webhook config) |
| `THAWANI_BASE_URL` | No | UAT: `https://uatcheckout.thawani.om/api/v1` · Prod: use Thawani production URL |

#### MyFatoorah

| Variable | Required | Example |
|----------|----------|---------|
| `MYFATOORAH_API_KEY` | Yes | (from MyFatoorah) |
| `MYFATOORAH_BASE_URL` | No | Test: `https://apitest.myfatoorah.com` · Prod: production API URL |

#### Stripe

| Variable | Required | Example |
|----------|----------|---------|
| `STRIPE_SECRET_KEY` | Yes | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Yes | `whsec_...` |

#### Mock (development/staging only — not for public production)

| Variable | Value |
|----------|-------|
| `PAYMENT_PROVIDER` | `mock` |

---

### 1.5 Vercel — Frontend (required)

Set in **Project → Settings → Environment Variables** (Production, Preview, Development as needed).

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Yes | Railway API **origin only** (no `/api/v1` suffix) | `https://api.yourdomain.com` |

The web client appends `/api/v1` automatically (`apps/web/src/lib/api.ts`).

> `NEXT_PUBLIC_*` variables are embedded at **build time**. Redeploy after changing them.

Optional (listed in `apps/web/.env.example` but not wired in app code — default locale comes from `@transit-logistic/shared`):

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_DEFAULT_LOCALE` | App default locale is `en`; Arabic is at `/ar/...` |

---

### 1.6 Variable summary diagram

```
Vercel                          Railway API
────────                        ───────────
NEXT_PUBLIC_API_URL ──────────► https://api.yourdomain.com
                                │
                                ├── DATABASE_URL ◄── PostgreSQL (linked)
                                ├── REDIS_HOST/PORT/PASSWORD ◄── Redis (linked)
                                ├── CORS_ORIGIN = Vercel URL
                                └── WEB_APP_URL = Vercel URL
```

---

## 2. Railway deployment steps

### Prerequisites

- [Railway](https://railway.app) account
- GitHub/GitLab repo connected to Railway
- Node.js ≥ 20, pnpm ≥ 9 (matches `package.json` engines)

### Step 1 — Create a Railway project

1. **New Project** → **Deploy from GitHub repo** → select `transit-logistic`.
2. You will add three services: **PostgreSQL**, **Redis**, and **API**.

### Step 2 — Add PostgreSQL

1. **+ New** → **Database** → **PostgreSQL**.
2. Wait until the service is healthy.
3. Note the **`DATABASE_URL`** in the PostgreSQL service **Variables** tab.

### Step 3 — Add Redis

1. **+ New** → **Database** → **Redis**.
2. Copy **host**, **port**, and **password** from the Redis service variables.
3. You will assign `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` on the API service.

### Step 4 — Configure the API service

Use the repo root as the service root (monorepo). Either convert the auto-detected service or add a **new Empty Service** linked to the same repo.

**Settings → General**

| Setting | Value |
|---------|-------|
| Root directory | `/` (repository root) |
| Watch paths | `apps/api/**`, `packages/shared/**` (optional) |

**Settings → Build**

| Setting | Value |
|---------|-------|
| Builder | Nixpacks (default) or Dockerfile if you add one later |

**Custom build command:**

```bash
pnpm install --frozen-lockfile && pnpm --filter @transit-logistic/shared build && pnpm --filter @transit-logistic/api exec prisma generate && pnpm --filter @transit-logistic/api build
```

**Custom start command:**

```bash
pnpm --filter @transit-logistic/api run start:prod
```

> `start:prod` runs `node dist/main` from `apps/api` (see `apps/api/package.json`).

**Settings → Deploy → Healthcheck (optional but recommended)**

| Setting | Value |
|---------|-------|
| Health check path | `/api/v1/health/live` |
| Health check timeout | `300` seconds (first deploy + migrations) |

### Step 5 — Link PostgreSQL to API

1. Open the **API service** → **Variables**.
2. **+ New Variable** → **Add reference** → select PostgreSQL → `DATABASE_URL`.

### Step 6 — Set API environment variables

Add all variables from [Section 1.3](#13-railway--api-service-required) and [1.4](#14-railway--api-service-payment-provider).

**Critical:**

```env
NODE_ENV=production
API_PORT=${{PORT}}
```

Railway injects `PORT`; the app reads `API_PORT` (not `PORT` directly). Using `${{PORT}}` keeps them in sync.

**Example production values (replace domains):**

```env
CORS_ORIGIN=https://app.yourdomain.com
WEB_APP_URL=https://app.yourdomain.com
PAYMENT_PROVIDER=thawani
```

### Step 7 — Run database migrations

Run **once** before or immediately after the first successful API deploy (see [Section 4](#4-database-migration-commands)).

Options:

- **Railway CLI** (recommended):

  ```bash
  railway link
  railway run --service api pnpm --filter @transit-logistic/api exec prisma migrate deploy
  ```

- **One-off shell** in Railway dashboard → API service → **Shell**.

### Step 8 — Seed admin user (first deploy only)

The seed script creates admin, fleet, and driver test accounts (`apps/api/prisma/seed.ts`).

```bash
railway run --service api pnpm --filter @transit-logistic/api exec prisma db seed
```

**Production recommendation:** run seed once, then **change or disable** default passwords (`admin@transit.dev`, etc.) before public launch.

### Step 9 — Generate public API URL

1. API service → **Settings** → **Networking** → **Generate Domain**.
2. Railway provides `https://<service-name>.up.railway.app`.
3. Use this as `NEXT_PUBLIC_API_URL` on Vercel until a custom domain is attached.

### Step 10 — Verify API

```bash
curl https://<your-railway-api-domain>/api/v1/health/live
# Expected: {"status":"ok"}

curl https://<your-railway-api-domain>/api/v1/health
# Expected: JSON with database + redis status "up"
```

---

## 3. Vercel deployment steps

### Prerequisites

- [Vercel](https://vercel.com) account
- Same Git repository connected to Vercel
- Railway API deployed and reachable over HTTPS

### Step 1 — Import project

1. **Add New…** → **Project** → import `transit-logistic`.
2. **Framework Preset:** Next.js (auto-detected).

### Step 2 — Monorepo configuration

| Setting | Value |
|---------|-------|
| **Root Directory** | `apps/web` |
| **Include source files outside of Root Directory** | **Enabled** (required for `packages/shared`) |

### Step 3 — Build settings

| Setting | Value |
|---------|-------|
| **Install Command** | `cd ../.. && pnpm install --frozen-lockfile` |
| **Build Command** | `cd ../.. && pnpm --filter @transit-logistic/shared build && pnpm --filter @transit-logistic/web build` |
| **Output Directory** | (default — `.next`) |
| **Node.js Version** | `20.x` |

Alternatively, set **Root Directory** to repository root and use:

| Setting | Value |
|---------|-------|
| **Build Command** | `pnpm --filter @transit-logistic/shared build && pnpm --filter @transit-logistic/web build` |
| **Output Directory** | `apps/web/.next` |

The first approach (root = `apps/web`) is usually simpler on Vercel.

### Step 4 — Environment variables

Add for **Production** (and Preview if you use staging APIs):

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

Use the Railway-generated URL until the custom API domain is live.

### Step 5 — Deploy

1. Click **Deploy**.
2. Wait for the build to finish.
3. Open the Vercel URL: `https://<project>.vercel.app`.

### Step 6 — Smoke test frontend

| URL | Expected |
|-----|----------|
| `https://<vercel-domain>/ar` | Arabic landing page |
| `https://<vercel-domain>/ar/login` | Login form loads |
| `https://<vercel-domain>/ar/track` | Public tracking search |

Open browser DevTools → Network. Confirm API calls go to `NEXT_PUBLIC_API_URL`, not `localhost:3001`.

### Step 7 — Update Railway CORS

After Vercel gives you a URL, set on Railway API:

```env
CORS_ORIGIN=https://<project>.vercel.app
WEB_APP_URL=https://<project>.vercel.app
```

Redeploy the API service (or restart) so CORS picks up the new values.

---

## 4. Database migration commands

All commands assume repository root and Railway-linked `DATABASE_URL`.

### Production migrate (apply pending migrations)

```bash
pnpm --filter @transit-logistic/api exec prisma migrate deploy
```

Via Railway CLI:

```bash
railway run --service api pnpm --filter @transit-logistic/api exec prisma migrate deploy
```

### Generate Prisma client (included in build)

```bash
pnpm --filter @transit-logistic/api exec prisma generate
```

### Check migration status

```bash
pnpm --filter @transit-logistic/api exec prisma migrate status
```

### Seed (first-time / staging only)

```bash
pnpm --filter @transit-logistic/api exec prisma db seed
```

Creates:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@transit.dev` | `Admin1234` |
| Fleet owner | `fleet@transit.dev` | `Fleet1234` |
| Driver | `driver@transit.dev` | `Driver1234` |

### Existing migrations in repo

| Migration | Path |
|-----------|------|
| Initial schema | `apps/api/prisma/migrations/0_init` |
| Payments | `apps/api/prisma/migrations/1_add_payments` |

> **Do not** run `prisma migrate dev` on production. Use `migrate deploy` only.

### Suggested deploy order

1. Deploy PostgreSQL (Railway).
2. Run `prisma migrate deploy`.
3. Run `prisma db seed` (optional, first time).
4. Deploy API with env vars set.
5. Deploy Vercel frontend.
6. Verify end-to-end.

---

## 5. Production domain configuration

### Recommended DNS layout

| Subdomain | Points to | Purpose |
|-----------|-----------|---------|
| `app.yourdomain.com` | Vercel | Next.js frontend |
| `api.yourdomain.com` | Railway | NestJS API |

### Vercel — custom domain

1. Vercel project → **Settings** → **Domains**.
2. Add `app.yourdomain.com` (and optionally `yourdomain.com` with redirect to `app.`).
3. Vercel shows DNS records (usually `CNAME` → `cname.vercel-dns.com` or A records for apex).
4. Add records at your DNS provider.
5. Wait for **Valid Configuration** in Vercel.

### Railway — custom domain

1. API service → **Settings** → **Networking** → **Custom Domain**.
2. Add `api.yourdomain.com`.
3. Railway shows a **CNAME** target (e.g. `xxxx.up.railway.app`).
4. At DNS provider:

   ```
   Type: CNAME
   Name: api
   Value: <railway-provided-target>
   ```

5. Wait for Railway to show the domain as active.

### Update environment variables after domains are live

**Railway (API):**

```env
CORS_ORIGIN=https://app.yourdomain.com
WEB_APP_URL=https://app.yourdomain.com
```

If you need both apex and www:

```env
CORS_ORIGIN=https://app.yourdomain.com,https://www.yourdomain.com
```

**Vercel (frontend):**

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

**Redeploy both** after changing domains or public env vars.

### Payment provider callback URLs

Configure in your payment dashboard (Thawani / MyFatoorah / Stripe):

| Purpose | URL pattern |
|---------|-------------|
| Success redirect | `https://app.yourdomain.com/ar/shipments/{id}/payment/success` (locale may vary) |
| Cancel redirect | `https://app.yourdomain.com/ar/shipments/{id}/payment/cancel` |
| Webhook | `https://api.yourdomain.com/api/v1/payments/webhooks/thawani` |

Replace `thawani` with `stripe` or `myfatoorah` as appropriate.

---

## 6. CORS configuration

The API enables CORS in `apps/api/src/main.ts`:

- Allowed origins come from `CORS_ORIGIN` (comma-separated list).
- `credentials: true` — cookies/authorization headers from the browser are allowed.
- In **production**, only listed origins are accepted (localhost is **not** auto-allowed).

### Rules

| Rule | Detail |
|------|--------|
| Scheme | Always `https://` in production |
| No trailing slash | `https://app.yourdomain.com` not `https://app.yourdomain.com/` |
| Multiple origins | Comma-separated, no spaces: `https://a.com,https://b.com` |
| Preview deployments | Add each Vercel preview URL to `CORS_ORIGIN`, or use a staging API with staging CORS |

### Example

```env
# Railway API
CORS_ORIGIN=https://app.yourdomain.com
WEB_APP_URL=https://app.yourdomain.com
```

### Verify CORS

From browser console on `https://app.yourdomain.com`:

```javascript
fetch('https://api.yourdomain.com/api/v1/health/live', { credentials: 'include' })
  .then(r => r.json())
  .then(console.log);
```

Or check response headers on an API preflight (`OPTIONS`) request — `Access-Control-Allow-Origin` should match your frontend origin.

---

## 7. SSL configuration

Both Vercel and Railway terminate TLS automatically. **No manual certificate installation** is required for default setups.

| Layer | Provider | Notes |
|-------|----------|-------|
| Frontend HTTPS | Vercel | Auto Let's Encrypt for custom domains |
| API HTTPS | Railway | Auto TLS on `*.up.railway.app` and custom domains |
| HTTP → HTTPS | Both | Enable "Force HTTPS" / rely on default redirect behavior |
| WebSocket (Socket.IO) | Railway | Use `wss://` via `https://api.yourdomain.com` if clients connect later |
| Internal DB/Redis | Railway private network | TLS between API and plugins is handled by Railway networking |

### Requirements for production

1. **Never** use `http://` in `NEXT_PUBLIC_API_URL`, `CORS_ORIGIN`, or `WEB_APP_URL`.
2. Payment webhooks must use **`https://api.yourdomain.com/...`**.
3. Ensure DNS propagation completes before registering webhooks with payment providers.

### HSTS

Vercel enables HSTS on custom domains by default. Railway serves HTTPS on public endpoints. No app-level changes required.

---

## 8. Final checklist before launch

### Infrastructure

- [ ] PostgreSQL running on Railway and linked to API
- [ ] Redis running on Railway; `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` set on API
- [ ] `prisma migrate deploy` completed successfully
- [ ] API health check passes: `GET /api/v1/health` (database + redis **up**)
- [ ] API live check passes: `GET /api/v1/health/live`

### Security

- [ ] `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are unique, random, not from `.env.example`
- [ ] `NODE_ENV=production` on Railway API
- [ ] Default seed passwords changed or seed accounts removed/disabled
- [ ] `PAYMENT_PROVIDER` is **not** `mock` for public production
- [ ] No secrets committed to Git; all secrets in Railway/Vercel dashboards

### Domains & SSL

- [ ] Custom domain on Vercel (`app.yourdomain.com`) — SSL valid
- [ ] Custom domain on Railway (`api.yourdomain.com`) — SSL valid
- [ ] `NEXT_PUBLIC_API_URL=https://api.yourdomain.com` on Vercel
- [ ] Vercel project **redeployed** after setting `NEXT_PUBLIC_API_URL`

### CORS & URLs

- [ ] `CORS_ORIGIN` matches exact Vercel production URL(s)
- [ ] `WEB_APP_URL` matches Vercel production URL
- [ ] Payment success/cancel redirects work from provider checkout

### Payments

- [ ] Production payment keys configured (Thawani/MyFatoorah/Stripe)
- [ ] Webhook URL registered: `https://api.yourdomain.com/api/v1/payments/webhooks/<provider>`
- [ ] Test full flow: create shipment → pay → status becomes `pending_assignment`

### Email

- [ ] `RESEND_API_KEY` set
- [ ] `EMAIL_FROM` uses a verified domain in Resend
- [ ] Test payment/notification email delivery

### Frontend

- [ ] `/ar/login` — admin login redirects to `/ar/admin/dashboard`
- [ ] `/ar/register` and customer dashboard work
- [ ] `/ar/track/[reference]` — public tracking loads
- [ ] Admin shipment details — tracking map and copy-link work
- [ ] No browser requests to `localhost:3001`

### Backend features

- [ ] Driver GPS: `watchPosition` sends points during `picked_up` / `in_transit`
- [ ] Live tracking poll: customer shipment map updates
- [ ] File uploads: **note** — API stores files on local disk (`UPLOAD_DIR=uploads`). Railway filesystem is **ephemeral**; uploaded documents may be lost on redeploy. Plan object storage (S3/R2) for long-term production document retention.

### Monitoring & ops

- [ ] Railway deploy notifications enabled
- [ ] Vercel deployment notifications enabled
- [ ] Log access configured (Railway logs, Vercel runtime logs)
- [ ] Database backup strategy defined (Railway backups or external dump schedule)
- [ ] Run smoke script against production (optional):

  ```bash
  API_URL=https://api.yourdomain.com/api/v1 WEB_URL=https://app.yourdomain.com node scripts/verify-production.mjs
  ```

### Post-launch

- [ ] Remove or rotate `admin@transit.dev` / `Fleet1234` / `Driver1234` if still active
- [ ] Document on-call contacts and rollback procedure (Railway redeploy previous image, Vercel instant rollback)

---

## Quick reference

| Item | Value |
|------|-------|
| API base path | `/api/v1` |
| Health (live) | `GET /api/v1/health/live` |
| Health (full) | `GET /api/v1/health` |
| Web build | `pnpm --filter @transit-logistic/web build` |
| API build | `pnpm --filter @transit-logistic/api build` |
| Prod migrate | `prisma migrate deploy` |
| Package manager | pnpm 9 |
| Node version | ≥ 20 |

---

## Related docs

| File | Content |
|------|---------|
| `docs/HANDOVER_REPORT_AR.md` | Arabic handover — features, credentials, local run |
| `apps/api/.env.example` | Full API env template |
| `apps/web/.env.example` | Frontend env template |
| `infra/docker/docker-compose.yml` | Local PostgreSQL + Redis reference |

---

*This guide describes deployment using Vercel + Railway as requested. No repository code changes are required for the baseline deployment; file upload persistence and server-side admin route guards remain operational considerations for hardening after launch.*
