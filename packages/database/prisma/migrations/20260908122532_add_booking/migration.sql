-- CreateEnum
CREATE TYPE "BookingServiceStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BookingResourceType" AS ENUM ('STAFF', 'ROOM', 'EQUIPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "BookingResourceStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "UserScheduleStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "BookingService" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "status" "BookingServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingServiceUser" (
    "tenantId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "BookingServiceUser_pkey" PRIMARY KEY ("serviceId","userId")
);

-- CreateTable
CREATE TABLE "BookingResource" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BookingResourceType" NOT NULL,
    "userId" TEXT,
    "status" "BookingResourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingResourceService" (
    "tenantId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "BookingResourceService_pkey" PRIMARY KEY ("resourceId","serviceId")
);

-- CreateTable
CREATE TABLE "BookingResourceSchedule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingResourceSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSchedule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/La_Paz',
    "status" "UserScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserScheduleInterval" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userScheduleId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserScheduleInterval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTimeOff" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTimeOff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "commerceSessionId" TEXT,
    "addressId" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "notes" TEXT,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentService" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "serviceNameSnapshot" TEXT NOT NULL,
    "priceSnapshot" DECIMAL(10,2) NOT NULL,
    "durationMinutesSnapshot" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentResource" (
    "tenantId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,

    CONSTRAINT "AppointmentResource_pkey" PRIMARY KEY ("appointmentId","resourceId")
);

-- CreateTable
CREATE TABLE "AppointmentStatusHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "fromStatus" "AppointmentStatus",
    "toStatus" "AppointmentStatus" NOT NULL,
    "note" TEXT,
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingService_tenantId_slug_key" ON "BookingService"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "BookingResource_tenantId_branchId_idx" ON "BookingResource"("tenantId", "branchId");

-- CreateIndex
CREATE INDEX "BookingResourceSchedule_resourceId_dayOfWeek_idx" ON "BookingResourceSchedule"("resourceId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "UserSchedule_tenantId_userId_status_idx" ON "UserSchedule"("tenantId", "userId", "status");

-- CreateIndex
CREATE INDEX "UserScheduleInterval_userScheduleId_dayOfWeek_idx" ON "UserScheduleInterval"("userScheduleId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "UserTimeOff_tenantId_userId_idx" ON "UserTimeOff"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "Appointment_tenantId_branchId_startAt_idx" ON "Appointment"("tenantId", "branchId", "startAt");

-- CreateIndex
CREATE INDEX "Appointment_tenantId_contactId_idx" ON "Appointment"("tenantId", "contactId");

-- CreateIndex
CREATE INDEX "AppointmentService_appointmentId_idx" ON "AppointmentService"("appointmentId");

-- CreateIndex
CREATE INDEX "AppointmentStatusHistory_appointmentId_createdAt_idx" ON "AppointmentStatusHistory"("appointmentId", "createdAt");

-- AddForeignKey
ALTER TABLE "BookingService" ADD CONSTRAINT "BookingService_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingServiceUser" ADD CONSTRAINT "BookingServiceUser_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingServiceUser" ADD CONSTRAINT "BookingServiceUser_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "BookingService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingResource" ADD CONSTRAINT "BookingResource_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingResource" ADD CONSTRAINT "BookingResource_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingResourceService" ADD CONSTRAINT "BookingResourceService_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingResourceService" ADD CONSTRAINT "BookingResourceService_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "BookingResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingResourceService" ADD CONSTRAINT "BookingResourceService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "BookingService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingResourceSchedule" ADD CONSTRAINT "BookingResourceSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingResourceSchedule" ADD CONSTRAINT "BookingResourceSchedule_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "BookingResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSchedule" ADD CONSTRAINT "UserSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserScheduleInterval" ADD CONSTRAINT "UserScheduleInterval_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserScheduleInterval" ADD CONSTRAINT "UserScheduleInterval_userScheduleId_fkey" FOREIGN KEY ("userScheduleId") REFERENCES "UserSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTimeOff" ADD CONSTRAINT "UserTimeOff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_commerceSessionId_fkey" FOREIGN KEY ("commerceSessionId") REFERENCES "CommerceSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "CustomerAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentService" ADD CONSTRAINT "AppointmentService_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentService" ADD CONSTRAINT "AppointmentService_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentService" ADD CONSTRAINT "AppointmentService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "BookingService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentResource" ADD CONSTRAINT "AppointmentResource_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentResource" ADD CONSTRAINT "AppointmentResource_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentResource" ADD CONSTRAINT "AppointmentResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "BookingResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentStatusHistory" ADD CONSTRAINT "AppointmentStatusHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentStatusHistory" ADD CONSTRAINT "AppointmentStatusHistory_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
