import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomBytes } from 'crypto';

import {
  AssessmentAttemptStatus,
  AssessmentStatus,
  Prisma,
   QuestionType,
} from '../generated/prisma/client';

import { PrismaService } from '../prisma/prisma.service';


type StudentAssessmentListItem = {
  assessmentId: string;
  title: string;
  description: string | null;
  board: string;
  grade: string;
  subject: string;
  durationMinutes: number | null;
  maximumMarks: number;
  instructions: string | null;
  startAt: Date | null;
  endAt: Date | null;

  attemptStatus:
    | 'AVAILABLE'
    | 'IN_PROGRESS';

  attemptId: string | null;
  expiresAt: Date | null;
};
@Injectable()
export class StudentAssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Returns assessments that the logged-in student
   * can currently start or resume.
   */
  async findAvailableForStudent(
    studentUserId: string,
  ) {
    // ------------------------------------------------
    // Step 1:
    // Find the Student profile belonging to the
    // authenticated user.
    //
    // We do NOT accept studentId from the frontend.
    // JWT user.sub is our source of truth.
    // ------------------------------------------------
    const student =
      await this.prisma.student.findUnique({
        where: {
          userId: studentUserId,
        },
        select: {
          userId: true,
          board: true,
          grade: true,
        },
      });

    if (!student) {
      throw new NotFoundException(
        'Student profile not found',
      );
    }

    // ------------------------------------------------
    // Step 2:
    // Backend time is authoritative.
    // ------------------------------------------------
    const now = new Date();

    // ------------------------------------------------
    // Step 3:
    // Find assessments that:
    //
    // - are published
    // - match student's board
    // - match student's grade
    // // - have a complete schedule
// - have already started
// - have not ended
    //
    // Also load ONLY this student's attempt.
    // ------------------------------------------------
    const assessments =
      await this.prisma.assessment.findMany({
        where: {
          status: AssessmentStatus.PUBLISHED,

          board: student.board,
          grade: student.grade,

          startAt: {
              not: null,
              lte: now,
            },

            endAt: {
              not: null,
              gt: now,
            },
        },

        orderBy: {
          createdAt: 'desc',
        },

        select: {
          assessmentId: true,
          title: true,
          description: true,
          board: true,
          grade: true,
          subject: true,
          durationMinutes: true,
          maximumMarks: true,
          instructions: true,
          startAt: true,
          endAt: true,

          attempts: {
            where: {
              studentUserId,
            },

            select: {
              attemptId: true,
              status: true,
              startedAt: true,
              expiresAt: true,
            },

            // Database uniqueness already guarantees
            // one attempt per student + assessment.
            take: 1,
          },
        },
      });

    // ------------------------------------------------
    // Step 4:
    // Convert database records into student-facing
    // availability information.
    // ------------------------------------------------
   const availableAssessments =
  assessments.flatMap<StudentAssessmentListItem>(
    (assessment) => {
        const attempt =
          assessment.attempts[0];

        // --------------------------------------------
        // No attempt:
        // student may start this assessment.
        // --------------------------------------------
        if (!attempt) {
          return [
            {
              assessmentId:
                assessment.assessmentId,

              title: assessment.title,
              description:
                assessment.description,

              board: assessment.board,
              grade: assessment.grade,
              subject: assessment.subject,

              durationMinutes:
                assessment.durationMinutes,

              maximumMarks:
                assessment.maximumMarks,

              instructions:
                assessment.instructions,

              startAt: assessment.startAt,
              endAt: assessment.endAt,

              attemptStatus: 'AVAILABLE',
              attemptId: null,
              expiresAt: null,
            },
          ];
        }

        // --------------------------------------------
        // Already submitted:
        // do not show under available assessments.
        // --------------------------------------------
        if (
          attempt.status ===
          AssessmentAttemptStatus.SUBMITTED
        ) {
          return [];
        }

        // --------------------------------------------
        // The attempt still says IN_PROGRESS,
        // but its time has already run out.
        //
        // Issue #28 is intentionally read-only,
        // so we do NOT auto-submit here.
        //
        // Timing enforcement will handle this later.
        // --------------------------------------------
        if (
          attempt.status ===
            AssessmentAttemptStatus.IN_PROGRESS &&
          attempt.expiresAt <= now
        ) {
          return [];
        }

        // --------------------------------------------
        // Active attempt:
        // student may resume.
        // --------------------------------------------
        return [
          {
            assessmentId:
              assessment.assessmentId,

            title: assessment.title,
            description:
              assessment.description,

            board: assessment.board,
            grade: assessment.grade,
            subject: assessment.subject,

            durationMinutes:
              assessment.durationMinutes,

            maximumMarks:
              assessment.maximumMarks,

            instructions:
              assessment.instructions,

            startAt: assessment.startAt,
            endAt: assessment.endAt,

            attemptStatus: 'IN_PROGRESS',
            attemptId: attempt.attemptId,
            expiresAt: attempt.expiresAt,
          },
        ];
      });

    // ------------------------------------------------
    // Step 5:
    // Return API response.
    // ------------------------------------------------
    return {
      assessments: availableAssessments,
    };
  }

   async startAssessmentForStudent(
    studentUserId: string,
    assessmentId: string,
  ) {
    // ------------------------------------------------
    // Step 1:
    // Resolve the authenticated user's Student profile.
    // ------------------------------------------------

    const student =
      await this.prisma.student.findUnique({
        where: {
          userId: studentUserId,
        },

        select: {
          userId: true,
          board: true,
          grade: true,
        },
      });

    if (!student) {
      throw new NotFoundException(
        'Student profile not found',
      );
    }

    // Backend clock is authoritative.
    const now = new Date();

    // ------------------------------------------------
    // Step 2:
    // Find assessment using the PUBLIC assessmentId.
    // ------------------------------------------------

    const assessment =
      await this.prisma.assessment.findUnique({
        where: {
          assessmentId,
        },

        select: {
          id: true,
          assessmentId: true,
          title: true,
          board: true,
          grade: true,
          status: true,
          durationMinutes: true,
          maximumMarks: true,
          startAt: true,
          endAt: true,

          _count: {
            select: {
              questions: true,
            },
          },
        },
      });

    if (!assessment) {
      throw new NotFoundException(
        'Assessment not found',
      );
    }

    // ------------------------------------------------
    // Step 3:
    // Student eligibility.
    //
    // Return 404 instead of 403 so we do not reveal
    // assessments belonging to another board/grade.
    // ------------------------------------------------

    if (
      assessment.board !== student.board ||
      assessment.grade !== student.grade
    ) {
      throw new NotFoundException(
        'Assessment not found',
      );
    }

    // ------------------------------------------------
    // Step 4:
    // Assessment must be published.
    // ------------------------------------------------

    if (
      assessment.status !==
      AssessmentStatus.PUBLISHED
    ) {
      throw new ConflictException(
        'Assessment is not available',
      );
    }

    // ------------------------------------------------
    // Step 5:
    // Published assessments should have a valid
    // start/end window.
    //
    // If data is inconsistent, do not invent timing.
    // ------------------------------------------------

    if (
      !assessment.startAt ||
      !assessment.endAt
    ) {
      throw new ConflictException(
        'Assessment schedule is incomplete',
      );
    }

    // ------------------------------------------------
    // Step 6:
    // Assessment has not started yet.
    // ------------------------------------------------

    if (now < assessment.startAt) {
      throw new ConflictException(
        'Assessment has not started yet',
      );
    }

    // ------------------------------------------------
    // Step 7:
    // Assessment window is already over.
    // ------------------------------------------------

    if (now >= assessment.endAt) {
      throw new ConflictException(
        'Assessment has expired',
      );
    }

    // ------------------------------------------------
    // Step 8:
    // Don't start an empty assessment.
    // ------------------------------------------------

    if (
      assessment._count.questions === 0 ||
      assessment.maximumMarks <= 0
    ) {
      throw new ConflictException(
        'Assessment is not ready to start',
      );
    }

    // ------------------------------------------------
    // Step 9:
    // Check whether the student already has an attempt.
    // ------------------------------------------------

    const existingAttempt =
      await this.prisma.assessmentAttempt.findUnique({
        where: {
          studentUserId_assessmentId: {
            studentUserId,
            assessmentId:
              assessment.id,
          },
        },

        select: {
          attemptId: true,
          status: true,
          startedAt: true,
          expiresAt: true,
        },
      });

    if (existingAttempt) {
      // Student already completed their only attempt.
      if (
        existingAttempt.status ===
        AssessmentAttemptStatus.SUBMITTED
      ) {
        throw new ConflictException(
          'Assessment already attempted',
        );
      }

      // ------------------------------------------------
      // Existing attempt is still active.
      //
      // Don't create another row.
      // Return it so the frontend can resume.
      // ------------------------------------------------

      if (
        existingAttempt.expiresAt > now
      ) {
        return {
          created: false,

          data: {
            attempt: {
              attemptId:
                existingAttempt.attemptId,

              status:
                existingAttempt.status,

              startedAt:
                existingAttempt.startedAt,

              expiresAt:
                existingAttempt.expiresAt,
            },

            assessment: {
              assessmentId:
                assessment.assessmentId,

              title:
                assessment.title,

              durationMinutes:
                assessment.durationMinutes,

              maximumMarks:
                assessment.maximumMarks,
            },
          },
        };
      }

      // ------------------------------------------------
      // Attempt exists but its time has passed.
      //
      // Auto-submission belongs to the timing issue.
      // For now we prevent another start.
      // ------------------------------------------------

      throw new ConflictException(
        'Assessment attempt has expired',
      );
    }

    // ------------------------------------------------
    // Step 10:
    // Calculate attempt timing.
    // ------------------------------------------------

    const startedAt = now;

    let expiresAt: Date;

    // No duration means the assessment itself
    // controls the entire available time.
    if (
      assessment.durationMinutes == null
    ) {
      expiresAt =
        assessment.endAt;
    } else {
      const durationEnd =
        new Date(
          startedAt.getTime() +
            assessment.durationMinutes *
              60 *
              1000,
        );

      // Hard cap:
      // attempt can NEVER continue beyond endAt.
      expiresAt =
        durationEnd < assessment.endAt
          ? durationEnd
          : assessment.endAt;
    }

    // ------------------------------------------------
    // Step 11:
    // Generate public attempt ID.
    // ------------------------------------------------

    const attemptId =
      this.generateAttemptId();

    try {
      // ------------------------------------------------
      // Step 12:
      // Create attempt.
      //
      // DB unique constraint guarantees:
      //
      // one student + one assessment
      // = one attempt.
      // ------------------------------------------------

      const createdAttempt =
        await this.prisma.assessmentAttempt.create({
          data: {
            attemptId,

            studentUserId,

            assessmentId:
              assessment.id,

            status:
              AssessmentAttemptStatus.IN_PROGRESS,

            startedAt,
            expiresAt,
          },

          select: {
            attemptId: true,
            status: true,
            startedAt: true,
            expiresAt: true,
          },
        });

      return {
        created: true,

        data: {
          attempt: createdAttempt,

          assessment: {
            assessmentId:
              assessment.assessmentId,

            title:
              assessment.title,

            durationMinutes:
              assessment.durationMinutes,

            maximumMarks:
              assessment.maximumMarks,
          },
        },
      };
    } catch (error: unknown) {
      // ------------------------------------------------
      // Step 13:
      // Concurrent start protection.
      //
      // Example:
      //
      // request A → checks no attempt
      // request B → checks no attempt
      // request A → creates attempt
      // request B → hits unique constraint
      //
      // Instead of producing a 500, return the
      // attempt that request A created.
      // ------------------------------------------------

     if (
  error instanceof
    Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002' &&
  this.isStudentAssessmentUniqueViolation(
    error,
  )
){
        const concurrentAttempt =
          await this.prisma
            .assessmentAttempt
            .findUnique({
              where: {
                studentUserId_assessmentId:
                  {
                    studentUserId,

                    assessmentId:
                      assessment.id,
                  },
              },

              select: {
                attemptId: true,
                status: true,
                startedAt: true,
                expiresAt: true,
              },
            });

        if (concurrentAttempt) {
  if (
    concurrentAttempt.status ===
    AssessmentAttemptStatus.SUBMITTED
  ) {
    throw new ConflictException(
      'Assessment already attempted',
    );
  }

  if (
    concurrentAttempt.expiresAt <=
    new Date()
  ) {
    throw new ConflictException(
      'Assessment attempt has expired',
    );
  }

  return {
    created: false,

    data: {
      attempt: concurrentAttempt,

      assessment: {
        assessmentId:
          assessment.assessmentId,

        title:
          assessment.title,

        durationMinutes:
          assessment.durationMinutes,

        maximumMarks:
          assessment.maximumMarks,
      },
    },
  };
}
      }

      throw error;
    }
  }

  /**
   * Generates the public assessment-attempt ID.
   *
   * Example:
   * ATT-A1B2C3D4E5F60718
   */
  private generateAttemptId(): string {
    const suffix =
      randomBytes(8)
        .toString('hex')
        .toUpperCase();

    return `ATT-${suffix}`;
  }

  private isStudentAssessmentUniqueViolation(
  error: Prisma.PrismaClientKnownRequestError,
): boolean {
  const target = error.meta?.target;

  if (!Array.isArray(target)) {
    return false;
  }

  return (
    target.includes('studentUserId') &&
    target.includes('assessmentId')
  );
}

  async getAttemptForStudent(
  studentUserId: string,
  attemptId: string,
) {
  const now = new Date();

  const attempt =
    await this.prisma.assessmentAttempt.findFirst({
      where: {
        attemptId,
        studentUserId,
      },

      select: {
        attemptId: true,
        status: true,
        startedAt: true,
        expiresAt: true,
        submittedAt: true,

        assessment: {
          select: {
            assessmentId: true,
            title: true,
            subject: true,
            durationMinutes: true,
            maximumMarks: true,
            instructions: true,

            questions: {
              orderBy: {
                order: 'asc',
              },

              select: {
                id: true,
                questionId: true,
                type: true,
                prompt: true,
                marks: true,
                order: true,
                options: true,
              },
            },
          },
        },

        answers: {
          select: {
            questionId: true,
            selectedOption: true,
            textAnswer: true,
            voiceUrl: true,
            updatedAt: true,
          },
        },
      },
    });

  // Either the attempt does not exist
  // OR it belongs to another student.
  //
  // Both intentionally return 404.
  if (!attempt) {
    throw new NotFoundException(
      'Assessment attempt not found',
    );
  }

  // For now we do not auto-submit here.
  // That belongs to the timing issue.
  if (
    attempt.status ===
      AssessmentAttemptStatus.IN_PROGRESS &&
    attempt.expiresAt <= now
  ) {
    throw new ConflictException(
      'Assessment attempt has expired',
    );
  }

  // Create a map:
  //
  // question internal UUID -> student's saved answer
  const answersByQuestionId =
    new Map(
      attempt.answers.map((answer) => [
        answer.questionId,
        answer,
      ]),
    );

  const questions =
    attempt.assessment.questions.map(
      (question) => {
        const savedAnswer =
          answersByQuestionId.get(
            question.id,
          );

        return {
          questionId:
            question.questionId,

          type:
            question.type,

          prompt:
            question.prompt,

          marks:
            question.marks,

          order:
            question.order,

          // Only MCQ should expose options.
          options:
            question.type ===
            QuestionType.MCQ
              ? question.options
              : null,

          // No row = unanswered question.
          answer: savedAnswer
            ? {
                selectedOption:
                  savedAnswer.selectedOption,

                textAnswer:
                  savedAnswer.textAnswer,

                voiceUrl:
                  savedAnswer.voiceUrl,

                updatedAt:
                  savedAnswer.updatedAt,
              }
            : null,
        };
      },
    );

  return {
    attempt: {
      attemptId:
        attempt.attemptId,

      status:
        attempt.status,

      startedAt:
        attempt.startedAt,

      expiresAt:
        attempt.expiresAt,

      submittedAt:
        attempt.submittedAt,
    },

    assessment: {
      assessmentId:
        attempt.assessment.assessmentId,

      title:
        attempt.assessment.title,

      subject:
        attempt.assessment.subject,

      durationMinutes:
        attempt.assessment.durationMinutes,

      maximumMarks:
        attempt.assessment.maximumMarks,

      instructions:
        attempt.assessment.instructions,
    },

    questions,
  };
}

}