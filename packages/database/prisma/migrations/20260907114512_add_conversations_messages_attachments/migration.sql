-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'MESSENGER');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'PENDING', 'CLOSED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'NOTE', 'SYSTEM');

-- CreateTable
CREATE TABLE "ContactChannel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "externalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "contactChannelId" TEXT,
    "channel" "Channel" NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "branchId" TEXT,
    "assignedToId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "content" TEXT NOT NULL,
    "senderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactChannel_tenantId_idx" ON "ContactChannel"("tenantId");

-- CreateIndex
CREATE INDEX "ContactChannel_tenantId_channel_externalId_idx" ON "ContactChannel"("tenantId", "channel", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactChannel_contactId_channel_key" ON "ContactChannel"("contactId", "channel");

-- CreateIndex
CREATE INDEX "Conversation_tenantId_status_idx" ON "Conversation"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Conversation_tenantId_lastMessageAt_idx" ON "Conversation"("tenantId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_contactId_idx" ON "Conversation"("contactId");

-- CreateIndex
CREATE INDEX "Conversation_branchId_idx" ON "Conversation"("branchId");

-- CreateIndex
CREATE INDEX "Message_tenantId_idx" ON "Message"("tenantId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Attachment_tenantId_idx" ON "Attachment"("tenantId");

-- CreateIndex
CREATE INDEX "Attachment_messageId_idx" ON "Attachment"("messageId");

-- AddForeignKey
ALTER TABLE "ContactChannel" ADD CONSTRAINT "ContactChannel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactChannel" ADD CONSTRAINT "ContactChannel_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_contactChannelId_fkey" FOREIGN KEY ("contactChannelId") REFERENCES "ContactChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
