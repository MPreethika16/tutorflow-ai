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


import {
  PaperRepairService,
} from './repair/paper-repair.service';

import {
  PaperValidationFailedError,
} from './validation/paper-validation.error';

import {
  GenerationWorkflowService,
} from './graph/generation-workflow.service';

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

  const paperRepairServiceMock = {
  repair: jest.fn(),    
  };

  const generationWorkflowServiceMock = {
  run: jest.fn(),
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
      
      generationWorkflowServiceMock.run.mockReset();

    

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

          {
            provide: PaperRepairService,
            useValue: paperRepairServiceMock,
          },

          {
            provide: GenerationWorkflowService,
            useValue: generationWorkflowServiceMock,
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
  aiServiceMock.generateStructured.mockResolvedValue(
    generatedPaper,
  );

  await service.generate({
    board: 'CBSE',
    grade: '10',
    subject: 'Mathematics',
    topic: 'Quadratic Equations',
    kind: AssessmentKind.PRACTICE,
    totalMarks: 5,
    durationMinutes: 45,
  });

  const [request] =
    aiServiceMock.generateStructured.mock.calls[0];

  const userMessage =
    request.messages.find(
      (message: {
        role: string;
        content: string;
      }) =>
        message.role === 'user',
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

  it('returns immediately when the generated paper is valid', async () => {
  aiServiceMock.generateStructured.mockResolvedValue(
    generatedPaper,
  );

  const result =
    await service.generate(dto);

  expect(result).toEqual(
    generatedPaper,
  );

  expect(
    paperRepairServiceMock.repair,
  ).not.toHaveBeenCalled();
});

it('repairs an invalid paper once when the first repair is valid', async () => {
  const invalidPaper = {
    ...generatedPaper,
    durationMinutes: 99,
  };

  const repairedPaper = {
    ...generatedPaper,
    durationMinutes:
      dto.durationMinutes,
  };

  aiServiceMock.generateStructured.mockResolvedValue(
    invalidPaper,
  );

  paperRepairServiceMock.repair.mockResolvedValue(
    repairedPaper,
  );

  const result =
    await service.generate(dto);

  expect(result).toEqual(
    repairedPaper,
  );

  expect(
    paperRepairServiceMock.repair,
  ).toHaveBeenCalledTimes(1);

  expect(
    paperRepairServiceMock.repair,
  ).toHaveBeenCalledWith(
    dto,
    invalidPaper,
    expect.arrayContaining([
      expect.objectContaining({
        code: 'DURATION_MISMATCH',
      }),
    ]),
  );
});

it('allows a second repair when the first repair is still invalid', async () => {
  const initialPaper = {
    ...generatedPaper,
    durationMinutes: 99,
  };

  const firstRepair = {
    ...generatedPaper,
    durationMinutes: 60,
  };

  const secondRepair = {
    ...generatedPaper,
    durationMinutes:
      dto.durationMinutes,
  };

  aiServiceMock.generateStructured.mockResolvedValue(
    initialPaper,
  );

  paperRepairServiceMock.repair
    .mockResolvedValueOnce(
      firstRepair,
    )
    .mockResolvedValueOnce(
      secondRepair,
    );

  const result =
    await service.generate(dto);

  expect(result).toEqual(
    secondRepair,
  );

  expect(
    paperRepairServiceMock.repair,
  ).toHaveBeenCalledTimes(2);
});


it('fails after the maximum number of repair attempts', async () => {
  const invalidPaper = {
    ...generatedPaper,
    durationMinutes: 99,
  };

  aiServiceMock.generateStructured.mockResolvedValue(
    invalidPaper,
  );

  paperRepairServiceMock.repair.mockResolvedValue(
    invalidPaper,
  );

  await expect(
    service.generate(dto),
  ).rejects.toBeInstanceOf(
    PaperValidationFailedError,
  );

  expect(
    paperRepairServiceMock.repair,
  ).toHaveBeenCalledTimes(2);
});

it('does not attempt repair when initial AI generation fails', async () => {
  aiServiceMock.generateStructured.mockRejectedValue(
    new Error(
      'AI provider unavailable',
    ),
  );

  await expect(
    service.generate(dto),
  ).rejects.toThrow(
    'AI provider unavailable',
  );

  expect(
    paperRepairServiceMock.repair,
  ).not.toHaveBeenCalled();
});




it('delegates draft generation to the LangGraph workflow', async () => {
  generationWorkflowServiceMock.run.mockResolvedValue({
    assessmentId: 'ASM-001',
    kind: 'TEST',
    source: 'AI_GENERATED',
    status: 'DRAFT',
  });

  const result =
    await service.generateAndSaveDraft(
      'teacher-user-id',
      dto,
    );

  expect(
    generationWorkflowServiceMock.run,
  ).toHaveBeenCalledTimes(1);

  expect(
    generationWorkflowServiceMock.run,
  ).toHaveBeenCalledWith(
    'teacher-user-id',
    dto,
  );

  expect(result).toEqual({
    assessmentId: 'ASM-001',
    kind: 'TEST',
    source: 'AI_GENERATED',
    status: 'DRAFT',
  });
});

it('propagates LangGraph workflow failures', async () => {
  generationWorkflowServiceMock.run.mockRejectedValue(
    new Error(
      'AI paper generation workflow failed',
    ),
  );

  await expect(
    service.generateAndSaveDraft(
      'teacher-user-id',
      dto,
    ),
  ).rejects.toThrow(
    'AI paper generation workflow failed',
  );
});

it('does not directly call persistence when delegating to the graph workflow', async () => {
  generationWorkflowServiceMock.run.mockResolvedValue({
    assessmentId: 'ASM-001',
    status: 'DRAFT',
    source: 'AI_GENERATED',
  });

  await service.generateAndSaveDraft(
    'teacher-user-id',
    dto,
  );

  expect(
    persistenceServiceMock.saveDraft,
  ).not.toHaveBeenCalled();
});

});