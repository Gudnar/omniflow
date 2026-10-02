-- CreateTable
CREATE TABLE "TenantMetaAppCredential" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "appSecretEncrypted" TEXT NOT NULL,
    "webhookVerifyToken" TEXT NOT NULL,
    "webhookPathId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantMetaAppCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantAiCredential" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantAiCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantMetaAppCredential_tenantId_key" ON "TenantMetaAppCredential"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantMetaAppCredential_webhookPathId_key" ON "TenantMetaAppCredential"("webhookPathId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantAiCredential_tenantId_providerId_key" ON "TenantAiCredential"("tenantId", "providerId");

-- AddForeignKey
ALTER TABLE "TenantMetaAppCredential" ADD CONSTRAINT "TenantMetaAppCredential_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAiCredential" ADD CONSTRAINT "TenantAiCredential_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAiCredential" ADD CONSTRAINT "TenantAiCredential_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AiProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
