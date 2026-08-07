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

  async createForTeacher(
    teacherUserId: string,
    assessmentId: string,
    dto: CreateQuestionDto,
  ) {
    // Step 1:
    // Reuse the shared ownership lookup.
    const assessment = await this.findOwnedAssessment(
      teacherUserId,
      assessmentId,
    );

    // Step 2:
    // Questions can be changed only while the
    // assessment is still a draft.
    if (assessment.status !== AssessmentStatus.DRAFT) {
      throw new ConflictException(
        'Questions can be added only to draft assessments',
      );
    }

    // Step 3:
    // Apply business rules that depend on question type.
    this.validateQuestionByType(dto);

    // Step 4:
    // Generate the public question ID.
    //
    // The client never supplies this value.
    const questionId = generateQuestionId();

    // Step 5:
    // Create the question and update maximumMarks
    // inside one transaction.
    //
    // If any operation fails, the complete transaction
    // is rolled back.
    return this.prisma.$transaction(async (tx) => {
      // Find the highest existing question position.
      const orderResult = await tx.question.aggregate({
        where: {
          assessmentId: assessment.id,
        },
        _max: {
          order: true,
        },
      });

      // No existing questions:
      // null + fallback gives the first order as 1.
      const nextOrder = (orderResult._max.order ?? 0) + 1;

      // Create the question.
      const createdQuestion = await tx.question.create({
        data: {
          questionId,
          assessmentId: assessment.id,
          type: dto.type,
          prompt: dto.prompt.trim(),
          marks: dto.marks,
          order: nextOrder,

          // Type-specific fields are normalized before storage.
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
            dto.type === QuestionType.MCQ && dto.explanation !== undefined
              ? dto.explanation.trim()
              : null,

          modelAnswer:
            dto.type === QuestionType.TYPED || dto.type === QuestionType.VOICE
              ? dto.modelAnswer!.trim()
              : null,

          gradingInstructions:
            (dto.type === QuestionType.TYPED ||
              dto.type === QuestionType.VOICE) &&
            dto.gradingInstructions !== undefined
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

      // Step 6:
      // Recalculate the derived total using the shared helper.
      const maximumMarks = await this.recalculateMaximumMarks(
        tx,
        assessment.id,
      );

      // Return both the created question and the updated
      // assessment total so the frontend can refresh its UI.
      return {
        question: createdQuestion,
        assessment: {
          assessmentId,
          maximumMarks,
        },
      };
    });
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
    // Step 1:
    // Reuse the shared ownership lookup.
    const assessment = await this.findOwnedAssessment(
      teacherUserId,
      assessmentId,
    );

    // Step 2:
    // Questions may be changed only while the parent
    // assessment is still a draft.
    if (assessment.status !== AssessmentStatus.DRAFT) {
      throw new ConflictException(
        'Questions can be updated only in draft assessments',
      );
    }

    // Step 3:
    // Find the question using:
    // - public question ID
    // - internal parent assessment UUID
    //
    // This ensures the question really belongs to the
    // assessment from the route.
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

    // Step 4:
    // Combine the existing values with the fields supplied
    // by the PATCH request.
    //
    // Omitted fields keep their current values.
    const updatedPrompt =
      dto.prompt === undefined ? question.prompt : dto.prompt.trim();

    const updatedMarks = dto.marks ?? question.marks;

    // Step 5:
    // Validate the merged data according to the question's
    // existing type.
    if (question.type === QuestionType.MCQ) {
      this.validateMcqUpdate(question, dto);
    } else {
      this.validateWrittenOrVoiceUpdate(question, dto);
    }

    // Step 6:
    // Update the question and recalculate the assessment's
    // maximum marks inside one transaction.
    //
    // If one operation fails, both are rolled back.
    return this.prisma.$transaction(async (tx) => {
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
                  dto.options === undefined
                    ? undefined
                    : (dto.options.map((option) => ({
                        id: option.id.trim().toUpperCase(),
                        text: option.text.trim(),
                      })) as Prisma.InputJsonValue),

                correctOption:
                  dto.correctOption === undefined
                    ? undefined
                    : dto.correctOption.trim().toUpperCase(),

                explanation:
                  dto.explanation === undefined
                    ? undefined
                    : dto.explanation.trim(),
              }
            : {
                prompt: updatedPrompt,
                marks: updatedMarks,

                modelAnswer:
                  dto.modelAnswer === undefined
                    ? undefined
                    : dto.modelAnswer.trim(),

                gradingInstructions:
                  dto.gradingInstructions === undefined
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

      // Recalculate the derived total using the shared helper.
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
      dto.correctOption === undefined
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
      dto.modelAnswer === undefined
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
    // --------------------------------------------------
    // Step 1:
    // Reuse the shared ownership lookup.
    // --------------------------------------------------
    const assessment = await this.findOwnedAssessment(
      teacherUserId,
      assessmentId,
    );

    // --------------------------------------------------
    // Step 3:
    // Questions can only be deleted while the
    // assessment is still in DRAFT status.
    //
    // Once published, questions are part of a fixed
    // assessment and should not change.
    // --------------------------------------------------
    if (assessment.status !== AssessmentStatus.DRAFT) {
      throw new ConflictException(
        'Questions can be deleted only from draft assessments',
      );
    }

    // --------------------------------------------------
    // Step 4:
    // Find the question using:
    // - public question ID
    // - internal assessment UUID
    //
    // This confirms the question actually belongs
    // to this particular assessment.
    // --------------------------------------------------
    const question = await this.prisma.question.findFirst({
      where: {
        questionId,
        assessmentId: assessment.id,
      },
      select: {
        id: true,
        questionId: true,
        order: true,
        marks: true,
      },
    });

    // --------------------------------------------------
    // Step 5:
    // Question does not exist in this assessment.
    // --------------------------------------------------
    if (!question) {
      throw new NotFoundException('Question not found');
    }

    // --------------------------------------------------
    // Step 6:
    // Delete + reorder + recalculate marks should all
    // succeed together.
    //
    // A transaction prevents inconsistent data.
    //
    // Example:
    // If deletion succeeds but marks update fails,
    // Prisma rolls everything back.
    // --------------------------------------------------
    return this.prisma.$transaction(async (tx) => {
      // ------------------------------------------------
      // Step 7:
      // Permanently delete the question.
      //
      // We decided hard deletion is safe because
      // deletion is allowed only while assessment
      // status is DRAFT.
      // ------------------------------------------------
      await tx.question.delete({
        where: {
          id: question.id,
        },
      });

      // ------------------------------------------------
      // Step 8:
      // Reorder every question that appeared after
      // the deleted question.
      //
      // Example:
      //
      // Before:
      // 1, 2, 3, 4, 5
      //
      // Delete 3
      //
      // Questions 4 and 5 are greater than 3,
      // so decrement them:
      //
      // 4 -> 3
      // 5 -> 4
      // ------------------------------------------------
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

      // ------------------------------------------------
      // Step 9:
      // Recalculate the derived total using the shared helper.
      // ------------------------------------------------
      const maximumMarks = await this.recalculateMaximumMarks(
        tx,
        assessment.id,
      );

      // ------------------------------------------------
      // Step 10:
      // Return a simple response.
      //
      // We don't return the deleted question because
      // it no longer exists in the database.
      // ------------------------------------------------
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
    // --------------------------------------------------
    // Step 1:
    // Reuse the shared ownership lookup.
    // --------------------------------------------------
    const assessment = await this.findOwnedAssessment(
      teacherUserId,
      assessmentId,
    );

    // --------------------------------------------------
    // Step 2:
    // Questions can only be reordered while the
    // assessment is still DRAFT.
    // --------------------------------------------------
    if (assessment.status !== AssessmentStatus.DRAFT) {
      throw new ConflictException(
        'Questions can be reordered only in draft assessments',
      );
    }

    // --------------------------------------------------
    // Step 3:
    // Fetch all current questions for this assessment.
    //
    // We need them to verify:
    // - count
    // - ownership
    // - valid IDs
    // --------------------------------------------------
    const existingQuestions = await this.prisma.question.findMany({
      where: {
        assessmentId: assessment.id,
      },
      select: {
        id: true,
        questionId: true,
        order: true,
      },
    });

    // --------------------------------------------------
    // Step 4:
    // The frontend must send the full desired order.
    //
    // Example:
    // if DB has 3 questions,
    // request must also contain exactly 3.
    // --------------------------------------------------
    if (dto.questions.length !== existingQuestions.length) {
      throw new BadRequestException(
        'All assessment questions must be included when reordering',
      );
    }

    // --------------------------------------------------
    // Step 5:
    // Verify question IDs are unique in the request.
    // --------------------------------------------------
    const questionIds = dto.questions.map((item) => item.questionId);

    if (new Set(questionIds).size !== questionIds.length) {
      throw new BadRequestException('Question IDs must be unique');
    }

    // --------------------------------------------------
    // Step 6:
    // Verify order values are unique.
    // --------------------------------------------------
    const orders = dto.questions.map((item) => item.order);

    if (new Set(orders).size !== orders.length) {
      throw new BadRequestException('Question order values must be unique');
    }

    // --------------------------------------------------
    // Step 7:
    // Orders must be sequential:
    //
    // For 3 questions:
    // valid   -> 1,2,3
    // invalid -> 1,2,4
    // invalid -> 2,3,4
    // --------------------------------------------------
    const sortedOrders = [...orders].sort((a, b) => a - b);

    for (let index = 0; index < sortedOrders.length; index++) {
      const expectedOrder = index + 1;

      if (sortedOrders[index] !== expectedOrder) {
        throw new BadRequestException(
          'Question order values must be sequential starting from 1',
        );
      }
    }

    // --------------------------------------------------
    // Step 8:
    // Verify every questionId in the request actually
    // belongs to this assessment.
    // --------------------------------------------------
    const existingQuestionIds = new Set(
      existingQuestions.map((question) => question.questionId),
    );

    for (const item of dto.questions) {
      if (!existingQuestionIds.has(item.questionId)) {
        throw new NotFoundException(`Question ${item.questionId} not found`);
      }
    }

    // --------------------------------------------------
    // Step 9:
    // Perform the reorder in one transaction.
    //
    // We use TWO phases because of the unique constraint:
    //
    // @@unique([assessmentId, order])
    //
    // Directly swapping:
    // 1 -> 2
    // 2 -> 1
    //
    // can cause a temporary duplicate order.
    // --------------------------------------------------
    return this.prisma.$transaction(async (tx) => {
      // ------------------------------------------------
      // Phase 1:
      // Move every question to a temporary high order.
      //
      // Example:
      // 1 -> 1001
      // 2 -> 1002
      // 3 -> 1003
      //
      // This frees up final positions 1,2,3.
      // ------------------------------------------------
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

      // ------------------------------------------------
      // Phase 2:
      // Assign the final desired order.
      // ------------------------------------------------
      for (const item of dto.questions) {
        // Find the internal DB question row
        // corresponding to the public question ID.
        const existingQuestion = existingQuestions.find(
          (question) => question.questionId === item.questionId,
        );

        // This should already be guaranteed by
        // earlier validation, but TypeScript still
        // needs us to guard against undefined.
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

      // ------------------------------------------------
      // Step 10:
      // Return the final ordered list.
      // ------------------------------------------------
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
  
  async publishForTeacher(
  teacherUserId: string,
  assessmentId: string,
) {
  // --------------------------------------------------
  // Step 1:
  // Find the assessment using:
  // - public assessment ID from the URL
  // - teacher ID from the JWT
  //
  // This is the ownership check.
  // --------------------------------------------------
  const assessment =
    await this.prisma.assessment.findFirst({
      where: {
        assessmentId,
        teacherId: teacherUserId,
      },
      select: {
        id: true,
        assessmentId: true,
        title: true,
        description: true,
        board: true,
        grade: true,
        subject: true,
        durationMinutes: true,
        instructions: true,
        maximumMarks: true,
        startAt: true,
        endAt: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

  // --------------------------------------------------
  // Step 2:
  // Return 404 when:
  // - assessment does not exist
  // - assessment belongs to another teacher
  // --------------------------------------------------
  if (!assessment) {
    throw new NotFoundException(
      'Assessment not found',
    );
  }

  // --------------------------------------------------
  // Step 3:
  // Only DRAFT assessments can be published.
  //
  // PUBLISHED, CLOSED and ARCHIVED assessments
  // cannot go through publish again.
  // --------------------------------------------------
  if (
    assessment.status !==
    AssessmentStatus.DRAFT
  ) {
    throw new ConflictException(
      'Only draft assessments can be published',
    );
  }

  // --------------------------------------------------
  // Step 4:
  // Duration is required before publishing.
  // --------------------------------------------------
  if (
    !assessment.durationMinutes ||
    assessment.durationMinutes <= 0
  ) {
    throw new BadRequestException(
      'Assessment duration is required before publishing',
    );
  }

  // --------------------------------------------------
  // Step 5:
  // Both schedule values must exist.
  // --------------------------------------------------
  if (
    !assessment.startAt ||
    !assessment.endAt
  ) {
    throw new BadRequestException(
      'Assessment start and end time are required before publishing',
    );
  }

  // --------------------------------------------------
  // Step 6:
  // End time must be later than start time.
  // --------------------------------------------------
  if (
    assessment.endAt <= assessment.startAt
  ) {
    throw new BadRequestException(
      'Assessment end time must be later than start time',
    );
  }

  // --------------------------------------------------
  // Step 7:
  // Fetch all questions belonging to this assessment.
  //
  // We need them to validate:
  // - question count
  // - marks
  // - ordering
  // --------------------------------------------------
  const questions =
    await this.prisma.question.findMany({
      where: {
        assessmentId: assessment.id,
      },
      select: {
        questionId: true,
        marks: true,
        order: true,
        type: true,
        options: true,
        correctOption: true,
        modelAnswer: true,
      },
      orderBy: {
        order: 'asc',
      },
    });

  // --------------------------------------------------
  // Step 8:
  // An empty assessment cannot be published.
  // --------------------------------------------------
  if (questions.length === 0) {
    throw new BadRequestException(
      'Assessment must contain at least one question before publishing',
    );
  }

  // --------------------------------------------------
  // Step 9:
  // Every question must have marks greater than 0.
  //
  // DTO validation should already guarantee this during
  // normal creation, but publish is the final safety gate.
  // --------------------------------------------------
  const invalidMarksQuestion =
    questions.find(
      (question) => question.marks <= 0,
    );

  if (invalidMarksQuestion) {
    throw new BadRequestException(
      `Question ${invalidMarksQuestion.questionId} must have marks greater than 0`,
    );
  }

  // --------------------------------------------------
  // Step 10:
  // maximumMarks must also be valid.
  //
  // This protects against inconsistent database state.
  // --------------------------------------------------
  if (assessment.maximumMarks <= 0) {
    throw new BadRequestException(
      'Assessment maximum marks must be greater than 0 before publishing',
    );
  }

  // --------------------------------------------------
  // Step 11:
  // Question ordering must be:
  //
  // 1, 2, 3, ..., N
  //
  // No duplicates and no gaps.
  // --------------------------------------------------
  for (
    let index = 0;
    index < questions.length;
    index++
  ) {
    const expectedOrder = index + 1;

    if (
      questions[index].order !==
      expectedOrder
    ) {
      throw new BadRequestException(
        'Question order is invalid. Questions must be sequential starting from 1',
      );
    }
  }

  // --------------------------------------------------
  // Step 12:
  // Optional but recommended:
  // Validate type-specific question integrity again.
  //
  // This prevents publishing corrupted question data.
  // --------------------------------------------------
  for (const question of questions) {
    if (question.type === QuestionType.MCQ) {
      const options =
        question.options as
          | Array<{
              id: string;
              text: string;
            }>
          | null;

      if (!options || options.length !== 4) {
        throw new BadRequestException(
          `MCQ question ${question.questionId} must contain exactly four options`,
        );
      }

      if (!question.correctOption) {
        throw new BadRequestException(
          `MCQ question ${question.questionId} must have a correct option`,
        );
      }

      const normalizedIds =
        options.map((option) =>
          option.id.trim().toUpperCase(),
        );

      if (
        !normalizedIds.includes(
          question.correctOption
            .trim()
            .toUpperCase(),
        )
      ) {
        throw new BadRequestException(
          `MCQ question ${question.questionId} has an invalid correct option`,
        );
      }
    }

    if (
      question.type === QuestionType.TYPED ||
      question.type === QuestionType.VOICE
    ) {
      if (!question.modelAnswer?.trim()) {
        throw new BadRequestException(
          `Question ${question.questionId} requires a model answer before publishing`,
        );
      }
    }
  }

  // --------------------------------------------------
  // Step 13:
  // All readiness checks passed.
  //
  // Perform the state transition:
  //
  // DRAFT -> PUBLISHED
  // --------------------------------------------------
  return this.prisma.assessment.update({
    where: {
      id: assessment.id,
    },
    data: {
      status: AssessmentStatus.PUBLISHED,
    },
    select: {
      assessmentId: true,
      title: true,
      description: true,
      board: true,
      grade: true,
      subject: true,
      durationMinutes: true,
      instructions: true,
      maximumMarks: true,
      startAt: true,
      endAt: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
}