-- AlterEnum
ALTER TYPE "DeliveryZoneMatchType" ADD VALUE 'DISTANCE_TIERS';

-- CreateTable
CREATE TABLE "DeliveryRateProfile" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryRateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryRateTier" (
    "id" TEXT NOT NULL,
    "rateProfileId" TEXT NOT NULL,
    "uptoKm" DOUBLE PRECISION NOT NULL,
    "fee" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "DeliveryRateTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryRateProfile_zoneId_idx" ON "DeliveryRateProfile"("zoneId");

-- CreateIndex
CREATE INDEX "DeliveryRateTier_rateProfileId_uptoKm_idx" ON "DeliveryRateTier"("rateProfileId", "uptoKm");

-- AddForeignKey
ALTER TABLE "DeliveryRateProfile" ADD CONSTRAINT "DeliveryRateProfile_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "DeliveryZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryRateTier" ADD CONSTRAINT "DeliveryRateTier_rateProfileId_fkey" FOREIGN KEY ("rateProfileId") REFERENCES "DeliveryRateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
