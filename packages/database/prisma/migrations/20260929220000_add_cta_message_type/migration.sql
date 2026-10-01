-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'CTA';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "ctaPayload" JSONB;
