-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('LEAD', 'PROSPECT', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ContactSource" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'MESSENGER', 'WEBSITE', 'REFERRAL', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'WHATSAPP', 'TASK', 'OTHER');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "type" "ContactType" NOT NULL DEFAULT 'LEAD',
    "status" "ContactStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "ContactSource",
    "companyId" TEXT,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactTag" (
    "contactId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactTag_pkey" PRIMARY KEY ("contactId","tagId")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "ownerId" TEXT,
    "type" "ActivityType" NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Company_tenantId_idx" ON "Company"("tenantId");

-- CreateIndex
CREATE INDEX "Contact_tenantId_status_idx" ON "Contact"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Contact_tenantId_type_idx" ON "Contact"("tenantId", "type");

-- CreateIndex
CREATE INDEX "Contact_companyId_idx" ON "Contact"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_tenantId_name_key" ON "Tag"("tenantId", "name");

-- CreateIndex
CREATE INDEX "ContactTag_tagId_idx" ON "ContactTag"("tagId");

-- CreateIndex
CREATE INDEX "ContactTag_tenantId_idx" ON "ContactTag"("tenantId");

-- CreateIndex
CREATE INDEX "Note_tenantId_idx" ON "Note"("tenantId");

-- CreateIndex
CREATE INDEX "Note_contactId_idx" ON "Note"("contactId");

-- CreateIndex
CREATE INDEX "Activity_tenantId_idx" ON "Activity"("tenantId");

-- CreateIndex
CREATE INDEX "Activity_contactId_occurredAt_idx" ON "Activity"("contactId", "occurredAt");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactTag" ADD CONSTRAINT "ContactTag_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactTag" ADD CONSTRAINT "ContactTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactTag" ADD CONSTRAINT "ContactTag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
