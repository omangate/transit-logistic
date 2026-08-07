-- Customs clearance + freight forwarding + master logistics orders
-- prisma:disable-transaction

ALTER TYPE "geo_region_type" ADD VALUE IF NOT EXISTS 'airport';
ALTER TYPE "geo_region_type" ADD VALUE IF NOT EXISTS 'land_border';

ALTER TYPE "conversation_context_type" ADD VALUE IF NOT EXISTS 'logistics_order';
ALTER TYPE "conversation_context_type" ADD VALUE IF NOT EXISTS 'customs_clearance';
ALTER TYPE "conversation_context_type" ADD VALUE IF NOT EXISTS 'freight_forwarding';

CREATE TYPE "customs_transaction_type" AS ENUM ('import', 'export', 'transit', 're_export', 'temporary_import', 'temporary_export', 'free_zone');
CREATE TYPE "customs_clearance_status" AS ENUM (
  'draft', 'submitted', 'documents_under_review', 'documents_missing', 'quotation_pending', 'quotation_sent',
  'quotation_accepted', 'clearance_in_progress', 'declaration_prepared', 'declaration_submitted', 'customs_inspection',
  'additional_approval_required', 'customs_duty_pending', 'customs_duty_paid', 'customs_released', 'port_release_pending',
  'ready_for_pickup', 'transportation_arranged', 'in_transit', 'delivered', 'completed', 'on_hold', 'cancelled'
);
CREATE TYPE "freight_transport_mode" AS ENUM ('sea', 'air', 'road', 'multimodal');
CREATE TYPE "freight_service_type" AS ENUM ('fcl', 'lcl', 'roro', 'breakbulk', 'project_cargo', 'reefer', 'domestic_road', 'gcc_road', 'cross_border_road');
CREATE TYPE "freight_route_type" AS ENUM ('origin_destination', 'port_to_port', 'door_to_port', 'port_to_door', 'door_to_door');
CREATE TYPE "freight_request_status" AS ENUM ('draft', 'submitted', 'quotation_pending', 'quotation_sent', 'quotation_accepted', 'in_progress', 'in_transit', 'delivered', 'completed', 'on_hold', 'cancelled');
CREATE TYPE "logistics_order_status" AS ENUM ('draft', 'active', 'in_progress', 'completed', 'on_hold', 'cancelled');
CREATE TYPE "logistics_quote_status" AS ENUM ('draft', 'pending', 'sent', 'accepted', 'rejected', 'countered', 'amended', 'expired');
CREATE TYPE "logistics_charge_category" AS ENUM ('freight', 'customs_clearance', 'customs_duty', 'port_charges', 'terminal_handling', 'storage', 'demurrage', 'detention', 'transportation', 'inspection', 'documentation', 'insurance', 'other');
CREATE TYPE "logistics_charge_payment_status" AS ENUM ('unpaid', 'partial', 'paid', 'waived');
CREATE TYPE "logistics_document_category" AS ENUM ('commercial_invoice', 'packing_list', 'bill_of_lading', 'air_waybill', 'certificate_of_origin', 'delivery_order', 'customs_declaration', 'import_permit', 'export_permit', 'vehicle_document', 'insurance', 'inspection_certificate', 'health_certificate', 'phytosanitary_certificate', 'authorization_letter', 'noc', 'other');
CREATE TYPE "checklist_item_status" AS ENUM ('required', 'uploaded', 'missing', 'under_review', 'approved', 'rejected', 'expired');
CREATE TYPE "container_record_status" AS ENUM ('booked', 'loaded', 'in_transit', 'arrived', 'customs_hold', 'released', 'delivered', 'empty_returned');
CREATE TYPE "logistics_location_type" AS ENUM ('port', 'airport', 'land_border', 'free_zone', 'industrial_area');

