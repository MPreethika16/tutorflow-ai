ALTER TABLE "Assessment"
ADD COLUMN "assessmentId" TEXT;

UPDATE "Assessment"
SET "assessmentId" = 'ASM-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8))
WHERE "assessmentId" IS NULL;

ALTER TABLE "Assessment"
ALTER COLUMN "assessmentId" SET NOT NULL;

CREATE UNIQUE INDEX "Assessment_assessmentId_key"
ON "Assessment"("assessmentId");