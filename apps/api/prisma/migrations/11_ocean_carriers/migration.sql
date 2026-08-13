-- Ocean carrier integration layer

CREATE TYPE "OceanCarrierCode" AS ENUM (
  'maersk',
  'hapag_lloyd',
  'msc',
  'cma_cgm',
  'cosco',
  'one',
  'evergreen',
  'yang_ming',
  'zim'
);

CREATE TYPE "OceanCarrierIntegrationMode" AS ENUM (
  'live_api',
  'manual_ops',
  'external_tracking'
);

CREATE TYPE "OceanCarrierConnectionStatus" AS ENUM (
  'connected',
  'not_configured',
  'auth_required',
  'degraded',
  'error'
);

CREATE TABLE "ocean_carrier_configs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "carrier_code" "OceanCarrierCode" NOT NULL,
  "display_name" TEXT NOT NULL,
  "scac" TEXT,
  "integration_mode" "OceanCarrierIntegrationMode" NOT NULL DEFAULT 'external_tracking',
  "status" "OceanCarrierConnectionStatus" NOT NULL DEFAULT 'not_configured',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "supports_tracking" BOOLEAN NOT NULL DEFAULT true,
  "supports_schedules" BOOLEAN NOT NULL DEFAULT false,
  "supports_booking" BOOLEAN NOT NULL DEFAULT false,
  "external_tracking_url_template" TEXT,
  "credential_env_key" TEXT,
  "last_sync_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ocean_carrier_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ocean_carrier_configs_carrier_code_key" ON "ocean_carrier_configs"("carrier_code");

CREATE TABLE "ocean_tracking_cache" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "search_type" TEXT NOT NULL,
  "search_value" TEXT NOT NULL,
  "carrier_code" "OceanCarrierCode",
  "source" "OceanCarrierIntegrationMode" NOT NULL,
  "normalized_data" JSONB NOT NULL,
  "container_number" TEXT,
  "bl_number" TEXT,
  "booking_number" TEXT,
  "vessel_name" TEXT,
  "voyage" TEXT,
  "pol_unlocode" TEXT,
  "pod_unlocode" TEXT,
  "etd" TIMESTAMP(3),
  "eta" TIMESTAMP(3),
  "current_status" TEXT,
  "last_event_at" TIMESTAMP(3),
  "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ocean_tracking_cache_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ocean_tracking_cache_search_value_idx" ON "ocean_tracking_cache"("search_value");
CREATE INDEX "ocean_tracking_cache_container_number_idx" ON "ocean_tracking_cache"("container_number");
CREATE INDEX "ocean_tracking_cache_bl_number_idx" ON "ocean_tracking_cache"("bl_number");
CREATE INDEX "ocean_tracking_cache_booking_number_idx" ON "ocean_tracking_cache"("booking_number");

INSERT INTO "ocean_carrier_configs" (
  "id",
  "carrier_code",
  "display_name",
  "scac",
  "integration_mode",
  "status",
  "enabled",
  "supports_tracking",
  "supports_schedules",
  "supports_booking",
  "external_tracking_url_template",
  "credential_env_key",
  "updated_at"
) VALUES
  (gen_random_uuid(), 'maersk', 'Maersk', 'MAEU', 'external_tracking', 'not_configured', true, true, false, false, 'https://www.maersk.com/tracking/{reference}', 'MAERSK_API_CLIENT_ID', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hapag_lloyd', 'Hapag-Lloyd', 'HLCU', 'external_tracking', 'not_configured', true, true, false, false, 'https://www.hapag-lloyd.com/en/online-business/track/track-by-booking-solution.html?booking={reference}', 'HAPAG_LLOYD_API_KEY', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'msc', 'MSC', 'MSCU', 'external_tracking', 'not_configured', true, true, false, false, 'https://www.msc.com/en/track-a-shipment?params={reference}', 'MSC_API_KEY', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'cma_cgm', 'CMA CGM', 'CMDU', 'external_tracking', 'not_configured', true, true, false, false, 'https://www.cma-cgm.com/ebusiness/tracking/search?SearchType=Container&SearchBy={reference}', 'CMA_CGM_API_KEY', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'cosco', 'COSCO Shipping', 'COSU', 'external_tracking', 'not_configured', true, true, false, false, 'https://elines.coscoshipping.com/ebusiness/cargoTracking?containerNo={reference}', 'COSCO_API_KEY', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'one', 'Ocean Network Express', 'ONEY', 'external_tracking', 'not_configured', true, true, false, false, 'https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking?searchType=Container&searchNumber={reference}', 'ONE_API_KEY', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'evergreen', 'Evergreen Line', 'EGLV', 'external_tracking', 'not_configured', true, true, false, false, 'https://www.shipmentlink.com/servlet/TDB1_CargoTracking.do?containerNo={reference}', 'EVERGREEN_API_KEY', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'yang_ming', 'Yang Ming', 'YMLU', 'external_tracking', 'not_configured', true, true, false, false, 'https://www.yangming.com/en/esolution/cargo_tracking?containerNo={reference}', 'YANG_MING_API_KEY', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'zim', 'ZIM', 'ZIMU', 'external_tracking', 'not_configured', true, true, false, false, 'https://www.zim.com/tools/track-a-shipment?container={reference}', 'ZIM_API_KEY', CURRENT_TIMESTAMP);
