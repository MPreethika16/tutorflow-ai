import {
  AssessmentKind,
  QuestionType,
} from '../../generated/prisma/client';

import {
  GenerationAgent,
} from './generation-agent';

describe('GenerationAgent', () => {
  const aiServiceMock = {
    generateStructured: jest.fn(),
  };

  const retrieverMock = {
    retrieve: jest.fn(),
  };

  const repairServiceMock = {
    repair: jest.fn(),
  };

  const persistenceServiceMock = {
    saveDraft: jest.fn(),
  };

  const request = {
    board: 'CBSE',
    grade: '10',
    subject: 'Mathematics',
    topic: 'Quadratic Equations',
    kind: AssessmentKind.TEST,
    totalMarks: 5,
    durationMinutes: 30,
  };

  const validPaper = {
    title:
      'Quadratic Equations Test',

    instructions: [
      'Answer all questions.',
    ],

    durationMinutes: 30,

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
            text: 'x² + 1',
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

  beforeEach(() => {
    jest.clearAllMocks();

    retrieverMock.retrieve.mockResolvedValue(
      [],
    );

    persistenceServiceMock.saveDraft.mockResolvedValue({
      assessmentId: 'ASM-001',
      source:
        'AI_GENERATED',
      status: 'DRAFT',
    });
  });

  it('generates, validates, and persists a valid paper', async () => {
    aiServiceMock.generateStructured.mockResolvedValue(
      validPaper,
    );

    const agent =
      new GenerationAgent(
        aiServiceMock as never,
        retrieverMock as never,
        repairServiceMock as never,
        persistenceServiceMock as never,
      );

    const result =
      await agent.run(
        'teacher-user-id',
        request,
      );

    expect(
      retrieverMock.retrieve,
    ).toHaveBeenCalledTimes(1);

    expect(
      aiServiceMock.generateStructured,
    ).toHaveBeenCalledTimes(1);

    expect(
      repairServiceMock.repair,
    ).not.toHaveBeenCalled();

    expect(
      persistenceServiceMock.saveDraft,
    ).toHaveBeenCalledTimes(1);

    expect(result).toEqual({
      assessmentId: 'ASM-001',
      source:
        'AI_GENERATED',
      status: 'DRAFT',
    });
  });

  it('repairs once before persisting when the first paper is invalid', async () => {
    const invalidPaper = {
      ...validPaper,
      durationMinutes: 99,
    };

    aiServiceMock.generateStructured.mockResolvedValue(
      invalidPaper,
    );

    repairServiceMock.repair.mockResolvedValue(
      validPaper,
    );

    const agent =
      new GenerationAgent(
        aiServiceMock as never,
        retrieverMock as never,
        repairServiceMock as never,
        persistenceServiceMock as never,
      );

    await agent.run(
      'teacher-user-id',
      request,
    );

    expect(
      repairServiceMock.repair,
    ).toHaveBeenCalledTimes(1);

    expect(
      persistenceServiceMock.saveDraft,
    ).toHaveBeenCalledTimes(1);
  });

  it('repairs twice when needed', async () => {
    const invalidPaperOne = {
      ...validPaper,
      durationMinutes: 99,
    };

    const invalidPaperTwo = {
      ...validPaper,
      durationMinutes: 60,
    };

    aiServiceMock.generateStructured.mockResolvedValue(
      invalidPaperOne,
    );

    repairServiceMock.repair
      .mockResolvedValueOnce(
        invalidPaperTwo,
      )
      .mockResolvedValueOnce(
        validPaper,
      );

    const agent =
      new GenerationAgent(
        aiServiceMock as never,
        retrieverMock as never,
        repairServiceMock as never,
        persistenceServiceMock as never,
      );

    await agent.run(
      'teacher-user-id',
      request,
    );

    expect(
      repairServiceMock.repair,
    ).toHaveBeenCalledTimes(2);

    expect(
      persistenceServiceMock.saveDraft,
    ).toHaveBeenCalledTimes(1);
  });

  it('fails after the repair budget is exhausted', async () => {
    const invalidPaper = {
      ...validPaper,
      durationMinutes: 99,
    };

    aiServiceMock.generateStructured.mockResolvedValue(
      invalidPaper,
    );

    repairServiceMock.repair.mockResolvedValue(
      invalidPaper,
    );

    const agent =
      new GenerationAgent(
        aiServiceMock as never,
        retrieverMock as never,
        repairServiceMock as never,
        persistenceServiceMock as never,
      );

    await expect(
      agent.run(
        'teacher-user-id',
        request,
      ),
    ).rejects.toThrow(
      'Generation workflow failed after maximum repair attempts',
    );

    expect(
      repairServiceMock.repair,
    ).toHaveBeenCalledTimes(2);

    expect(
      persistenceServiceMock.saveDraft,
    ).not.toHaveBeenCalled();
  });

  it('uses teacher history before generation', async () => {
    retrieverMock.retrieve.mockResolvedValue([
      {
        type:
          QuestionType.TYPED,

        prompt:
          'Explain how the discriminant determines the nature of roots.',

        marks: 3,

        options: null,
      },
    ]);

    aiServiceMock.generateStructured.mockResolvedValue(
      validPaper,
    );

    const agent =
      new GenerationAgent(
        aiServiceMock as never,
        retrieverMock as never,
        repairServiceMock as never,
        persistenceServiceMock as never,
      );

    await agent.run(
      'teacher-user-id',
      request,
    );

    expect(
      retrieverMock.retrieve,
    ).toHaveBeenCalledWith({
      teacherUserId:
        'teacher-user-id',

      board: 'CBSE',
      grade: '10',
      subject:
        'Mathematics',
    });

    const [aiRequest] =
      aiServiceMock
        .generateStructured
        .mock.calls[0];

    const systemMessage =
      aiRequest.messages.find(
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
      'Explain how the discriminant determines the nature of roots.',
    );
  });

  it('does not persist when generation fails', async () => {
    aiServiceMock.generateStructured.mockRejectedValue(
      new Error(
        'AI unavailable',
      ),
    );

    const agent =
      new GenerationAgent(
        aiServiceMock as never,
        retrieverMock as never,
        repairServiceMock as never,
        persistenceServiceMock as never,
      );

    await expect(
      agent.run(
        'teacher-user-id',
        request,
      ),
    ).rejects.toThrow(
      'AI unavailable',
    );

    expect(
      persistenceServiceMock.saveDraft,
    ).not.toHaveBeenCalled();
  });
});