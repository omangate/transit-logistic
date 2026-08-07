-- V1: bookings, availability calendar, quote enhancements, messaging, support, auth hardening
-- prisma:disable-transaction

-- Quote status enum extensions (must run outside transaction on PostgreSQL)
ALTER TYPE "quote_request_status" ADD VALUE IF NOT EXISTS 'countered';
ALTER TYPE "quote_request_status" ADD VALUE IF NOT EXISTS 'cancelled';

-- New enums
CREATE TYPE "booking_status" AS ENUM ('pending', 'confirmed', 'active', 'completed', 'cancelled', 'expired');
CREATE TYPE "availability_block_type" AS ENUM ('available', 'busy', 'maintenance', 'blocked');
CREATE TYPE "support_ticket_status" AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE "support_ticket_priority" AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE "conversation_context_type" AS ENUM ('quote', 'booking', 'shipment', 'general');

-- User auth hardening
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "failed_login_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_token_hash_idx" ON "password_reset_tokens"("token_hash");
ALTER TABLE "password_reset_tokens" DROP CONSTRAINT IF EXISTS "password_reset_tokens_user_id_fkey";
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Quote enhancements
ALTER TABLE "truck_quote_requests" ADD COLUMN IF NOT EXISTS "start_date" TIMESTAMP(3);
ALTER TABLE "truck_quote_requests" ADD COLUMN IF NOT EXISTS "end_date" TIMESTAMP(3);
ALTER TABLE "truck_quote_requests" ADD COLUMN IF NOT EXISTS "with_driver" BOOLEAN;
ALTER TABLE "truck_quote_requests" ADD COLUMN IF NOT EXISTS "quoted_amount" DECIMAL(12,3);
ALTER TABLE "truck_quote_requests" ADD COLUMN IF NOT EXISTS "counter_amount" DECIMAL(12,3);
ALTER TABLE "truck_quote_requests" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'OMR';
ALTER TABLE "truck_quote_requests" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "quote_status_history" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "status" "quote_request_status" NOT NULL,
    "note" TEXT,
    "actor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quote_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "quote_status_history_quote_id_idx" ON "quote_status_history"("quote_id");
