-- Truck rental pricing fields
ALTER TABLE "truck_listings" ADD COLUMN IF NOT EXISTS "daily_rental_price" DECIMAL(10,2);
ALTER TABLE "truck_listings" ADD COLUMN IF NOT EXISTS "weekly_rental_price" DECIMAL(10,2);
ALTER TABLE "truck_listings" ADD COLUMN IF NOT EXISTS "monthly_rental_price" DECIMAL(10,2);
ALTER TABLE "truck_listings" ADD COLUMN IF NOT EXISTS "with_driver_available" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "truck_listings" ADD COLUMN IF NOT EXISTS "without_driver_available" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "truck_listings" ADD COLUMN IF NOT EXISTS "min_rental_days" INTEGER;
