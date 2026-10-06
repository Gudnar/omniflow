-- AlterTable
ALTER TABLE "AiAgent" ADD COLUMN     "enabledTools" TEXT[] DEFAULT ARRAY[]::TEXT[];
