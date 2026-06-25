-- Phase 2: Geography, shipment requests, truck listing enhancements

CREATE TYPE "geo_region_type" AS ENUM ('governorate', 'wilayat', 'city', 'industrial_area', 'free_zone', 'port');
CREATE TYPE "shipment_request_status" AS ENUM ('open', 'matched', 'converted', 'cancelled', 'expired');

ALTER TABLE "users" ALTER COLUMN "locale" SET DEFAULT 'ar';

ALTER TABLE "truck_listings" ADD COLUMN "container_transport_support" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "truck_listings" ADD COLUMN "plate_number" TEXT;
ALTER TABLE "truck_listings" ADD COLUMN "video_url" TEXT;

CREATE TABLE "countries" (
    "code" CHAR(2) NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "default_currency" TEXT NOT NULL DEFAULT 'OMR',
    "center_latitude" DECIMAL(10,7) NOT NULL,
    "center_longitude" DECIMAL(10,7) NOT NULL,
    "default_zoom" INTEGER NOT NULL DEFAULT 6,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "countries_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "geo_regions" (
    "id" UUID NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "type" "geo_region_type" NOT NULL,
    "code" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "parent_id" UUID,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "geo_regions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "geo_regions_country_code_code_key" ON "geo_regions"("country_code", "code");
CREATE INDEX "geo_regions_country_code_type_idx" ON "geo_regions"("country_code", "type");
CREATE INDEX "geo_regions_parent_id_idx" ON "geo_regions"("parent_id");

CREATE TABLE "truck_listing_service_areas" (
    "truck_listing_id" UUID NOT NULL,
    "geo_region_id" UUID NOT NULL,
    CONSTRAINT "truck_listing_service_areas_pkey" PRIMARY KEY ("truck_listing_id", "geo_region_id")
);

CREATE TABLE "shipment_requests" (
    "id" UUID NOT NULL,
    "reference_number" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "status" "shipment_request_status" NOT NULL DEFAULT 'open',
    "pickup_address" TEXT NOT NULL,
    "pickup_geo_region_id" UUID,
    "pickup_latitude" DECIMAL(10,7),
    "pickup_longitude" DECIMAL(10,7),
    "delivery_address" TEXT NOT NULL,
    "delivery_geo_region_id" UUID,
    "delivery_latitude" DECIMAL(10,7),
    "delivery_longitude" DECIMAL(10,7),
    "cargo_type" "cargo_type" NOT NULL DEFAULT 'dry',
    "weight_kg" DECIMAL(10,2),
    "preferred_date" TIMESTAMP(3),
    "notes" TEXT,
    "required_vehicle_type" "vehicle_type",
    "requires_refrigerated" BOOLEAN NOT NULL DEFAULT false,
    "requires_cross_border" BOOLEAN NOT NULL DEFAULT false,
    "requires_container" BOOLEAN NOT NULL DEFAULT false,
    "converted_shipment_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shipment_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shipment_requests_reference_number_key" ON "shipment_requests"("reference_number");
CREATE INDEX "shipment_requests_customer_id_idx" ON "shipment_requests"("customer_id");
CREATE INDEX "shipment_requests_status_idx" ON "shipment_requests"("status");

CREATE TABLE "shipment_request_matches" (
    "id" UUID NOT NULL,
    "shipment_request_id" UUID NOT NULL,
    "fleet_owner_id" UUID NOT NULL,
    "truck_listing_id" UUID,
    "notified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shipment_request_matches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shipment_request_matches_shipment_request_id_fleet_owner_id_key" ON "shipment_request_matches"("shipment_request_id", "fleet_owner_id");
CREATE INDEX "shipment_request_matches_fleet_owner_id_idx" ON "shipment_request_matches"("fleet_owner_id");

ALTER TABLE "geo_regions" ADD CONSTRAINT "geo_regions_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "geo_regions" ADD CONSTRAINT "geo_regions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "geo_regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "truck_listing_service_areas" ADD CONSTRAINT "truck_listing_service_areas_truck_listing_id_fkey" FOREIGN KEY ("truck_listing_id") REFERENCES "truck_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "truck_listing_service_areas" ADD CONSTRAINT "truck_listing_service_areas_geo_region_id_fkey" FOREIGN KEY ("geo_region_id") REFERENCES "geo_regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment_requests" ADD CONSTRAINT "shipment_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment_requests" ADD CONSTRAINT "shipment_requests_pickup_geo_region_id_fkey" FOREIGN KEY ("pickup_geo_region_id") REFERENCES "geo_regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shipment_requests" ADD CONSTRAINT "shipment_requests_delivery_geo_region_id_fkey" FOREIGN KEY ("delivery_geo_region_id") REFERENCES "geo_regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shipment_request_matches" ADD CONSTRAINT "shipment_request_matches_shipment_request_id_fkey" FOREIGN KEY ("shipment_request_id") REFERENCES "shipment_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment_request_matches" ADD CONSTRAINT "shipment_request_matches_fleet_owner_id_fkey" FOREIGN KEY ("fleet_owner_id") REFERENCES "fleet_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
