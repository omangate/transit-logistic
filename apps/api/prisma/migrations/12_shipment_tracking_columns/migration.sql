-- Align shipments table with Prisma schema (columns used by road/public tracking queries).

ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "cargo_type" "cargo_type" NOT NULL DEFAULT 'dry';
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "package_count" INTEGER;
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "length_cm" DECIMAL(10,2);
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "width_cm" DECIMAL(10,2);
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "height_cm" DECIMAL(10,2);
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "shipping_method" "shipping_method" NOT NULL DEFAULT 'standard';
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "is_cross_border" BOOLEAN NOT NULL DEFAULT false;
