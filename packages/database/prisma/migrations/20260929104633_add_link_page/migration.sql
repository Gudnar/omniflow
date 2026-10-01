-- CreateEnum
CREATE TYPE "LinkPageStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "LinkPage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "status" "LinkPageStatus" NOT NULL DEFAULT 'DRAFT',
    "primaryColor" TEXT NOT NULL DEFAULT '#2563eb',
    "backgroundColor" TEXT NOT NULL DEFAULT '#ffffff',
    "textColor" TEXT NOT NULL DEFAULT '#111827',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkPageItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "linkPageId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkPageItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LinkPage_tenantId_key" ON "LinkPage"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "LinkPage_slug_key" ON "LinkPage"("slug");

-- CreateIndex
CREATE INDEX "LinkPageItem_linkPageId_sortOrder_idx" ON "LinkPageItem"("linkPageId", "sortOrder");

-- AddForeignKey
ALTER TABLE "LinkPage" ADD CONSTRAINT "LinkPage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkPageItem" ADD CONSTRAINT "LinkPageItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkPageItem" ADD CONSTRAINT "LinkPageItem_linkPageId_fkey" FOREIGN KEY ("linkPageId") REFERENCES "LinkPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
