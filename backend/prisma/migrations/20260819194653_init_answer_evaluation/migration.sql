-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('PENDING', 'WAITING_FOR_REVIEW', 'APPROVED');

-- CreateTable
CREATE TABLE "AnswerEvaluation" (
    "id" UUID NOT NULL,
    "studentAnswerId" UUID NOT NULL,
    "aiMarks" INTEGER,
    "aiFeedback" TEXT,
    "aiReasoning" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "teacherMarks" INTEGER,
    "teacherFeedback" TEXT,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnswerEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnswerEvaluation_studentAnswerId_key" ON "AnswerEvaluation"("studentAnswerId");

-- CreateIndex
CREATE INDEX "AnswerEvaluation_status_idx" ON "AnswerEvaluation"("status");

-- AddForeignKey
ALTER TABLE "AnswerEvaluation" ADD CONSTRAINT "AnswerEvaluation_studentAnswerId_fkey" FOREIGN KEY ("studentAnswerId") REFERENCES "StudentAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
