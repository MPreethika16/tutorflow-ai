import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AssessmentAttemptStatus,
  AssessmentStatus,
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
    // - have already started (or have no startAt)
    // - have not ended (or have no endAt)
    //
    // Also load ONLY this student's attempt.
    // ------------------------------------------------
    const assessments =
      await this.prisma.assessment.findMany({
        where: {
          status: AssessmentStatus.PUBLISHED,

          board: student.board,
          grade: student.grade,

          AND: [
            {
              OR: [
                {
                  startAt: null,
                },
                {
                  startAt: {
                    lte: now,
                  },
                },
              ],
            },

            {
              OR: [
                {
                  endAt: null,
                },
                {
                  endAt: {
                    gt: now,
                  },
                },
              ],
            },
          ],
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
}