-- Truck Marketplace module

CREATE TYPE "vehicle_category" AS ENUM ('light_truck', 'medium_truck', 'heavy_truck', 'trailer', 'van', 'specialized');
CREATE TYPE "truck_listing_status" AS ENUM ('draft', 'pending_approval', 'approved', 'rejected', 'suspended');
CREATE TYPE "truck_availability_status" AS ENUM ('available', 'busy', 'maintenance');
CREATE TYPE "quote_request_status" AS ENUM ('pending', 'responded', 'accepted', 'declined', 'expired');

ALTER TABLE "shipments" ADD COLUMN "truck_listing_id" UUID;
CREATE INDEX "shipments_truck_listing_id_idx" ON "shipments"("truck_listing_id");

CREATE TABLE "truck_listings" (
    "id" UUID NOT NULL,
    "fleet_owner_id" UUID NOT NULL,
    "vehicle_id" UUID,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "vehicle_category" "vehicle_category" NOT NULL,
    "vehicle_type" "vehicle_type" NOT NULL,
    "capacity_kg" DECIMAL(10,2),
    "capacity_cbm" DECIMAL(10,2),
    "length_m" DECIMAL(6,2),
    "width_m" DECIMAL(6,2),
    "height_m" DECIMAL(6,2),
    "cargo_type" "cargo_type" NOT NULL DEFAULT 'dry',
    "shipping_method" "shipping_method" NOT NULL DEFAULT 'standard',
    "cross_border_support" BOOLEAN NOT NULL DEFAULT false,
    "refrigerated_support" BOOLEAN NOT NULL DEFAULT false,
    "hazardous_materials_support" BOOLEAN NOT NULL DEFAULT false,
    "insurance_coverage" BOOLEAN NOT NULL DEFAULT false,
    "operating_countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "cover_image_url" TEXT,
    "availability_status" "truck_availability_status" NOT NULL DEFAULT 'available',
    "listing_status" "truck_listing_status" NOT NULL DEFAULT 'draft',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_listing_enabled" BOOLEAN NOT NULL DEFAULT true,
    "price_per_km" DECIMAL(10,2),
    "avg_rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "completed_deliveries" INTEGER NOT NULL DEFAULT 0,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "rejection_reason" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "truck_listings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "truck_listings_slug_key" ON "truck_listings"("slug");
CREATE UNIQUE INDEX "truck_listings_vehicle_id_key" ON "truck_listings"("vehicle_id");
CREATE INDEX "truck_listings_fleet_owner_id_idx" ON "truck_listings"("fleet_owner_id");
CREATE INDEX "truck_listings_listing_status_is_listing_enabled_idx" ON "truck_listings"("listing_status", "is_listing_enabled");
CREATE INDEX "truck_listings_is_featured_idx" ON "truck_listings"("is_featured");
CREATE INDEX "truck_listings_vehicle_category_idx" ON "truck_listings"("vehicle_category");
CREATE INDEX "truck_listings_vehicle_type_idx" ON "truck_listings"("vehicle_type");

CREATE TABLE "truck_listing_images" (
    "id" UUID NOT NULL,
    "truck_listing_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "truck_listing_images_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "truck_listing_images_truck_listing_id_idx" ON "truck_listing_images"("truck_listing_id");

CREATE TABLE "truck_quote_requests" (
    "id" UUID NOT NULL,
    "truck_listing_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "origin_city" TEXT NOT NULL,
    "origin_country" TEXT NOT NULL,
    "dest_city" TEXT NOT NULL,
    "dest_country" TEXT NOT NULL,
    "cargo_details" TEXT,
    "weight_kg" DECIMAL(10,2),
    "preferred_date" TIMESTAMP(3),
    "status" "quote_request_status" NOT NULL DEFAULT 'pending',
    "fleet_response" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "truck_quote_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "truck_quote_requests_truck_listing_id_idx" ON "truck_quote_requests"("truck_listing_id");
CREATE INDEX "truck_quote_requests_customer_id_idx" ON "truck_quote_requests"("customer_id");
CREATE INDEX "truck_quote_requests_status_idx" ON "truck_quote_requests"("status");

CREATE TABLE "truck_reviews" (
    "id" UUID NOT NULL,
    "truck_listing_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "fleet_owner_id" UUID NOT NULL,
    "driver_id" UUID,
    "shipment_id" UUID,
    "communication_score" INTEGER NOT NULL,
    "delivery_speed_score" INTEGER NOT NULL,
    "vehicle_condition_score" INTEGER NOT NULL,
    "professionalism_score" INTEGER NOT NULL,
    "overall_score" INTEGER NOT NULL,
    "comment" TEXT,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "is_moderated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "truck_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "truck_reviews_truck_listing_id_idx" ON "truck_reviews"("truck_listing_id");
CREATE INDEX "truck_reviews_fleet_owner_id_idx" ON "truck_reviews"("fleet_owner_id");
CREATE INDEX "truck_reviews_customer_id_idx" ON "truck_reviews"("customer_id");

CREATE TABLE "marketplace_views" (
    "id" UUID NOT NULL,
    "truck_listing_id" UUID NOT NULL,
    "session_id" TEXT,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_views_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marketplace_views_truck_listing_id_viewed_at_idx" ON "marketplace_views"("truck_listing_id", "viewed_at");

ALTER TABLE "shipments" ADD CONSTRAINT "shipments_truck_listing_id_fkey" FOREIGN KEY ("truck_listing_id") REFERENCES "truck_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "truck_listings" ADD CONSTRAINT "truck_listings_fleet_owner_id_fkey" FOREIGN KEY ("fleet_owner_id") REFERENCES "fleet_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "truck_listings" ADD CONSTRAINT "truck_listings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "truck_listing_images" ADD CONSTRAINT "truck_listing_images_truck_listing_id_fkey" FOREIGN KEY ("truck_listing_id") REFERENCES "truck_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "truck_quote_requests" ADD CONSTRAINT "truck_quote_requests_truck_listing_id_fkey" FOREIGN KEY ("truck_listing_id") REFERENCES "truck_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "truck_quote_requests" ADD CONSTRAINT "truck_quote_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "truck_reviews" ADD CONSTRAINT "truck_reviews_truck_listing_id_fkey" FOREIGN KEY ("truck_listing_id") REFERENCES "truck_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "truck_reviews" ADD CONSTRAINT "truck_reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "truck_reviews" ADD CONSTRAINT "truck_reviews_fleet_owner_id_fkey" FOREIGN KEY ("fleet_owner_id") REFERENCES "fleet_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplace_views" ADD CONSTRAINT "marketplace_views_truck_listing_id_fkey" FOREIGN KEY ("truck_listing_id") REFERENCES "truck_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
