-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerLocation" JSONB,
ADD COLUMN     "trackingCode" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "orderApprovalMode" TEXT NOT NULL DEFAULT 'AUTOMATIC';
