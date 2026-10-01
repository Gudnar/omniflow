-- CreateEnum
CREATE TYPE "WhatsAppConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "externalId" TEXT;

-- CreateTable
CREATE TABLE "WhatsAppConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "wabaId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "displayPhoneNumber" TEXT NOT NULL,
    "status" "WhatsAppConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConnection_tenantId_key" ON "WhatsAppConnection"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConnection_phoneNumberId_key" ON "WhatsAppConnection"("phoneNumberId");

-- CreateIndex
CREATE INDEX "WhatsAppConnection_status_idx" ON "WhatsAppConnection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Message_externalId_key" ON "Message"("externalId");

-- AddForeignKey
ALTER TABLE "WhatsAppConnection" ADD CONSTRAINT "WhatsAppConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

