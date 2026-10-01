-- AlterTable
ALTER TABLE "CommerceSession" ADD COLUMN     "publicToken" TEXT,
ADD COLUMN     "publicTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "CommerceSession_publicToken_key" ON "CommerceSession"("publicToken");

-- CreateIndex
CREATE UNIQUE INDEX "EcommerceStore_slug_key" ON "EcommerceStore"("slug");
