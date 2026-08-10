-- AlterTable
ALTER TABLE "vehicle_shipment_records" ADD COLUMN IF NOT EXISTS "chassis_number" TEXT;
ALTER TABLE "vehicle_shipment_records" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- AlterTable
ALTER TABLE "document_checklist_templates" ADD COLUMN IF NOT EXISTS "service_type" TEXT;
ALTER TABLE "document_checklist_templates" ADD COLUMN IF NOT EXISTS "cargo_type" TEXT;

-- AlterTable
ALTER TABLE "logistics_messages" ADD COLUMN IF NOT EXISTS "attachment_original_name" TEXT;
ALTER TABLE "logistics_messages" ADD COLUMN IF NOT EXISTS "attachment_mime_type" TEXT;
