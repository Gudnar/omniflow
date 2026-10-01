-- Rename WhatsApp-specific connection table/type into the generalized Meta model.
-- Hand-authored (not a raw `prisma migrate diff`) to preserve existing rows —
-- Prisma cannot detect renames and would otherwise emit DROP+CREATE.
ALTER TABLE "WhatsAppConnection" RENAME TO "MetaConnection";
ALTER TYPE "WhatsAppConnectionStatus" RENAME TO "MetaConnectionStatus";
ALTER TABLE "MetaConnection" RENAME CONSTRAINT "WhatsAppConnection_pkey" TO "MetaConnection_pkey";
ALTER TABLE "MetaConnection" RENAME CONSTRAINT "WhatsAppConnection_tenantId_fkey" TO "MetaConnection_tenantId_fkey";

ALTER TABLE "MetaConnection" RENAME COLUMN "phoneNumberId" TO "externalAccountId";
ALTER TABLE "MetaConnection" RENAME COLUMN "displayPhoneNumber" TO "displayName";
ALTER TABLE "MetaConnection" ALTER COLUMN "wabaId" DROP NOT NULL;

-- Backfill channel for the existing row(s) before making it NOT NULL.
ALTER TABLE "MetaConnection" ADD COLUMN "channel" "Channel";
UPDATE "MetaConnection" SET "channel" = 'WHATSAPP' WHERE "channel" IS NULL;
ALTER TABLE "MetaConnection" ALTER COLUMN "channel" SET NOT NULL;

-- Replace the old bare-unique constraints with the new composite-uniqueness model.
DROP INDEX "WhatsAppConnection_tenantId_key";
DROP INDEX "WhatsAppConnection_phoneNumberId_key";
CREATE UNIQUE INDEX "MetaConnection_tenantId_channel_key" ON "MetaConnection"("tenantId", "channel");
CREATE UNIQUE INDEX "MetaConnection_channel_externalAccountId_key" ON "MetaConnection"("channel", "externalAccountId");
ALTER INDEX "WhatsAppConnection_status_idx" RENAME TO "MetaConnection_status_idx";

-- New TikTok connection table.
CREATE TYPE "TikTokConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED');
CREATE TABLE "TikTokConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "status" "TikTokConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TikTokConnection_tenantId_key" ON "TikTokConnection"("tenantId");
CREATE UNIQUE INDEX "TikTokConnection_businessId_key" ON "TikTokConnection"("businessId");
CREATE INDEX "TikTokConnection_status_idx" ON "TikTokConnection"("status");
ALTER TABLE "TikTokConnection" ADD CONSTRAINT "TikTokConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
