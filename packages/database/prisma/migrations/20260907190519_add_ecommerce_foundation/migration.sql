-- CreateEnum
CREATE TYPE "EcommerceStoreStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "EcommerceOperationMode" AS ENUM ('DIRECT_SALE', 'BOOKING', 'BOTH');

-- CreateEnum
CREATE TYPE "EcommerceLocationSource" AS ENUM ('WHATSAPP', 'STOREFRONT', 'BOTH', 'NONE');

-- CreateEnum
CREATE TYPE "FulfillmentType" AS ENUM ('PICKUP', 'LOCAL_DELIVERY', 'SHIPPING');

-- CreateEnum
CREATE TYPE "EcommerceSectionType" AS ENUM ('BANNER', 'TEXT_BLOCK', 'IMAGE_GALLERY');

-- CreateTable
CREATE TABLE "EcommerceStore" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "EcommerceStoreStatus" NOT NULL DEFAULT 'DRAFT',
    "operationMode" "EcommerceOperationMode" NOT NULL DEFAULT 'DIRECT_SALE',
    "locationSource" "EcommerceLocationSource" NOT NULL DEFAULT 'WHATSAPP',
    "fulfillmentOptions" "FulfillmentType"[] DEFAULT ARRAY['PICKUP']::"FulfillmentType"[],
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcommerceStore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcommerceStoreSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "logo" TEXT,
    "mobileLogo" TEXT,
    "favicon" TEXT,
    "heroImage" TEXT,
    "mobileHeroImage" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#2563eb',
    "secondaryColor" TEXT NOT NULL DEFAULT '#1e293b',
    "buttonColor" TEXT NOT NULL DEFAULT '#2563eb',
    "textColor" TEXT NOT NULL DEFAULT '#111827',
    "backgroundColor" TEXT NOT NULL DEFAULT '#ffffff',
    "promoColor" TEXT NOT NULL DEFAULT '#dc2626',
    "fontFamily" TEXT NOT NULL DEFAULT 'Inter',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcommerceStoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcommerceSection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "type" "EcommerceSectionType" NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcommerceSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcommerceStoreBranch" (
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "EcommerceStoreBranch_pkey" PRIMARY KEY ("storeId","branchId")
);

-- CreateIndex
CREATE UNIQUE INDEX "EcommerceStore_tenantId_key" ON "EcommerceStore"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "EcommerceStoreSettings_storeId_key" ON "EcommerceStoreSettings"("storeId");

-- CreateIndex
CREATE INDEX "EcommerceSection_storeId_sortOrder_idx" ON "EcommerceSection"("storeId", "sortOrder");

-- AddForeignKey
ALTER TABLE "EcommerceStore" ADD CONSTRAINT "EcommerceStore_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceStoreSettings" ADD CONSTRAINT "EcommerceStoreSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceStoreSettings" ADD CONSTRAINT "EcommerceStoreSettings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "EcommerceStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceSection" ADD CONSTRAINT "EcommerceSection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceSection" ADD CONSTRAINT "EcommerceSection_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "EcommerceStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceStoreBranch" ADD CONSTRAINT "EcommerceStoreBranch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceStoreBranch" ADD CONSTRAINT "EcommerceStoreBranch_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "EcommerceStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceStoreBranch" ADD CONSTRAINT "EcommerceStoreBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
