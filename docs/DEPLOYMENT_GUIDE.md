# Deployment Guide — Transit Logistic

This guide explains how to deploy the **transit-logistic** monorepo in production.

---

## 1. Which app is the frontend?

| Item | Value |
|------|-------|
| **App path** | `apps/web` |
| **Package name** | `@transit-logistic/web` |
| **Framework** | Next.js 15 (App Router) + React 19 + next-intl |
| **Default local port** | `3000` |
| **Build command** | `pnpm --filter @transit-logistic/web build` |
| **Start command (Node host)** | `pnpm --filter @transit-logistic/web start` |

The frontend is a **client-heavy Next.js app**. It calls the API using `NEXT_PUBLIC_API_URL` (see `apps/web/src/lib/api.ts`). It has **no Next.js API routes** — all business logic lives in the NestJS API.

---

## 2. Which app is the API / backend?

| Item | Value |
|------|-------|
| **App path** | `apps/api` |
| **Package name** | `@transit-logistic/api` |
| **Framework** | NestJS 11 on Node.js + Express |
| **Default local port** | `3001` |
| **API prefix** | `/api/v1` |
| **Build command** | `pnpm --filter @transit-logistic/shared build && pnpm --filter @transit-logistic/api exec prisma generate && pnpm --filter @transit-logistic/api build` |
| **Start command** | `pnpm --filter @transit-logistic/api run start:prod` |

**Also required (not inside either app folder):**

| Service | Purpose |
|---------|---------|
| **PostgreSQL** | Primary database (Prisma) |
| **Redis** | Live GPS tracking cache |

**Shared package:** `packages/shared` must be built before the API and web apps.

---

## 3. Required environment variables

### Frontend — Vercel (`apps/web`)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | **Yes** | API origin only — **no** `/api/v1` suffix | `https://api.yourdomain.com` |

> `NEXT_PUBLIC_*` values are baked in at **build time**. Redeploy after changing them.

Optional (in `.env.example` but app default locale comes from `@transit-logistic/shared`):

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_DEFAULT_LOCALE` | Default is `en`; Arabic routes use `/ar/...` |

---

### Backend — Render / Railway (`apps/api`)

#### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Must be `production` | `production` |
| `API_PORT` | Port the API listens on | On Railway: `${{PORT}}` · On Render: use Render's `PORT` env |
| `DATABASE_URL` | PostgreSQL connection string | From managed Postgres plugin |
| `REDIS_HOST` | Redis hostname | From Redis plugin |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | From Redis plugin |
| `JWT_ACCESS_SECRET` | Random secret (~48 bytes) | Generate locally once |
| `JWT_REFRESH_SECRET` | Random secret (~48 bytes) | Generate locally once |
| `CORS_ORIGIN` | Frontend URL(s), comma-separated | `https://app.yourdomain.com` |
| `WEB_APP_URL` | Frontend base URL (payments, emails) | `https://app.yourdomain.com` |
| `PAYMENT_PROVIDER` | `mock` \| `thawani` \| `myfatoorah` \| `stripe` | `thawani` for production |

Generate JWT secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

#### Recommended

| Variable | Description |
|----------|-------------|
| `JWT_ACCESS_EXPIRES_IN` | Default `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Default `7d` |
| `RESEND_API_KEY` | Email via Resend |
| `EMAIL_FROM` | e.g. `Transit Logistic <noreply@yourdomain.com>` |
| `TRACKING_GEOFENCE_RADIUS_M` | Default `500` |
| `TRACKING_LIVE_CACHE_TTL_S` | Default `86400` |

#### Payment provider (set one block matching `PAYMENT_PROVIDER`)

**Thawani**

| Variable |
|----------|
| `THAWANI_SECRET_KEY` |
| `THAWANI_PUBLISHABLE_KEY` |
| `THAWANI_WEBHOOK_SECRET` |
| `THAWANI_BASE_URL` (UAT or production) |

**MyFatoorah**

| Variable |
|----------|
| `MYFATOORAH_API_KEY` |
| `MYFATOORAH_BASE_URL` |

**Stripe**

| Variable |
|----------|
| `STRIPE_SECRET_KEY` |
| `STRIPE_WEBHOOK_SECRET` |

#### Webhook URL (register in payment dashboard)

```
https://api.yourdomain.com/api/v1/payments/webhooks/<provider>
```

---

## 4. Can this be deployed on Vercel (frontend) + Render/Railway (backend)?

**Yes.** This is the recommended split for this repository.

| Component | Vercel | Render | Railway |
|-----------|--------|--------|---------|
| **Frontend** (`apps/web`) | ✅ Best fit | ⚠️ Possible but not ideal for Next.js | ⚠️ Possible |
| **API** (`apps/api`) | ❌ No — needs always-on Node + WebSockets | ✅ Web Service | ✅ Service |
| **PostgreSQL** | ❌ | ✅ Managed Postgres | ✅ Plugin |
| **Redis** | ❌ | ✅ Managed Redis | ✅ Plugin |

**Why not everything on Vercel?**

- The NestJS API is a **long-running Node server** with Socket.IO, file uploads, and payment webhooks.
- Vercel is for the Next.js frontend only.

**Render vs Railway for backend:** Both work. Use either for the API + Postgres + Redis. Steps below show both options where they differ.

---

## 5. Step-by-step deployment

### Architecture

```
Users → Vercel (apps/web) → HTTPS → Render or Railway (apps/api)
                                          ├── PostgreSQL
                                          └── Redis
