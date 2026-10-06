-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "patientName" TEXT;

-- CreateIndex
CREATE INDEX "Appointment_groupId_idx" ON "Appointment"("groupId");
