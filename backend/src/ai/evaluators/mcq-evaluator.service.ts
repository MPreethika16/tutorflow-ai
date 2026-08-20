import { Injectable, BadRequestException } from '@nestjs/common';
import { Question, StudentAnswer, QuestionType } from '../../generated/prisma/client';
import { AnswerEvaluationResult } from './answer-evaluation-result';

@Injectable()
export class McqEvaluatorService {
  evaluate(question: Question, studentAnswer: StudentAnswer): AnswerEvaluationResult {
    if (question.type !== QuestionType.MCQ) {
      throw new BadRequestException('Question must be of type MCQ');
    }

    if (!studentAnswer.selectedOption) {
      return {
        suggestedMarks: 0,
        criteria: [{ criterion: 'Selected an option', awardedMarks: 0, maxMarks: question.marks, status: 'NOT_MET' }],
        feedback: 'No option selected.',
        reasoning: 'The student did not select an option.',
        confidence: 1,
      };
    }

    const isCorrect =
      question.correctOption != null &&
      studentAnswer.selectedOption.trim().toUpperCase() === question.correctOption.trim().toUpperCase();

    if (isCorrect) {
      return {
        suggestedMarks: question.marks,
        criteria: [{ criterion: 'Selected correct option', awardedMarks: question.marks, maxMarks: question.marks, status: 'MET' }],
        feedback: 'Correct.',
        reasoning: `The selected option (${studentAnswer.selectedOption}) matches the correct option (${question.correctOption}).`,
        confidence: 1,
      };
    } else {
      return {
        suggestedMarks: 0,
        criteria: [{ criterion: 'Selected correct option', awardedMarks: 0, maxMarks: question.marks, status: 'NOT_MET' }],
        feedback: 'Incorrect.',
        reasoning: `The selected option (${studentAnswer.selectedOption}) does not match the correct option (${question.correctOption}).`,
        confidence: 1,
      };
    }
  }
}