ALTER TABLE "quote_status_history" DROP CONSTRAINT IF EXISTS "quote_status_history_quote_id_fkey";
ALTER TABLE "quote_status_history" ADD CONSTRAINT "quote_status_history_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "truck_quote_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Availability blocks
CREATE TABLE IF NOT EXISTS "truck_availability_blocks" (
    "id" UUID NOT NULL,
    "truck_listing_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "block_type" "availability_block_type" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "truck_availability_blocks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "truck_availability_blocks_truck_listing_id_start_date_end_date_idx" ON "truck_availability_blocks"("truck_listing_id", "start_date", "end_date");
ALTER TABLE "truck_availability_blocks" DROP CONSTRAINT IF EXISTS "truck_availability_blocks_truck_listing_id_fkey";
ALTER TABLE "truck_availability_blocks" ADD CONSTRAINT "truck_availability_blocks_truck_listing_id_fkey" FOREIGN KEY ("truck_listing_id") REFERENCES "truck_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bookings
CREATE TABLE IF NOT EXISTS "truck_bookings" (
    "id" UUID NOT NULL,
    "truck_listing_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "fleet_owner_id" UUID NOT NULL,
    "quote_request_id" UUID,
    "shipment_id" UUID,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "with_driver" BOOLEAN NOT NULL DEFAULT false,
    "status" "booking_status" NOT NULL DEFAULT 'pending',
    "daily_rate" DECIMAL(12,3),
    "total_amount" DECIMAL(12,3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'OMR',
    "notes" TEXT,
    "expires_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "truck_bookings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "truck_bookings_quote_request_id_key" ON "truck_bookings"("quote_request_id");
CREATE UNIQUE INDEX IF NOT EXISTS "truck_bookings_shipment_id_key" ON "truck_bookings"("shipment_id");
CREATE INDEX IF NOT EXISTS "truck_bookings_truck_listing_id_start_date_end_date_idx" ON "truck_bookings"("truck_listing_id", "start_date", "end_date");
CREATE INDEX IF NOT EXISTS "truck_bookings_customer_id_idx" ON "truck_bookings"("customer_id");
CREATE INDEX IF NOT EXISTS "truck_bookings_fleet_owner_id_idx" ON "truck_bookings"("fleet_owner_id");
CREATE INDEX IF NOT EXISTS "truck_bookings_status_idx" ON "truck_bookings"("status");

ALTER TABLE "truck_bookings" DROP CONSTRAINT IF EXISTS "truck_bookings_truck_listing_id_fkey";
ALTER TABLE "truck_bookings" ADD CONSTRAINT "truck_bookings_truck_listing_id_fkey" FOREIGN KEY ("truck_listing_id") REFERENCES "truck_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "truck_bookings" DROP CONSTRAINT IF EXISTS "truck_bookings_customer_id_fkey";
ALTER TABLE "truck_bookings" ADD CONSTRAINT "truck_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "truck_bookings" DROP CONSTRAINT IF EXISTS "truck_bookings_fleet_owner_id_fkey";
ALTER TABLE "truck_bookings" ADD CONSTRAINT "truck_bookings_fleet_owner_id_fkey" FOREIGN KEY ("fleet_owner_id") REFERENCES "fleet_owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "truck_bookings" DROP CONSTRAINT IF EXISTS "truck_bookings_quote_request_id_fkey";
ALTER TABLE "truck_bookings" ADD CONSTRAINT "truck_bookings_quote_request_id_fkey" FOREIGN KEY ("quote_request_id") REFERENCES "truck_quote_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "truck_bookings" DROP CONSTRAINT IF EXISTS "truck_bookings_shipment_id_fkey";
ALTER TABLE "truck_bookings" ADD CONSTRAINT "truck_bookings_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Messaging
CREATE TABLE IF NOT EXISTS "conversations" (
    "id" UUID NOT NULL,
    "context_type" "conversation_context_type" NOT NULL,
    "quote_id" UUID,
    "booking_id" UUID,
    "shipment_id" UUID,
    "customer_id" UUID NOT NULL,
    "fleet_user_id" UUID NOT NULL,
    "fleet_owner_id" UUID NOT NULL,
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "conversations_customer_id_idx" ON "conversations"("customer_id");
CREATE INDEX IF NOT EXISTS "conversations_fleet_user_id_idx" ON "conversations"("fleet_user_id");
CREATE INDEX IF NOT EXISTS "conversations_fleet_owner_id_idx" ON "conversations"("fleet_owner_id");
CREATE INDEX IF NOT EXISTS "conversations_quote_id_idx" ON "conversations"("quote_id");
CREATE INDEX IF NOT EXISTS "conversations_booking_id_idx" ON "conversations"("booking_id");
CREATE INDEX IF NOT EXISTS "conversations_shipment_id_idx" ON "conversations"("shipment_id");

ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "conversations_customer_id_fkey";
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "conversations_fleet_user_id_fkey";
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_fleet_user_id_fkey" FOREIGN KEY ("fleet_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "conversations_fleet_owner_id_fkey";
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_fleet_owner_id_fkey" FOREIGN KEY ("fleet_owner_id") REFERENCES "fleet_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");
CREATE INDEX IF NOT EXISTS "messages_sender_id_idx" ON "messages"("sender_id");
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_conversation_id_fkey";
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_sender_id_fkey";
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Support tickets
CREATE TABLE IF NOT EXISTS "support_tickets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "support_ticket_status" NOT NULL DEFAULT 'open',
    "priority" "support_ticket_priority" NOT NULL DEFAULT 'medium',
    "booking_id" UUID,
    "shipment_id" UUID,
    "payment_id" UUID,
    "assigned_to_id" UUID,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "support_tickets_user_id_idx" ON "support_tickets"("user_id");
CREATE INDEX IF NOT EXISTS "support_tickets_status_idx" ON "support_tickets"("status");
ALTER TABLE "support_tickets" DROP CONSTRAINT IF EXISTS "support_tickets_user_id_fkey";
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "support_ticket_messages" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "support_ticket_messages_ticket_id_idx" ON "support_ticket_messages"("ticket_id");
ALTER TABLE "support_ticket_messages" DROP CONSTRAINT IF EXISTS "support_ticket_messages_ticket_id_fkey";
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
