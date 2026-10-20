-- AlterTable
ALTER TABLE "PaymentSession" ADD COLUMN     "providerIntentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSession_providerIntentId_key" ON "PaymentSession"("providerIntentId");