CREATE TABLE "logistics_orders" (
    "id" UUID NOT NULL,
    "reference_number" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "status" "logistics_order_status" NOT NULL DEFAULT 'draft',
    "shipment_id" UUID,
    "truck_booking_id" UUID,
    "assigned_to_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "logistics_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customs_clearance_requests" (
    "id" UUID NOT NULL,
    "reference_number" TEXT NOT NULL,
    "logistics_order_id" UUID,
    "customer_id" UUID NOT NULL,
    "transaction_type" "customs_transaction_type" NOT NULL,
    "status" "customs_clearance_status" NOT NULL DEFAULT 'draft',
    "shipment_reference" TEXT,
    "customer_reference" TEXT,
    "bill_of_lading_number" TEXT,
    "booking_number" TEXT,
    "shipping_line" TEXT,
    "vessel_name" TEXT,
    "voyage_number" TEXT,
    "port_of_loading" TEXT,
    "port_of_discharge" TEXT,
    "port_of_loading_region_id" UUID,
    "port_of_discharge_region_id" UUID,
    "final_destination" TEXT,
    "country_of_origin" CHAR(2),
    "destination_country" CHAR(2),
    "eta" TIMESTAMP(3),
    "etd" TIMESTAMP(3),
    "declaration_number" TEXT,
    "assigned_to_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customs_clearance_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customs_cargo_lines" (
    "id" UUID NOT NULL,
    "customs_request_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "hs_code" TEXT,
    "package_count" INTEGER,
    "package_type" TEXT,
    "gross_weight_kg" DECIMAL(12,3),
    "net_weight_kg" DECIMAL(12,3),
    "volume_cbm" DECIMAL(12,3),
    "cargo_value" DECIMAL(14,3),
    "currency" TEXT NOT NULL DEFAULT 'OMR',
    "container_count" INTEGER,
    "container_type" TEXT,
    "is_reefer" BOOLEAN NOT NULL DEFAULT false,
    "is_dangerous_goods" BOOLEAN NOT NULL DEFAULT false,
    "is_vehicle_cargo" BOOLEAN NOT NULL DEFAULT false,
    "is_general_cargo" BOOLEAN NOT NULL DEFAULT true,
    "is_bulk_cargo" BOOLEAN NOT NULL DEFAULT false,
    "is_project_cargo" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customs_cargo_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "freight_forwarding_requests" (
    "id" UUID NOT NULL,
    "reference_number" TEXT NOT NULL,
    "logistics_order_id" UUID,
    "customer_id" UUID NOT NULL,
    "transport_mode" "freight_transport_mode" NOT NULL,
    "service_type" "freight_service_type",
    "route_type" "freight_route_type" NOT NULL DEFAULT 'origin_destination',
    "status" "freight_request_status" NOT NULL DEFAULT 'draft',
    "origin" TEXT,
    "destination" TEXT,
    "origin_region_id" UUID,
    "destination_region_id" UUID,
    "port_origin" TEXT,
    "port_destination" TEXT,
    "port_origin_region_id" UUID,
    "port_destination_region_id" UUID,
    "cargo_description" TEXT,
    "commodity" TEXT,
    "weight_kg" DECIMAL(12,3),
    "volume_cbm" DECIMAL(12,3),
    "container_type" TEXT,
    "container_quantity" INTEGER,
    "pickup_required" BOOLEAN NOT NULL DEFAULT false,
    "delivery_required" BOOLEAN NOT NULL DEFAULT false,
    "customs_clearance_required" BOOLEAN NOT NULL DEFAULT false,
    "insurance_required" BOOLEAN NOT NULL DEFAULT false,
    "preferred_departure_date" DATE,
    "special_instructions" TEXT,
    "assigned_to_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "freight_forwarding_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "logistics_documents" (
    "id" UUID NOT NULL,
    "logistics_order_id" UUID,
    "customs_request_id" UUID,
    "freight_request_id" UUID,
    "category" "logistics_document_category" NOT NULL,
    "document_number" TEXT,
    "issue_date" DATE,
    "expires_at" TIMESTAMP(3),
    "storage_key" TEXT,
    "original_name" TEXT,
    "mime_type" TEXT,
    "file_url" TEXT,
    "status" "document_status" NOT NULL DEFAULT 'pending',
    "ai_suggested_category" "logistics_document_category",
    "uploaded_by_id" UUID NOT NULL,
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "logistics_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "logistics_status_history" (
    "id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "logistics_order_id" UUID,
    "customs_request_id" UUID,
    "freight_request_id" UUID,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "actor_id" UUID,
    "attachment_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "logistics_status_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "logistics_quotes" (
    "id" UUID NOT NULL,
    "reference_number" TEXT NOT NULL,
    "logistics_order_id" UUID,
    "customs_request_id" UUID,
    "freight_request_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "logistics_quote_status" NOT NULL DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'OMR',
    "subtotal" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "valid_until" TIMESTAMP(3),
    "customer_note" TEXT,
    "internal_note" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "logistics_quotes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "logistics_quote_lines" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "category" "logistics_charge_category" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,3) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "tax" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'OMR',
    "is_customer_visible" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "logistics_quote_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "logistics_charges" (
    "id" UUID NOT NULL,
    "logistics_order_id" UUID NOT NULL,
    "category" "logistics_charge_category" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'OMR',
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "tax" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "source" TEXT,
    "payment_status" "logistics_charge_payment_status" NOT NULL DEFAULT 'unpaid',
    "is_customer_visible" BOOLEAN NOT NULL DEFAULT true,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "document_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "logistics_charges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "container_records" (
    "id" UUID NOT NULL,
    "logistics_order_id" UUID,
    "customs_request_id" UUID,
    "freight_request_id" UUID,
    "container_number" TEXT NOT NULL,
    "size" TEXT,
    "type" TEXT,
    "seal_number" TEXT,
    "gross_weight_kg" DECIMAL(12,3),
    "cargo_description" TEXT,
    "shipping_line" TEXT,
    "bl_number" TEXT,
    "current_status" "container_record_status" NOT NULL DEFAULT 'booked',
    "current_location" TEXT,
    "pickup_date" DATE,
    "return_date" DATE,
    "empty_return_location" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "container_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vehicle_shipment_records" (
    "id" UUID NOT NULL,
    "logistics_order_id" UUID,
    "customs_request_id" UUID,
    "vin" TEXT,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "color" TEXT,
    "weight_kg" DECIMAL(12,3),
    "origin" TEXT,
    "destination" TEXT,
    "container_number" TEXT,
    "bl_number" TEXT,
    "customs_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vehicle_shipment_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_checklist_templates" (
    "id" UUID NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "transaction_type" "customs_transaction_type",
    "transport_mode" "freight_transport_mode",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "document_checklist_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_checklist_template_items" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "document_category" "logistics_document_category" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "document_checklist_template_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_checklist_items" (
    "id" UUID NOT NULL,
    "logistics_order_id" UUID,
    "customs_request_id" UUID,
    "freight_request_id" UUID,
    "template_item_id" UUID,
    "document_category" "logistics_document_category" NOT NULL,
    "status" "checklist_item_status" NOT NULL DEFAULT 'required',
    "logistics_document_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "document_checklist_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "logistics_location_configs" (
    "id" UUID NOT NULL,
    "geo_region_id" UUID,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "location_type" "logistics_location_type" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "logistics_location_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "logistics_conversations" (
    "id" UUID NOT NULL,
    "logistics_order_id" UUID,
    "customs_request_id" UUID,
    "freight_request_id" UUID,
    "quote_id" UUID,
    "customer_id" UUID NOT NULL,
    "assigned_to_id" UUID,
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "logistics_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "logistics_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "attachment_key" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "logistics_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "logistics_orders_reference_number_key" ON "logistics_orders"("reference_number");
CREATE UNIQUE INDEX "customs_clearance_requests_reference_number_key" ON "customs_clearance_requests"("reference_number");
CREATE UNIQUE INDEX "freight_forwarding_requests_reference_number_key" ON "freight_forwarding_requests"("reference_number");
CREATE UNIQUE INDEX "logistics_quotes_reference_number_key" ON "logistics_quotes"("reference_number");

ALTER TABLE "logistics_orders" ADD CONSTRAINT "logistics_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "logistics_orders" ADD CONSTRAINT "logistics_orders_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "customs_clearance_requests" ADD CONSTRAINT "customs_clearance_requests_logistics_order_id_fkey" FOREIGN KEY ("logistics_order_id") REFERENCES "logistics_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customs_clearance_requests" ADD CONSTRAINT "customs_clearance_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customs_clearance_requests" ADD CONSTRAINT "customs_clearance_requests_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customs_clearance_requests" ADD CONSTRAINT "customs_clearance_requests_port_of_loading_region_id_fkey" FOREIGN KEY ("port_of_loading_region_id") REFERENCES "geo_regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customs_clearance_requests" ADD CONSTRAINT "customs_clearance_requests_port_of_discharge_region_id_fkey" FOREIGN KEY ("port_of_discharge_region_id") REFERENCES "geo_regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "customs_cargo_lines" ADD CONSTRAINT "customs_cargo_lines_customs_request_id_fkey" FOREIGN KEY ("customs_request_id") REFERENCES "customs_clearance_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "freight_forwarding_requests" ADD CONSTRAINT "freight_forwarding_requests_logistics_order_id_fkey" FOREIGN KEY ("logistics_order_id") REFERENCES "logistics_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "freight_forwarding_requests" ADD CONSTRAINT "freight_forwarding_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "logistics_documents" ADD CONSTRAINT "logistics_documents_logistics_order_id_fkey" FOREIGN KEY ("logistics_order_id") REFERENCES "logistics_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "logistics_documents" ADD CONSTRAINT "logistics_documents_customs_request_id_fkey" FOREIGN KEY ("customs_request_id") REFERENCES "customs_clearance_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "logistics_documents" ADD CONSTRAINT "logistics_documents_freight_request_id_fkey" FOREIGN KEY ("freight_request_id") REFERENCES "freight_forwarding_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "logistics_documents" ADD CONSTRAINT "logistics_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "logistics_quotes" ADD CONSTRAINT "logistics_quotes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "logistics_quote_lines" ADD CONSTRAINT "logistics_quote_lines_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "logistics_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "logistics_charges" ADD CONSTRAINT "logistics_charges_logistics_order_id_fkey" FOREIGN KEY ("logistics_order_id") REFERENCES "logistics_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "logistics_conversations" ADD CONSTRAINT "logistics_conversations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "logistics_messages" ADD CONSTRAINT "logistics_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "logistics_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "logistics_messages" ADD CONSTRAINT "logistics_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "logistics_orders_customer_id_idx" ON "logistics_orders"("customer_id");
CREATE INDEX "customs_clearance_requests_customer_id_idx" ON "customs_clearance_requests"("customer_id");
CREATE INDEX "freight_forwarding_requests_customer_id_idx" ON "freight_forwarding_requests"("customer_id");
