-- CreateEnum
CREATE TYPE "AiProviderType" AS ENUM ('OPENAI', 'ANTHROPIC', 'GEMINI');

-- CreateEnum
CREATE TYPE "AiModelStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AiAgentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "AiProvider" (
    "id" TEXT NOT NULL,
    "type" "AiProviderType" NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiModel" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "capabilities" TEXT[],
    "status" "AiModelStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAgent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AiAgentStatus" NOT NULL DEFAULT 'INACTIVE',
    "modelId" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "goal" TEXT,
    "personality" TEXT,
    "language" TEXT NOT NULL DEFAULT 'es',
    "channels" "Channel"[],
    "escalationKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxTokens" INTEGER NOT NULL DEFAULT 500,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "conversationId" TEXT,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiProvider_type_key" ON "AiProvider"("type");

-- CreateIndex
CREATE UNIQUE INDEX "AiModel_providerId_name_key" ON "AiModel"("providerId", "name");

-- CreateIndex
CREATE INDEX "AiAgent_tenantId_status_idx" ON "AiAgent"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AiUsage_tenantId_createdAt_idx" ON "AiUsage"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiModel" ADD CONSTRAINT "AiModel_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AiProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAgent" ADD CONSTRAINT "AiAgent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAgent" ADD CONSTRAINT "AiAgent_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AiModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AiAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
