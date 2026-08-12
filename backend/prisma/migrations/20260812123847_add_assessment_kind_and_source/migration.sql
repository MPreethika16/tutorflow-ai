-- CreateEnum
CREATE TYPE "AssessmentKind" AS ENUM ('PRACTICE', 'TEST');

-- CreateEnum
CREATE TYPE "ContentSource" AS ENUM ('MANUAL', 'AI_GENERATED');

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "kind" "AssessmentKind" NOT NULL DEFAULT 'PRACTICE',
ADD COLUMN     "source" "ContentSource" NOT NULL DEFAULT 'MANUAL';
