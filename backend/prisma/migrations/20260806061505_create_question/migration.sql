-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MCQ', 'TYPED', 'VOICE');

-- CreateTable
CREATE TABLE "Question" (
    "id" UUID NOT NULL,
    "questionId" TEXT NOT NULL,
    "assessmentId" UUID NOT NULL,
    "type" "QuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "marks" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "options" JSONB,
    "correctOption" TEXT,
    "explanation" TEXT,
    "modelAnswer" TEXT,
    "gradingInstructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Question_questionId_key" ON "Question"("questionId");

-- CreateIndex
CREATE INDEX "Question_assessmentId_idx" ON "Question"("assessmentId");

-- CreateIndex
CREATE INDEX "Question_assessmentId_type_idx" ON "Question"("assessmentId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Question_assessmentId_order_key" ON "Question"("assessmentId", "order");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
