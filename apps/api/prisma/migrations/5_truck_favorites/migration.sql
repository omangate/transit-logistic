-- Truck favorites (customer wishlists)
CREATE TABLE "truck_favorites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "truck_listing_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "truck_favorites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "truck_favorites_user_id_truck_listing_id_key" ON "truck_favorites"("user_id", "truck_listing_id");
CREATE INDEX "truck_favorites_user_id_idx" ON "truck_favorites"("user_id");

ALTER TABLE "truck_favorites" ADD CONSTRAINT "truck_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "truck_favorites" ADD CONSTRAINT "truck_favorites_truck_listing_id_fkey" FOREIGN KEY ("truck_listing_id") REFERENCES "truck_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