```

Suggested domains:

| Subdomain | Host |
|-----------|------|
| `app.yourdomain.com` | Vercel |
| `api.yourdomain.com` | Render or Railway |

---

### Phase A — Database & Redis

#### Option A: Railway

1. Create a project at [railway.app](https://railway.app).
2. **+ New → Database → PostgreSQL** — note `DATABASE_URL`.
3. **+ New → Database → Redis** — note host, port, password.

#### Option B: Render

1. Create a project at [render.com](https://render.com).
2. **New → PostgreSQL** — copy **Internal Database URL**.
3. **New → Redis** — copy connection details.

---

### Phase B — Deploy the API (backend)

#### Railway

1. **+ New → GitHub Repo** → select `transit-logistic`.
2. **Root directory:** repository root `/`.
3. **Build command:**

   ```bash
   pnpm install --frozen-lockfile && pnpm --filter @transit-logistic/shared build && pnpm --filter @transit-logistic/api exec prisma generate && pnpm --filter @transit-logistic/api build
   ```

4. **Start command:**

   ```bash
   pnpm --filter @transit-logistic/api run start:prod
   ```

5. **Variables:** link `DATABASE_URL` from Postgres; set Redis vars; set all [required API variables](#backend--render--railway-appsapi).

   ```env
   NODE_ENV=production
   API_PORT=${{PORT}}
   CORS_ORIGIN=https://your-app.vercel.app
   WEB_APP_URL=https://your-app.vercel.app
   ```

6. **Networking → Generate Domain** (e.g. `xxx.up.railway.app`).
7. **Health check path:** `/api/v1/health/live`

#### Render

1. **New → Web Service** → connect GitHub repo.
2. **Root directory:** leave as repo root.
3. **Runtime:** Node.
4. **Build command:** same as Railway above.
5. **Start command:** same as Railway above.
6. Add environment variables (use Render's `PORT` for `API_PORT`).
7. **Health check path:** `/api/v1/health/live`

---

### Phase C — Run database migrations

Run once after Postgres is available:

```bash
pnpm --filter @transit-logistic/api exec prisma migrate deploy
```

**Railway CLI:**

```bash
railway link
railway run pnpm --filter @transit-logistic/api exec prisma migrate deploy
```

**Render:** use Shell in the dashboard or a one-off job with the same command.

**Optional — seed admin user (first deploy only):**

```bash
pnpm --filter @transit-logistic/api exec prisma db seed
```

Creates `admin@transit.dev` / `Admin1234` — change passwords before public launch.

---

### Phase D — Deploy the frontend (Vercel)

1. Import the repo at [vercel.com](https://vercel.com).
2. **Framework:** Next.js.
3. **Root Directory:** `apps/web`
4. **Enable:** “Include source files outside of Root Directory” (needed for `packages/shared`).
5. **Install Command:**

   ```bash
   cd ../.. && pnpm install --frozen-lockfile
   ```

6. **Build Command:**

   ```bash
   cd ../.. && pnpm --filter @transit-logistic/shared build && pnpm --filter @transit-logistic/web build
   ```

7. **Environment variable (Production):**

   ```env
   NEXT_PUBLIC_API_URL=https://api.yourdomain.com
   ```

   Use the Railway/Render API URL until custom domain is ready.

8. **Deploy.**

9. Update API `CORS_ORIGIN` and `WEB_APP_URL` to your Vercel URL, then redeploy the API.

---

### Phase E — Custom domains & SSL

| Host | Platform | Action |
|------|----------|--------|
| `app.yourdomain.com` | Vercel | Add domain → set DNS CNAME |
| `api.yourdomain.com` | Render/Railway | Add custom domain → set DNS CNAME |

Both platforms provide **automatic HTTPS**. Use `https://` in all env vars.

After domains are live, update:

**Vercel:**

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

**API:**

```env
CORS_ORIGIN=https://app.yourdomain.com
WEB_APP_URL=https://app.yourdomain.com
```

Redeploy both.

---

### Phase F — Verify production

```bash
# API health
curl https://api.yourdomain.com/api/v1/health/live
curl https://api.yourdomain.com/api/v1/health

# Smoke script (optional)
API_URL=https://api.yourdomain.com/api/v1 WEB_URL=https://app.yourdomain.com node scripts/verify-production.mjs
```

**Browser checks:**

- `https://app.yourdomain.com/ar/login`
- `https://app.yourdomain.com/ar/admin/dashboard`
- `https://app.yourdomain.com/ar/track`

Confirm DevTools → Network shows requests to your API URL, not `localhost:3001`.

---

## Quick reference

| Item | Value |
|------|-------|
| Frontend app | `apps/web` |
| Backend app | `apps/api` |
| Node version | ≥ 20 |
| Package manager | pnpm 9.15.9 |
| Prod migrate | `prisma migrate deploy` |
| API health | `GET /api/v1/health/live` |

---

## Production checklist

- [ ] PostgreSQL + Redis running
- [ ] `prisma migrate deploy` completed
- [ ] JWT secrets are unique (not from `.env.example`)
- [ ] `CORS_ORIGIN` matches Vercel URL exactly
- [ ] `NEXT_PUBLIC_API_URL` set and Vercel redeployed
- [ ] `PAYMENT_PROVIDER` is not `mock` for public production
- [ ] Payment webhooks registered on API HTTPS URL
- [ ] Default seed passwords changed or removed
- [ ] **Note:** API stores uploads on local disk (`uploads/`) — ephemeral on Render/Railway; plan S3/R2 for long-term document storage

---

## Related docs

- [`docs/PRODUCTION_DEPLOYMENT.md`](./PRODUCTION_DEPLOYMENT.md) — detailed Vercel + Railway guide
- [`docs/HANDOVER_REPORT_AR.md`](./HANDOVER_REPORT_AR.md) — Arabic feature overview and local run
- [`apps/api/.env.example`](../apps/api/.env.example) — full API env template
- [`apps/web/.env.example`](../apps/web/.env.example) — frontend env template
