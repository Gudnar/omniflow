-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "adReferral" JSONB,
ADD COLUMN     "isNewContact" BOOLEAN NOT NULL DEFAULT false;
