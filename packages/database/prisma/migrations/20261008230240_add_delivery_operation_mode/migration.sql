-- CreateEnum
CREATE TYPE "DeliveryOperationMode" AS ENUM ('ROUTE_BASED', 'IMMEDIATE');

-- AlterTable
ALTER TABLE "DeliveryProviderConfig" ADD COLUMN     "operationMode" "DeliveryOperationMode" NOT NULL DEFAULT 'ROUTE_BASED';
