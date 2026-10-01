-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('PENDING', 'READY', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Fulfillment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT,
    "appointmentId" TEXT,
    "type" "FulfillmentType" NOT NULL,
    "status" "FulfillmentStatus" NOT NULL DEFAULT 'PENDING',
    "branchId" TEXT,
    "addressId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "receivedByName" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fulfillment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Fulfillment_orderId_key" ON "Fulfillment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Fulfillment_appointmentId_key" ON "Fulfillment"("appointmentId");

-- CreateIndex
CREATE INDEX "Fulfillment_tenantId_status_idx" ON "Fulfillment"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "Fulfillment" ADD CONSTRAINT "Fulfillment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fulfillment" ADD CONSTRAINT "Fulfillment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fulfillment" ADD CONSTRAINT "Fulfillment_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fulfillment" ADD CONSTRAINT "Fulfillment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fulfillment" ADD CONSTRAINT "Fulfillment_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "CustomerAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;
