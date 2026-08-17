import {
  Test,
  TestingModule,
} from '@nestjs/testing';

import {
  AssessmentKind,
  QuestionType,
} from '../generated/prisma/client';

import { AiService } from './ai.service';
import {
  GeneratedPaperPersistenceService,
} from './generated-paper-persistence.service';
import {
  PaperGenerationService,
} from './paper-generation.service';
import {
  TeacherStyleRetriever,
} from './retrieval/teacher-style-retriever.service';

describe('PaperGenerationService', () => {
  let service: PaperGenerationService;

  const aiServiceMock = {
    generateStructured: jest.fn(),
  };

  const persistenceServiceMock = {
    saveDraft: jest.fn(),
  };

  const teacherStyleRetrieverMock = {
    retrieve: jest.fn(),
  };

  const dto = {
    board: 'CBSE',
    grade: '10',
    subject: 'Mathematics',
    topic: 'Quadratic Equations',
    kind: AssessmentKind.TEST,
    totalMarks: 5,
    durationMinutes: 45,
    additionalInstructions:
      'Include conceptual questions.',
  };

  const generatedPaper = {
    title:
      'Quadratic Equations Test',

    instructions: [
      'Answer all questions.',
    ],

    durationMinutes: 45,

    totalMarks: 5,

    questions: [
      {
        type: 'MCQ' as const,

        prompt:
          'Which expression is quadratic?',

        marks: 1,

        difficulty:
          'EASY' as const,

        options: [
          {
            id: 'A',
            text: 'x + 1',
          },
          {
            id: 'B',
            text:
              'x² + 2x + 1',
          },
        ],

        correctOption: 'B',

        explanation:
          'The highest power is 2.',
      },

      {
        type:
          'SHORT_ANSWER' as const,

        prompt:
          'What does the discriminant tell us?',

        marks: 4,

        difficulty:
          'MEDIUM' as const,

        modelAnswer:
          'It tells us the nature of the roots.',

        gradingInstructions:
          'Award marks for correctly explaining the nature of the roots.',
      },
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    teacherStyleRetrieverMock
      .retrieve
      .mockResolvedValue([]);

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          PaperGenerationService,

          {
            provide: AiService,
            useValue:
              aiServiceMock,
          },

          {
            provide:
              GeneratedPaperPersistenceService,
            useValue:
              persistenceServiceMock,
          },

          {
            provide:
              TeacherStyleRetriever,
            useValue:
              teacherStyleRetrieverMock,
          },
        ],
      }).compile();

    service =
      module.get<PaperGenerationService>(
        PaperGenerationService,
      );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('generates a paper without teacher-style context', async () => {
    aiServiceMock
      .generateStructured
      .mockResolvedValue(
        generatedPaper,
      );

    const result =
      await service.generate(dto);

    expect(result).toEqual(
      generatedPaper,
    );

    expect(
      aiServiceMock.generateStructured,
    ).toHaveBeenCalledTimes(1);

    expect(
      teacherStyleRetrieverMock.retrieve,
    ).not.toHaveBeenCalled();

    const [
      request,
      schema,
      schemaName,
    ] =
      aiServiceMock
        .generateStructured
        .mock.calls[0];

    expect(schema).toBeDefined();

    expect(schemaName).toBe(
      'generated_paper',
    );

    expect(
      request.messages,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
        }),

        expect.objectContaining({
          role: 'user',
        }),
      ]),
    );

    const systemMessage =
      request.messages.find(
        (message: {
          role: string;
          content: string;
        }) =>
          message.role ===
          'system',
      );

    expect(
      systemMessage.content,
    ).not.toContain(
      'TEACHER STYLE CONTEXT',
    );
  });

  it('builds the requested generation context', async () => {
    aiServiceMock
      .generateStructured
      .mockResolvedValue(
        generatedPaper,
      );

    await service.generate(dto);

    const [request] =
      aiServiceMock
        .generateStructured
        .mock.calls[0];

    const userMessage =
      request.messages.find(
        (message: {
          role: string;
          content: string;
        }) =>
          message.role ===
          'user',
      );

    expect(
      userMessage.content,
    ).toContain(
      'Quadratic Equations',
    );

    expect(
      userMessage.content,
    ).toContain(
      'Total marks: 5',
    );

    expect(
      userMessage.content,
    ).toContain(
      'Duration: 45 minutes',
    );

    expect(
      userMessage.content,
    ).toContain(
      'Include conceptual questions.',
    );
  });

  it('works without additional instructions', async () => {
    aiServiceMock
      .generateStructured
      .mockResolvedValue(
        generatedPaper,
      );

    await service.generate({
      board: 'CBSE',
      grade: '10',
      subject: 'Mathematics',
      topic:
        'Quadratic Equations',
      kind:
        AssessmentKind.PRACTICE,
      totalMarks: 5,
      durationMinutes: 20,
    });

    const [request] =
      aiServiceMock
        .generateStructured
        .mock.calls[0];

    const userMessage =
      request.messages.find(
        (message: {
          role: string;
          content: string;
        }) =>
          message.role ===
          'user',
      );

    expect(
      userMessage.content,
    ).not.toContain(
      'Additional instructions:',
    );
  });

  it('uses teacher history when generating with teacher style', async () => {
    teacherStyleRetrieverMock
      .retrieve
      .mockResolvedValue([
        {
          type:
            QuestionType.TYPED,

          prompt:
            'Explain how the discriminant determines the nature of roots.',

          marks: 3,

          options: null,
        },
      ]);

    aiServiceMock
      .generateStructured
      .mockResolvedValue(
        generatedPaper,
      );

    const result =
      await service
        .generateWithTeacherStyle(
          'teacher-user-id',
          dto,
        );

    expect(result).toEqual(
      generatedPaper,
    );

    expect(
      teacherStyleRetrieverMock.retrieve,
    ).toHaveBeenCalledWith({
      teacherUserId:
        'teacher-user-id',

      board: 'CBSE',
      grade: '10',

      subject:
        'Mathematics',
    });

    const [request] =
      aiServiceMock
        .generateStructured
        .mock.calls[0];

    const systemMessage =
      request.messages.find(
        (message: {
          role: string;
          content: string;
        }) =>
          message.role ===
          'system',
      );

    expect(
      systemMessage.content,
    ).toContain(
      'TEACHER STYLE CONTEXT',
    );

    expect(
      systemMessage.content,
    ).toContain(
      'Explain how the discriminant determines the nature of roots.',
    );

    expect(
      systemMessage.content,
    ).toContain(
      'Do not copy the examples verbatim.',
    );
  });

  it('still generates when teacher has no matching history', async () => {
    teacherStyleRetrieverMock
      .retrieve
      .mockResolvedValue([]);

    aiServiceMock
      .generateStructured
      .mockResolvedValue(
        generatedPaper,
      );

    const result =
      await service
        .generateWithTeacherStyle(
          'new-teacher-id',
          dto,
        );

    expect(result).toEqual(
      generatedPaper,
    );

    const [request] =
      aiServiceMock
        .generateStructured
        .mock.calls[0];

    const systemMessage =
      request.messages.find(
        (message: {
          role: string;
          content: string;
        }) =>
          message.role ===
          'system',
      );

    expect(
      systemMessage.content,
    ).not.toContain(
      'TEACHER STYLE CONTEXT',
    );
  });

  it('generates and saves the teacher-style paper as a draft', async () => {
    teacherStyleRetrieverMock
      .retrieve
      .mockResolvedValue([
        {
          type:
            QuestionType.MCQ,

          prompt:
            'Which equation is quadratic?',

          marks: 1,

          options: [
            {
              id: 'A',
              text: 'x + 1',
            },
            {
              id: 'B',
              text:
                'x² + 1',
            },
          ],
        },
      ]);

    aiServiceMock
      .generateStructured
      .mockResolvedValue(
        generatedPaper,
      );

    persistenceServiceMock
      .saveDraft
      .mockResolvedValue({
        assessmentId:
          'ASM-001',

        kind: 'TEST',

        source:
          'AI_GENERATED',

        status: 'DRAFT',
      });

    const result =
      await service
        .generateAndSaveDraft(
          'teacher-user-id',
          dto,
        );

    expect(
      teacherStyleRetrieverMock.retrieve,
    ).toHaveBeenCalledTimes(1);

    expect(
      persistenceServiceMock.saveDraft,
    ).toHaveBeenCalledWith(
      'teacher-user-id',
      dto,
      generatedPaper,
    );

    expect(result).toEqual({
      assessmentId:
        'ASM-001',

      kind: 'TEST',

      source:
        'AI_GENERATED',

      status: 'DRAFT',
    });
  });

  it('does not persist when AI generation fails', async () => {
    teacherStyleRetrieverMock
      .retrieve
      .mockResolvedValue([]);

    aiServiceMock
      .generateStructured
      .mockRejectedValue(
        new Error(
          'AI service is temporarily unavailable',
        ),
      );

    await expect(
      service.generateAndSaveDraft(
        'teacher-user-id',
        dto,
      ),
    ).rejects.toThrow(
      'AI service is temporarily unavailable',
    );

    expect(
      persistenceServiceMock.saveDraft,
    ).not.toHaveBeenCalled();
  });

  it('propagates retrieval failures without calling AI', async () => {
    teacherStyleRetrieverMock
      .retrieve
      .mockRejectedValue(
        new Error(
          'Teacher style retrieval failed',
        ),
      );

    await expect(
      service.generateWithTeacherStyle(
        'teacher-user-id',
        dto,
      ),
    ).rejects.toThrow(
      'Teacher style retrieval failed',
    );

    expect(
      aiServiceMock.generateStructured,
    ).not.toHaveBeenCalled();
  });
});