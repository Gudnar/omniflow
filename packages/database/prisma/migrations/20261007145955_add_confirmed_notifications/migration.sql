-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "notifyOnAppointmentConfirmed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyOnOrderConfirmed" BOOLEAN NOT NULL DEFAULT true;
