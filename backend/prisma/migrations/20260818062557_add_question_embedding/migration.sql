-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "embedding" vector(1536);
