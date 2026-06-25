# Truck Marketplace API

Base path: `/api/v1`

## Public (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/marketplace/trucks` | Browse approved listings (filters: search, category, vehicleType, country, crossBorder, refrigerated, minCapacityKg, maxCapacityKg, minPrice, maxPrice, minRating, featured, page, limit, sort) |
| GET | `/marketplace/trucks/:slug` | Truck profile + reviews; increments view count |
| GET | `/marketplace/home` | Home sections: featured, recent, topRated, premiumFleets |

## Customer (JWT, role: customer)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/marketplace/trucks/:listingId/quotes` | Request quotation |
| GET | `/marketplace/quotes/mine` | List own quote requests |
| POST | `/marketplace/trucks/:listingId/reviews` | Submit multi-category review |

## Fleet owner (JWT, role: fleet_owner)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/fleet/marketplace/trucks` | Create listing |
| GET | `/fleet/marketplace/trucks` | List own listings |
| GET | `/fleet/marketplace/trucks/:id` | Get listing detail |
| PATCH | `/fleet/marketplace/trucks/:id` | Update listing |
| POST | `/fleet/marketplace/trucks/:id/submit` | Submit for admin approval |
| POST | `/fleet/marketplace/trucks/:id/cover` | Set cover image URL |
| GET | `/marketplace/quotes/fleet` | Quote requests for fleet trucks |
| PATCH | `/marketplace/quotes/:id/respond` | Respond to quote |

## Admin (JWT, role: admin)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/marketplace/metrics` | Dashboard metrics |
| GET | `/admin/marketplace/trucks?status=` | List listings by status |
| POST | `/admin/marketplace/trucks/:id/approve` | Approve listing |
| POST | `/admin/marketplace/trucks/:id/reject` | Reject listing |
| POST | `/admin/marketplace/trucks/:id/suspend` | Suspend listing |
| PATCH | `/admin/marketplace/trucks/:id` | Feature / enable listing |
| PATCH | `/admin/marketplace/reviews/:id/visibility` | Moderate review |

## Data models

- **TruckListing** — marketplace profile (specs, gallery, status, ratings)
- **TruckListingImage** — gallery images with cover flag
- **TruckQuoteRequest** — customer quotation requests
- **TruckReview** — communication, speed, condition, professionalism, overall scores
- **MarketplaceView** — analytics view events

## Listing workflow

`draft` → `pending_approval` (fleet submit) → `approved` / `rejected` (admin) → `suspended` (admin)

Only `approved` + `isListingEnabled` listings appear in public browse.
