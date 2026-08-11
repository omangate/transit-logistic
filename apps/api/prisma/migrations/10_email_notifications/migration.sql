-- Email delivery logging & verification
CREATE TYPE "email_delivery_status" AS ENUM ('queued', 'sent', 'delivered', 'failed', 'skipped', 'bounced', 'complained');

CREATE TABLE "email_delivery_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "recipient_email" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "template_event" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "locale" "Locale" NOT NULL DEFAULT 'ar',
    "subject" TEXT NOT NULL,
    "status" "email_delivery_status" NOT NULL DEFAULT 'queued',
    "provider" TEXT,
    "provider_message_id" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_category" TEXT,
    "error_message" TEXT,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "email_delivery_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_delivery_logs_event_key_key" ON "email_delivery_logs"("event_key");
CREATE INDEX "email_delivery_logs_recipient_email_idx" ON "email_delivery_logs"("recipient_email");
CREATE INDEX "email_delivery_logs_template_event_idx" ON "email_delivery_logs"("template_event");
CREATE INDEX "email_delivery_logs_user_id_idx" ON "email_delivery_logs"("user_id");

CREATE TABLE "email_verification_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens"("user_id");
CREATE INDEX "email_verification_tokens_token_hash_idx" ON "email_verification_tokens"("token_hash");

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_preferences" JSONB DEFAULT '{}';

ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_delivery_logs" ADD CONSTRAINT "email_delivery_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
