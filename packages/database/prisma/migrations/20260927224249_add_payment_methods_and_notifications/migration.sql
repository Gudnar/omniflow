-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('CASH', 'BANK_TRANSFER', 'QR');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "notifyOnAppointmentPendingApproval" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyOnOrderPendingApproval" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "PaymentMethodType" NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "instructions" TEXT,
    "qrImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentMethod_tenantId_idx" ON "PaymentMethod"("tenantId");

-- CreateIndex
CREATE INDEX "Notification_tenantId_userId_createdAt_idx" ON "Notification"("tenantId", "userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
