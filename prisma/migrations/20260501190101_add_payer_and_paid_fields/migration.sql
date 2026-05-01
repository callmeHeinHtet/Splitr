-- AlterTable
ALTER TABLE "Bill" ADD COLUMN     "payerHandle" TEXT,
ADD COLUMN     "payerName" TEXT,
ADD COLUMN     "payerProvider" TEXT;

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidAt" TIMESTAMP(3);
