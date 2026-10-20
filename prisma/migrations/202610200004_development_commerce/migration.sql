-- AlterTable
ALTER TABLE "Artifact" ADD COLUMN     "developmentOnly" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "editionId" TEXT;

-- AlterTable
ALTER TABLE "Download" ADD COLUMN     "consumedAt" TIMESTAMP(3),
ADD COLUMN     "tokenHash" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "checkoutKey" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "productName" TEXT,
ADD COLUMN     "productVersion" TEXT;

-- CreateTable
CREATE TABLE "DeliveryNotice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PURCHASE_READY',
    "transport" TEXT NOT NULL DEFAULT 'development-outbox',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryNotice_orderId_kind_key" ON "DeliveryNotice"("orderId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Download_tokenHash_key" ON "Download"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Order_userId_checkoutKey_key" ON "Order"("userId", "checkoutKey");

-- AddForeignKey
ALTER TABLE "DeliveryNotice" ADD CONSTRAINT "DeliveryNotice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryNotice" ADD CONSTRAINT "DeliveryNotice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
