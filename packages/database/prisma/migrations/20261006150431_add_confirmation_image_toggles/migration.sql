-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "sendAppointmentQrCode" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sendAppointmentReceiptImage" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sendOrderQrCode" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sendOrderReceiptImage" BOOLEAN NOT NULL DEFAULT true;
