-- CreateEnum
CREATE TYPE "FlowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "FlowNodeType" AS ENUM ('TRIGGER', 'CONDITION', 'ACTION', 'WAIT', 'END');

-- CreateEnum
CREATE TYPE "FlowExecutionStatus" AS ENUM ('RUNNING', 'WAITING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FlowExecutionLogStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "abandonedNotifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "contactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flow" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "FlowStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlowNode" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "type" "FlowNodeType" NOT NULL,
    "subtype" TEXT NOT NULL,
    "name" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlowNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlowEdge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "sourceHandle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlowEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlowExecution" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "status" "FlowExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "triggerEventType" TEXT,
    "contextData" JSONB NOT NULL DEFAULT '{}',
    "currentNodeId" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "FlowExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlowExecutionLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "status" "FlowExecutionLogStatus" NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "FlowExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_tenantId_type_createdAt_idx" ON "Event"("tenantId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Flow_tenantId_status_idx" ON "Flow"("tenantId", "status");

-- CreateIndex
CREATE INDEX "FlowNode_tenantId_flowId_idx" ON "FlowNode"("tenantId", "flowId");

-- CreateIndex
CREATE INDEX "FlowEdge_tenantId_flowId_idx" ON "FlowEdge"("tenantId", "flowId");

-- CreateIndex
CREATE INDEX "FlowEdge_sourceNodeId_idx" ON "FlowEdge"("sourceNodeId");

-- CreateIndex
CREATE INDEX "FlowExecution_tenantId_flowId_status_idx" ON "FlowExecution"("tenantId", "flowId", "status");

-- CreateIndex
CREATE INDEX "FlowExecutionLog_tenantId_executionId_idx" ON "FlowExecutionLog"("tenantId", "executionId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flow" ADD CONSTRAINT "Flow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowNode" ADD CONSTRAINT "FlowNode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowNode" ADD CONSTRAINT "FlowNode_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowEdge" ADD CONSTRAINT "FlowEdge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowEdge" ADD CONSTRAINT "FlowEdge_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowEdge" ADD CONSTRAINT "FlowEdge_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "FlowNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowEdge" ADD CONSTRAINT "FlowEdge_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "FlowNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowExecution" ADD CONSTRAINT "FlowExecution_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowExecution" ADD CONSTRAINT "FlowExecution_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowExecutionLog" ADD CONSTRAINT "FlowExecutionLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowExecutionLog" ADD CONSTRAINT "FlowExecutionLog_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "FlowExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
