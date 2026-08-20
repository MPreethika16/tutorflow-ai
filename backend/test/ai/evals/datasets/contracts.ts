import { Question, StudentAnswer } from '../../../../src/generated/prisma/client';
import { GeneratePaperDto } from '../../../../src/ai/dto/generate-paper.dto';

export interface GenerationEvalCase {
  id: string;
  description: string;
  request: GeneratePaperDto;
  expectedConstraints: {
    totalMarks: number;
    questionCount?: number;
  };
}

export interface GradingEvalCase {
  id: string;
  description: string;
  question: Question;
  studentAnswer: StudentAnswer;
  expectedMarks?: number;
  expectedRange?: [number, number];
}

export interface RetrievalEvalCase {
  id: string;
  query: string;
  expectedPromptFragment: string | null;
  shouldReject?: boolean;
}
