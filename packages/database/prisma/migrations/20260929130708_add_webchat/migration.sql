-- AlterEnum
ALTER TYPE "Channel" ADD VALUE 'WEBCHAT';

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "webchatToken" TEXT;

-- AlterTable
ALTER TABLE "LinkPage" ADD COLUMN     "chatEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_webchatToken_key" ON "Conversation"("webchatToken");

