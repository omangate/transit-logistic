-- Customs prep enhancements: extraction metadata, HS tariff versioning, Bayan record fields

ALTER TYPE "extraction_review_status" ADD VALUE IF NOT EXISTS 'EXTRACTION_FAILED';

ALTER TABLE "customs_clearance_requests"
  ADD COLUMN IF NOT EXISTS "bayan_declaration_number" TEXT,
  ADD COLUMN IF NOT EXISTS "bayan_declaration_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "customs_duty_amount" DECIMAL(14,3),
  ADD COLUMN IF NOT EXISTS "customs_payment_status" TEXT,
  ADD COLUMN IF NOT EXISTS "customs_release_status" TEXT,
  ADD COLUMN IF NOT EXISTS "bayan_notes" TEXT;

ALTER TABLE "declaration_extracted_fields"
  ADD COLUMN IF NOT EXISTS "extraction_method" TEXT,
  ADD COLUMN IF NOT EXISTS "evidence_snippet" TEXT;

ALTER TABLE "cargo_line_hs_suggestions"
  ADD COLUMN IF NOT EXISTS "match_explanation" TEXT,
  ADD COLUMN IF NOT EXISTS "tariff_version" TEXT,
  ADD COLUMN IF NOT EXISTS "official_source_url" TEXT;

ALTER TABLE "cargo_line_hs_suggestions" ALTER COLUMN "is_official_source" SET DEFAULT false;

CREATE TABLE IF NOT EXISTS "oman_hs_tariff_import_batches" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "file_name" TEXT,
  "file_format" TEXT NOT NULL,
  "record_count" INTEGER NOT NULL DEFAULT 0,
  "official_count" INTEGER NOT NULL DEFAULT 0,
  "tariff_version" TEXT,
  "tariff_year" INTEGER,
  "official_source" TEXT,
  "official_source_url" TEXT,
  "imported_by_id" UUID,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oman_hs_tariff_import_batches_pkey" PRIMARY KEY ("id")
);

-- Expand oman_hs_tariff_entries (preserve existing rows)
ALTER TABLE "oman_hs_tariff_entries"
  ADD COLUMN IF NOT EXISTS "chapter" TEXT,
  ADD COLUMN IF NOT EXISTS "heading" TEXT,
  ADD COLUMN IF NOT EXISTS "subheading" TEXT,
  ADD COLUMN IF NOT EXISTS "unit_of_measure" TEXT,
  ADD COLUMN IF NOT EXISTS "tariff_version" TEXT,
  ADD COLUMN IF NOT EXISTS "tariff_year" INTEGER,
  ADD COLUMN IF NOT EXISTS "official_source" TEXT,
  ADD COLUMN IF NOT EXISTS "official_source_url" TEXT,
  ADD COLUMN IF NOT EXISTS "is_official_source" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "is_verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "last_verified_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "import_batch_id" UUID,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Drop old unique on hs_code only if exists, add composite unique
DO $$ BEGIN
  ALTER TABLE "oman_hs_tariff_entries" DROP CONSTRAINT IF EXISTS "oman_hs_tariff_entries_hs_code_key";
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "oman_hs_tariff_entries_hs_code_tariff_version_key"
  ON "oman_hs_tariff_entries"("hs_code", "tariff_version");

CREATE INDEX IF NOT EXISTS "oman_hs_tariff_entries_chapter_idx" ON "oman_hs_tariff_entries"("chapter");
CREATE INDEX IF NOT EXISTS "oman_hs_tariff_entries_active_official_idx" ON "oman_hs_tariff_entries"("is_active", "is_official_source");

ALTER TABLE "oman_hs_tariff_entries"
  ADD CONSTRAINT "oman_hs_tariff_entries_import_batch_id_fkey"
  FOREIGN KEY ("import_batch_id") REFERENCES "oman_hs_tariff_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
