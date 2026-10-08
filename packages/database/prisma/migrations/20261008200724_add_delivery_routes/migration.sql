-- CreateEnum
CREATE TYPE "DeliveryRouteStatus" AS ENUM ('PLANNED', 'PREPARING', 'IN_ROUTE', 'PARTIALLY_COMPLETED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryRouteStopStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "DeliveryRoute" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "routeDate" DATE NOT NULL,
    "responsibleUserId" TEXT,
    "status" "DeliveryRouteStatus" NOT NULL DEFAULT 'PLANNED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryRouteStop" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "fulfillmentId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "DeliveryRouteStopStatus" NOT NULL DEFAULT 'PENDING',
    "plannedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "DeliveryRouteStop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryRoute_tenantId_branchId_routeDate_idx" ON "DeliveryRoute"("tenantId", "branchId", "routeDate");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryRouteStop_fulfillmentId_key" ON "DeliveryRouteStop"("fulfillmentId");

-- CreateIndex
CREATE INDEX "DeliveryRouteStop_routeId_sequence_idx" ON "DeliveryRouteStop"("routeId", "sequence");

-- AddForeignKey
ALTER TABLE "DeliveryRoute" ADD CONSTRAINT "DeliveryRoute_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryRoute" ADD CONSTRAINT "DeliveryRoute_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryRoute" ADD CONSTRAINT "DeliveryRoute_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryRouteStop" ADD CONSTRAINT "DeliveryRouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "DeliveryRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryRouteStop" ADD CONSTRAINT "DeliveryRouteStop_fulfillmentId_fkey" FOREIGN KEY ("fulfillmentId") REFERENCES "Fulfillment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
