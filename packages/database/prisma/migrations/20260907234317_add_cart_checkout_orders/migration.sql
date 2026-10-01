-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CHECKED_OUT', 'ABANDONED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "reference" TEXT,
    "city" TEXT,
    "zone" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "notes" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommerceSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "conversationId" TEXT,
    "storeId" TEXT,
    "branchId" TEXT,
    "cartId" TEXT,
    "appointmentId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "commerceSessionId" TEXT NOT NULL,
    "conversationId" TEXT,
    "branchId" TEXT,
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "currency" TEXT NOT NULL DEFAULT 'BOB',
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "shipping" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "branchId" TEXT,
    "addressId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'CONFIRMED',
    "fulfillmentType" "FulfillmentType" NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "shipping" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "skuSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerAddress_tenantId_contactId_idx" ON "CustomerAddress"("tenantId", "contactId");

-- CreateIndex
CREATE INDEX "CommerceSession_tenantId_contactId_idx" ON "CommerceSession"("tenantId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_commerceSessionId_key" ON "Cart"("commerceSessionId");

-- CreateIndex
CREATE INDEX "Cart_tenantId_contactId_status_idx" ON "Cart"("tenantId", "contactId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_variantId_key" ON "CartItem"("cartId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_cartId_key" ON "Order"("cartId");

-- CreateIndex
CREATE INDEX "Order_tenantId_contactId_idx" ON "Order"("tenantId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_tenantId_orderNumber_key" ON "Order"("tenantId", "orderNumber");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceSession" ADD CONSTRAINT "CommerceSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceSession" ADD CONSTRAINT "CommerceSession_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceSession" ADD CONSTRAINT "CommerceSession_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceSession" ADD CONSTRAINT "CommerceSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_commerceSessionId_fkey" FOREIGN KEY ("commerceSessionId") REFERENCES "CommerceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "CustomerAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
