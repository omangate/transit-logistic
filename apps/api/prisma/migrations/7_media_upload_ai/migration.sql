-- Media upload, document enhancements, AI chat sessions
-- prisma:disable-transaction
ALTER TYPE "document_status" ADD VALUE IF NOT EXISTS 'expired';

ALTER TABLE "truck_listings" ADD COLUMN IF NOT EXISTS "video_storage_key" TEXT;
ALTER TABLE "truck_listings" ADD COLUMN IF NOT EXISTS "video_thumbnail_url" TEXT;
ALTER TABLE "truck_listings" ADD COLUMN IF NOT EXISTS "draft_data" JSONB;

ALTER TABLE "truck_listing_images" ADD COLUMN IF NOT EXISTS "thumbnail_url" TEXT;
ALTER TABLE "truck_listing_images" ADD COLUMN IF NOT EXISTS "storage_key" TEXT;
ALTER TABLE "truck_listing_images" ADD COLUMN IF NOT EXISTS "width" INTEGER;
ALTER TABLE "truck_listing_images" ADD COLUMN IF NOT EXISTS "height" INTEGER;
ALTER TABLE "truck_listing_images" ADD COLUMN IF NOT EXISTS "mime_type" TEXT;

ALTER TABLE "fleet_owner_documents" ADD COLUMN IF NOT EXISTS "storage_key" TEXT;
ALTER TABLE "fleet_owner_documents" ADD COLUMN IF NOT EXISTS "original_name" TEXT;
ALTER TABLE "fleet_owner_documents" ADD COLUMN IF NOT EXISTS "mime_type" TEXT;
ALTER TABLE "fleet_owner_documents" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3);
ALTER TABLE "fleet_owner_documents" ADD COLUMN IF NOT EXISTS "review_note" TEXT;
ALTER TABLE "fleet_owner_documents" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "vehicle_documents" ADD COLUMN IF NOT EXISTS "storage_key" TEXT;
ALTER TABLE "vehicle_documents" ADD COLUMN IF NOT EXISTS "original_name" TEXT;
ALTER TABLE "vehicle_documents" ADD COLUMN IF NOT EXISTS "mime_type" TEXT;
ALTER TABLE "vehicle_documents" ADD COLUMN IF NOT EXISTS "review_note" TEXT;
ALTER TABLE "vehicle_documents" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3);
ALTER TABLE "vehicle_documents" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "ai_chat_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "user_role" NOT NULL,
    "title" TEXT,
    "locale" "locale" NOT NULL DEFAULT 'ar',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ai_chat_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_chat_sessions_user_id_updated_at_idx" ON "ai_chat_sessions"("user_id", "updated_at");
ALTER TABLE "ai_chat_sessions" DROP CONSTRAINT IF EXISTS "ai_chat_sessions_user_id_fkey";
ALTER TABLE "ai_chat_sessions" ADD CONSTRAINT "ai_chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ai_chat_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_chat_messages_session_id_created_at_idx" ON "ai_chat_messages"("session_id", "created_at");
ALTER TABLE "ai_chat_messages" DROP CONSTRAINT IF EXISTS "ai_chat_messages_session_id_fkey";
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ai_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
