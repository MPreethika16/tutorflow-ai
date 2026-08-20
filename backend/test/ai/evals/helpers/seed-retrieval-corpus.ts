import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../../../src/prisma/prisma.service';
import { EmbeddingService } from '../../../../src/ai/embedding.service';
import { 
  EVAL_TEACHER_ID, 
  EVAL_USER_ID, 
  RETRIEVAL_EVAL_CORPUS 
} from '../datasets/retrieval-corpus';
import { UserRole } from '../../../../src/generated/prisma/client';

export async function seedRetrievalCorpus(app: INestApplication): Promise<void> {
  if (process.env.ALLOW_EVAL_SEED !== 'true') {
    throw new Error('ALLOW_EVAL_SEED=true is required to run the retrieval baseline with corpus seeding. Refusing to seed database to protect against accidental mutation.');
  }

  const prisma = app.get(PrismaService);
  const embeddingService = app.get(EmbeddingService);

  // 1. Ensure the Eval Teacher / User exists
  const existingUser = await prisma.user.findUnique({
    where: { id: EVAL_USER_ID }
  });

  if (!existingUser) {
    await prisma.user.create({
      data: {
        id: EVAL_USER_ID,
        firstName: 'Eval',
        lastName: 'Teacher',
        email: 'eval-teacher@tutorflow.local',
        passwordHash: 'dummy',
        role: UserRole.TEACHER,
        teacher: {
          create: {}
        }
      }
    });
  }

  // 2. Clear ONLY eval-owned assessments/questions to remain idempotent
  // We don't truncate tables, we just rely on cascade deletes for the Eval Teacher's assessments.
  const existingAssessments = await prisma.assessment.findMany({
    where: { teacherId: EVAL_TEACHER_ID }
  });
  
  if (existingAssessments.length > 0) {
    // Only delete if the corpus is structurally changed, or just delete always for idempotency.
    // Deleting the assessment cascades and deletes the questions.
    // However, if we delete them, we lose the vector embeddings and have to regenerate them.
    // Let's check if the assessments match the corpus perfectly. If they do, we skip!
    const allQuestions = await prisma.question.findMany({
      where: { assessmentId: { in: existingAssessments.map(a => a.id) } },
      select: { id: true, embedding: true }
    });
    
    // Check if any question is missing an embedding
    const hasMissingEmbeddings = allQuestions.some(q => q.embedding === null);
    
    // If the count of existing questions matches the corpus exactly and no embeddings are missing, reuse!
    const corpusQuestionCount = RETRIEVAL_EVAL_CORPUS.reduce((acc, a) => acc + a.questions.length, 0);
    
    if (allQuestions.length === corpusQuestionCount && !hasMissingEmbeddings) {
      console.log('Eval corpus already seeded with embeddings. Reusing deterministic corpus.');
      return;
    }
    
    // Otherwise, clean up and recreate
    await prisma.assessment.deleteMany({
      where: { teacherId: EVAL_TEACHER_ID }
    });
  }

  console.log('Seeding eval corpus...');

  // 3. Insert the corpus
  for (const assessment of RETRIEVAL_EVAL_CORPUS) {
    await prisma.assessment.create({
      data: {
        id: assessment.id,
        assessmentId: assessment.id, // Using the same ID for the external assessmentId
        teacherId: EVAL_TEACHER_ID,
        title: assessment.title,
        board: assessment.board,
        grade: assessment.grade,
        subject: assessment.subject,
        status: 'PUBLISHED',
        questions: {
          create: assessment.questions.map(q => ({
            id: q.id,
            questionId: q.id,
            type: q.type,
            prompt: q.prompt,
            marks: q.marks,
            order: q.order,
          }))
        }
      }
    });

    // 4. Generate and store embeddings for each question
    for (const q of assessment.questions) {
      const queryText = `${assessment.subject} ${q.prompt}`;
      const vector = await embeddingService.generateEmbedding(queryText);
      const vectorString = `[${vector.join(',')}]`;
      
      await prisma.$executeRaw`
        UPDATE "Question"
        SET "embedding" = ${vectorString}::vector
        WHERE "id" = ${q.id}::uuid
      `;
    }
  }

  console.log('Eval corpus seeded successfully.');
}
