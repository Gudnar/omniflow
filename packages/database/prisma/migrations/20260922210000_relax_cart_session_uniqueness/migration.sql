-- DropIndex
DROP INDEX "Cart_commerceSessionId_key";

-- CreateIndex
CREATE INDEX "Cart_commerceSessionId_idx" ON "Cart"("commerceSessionId");
