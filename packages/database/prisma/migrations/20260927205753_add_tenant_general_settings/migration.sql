-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'BOB',
ADD COLUMN     "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
ADD COLUMN     "decimalSeparator" TEXT NOT NULL DEFAULT ',',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'es',
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "taxId" TEXT,
ADD COLUMN     "thousandsSeparator" TEXT NOT NULL DEFAULT '.',
ADD COLUMN     "timeFormat" TEXT NOT NULL DEFAULT '24h',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/La_Paz';
