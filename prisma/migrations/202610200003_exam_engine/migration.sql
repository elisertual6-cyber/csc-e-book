-- CreateEnum
CREATE TYPE "ExamMode" AS ENUM ('PRACTICE', 'MOCK');

-- CreateEnum
CREATE TYPE "ExamAccess" AS ENUM ('FREE', 'PREMIUM');

-- AlterTable
ALTER TABLE "Attempt" ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startKey" TEXT,
ADD COLUMN     "templateSnapshot" JSONB,
ALTER COLUMN "deadlineAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ExamTemplate" ADD COLUMN     "access" "ExamAccess" NOT NULL DEFAULT 'PREMIUM',
ADD COLUMN     "mode" "ExamMode" NOT NULL DEFAULT 'MOCK',
ADD COLUMN     "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Attempt_status_deadlineAt_idx" ON "Attempt"("status", "deadlineAt");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_userId_startKey_key" ON "Attempt"("userId", "startKey");
