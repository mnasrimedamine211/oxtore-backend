-- AlterEnum
ALTER TYPE "BoutiqueStatus" ADD VALUE 'rejected';

-- AlterTable
ALTER TABLE "boutiques" ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "responded_at" TIMESTAMP(3),
ADD COLUMN     "responded_by" UUID;
