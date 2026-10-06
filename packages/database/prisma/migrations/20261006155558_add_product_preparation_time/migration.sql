-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "preparationMinutesSnapshot" INTEGER,
ADD COLUMN     "preparationReasonSnapshot" TEXT,
ADD COLUMN     "requiresPreparationSnapshot" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "preparationMinutes" INTEGER,
ADD COLUMN     "preparationReason" TEXT,
ADD COLUMN     "requiresPreparation" BOOLEAN NOT NULL DEFAULT false;
