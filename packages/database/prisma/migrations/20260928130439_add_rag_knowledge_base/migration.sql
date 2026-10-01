-- CreateEnum
CREATE TYPE "KnowledgeDocumentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "KnowledgeDocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "embedding" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAgentKnowledgeDocument" (
    "tenantId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "AiAgentKnowledgeDocument_pkey" PRIMARY KEY ("agentId","documentId")
);

-- CreateIndex
CREATE INDEX "KnowledgeDocument_tenantId_status_idx" ON "KnowledgeDocument"("tenantId", "status");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_tenantId_documentId_idx" ON "KnowledgeChunk"("tenantId", "documentId");

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAgentKnowledgeDocument" ADD CONSTRAINT "AiAgentKnowledgeDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAgentKnowledgeDocument" ADD CONSTRAINT "AiAgentKnowledgeDocument_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AiAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAgentKnowledgeDocument" ADD CONSTRAINT "AiAgentKnowledgeDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
