-- CreateEnum
CREATE TYPE "PaymentSessionState" AS ENUM ('CREATING', 'OPEN', 'PAID', 'REVIEW_REQUIRED', 'REFUNDED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentMethod" TEXT NOT NULL DEFAULT 'mock';

-- CreateTable
CREATE TABLE "PaymentSession" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "providerSessionId" TEXT,
    "providerPaymentId" TEXT,
    "checkoutUrl" TEXT,
    "state" "PaymentSessionState" NOT NULL DEFAULT 'CREATING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookReceipt" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "bodyHash" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSession_orderId_key" ON "PaymentSession"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSession_providerSessionId_key" ON "PaymentSession"("providerSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSession_providerPaymentId_key" ON "PaymentSession"("providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookReceipt_eventId_key" ON "PaymentWebhookReceipt"("eventId");

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
