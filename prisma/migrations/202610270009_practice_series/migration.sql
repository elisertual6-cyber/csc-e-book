ALTER TABLE "ExamTemplate"
  ADD COLUMN "seriesKey" TEXT,
  ADD COLUMN "setPosition" INTEGER,
  ADD COLUMN "questionKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE UNIQUE INDEX "ExamTemplate_seriesKey_setPosition_key"
  ON "ExamTemplate"("seriesKey", "setPosition");

ALTER TABLE "ExamTemplate" ADD CONSTRAINT "ExamTemplate_series_shape" CHECK (
  ("seriesKey" IS NULL AND "setPosition" IS NULL AND cardinality("questionKeys") = 0)
  OR
  ("seriesKey" IS NOT NULL AND length("seriesKey") > 0
    AND "setPosition" IS NOT NULL AND "setPosition" BETWEEN 1 AND 5
    AND cardinality("questionKeys") = 160 AND "questionCount" = 160
    AND "mode" = 'PRACTICE' AND "level" = 'COMMON'
    AND "access" = 'FREE' AND "durationSeconds" = 0)
);
-- Existing table RLS, revoked browser grants and owner-only server access remain in force.
