import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AssessmentStatus,
  Prisma,
  QuestionType,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

import { CreateQuestionDto } from './dto/create-question.dto';
import { generateQuestionId } from './utils/question.util';

import { UpdateQuestionDto } from './dto/update-question.dto';
import { ReorderQuestionsDto } from './dto/reorder-questions.dto';

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds an assessment owned by the logged-in teacher.
   *
   * We intentionally return 404 for both:
   * - assessment does not exist
   * - assessment belongs to another teacher
   *
   * This keeps ownership checks consistent across every
   * question endpoint and avoids exposing another teacher's data.
   */
  private async findOwnedAssessment(
    teacherUserId: string,
    assessmentId: string,
  ) {
    const assessment = await this.prisma.assessment.findFirst({
      where: {
        assessmentId,
        teacherId: teacherUserId,
      },
      select: {
        id: true,
        assessmentId: true,
        title: true,
        status: true,
        maximumMarks: true,
      },
    });

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    return assessment;
  }

  /**
   * Recalculates Assessment.maximumMarks from the current
   * questions inside the same transaction as the write.
   *
   * This helper is reused by create, update and delete so the
   * derived total cannot drift because of duplicated logic.
   */
  private async recalculateMaximumMarks(
    tx: Prisma.TransactionClient,
    assessmentDbId: string,
  ): Promise<number> {
    const marksResult = await tx.question.aggregate({
      where: {
        assessmentId: assessmentDbId,
      },
      _sum: {
        marks: true,
      },
    });

    const maximumMarks = marksResult._sum.marks ?? 0;

    await tx.assessment.update({
      where: {
        id: assessmentDbId,
      },
      data: {
        maximumMarks,
      },
    });

    return maximumMarks;
  }

  /**
   * Runs an interactive Prisma transaction at SERIALIZABLE isolation and
   * retries only the Prisma error codes explicitly allowed by the caller.
   *
   * - P2034: transaction write conflict / serialization failure
   * - P2002: unique constraint conflict (used by create when two requests
   *   calculate the same next question order)
   *
   * We intentionally do not add retry delays yet because expected write
   * contention is low for the MVP.
   */
  private async runSerializableTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    retryableCodes: string[] = ['P2034'],
  ): Promise<T> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        const code =
          typeof error === 'object' && error !== null && 'code' in error
            ? String((error as { code?: unknown }).code)
            : undefined;

        const retryable =
          code !== undefined && retryableCodes.includes(code);

        if (!retryable || attempt === maxAttempts) {
          throw error;
        }
      }
    }

    // Defensive fallback: the loop always returns or throws.
    throw new ConflictException(
      'Operation could not be completed due to a concurrent update. Please retry.',
    );
  }

  async createForTeacher(
    teacherUserId: string,
    assessmentId: string,
    dto: CreateQuestionDto,
  ) {
    // Step 1: Verify the assessment belongs to this teacher.
    const assessment = await this.findOwnedAssessment(
      teacherUserId,
      assessmentId,
    );

    // Fast-fail before opening a transaction.
    if (assessment.status !== AssessmentStatus.DRAFT) {
      throw new ConflictException(
        'Questions can be added only to draft assessments',
      );
    }

    // Validate rules that depend on the question type.
    this.validateQuestionByType(dto);

    // SERIALIZABLE + bounded retries prevents concurrent creates from
    // permanently colliding on the next order value.
    return this.runSerializableTransaction(
      async (tx) => {
        // Re-check the status inside the transaction. The assessment may
        // have been published after the initial read.
        const draftAssessment = await tx.assessment.findFirst({
          where: {
            id: assessment.id,
            teacherId: teacherUserId,
            status: AssessmentStatus.DRAFT,
          },
          select: {
            id: true,
          },
        });

        if (!draftAssessment) {
          throw new ConflictException(
            'Questions can be added only to draft assessments',
          );
        }

        const orderResult = await tx.question.aggregate({
          where: {
            assessmentId: assessment.id,
          },
          _max: {
            order: true,
          },
        });

        const nextOrder = (orderResult._max.order ?? 0) + 1;

        // Generate inside the retryable operation so a rare public-ID
        // collision receives a fresh ID on the next attempt.
        const questionId = generateQuestionId();

        const createdQuestion = await tx.question.create({
          data: {
            questionId,
            assessmentId: assessment.id,
            type: dto.type,
            prompt: dto.prompt.trim(),
            marks: dto.marks,
            order: nextOrder,

            options:
              dto.type === QuestionType.MCQ
                ? (dto.options!.map((option) => ({
                    id: option.id.trim().toUpperCase(),
                    text: option.text.trim(),
                  })) as Prisma.InputJsonValue)
                : Prisma.JsonNull,

            correctOption:
              dto.type === QuestionType.MCQ
                ? dto.correctOption!.trim().toUpperCase()
                : null,

            explanation:
              dto.type === QuestionType.MCQ && dto.explanation != null
                ? dto.explanation.trim()
                : null,

            modelAnswer:
              dto.type === QuestionType.TYPED ||
              dto.type === QuestionType.VOICE
                ? dto.modelAnswer!.trim()
                : null,

            gradingInstructions:
              (dto.type === QuestionType.TYPED ||
                dto.type === QuestionType.VOICE) &&
              dto.gradingInstructions != null
                ? dto.gradingInstructions.trim()
                : null,
          },
          select: {
            questionId: true,
            type: true,
            prompt: true,
            marks: true,
            order: true,
            options: true,
            correctOption: true,
            explanation: true,
            modelAnswer: true,
            gradingInstructions: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        const maximumMarks = await this.recalculateMaximumMarks(
          tx,
          assessment.id,
        );

        return {
          question: createdQuestion,
          assessment: {
            assessmentId,
            maximumMarks,
          },
        };
      },
      ['P2002', 'P2034'],
    );
  }

  /**
   * Validates rules that differ by question type.
   *
   * DTO validation checks basic data shape.
   * This method checks business meaning.
   */
  private validateQuestionByType(dto: CreateQuestionDto): void {
    if (dto.type === QuestionType.MCQ) {
      this.validateMcq(dto);
      return;
    }

    if (dto.type === QuestionType.TYPED || dto.type === QuestionType.VOICE) {
      this.validateWrittenOrVoiceQuestion(dto);
    }
  }

  private validateMcq(dto: CreateQuestionDto): void {
    // MCQs require exactly four options.
    if (!dto.options || dto.options.length !== 4) {
      throw new BadRequestException(
        'MCQ questions must contain exactly four options',
      );
    }

    // MCQs require a correct-option ID.
    if (!dto.correctOption?.trim()) {
      throw new BadRequestException(
        'correctOption is required for MCQ questions',
      );
    }

    // Normalize IDs so values such as "a" and " A "
    // are treated as the same ID.
    const normalizedOptionIds = dto.options.map((option) =>
      option.id.trim().toUpperCase(),
    );

    // All option IDs must be unique.
    const uniqueOptionIds = new Set(normalizedOptionIds);

    if (uniqueOptionIds.size !== normalizedOptionIds.length) {
      throw new BadRequestException('MCQ option IDs must be unique');
    }

    // Normalize text before duplicate checking.
    //
    // "Delhi" and " delhi " are treated as duplicates.
    const normalizedOptionTexts = dto.options.map((option) =>
      option.text.trim().toLowerCase(),
    );

    const uniqueOptionTexts = new Set(normalizedOptionTexts);

    if (uniqueOptionTexts.size !== normalizedOptionTexts.length) {
      throw new BadRequestException('MCQ option text must be unique');
    }

    const normalizedCorrectOption = dto.correctOption.trim().toUpperCase();

    // The correct option must reference an actual option.
    if (!uniqueOptionIds.has(normalizedCorrectOption)) {
      throw new BadRequestException(
        'correctOption must match one of the option IDs',
      );
    }

    // MCQs must not contain typed/voice grading fields.
    if (
      dto.modelAnswer !== undefined ||
      dto.gradingInstructions !== undefined
    ) {
      throw new BadRequestException(
        'MCQ questions cannot contain modelAnswer or gradingInstructions',
      );
    }
  }

  private validateWrittenOrVoiceQuestion(dto: CreateQuestionDto): void {
    // Typed and voice questions require a teacher-reviewed
    // model answer for later AI-assisted grading.
    if (!dto.modelAnswer?.trim()) {
      throw new BadRequestException(
        'modelAnswer is required for typed and voice questions',
      );
    }

    // Typed and voice questions must not contain MCQ data.
    if (
      dto.options !== undefined ||
      dto.correctOption !== undefined ||
      dto.explanation !== undefined
    ) {
      throw new BadRequestException(
        'Typed and voice questions cannot contain MCQ fields',
      );
    }
  }

  async findAllForTeacher(teacherUserId: string, assessmentId: string) {
    // Step 1:
    // Reuse the shared ownership lookup.
    const assessment = await this.findOwnedAssessment(
      teacherUserId,
      assessmentId,
    );

    // Step 3:
    // Fetch all questions that belong to the assessment.
    //
    // We use the internal assessment UUID because
    // Question.assessmentId references Assessment.id.
    const questions = await this.prisma.question.findMany({
      where: {
        assessmentId: assessment.id,
      },

      // Questions must be returned in the same sequence
      // in which students will see them.
      orderBy: {
        order: 'asc',
      },

      select: {
        questionId: true,
        type: true,
        prompt: true,
        marks: true,
        order: true,

        // Teacher-only answer and grading fields.
        options: true,
        correctOption: true,
        explanation: true,
        modelAnswer: true,
        gradingInstructions: true,

        createdAt: true,
        updatedAt: true,
      },
    });

    // Step 4:
    // Return assessment context together with its questions.
    //
    // This helps the frontend display the title,
    // current status and total marks without another request.
    return {
      assessment: {
        assessmentId: assessment.assessmentId,
        title: assessment.title,
        status: assessment.status,
        maximumMarks: assessment.maximumMarks,
      },
      questions,
    };
  }

  async updateForTeacher(
    teacherUserId: string,
    assessmentId: string,
    questionId: string,
    dto: UpdateQuestionDto,
  ) {
    // Step 1: Verify assessment ownership.
    const assessment = await this.findOwnedAssessment(
      teacherUserId,
      assessmentId,
    );

    // Fast-fail before opening a transaction.
    if (assessment.status !== AssessmentStatus.DRAFT) {
      throw new ConflictException(
        'Questions can be updated only in draft assessments',
      );
    }

    // Load the current question so PATCH fields can be merged and validated
    // against the question's existing type.
    const question = await this.prisma.question.findFirst({
      where: {
        questionId,
        assessmentId: assessment.id,
      },
      select: {
        id: true,
        questionId: true,
        type: true,
        prompt: true,
        marks: true,
        order: true,
        options: true,
        correctOption: true,
        explanation: true,
        modelAnswer: true,
        gradingInstructions: true,
      },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    // Null and undefined both mean "preserve the existing value".
    const updatedPrompt =
      dto.prompt == null ? question.prompt : dto.prompt.trim();

    const updatedMarks = dto.marks ?? question.marks;

    if (question.type === QuestionType.MCQ) {
      this.validateMcqUpdate(question, dto);
    } else {
      this.validateWrittenOrVoiceUpdate(question, dto);
    }

    return this.runSerializableTransaction(async (tx) => {
      // Authoritative status check: publishing could have happened after
      // the initial DRAFT check.
      const draftAssessment = await tx.assessment.findFirst({
        where: {
          id: assessment.id,
          teacherId: teacherUserId,
          status: AssessmentStatus.DRAFT,
        },
        select: {
          id: true,
        },
      });

      if (!draftAssessment) {
        throw new ConflictException(
          'Questions can be updated only in draft assessments',
        );
      }

      const updatedQuestion = await tx.question.update({
        where: {
          id: question.id,
        },
        data:
          question.type === QuestionType.MCQ
            ? {
                prompt: updatedPrompt,
                marks: updatedMarks,

                options:
                  dto.options == null
                    ? undefined
                    : (dto.options.map((option) => ({
                        id: option.id.trim().toUpperCase(),
                        text: option.text.trim(),
                      })) as Prisma.InputJsonValue),

                correctOption:
                  dto.correctOption == null
                    ? undefined
                    : dto.correctOption.trim().toUpperCase(),

                explanation:
                  dto.explanation == null
                    ? undefined
                    : dto.explanation.trim(),
              }
            : {
                prompt: updatedPrompt,
                marks: updatedMarks,

                modelAnswer:
                  dto.modelAnswer == null
                    ? undefined
                    : dto.modelAnswer.trim(),

                gradingInstructions:
                  dto.gradingInstructions == null
                    ? undefined
                    : dto.gradingInstructions.trim(),
              },

        select: {
          questionId: true,
          type: true,
          prompt: true,
          marks: true,
          order: true,
          options: true,
          correctOption: true,
          explanation: true,
          modelAnswer: true,
          gradingInstructions: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const maximumMarks = await this.recalculateMaximumMarks(
        tx,
        assessment.id,
      );

      return {
        question: updatedQuestion,
        assessment: {
          assessmentId,
          maximumMarks,
        },
      };
    });
  }

  private validateMcqUpdate(
    existingQuestion: {
      options: Prisma.JsonValue;
      correctOption: string | null;
    },
    dto: UpdateQuestionDto,
  ): void {
    // MCQs cannot receive fields belonging to TYPED
    // or VOICE questions.
    if (
      dto.modelAnswer !== undefined ||
      dto.gradingInstructions !== undefined
    ) {
      throw new BadRequestException(
        'MCQ questions cannot contain modelAnswer or gradingInstructions',
      );
    }

    // Use new options when supplied.
    // Otherwise use the options already stored in the database.
    const existingOptions = existingQuestion.options as Array<{
      id: string;
      text: string;
    }> | null;

    const options = dto.options ?? existingOptions;

    if (!options || options.length !== 4) {
      throw new BadRequestException(
        'MCQ questions must contain exactly four options',
      );
    }

    const normalizedOptionIds = options.map((option) =>
      option.id.trim().toUpperCase(),
    );

    // Ensure IDs such as A, B, C and D are unique.
    if (new Set(normalizedOptionIds).size !== normalizedOptionIds.length) {
      throw new BadRequestException('MCQ option IDs must be unique');
    }

    const normalizedOptionTexts = options.map((option) =>
      option.text.trim().toLowerCase(),
    );

    // Treat values such as "Delhi" and " delhi "
    // as duplicate option text.
    if (new Set(normalizedOptionTexts).size !== normalizedOptionTexts.length) {
      throw new BadRequestException('MCQ option text must be unique');
    }

    const correctOption =
      dto.correctOption == null
        ? existingQuestion.correctOption
        : dto.correctOption.trim().toUpperCase();

    if (!correctOption) {
      throw new BadRequestException(
        'correctOption is required for MCQ questions',
      );
    }

    // Important:
    // If options are changed, the existing correct option
    // must still exist among the new option IDs.
    if (!normalizedOptionIds.includes(correctOption)) {
      throw new BadRequestException(
        'correctOption must match one of the option IDs',
      );
    }
  }

  private validateWrittenOrVoiceUpdate(
    existingQuestion: {
      modelAnswer: string | null;
    },
    dto: UpdateQuestionDto,
  ): void {
    // TYPED and VOICE questions cannot receive MCQ fields.
    if (
      dto.options !== undefined ||
      dto.correctOption !== undefined ||
      dto.explanation !== undefined
    ) {
      throw new BadRequestException(
        'Typed and voice questions cannot contain MCQ fields',
      );
    }

    // Use the new model answer when supplied.
    // Otherwise retain the stored model answer.
    const modelAnswer =
      dto.modelAnswer == null
        ? existingQuestion.modelAnswer
        : dto.modelAnswer.trim();

    if (!modelAnswer) {
      throw new BadRequestException(
        'modelAnswer is required for typed and voice questions',
      );
    }
  }

  async findOneForTeacher(
    teacherUserId: string,
    assessmentId: string,
    questionId: string,
  ) {
    // Step 1:
    // Reuse the shared ownership lookup.
    const assessment = await this.findOwnedAssessment(
      teacherUserId,
      assessmentId,
    );

    // Step 2:
    // Find the question using both:
    // - its public question ID
    // - the internal UUID of the parent assessment
    //
    // This prevents a question from another assessment
    // being accessed through this route.
    const question = await this.prisma.question.findFirst({
      where: {
        questionId,
        assessmentId: assessment.id,
      },
      select: {
        questionId: true,
        type: true,
        prompt: true,
        marks: true,
        order: true,
        options: true,
        correctOption: true,
        explanation: true,
        modelAnswer: true,
        gradingInstructions: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    // Return assessment context together with the full
    // teacher-only question details.
    return {
      assessment: {
        assessmentId: assessment.assessmentId,
        title: assessment.title,
        status: assessment.status,
        maximumMarks: assessment.maximumMarks,
      },
      question,
    };
  }

  async deleteForTeacher(
    teacherUserId: string,
    assessmentId: string,
    questionId: string,
  ) {
    // Step 1: Verify ownership.
    const assessment = await this.findOwnedAssessment(
      teacherUserId,
      assessmentId,
    );

    // Fast-fail before opening a transaction.
    if (assessment.status !== AssessmentStatus.DRAFT) {
      throw new ConflictException(
        'Questions can be deleted only from draft assessments',
      );
    }

    return this.runSerializableTransaction(async (tx) => {
      // Re-check DRAFT status inside the transaction so delete cannot race
      // with publishing.
      const draftAssessment = await tx.assessment.findFirst({
        where: {
          id: assessment.id,
          teacherId: teacherUserId,
          status: AssessmentStatus.DRAFT,
        },
        select: {
          id: true,
        },
      });

      if (!draftAssessment) {
        throw new ConflictException(
          'Questions can be deleted only from draft assessments',
        );
      }

      // Find the question inside the same transaction that performs the
      // delete. This avoids a stale pre-transaction lookup and prevents
      // P2025 when another request deletes the row first.
      const question = await tx.question.findFirst({
        where: {
          questionId,
          assessmentId: assessment.id,
        },
        select: {
          id: true,
          questionId: true,
          order: true,
        },
      });

      if (!question) {
        throw new NotFoundException('Question not found');
      }

      await tx.question.delete({
        where: {
          id: question.id,
        },
      });

      // Keep remaining orders contiguous after deletion.
      await tx.question.updateMany({
        where: {
          assessmentId: assessment.id,
          order: {
            gt: question.order,
          },
        },
        data: {
          order: {
            decrement: 1,
          },
        },
      });

      const maximumMarks = await this.recalculateMaximumMarks(
        tx,
        assessment.id,
      );

      return {
        message: 'Question deleted successfully',
        deletedQuestionId: question.questionId,
        maximumMarks,
      };
    });
  }

  async reorderForTeacher(
    teacherUserId: string,
    assessmentId: string,
    dto: ReorderQuestionsDto,
  ) {
    // Step 1: Verify ownership.
    const assessment = await this.findOwnedAssessment(
      teacherUserId,
      assessmentId,
    );

    // Fast-fail before opening a transaction.
    if (assessment.status !== AssessmentStatus.DRAFT) {
      throw new ConflictException(
        'Questions can be reordered only in draft assessments',
      );
    }

    // Read, validate and write against one SERIALIZABLE transaction snapshot.
    return this.runSerializableTransaction(async (tx) => {
      const draftAssessment = await tx.assessment.findFirst({
        where: {
          id: assessment.id,
          teacherId: teacherUserId,
          status: AssessmentStatus.DRAFT,
        },
        select: {
          id: true,
        },
      });

      if (!draftAssessment) {
        throw new ConflictException(
          'Questions can be reordered only in draft assessments',
        );
      }

      // Fetch inside the transaction so validation and writes use the same
      // question set.
      const existingQuestions = await tx.question.findMany({
        where: {
          assessmentId: assessment.id,
        },
        select: {
          id: true,
          questionId: true,
          order: true,
        },
      });

      if (dto.questions.length !== existingQuestions.length) {
        throw new BadRequestException(
          'All assessment questions must be included when reordering',
        );
      }

      const questionIds = dto.questions.map((item) => item.questionId);

      if (new Set(questionIds).size !== questionIds.length) {
        throw new BadRequestException('Question IDs must be unique');
      }

      const orders = dto.questions.map((item) => item.order);

      if (new Set(orders).size !== orders.length) {
        throw new BadRequestException(
          'Question order values must be unique',
        );
      }

      const sortedOrders = [...orders].sort((a, b) => a - b);

      for (let index = 0; index < sortedOrders.length; index++) {
        if (sortedOrders[index] !== index + 1) {
          throw new BadRequestException(
            'Question order values must be sequential starting from 1',
          );
        }
      }

      const existingQuestionIds = new Set(
        existingQuestions.map((question) => question.questionId),
      );

      for (const item of dto.questions) {
        if (!existingQuestionIds.has(item.questionId)) {
          throw new NotFoundException(
            `Question ${item.questionId} not found`,
          );
        }
      }

      // Two-phase updates avoid collisions with:
      // @@unique([assessmentId, order])
      //
      // We intentionally keep the Prisma implementation for MVP-sized
      // assessments instead of introducing raw SQL.
      const temporaryOffset = 100000;

      for (let index = 0; index < existingQuestions.length; index++) {
        const question = existingQuestions[index];

        await tx.question.update({
          where: {
            id: question.id,
          },
          data: {
            order: temporaryOffset + index + 1,
          },
        });
      }

      const questionsByPublicId = new Map(
        existingQuestions.map((question) => [
          question.questionId,
          question,
        ]),
      );

      for (const item of dto.questions) {
        const existingQuestion = questionsByPublicId.get(
          item.questionId,
        );

        if (!existingQuestion) {
          throw new NotFoundException('Question not found');
        }

        await tx.question.update({
          where: {
            id: existingQuestion.id,
          },
          data: {
            order: item.order,
          },
        });
      }

      const reorderedQuestions = await tx.question.findMany({
        where: {
          assessmentId: assessment.id,
        },
        orderBy: {
          order: 'asc',
        },
        select: {
          questionId: true,
          type: true,
          prompt: true,
          marks: true,
          order: true,
        },
      });

      return {
        message: 'Questions reordered successfully',
        questions: reorderedQuestions,
      };
    });
  }

}