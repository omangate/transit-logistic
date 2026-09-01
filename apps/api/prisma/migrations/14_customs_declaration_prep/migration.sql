-- CreateEnum
CREATE TYPE "extraction_review_status" AS ENUM ('CONFIRMED_FROM_DOCUMENT', 'NEEDS_REVIEW', 'MISSING', 'MANUALLY_OVERRIDDEN');
CREATE TYPE "declaration_prep_status" AS ENUM ('not_started', 'documents_uploaded', 'extracting', 'draft_ready', 'under_review', 'hs_review', 'validated', 'bayan_ready');
CREATE TYPE "document_extraction_status" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- AlterTable customs_clearance_requests
ALTER TABLE "customs_clearance_requests"
  ADD COLUMN "customs_entry_exit_port" TEXT,
  ADD COLUMN "consignee_name" TEXT,
  ADD COLUMN "consignee_confirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "declaration_prep_status" "declaration_prep_status" NOT NULL DEFAULT 'not_started',
  ADD COLUMN "declaration_draft_built_at" TIMESTAMP(3),
  ADD COLUMN "bayan_ready_at" TIMESTAMP(3);

-- AlterTable customs_cargo_lines
ALTER TABLE "customs_cargo_lines"
  ADD COLUMN "approved_hs_code" TEXT,
  ADD COLUMN "quantity" DECIMAL(14,3),
  ADD COLUMN "unit_of_measure" TEXT,
  ADD COLUMN "unit_price" DECIMAL(14,3),
  ADD COLUMN "vin" TEXT,
  ADD COLUMN "vehicle_make" TEXT,
  ADD COLUMN "vehicle_model" TEXT,
  ADD COLUMN "vehicle_year" INTEGER;

-- CreateTable document_extractions
CREATE TABLE "document_extractions" (
  "id" UUID NOT NULL,
  "logistics_document_id" UUID NOT NULL,
  "customs_request_id" UUID NOT NULL,
  "status" "document_extraction_status" NOT NULL DEFAULT 'pending',
  "detected_category" "logistics_document_category",
  "raw_payload" JSONB,
  "error_message" TEXT,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateTable declaration_extracted_fields
CREATE TABLE "declaration_extracted_fields" (
  "id" UUID NOT NULL,
  "customs_request_id" UUID NOT NULL,
  "field_key" TEXT NOT NULL,
  "field_group" TEXT NOT NULL,
  "display_value" TEXT,
  "normalized_value" TEXT,
  "review_status" "extraction_review_status" NOT NULL DEFAULT 'NEEDS_REVIEW',
  "confidence" DECIMAL(5,4),
  "source_document_id" UUID,
  "source_page" INTEGER,
  "source_extraction_id" UUID,
  "cargo_line_index" INTEGER,
  "reviewed_by_id" UUID,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "declaration_extracted_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable field_discrepancies
CREATE TABLE "field_discrepancies" (
  "id" UUID NOT NULL,
  "customs_request_id" UUID NOT NULL,
  "field_key" TEXT NOT NULL,
  "values" JSONB NOT NULL,
  "resolved" BOOLEAN NOT NULL DEFAULT false,
  "resolved_value" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "field_discrepancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable cargo_line_hs_suggestions
CREATE TABLE "cargo_line_hs_suggestions" (
  "id" UUID NOT NULL,
  "cargo_line_id" UUID NOT NULL,
  "hs_code" TEXT NOT NULL,
  "description_en" TEXT NOT NULL,
  "description_ar" TEXT NOT NULL,
  "duty_rate" TEXT,
  "permit_required" BOOLEAN NOT NULL DEFAULT false,
  "restriction_note" TEXT,
  "confidence" DECIMAL(5,4),
  "is_official_source" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cargo_line_hs_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable oman_hs_tariff_entries
CREATE TABLE "oman_hs_tariff_entries" (
  "id" UUID NOT NULL,
  "hs_code" TEXT NOT NULL,
  "description_en" TEXT NOT NULL,
  "description_ar" TEXT NOT NULL,
  "duty_rate" TEXT,
  "permit_required" BOOLEAN NOT NULL DEFAULT false,
  "restriction_note" TEXT,
  "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oman_hs_tariff_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable saved_consignees
CREATE TABLE "saved_consignees" (
  "id" UUID NOT NULL,
  "company_name" TEXT NOT NULL,
  "company_name_ar" TEXT,
  "cr_number" TEXT,
  "address" TEXT,
  "contact_phone" TEXT,
  "contact_email" TEXT,
  "created_by_id" UUID NOT NULL,
  "usage_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "saved_consignees_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "document_extractions_logistics_document_id_idx" ON "document_extractions"("logistics_document_id");
CREATE INDEX "document_extractions_customs_request_id_idx" ON "document_extractions"("customs_request_id");
CREATE INDEX "declaration_extracted_fields_customs_request_id_idx" ON "declaration_extracted_fields"("customs_request_id");
CREATE INDEX "declaration_extracted_fields_field_key_idx" ON "declaration_extracted_fields"("field_key");
CREATE INDEX "declaration_extracted_fields_source_document_id_idx" ON "declaration_extracted_fields"("source_document_id");
CREATE INDEX "field_discrepancies_customs_request_id_idx" ON "field_discrepancies"("customs_request_id");
CREATE INDEX "cargo_line_hs_suggestions_cargo_line_id_idx" ON "cargo_line_hs_suggestions"("cargo_line_id");
CREATE INDEX "cargo_line_hs_suggestions_hs_code_idx" ON "cargo_line_hs_suggestions"("hs_code");
CREATE UNIQUE INDEX "oman_hs_tariff_entries_hs_code_key" ON "oman_hs_tariff_entries"("hs_code");
CREATE INDEX "oman_hs_tariff_entries_hs_code_idx" ON "oman_hs_tariff_entries"("hs_code");
CREATE INDEX "saved_consignees_company_name_idx" ON "saved_consignees"("company_name");

-- ForeignKeys
ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_logistics_document_id_fkey" FOREIGN KEY ("logistics_document_id") REFERENCES "logistics_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_customs_request_id_fkey" FOREIGN KEY ("customs_request_id") REFERENCES "customs_clearance_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "declaration_extracted_fields" ADD CONSTRAINT "declaration_extracted_fields_customs_request_id_fkey" FOREIGN KEY ("customs_request_id") REFERENCES "customs_clearance_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "declaration_extracted_fields" ADD CONSTRAINT "declaration_extracted_fields_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "logistics_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "declaration_extracted_fields" ADD CONSTRAINT "declaration_extracted_fields_source_extraction_id_fkey" FOREIGN KEY ("source_extraction_id") REFERENCES "document_extractions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "field_discrepancies" ADD CONSTRAINT "field_discrepancies_customs_request_id_fkey" FOREIGN KEY ("customs_request_id") REFERENCES "customs_clearance_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cargo_line_hs_suggestions" ADD CONSTRAINT "cargo_line_hs_suggestions_cargo_line_id_fkey" FOREIGN KEY ("cargo_line_id") REFERENCES "customs_cargo_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
