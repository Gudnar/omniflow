-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "minBookingLeadDays" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "BookingBlackoutDate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingBlackoutDate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingBlackoutDate_tenantId_branchId_idx" ON "BookingBlackoutDate"("tenantId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingBlackoutDate_branchId_date_key" ON "BookingBlackoutDate"("branchId", "date");

-- AddForeignKey
ALTER TABLE "BookingBlackoutDate" ADD CONSTRAINT "BookingBlackoutDate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingBlackoutDate" ADD CONSTRAINT "BookingBlackoutDate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
