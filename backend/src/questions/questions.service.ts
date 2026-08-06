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

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async createForTeacher(
    teacherUserId: string,
    assessmentId: string,
    dto: CreateQuestionDto,
  ) {
    // Step 1:
    // Find the assessment using both its public ID and
    // the logged-in teacher's ID.
    //
    // This performs the ownership check.
    const assessment =
      await this.prisma.assessment.findFirst({
        where: {
          assessmentId,
          teacherId: teacherUserId,
        },
        select: {
          id: true,
          status: true,
        },
      });

    // Covers both cases:
    // - assessment does not exist
    // - assessment belongs to another teacher
    if (!assessment) {
      throw new NotFoundException(
        'Assessment not found',
      );
    }

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
      const nextOrder =
        (orderResult._max.order ?? 0) + 1;

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
            dto.type === QuestionType.MCQ &&
            dto.explanation !== undefined
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
      // Recalculate the total marks from all questions.
      //
      // The frontend never directly controls
      // Assessment.maximumMarks.
      const marksResult = await tx.question.aggregate({
        where: {
          assessmentId: assessment.id,
        },
        _sum: {
          marks: true,
        },
      });

      const maximumMarks =
        marksResult._sum.marks ?? 0;

      await tx.assessment.update({
        where: {
          id: assessment.id,
        },
        data: {
          maximumMarks,
        },
      });

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
  private validateQuestionByType(
    dto: CreateQuestionDto,
  ): void {
    if (dto.type === QuestionType.MCQ) {
      this.validateMcq(dto);
      return;
    }

    if (
      dto.type === QuestionType.TYPED ||
      dto.type === QuestionType.VOICE
    ) {
      this.validateWrittenOrVoiceQuestion(dto);
    }
  }

  private validateMcq(
    dto: CreateQuestionDto,
  ): void {
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
    const normalizedOptionIds = dto.options.map(
      (option) =>
        option.id.trim().toUpperCase(),
    );

    // All option IDs must be unique.
    const uniqueOptionIds = new Set(
      normalizedOptionIds,
    );

    if (
      uniqueOptionIds.size !==
      normalizedOptionIds.length
    ) {
      throw new BadRequestException(
        'MCQ option IDs must be unique',
      );
    }

    // Normalize text before duplicate checking.
    //
    // "Delhi" and " delhi " are treated as duplicates.
    const normalizedOptionTexts = dto.options.map(
      (option) =>
        option.text.trim().toLowerCase(),
    );

    const uniqueOptionTexts = new Set(
      normalizedOptionTexts,
    );

    if (
      uniqueOptionTexts.size !==
      normalizedOptionTexts.length
    ) {
      throw new BadRequestException(
        'MCQ option text must be unique',
      );
    }

    const normalizedCorrectOption =
      dto.correctOption.trim().toUpperCase();

    // The correct option must reference an actual option.
    if (
      !uniqueOptionIds.has(
        normalizedCorrectOption,
      )
    ) {
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

  private validateWrittenOrVoiceQuestion(
    dto: CreateQuestionDto,
  ): void {
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


  async findAllForTeacher(
  teacherUserId: string,
  assessmentId: string,
) {
  // Step 1:
  // Find the assessment using both:
  // - public assessment ID from the route
  // - teacher UUID from the JWT
  //
  // This is the ownership check.
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
        status: true,
        maximumMarks: true,
      },
    });

  // Step 2:
  // Return the same 404 response when:
  // - the assessment does not exist
  // - the assessment belongs to another teacher
  //
  // This avoids exposing another teacher's data.
  if (!assessment) {
    throw new NotFoundException(
      'Assessment not found',
    );
  }

  // Step 3:
  // Fetch all questions that belong to the assessment.
  //
  // We use the internal assessment UUID because
  // Question.assessmentId references Assessment.id.
  const questions =
    await this.prisma.question.findMany({
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
}