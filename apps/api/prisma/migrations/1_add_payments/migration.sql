-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('requires_payment_method', 'requires_confirmation', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "payment_provider_type" AS ENUM ('mock', 'stripe', 'tap', 'thawani');

-- CreateTable
CREATE TABLE "payment_intents" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "status" "payment_status" NOT NULL DEFAULT 'requires_confirmation',
    "provider" "payment_provider_type" NOT NULL DEFAULT 'mock',
    "provider_intent_id" TEXT,
    "client_secret" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "failure_code" TEXT,
    "failure_message" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL,
    "payment_intent_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_provider_intent_id_key" ON "payment_intents"("provider_intent_id");

-- CreateIndex
CREATE INDEX "payment_intents_shipment_id_idx" ON "payment_intents"("shipment_id");

-- CreateIndex
CREATE INDEX "payment_intents_customer_id_idx" ON "payment_intents"("customer_id");

-- CreateIndex
CREATE INDEX "payment_intents_status_idx" ON "payment_intents"("status");

-- CreateIndex
CREATE INDEX "payment_events_payment_intent_id_created_at_idx" ON "payment_events"("payment_intent_id", "created_at");

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_intent_id_fkey" FOREIGN KEY ("payment_intent_id") REFERENCES "payment_intents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
