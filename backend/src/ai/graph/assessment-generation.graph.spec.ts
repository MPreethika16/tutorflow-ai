import {
  AssessmentKind,
  QuestionType,
} from '../../generated/prisma/client';

import {
  buildAssessmentGenerationGraph,
} from './assessment-generation.graph';

describe('AssessmentGenerationGraph', () => {
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
    title: 'Quadratic Equations Test',

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
        difficulty: 'EASY' as const,

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
        type: 'SHORT_ANSWER' as const,

        prompt:
          'What does the discriminant tell us?',

        marks: 4,
        difficulty: 'MEDIUM' as const,

        modelAnswer:
          'It tells us the nature of the roots.',

        gradingInstructions:
          'Award marks for correctly explaining the nature of the roots.',
      },
    ],
  };

  const persistedAssessment = {
    assessmentId: 'ASM-001',

    title:
      'Quadratic Equations Test',

    kind: AssessmentKind.TEST,

    source: 'AI_GENERATED',

    status: 'DRAFT',

    maximumMarks: 5,

    durationMinutes: 30,
  };

  function buildGraph() {
    return buildAssessmentGenerationGraph(
      aiServiceMock as never,
      retrieverMock as never,
      repairServiceMock as never,
      persistenceServiceMock as never,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();

    retrieverMock.retrieve.mockResolvedValue(
      [],
    );

    persistenceServiceMock.saveDraft.mockResolvedValue(
      persistedAssessment,
    );
  });

  it('retrieves, generates, validates, and persists a valid paper', async () => {
    aiServiceMock.generateStructured.mockResolvedValue(
      validPaper,
    );

    const graph = buildGraph();

    const result =
      await graph.invoke({
        teacherUserId:
          'teacher-user-id',

        request,
      });

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

    expect(
      persistenceServiceMock.saveDraft,
    ).toHaveBeenCalledWith(
      'teacher-user-id',
      expect.objectContaining({
        board: 'CBSE',
        grade: '10',
        subject: 'Mathematics',
        topic:
          'Quadratic Equations',
      }),
      validPaper,
    );

    expect(
      result.generatedPaper,
    ).toEqual(validPaper);

    expect(
      result.validationErrors,
    ).toEqual([]);

    expect(
      result.repairCount,
    ).toBe(0);

    expect(
      result.status,
    ).toBe('COMPLETED');

    expect(
      result.persistedAssessment,
    ).toEqual({
      assessmentId:
        'ASM-001',

      title:
        'Quadratic Equations Test',

      kind: 'TEST',

      source:
        'AI_GENERATED',

      status:
        'DRAFT',

      maximumMarks: 5,

      durationMinutes: 30,
    });
  });

  it('repairs an invalid paper once and persists the valid repair', async () => {
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

    const graph = buildGraph();

    const result =
      await graph.invoke({
        teacherUserId:
          'teacher-user-id',

        request,
      });

    expect(
      repairServiceMock.repair,
    ).toHaveBeenCalledTimes(1);

    expect(
      repairServiceMock.repair,
    ).toHaveBeenCalledWith(
      expect.objectContaining(
        request,
      ),

      invalidPaper,

      expect.arrayContaining([
        expect.objectContaining({
          code:
            'DURATION_MISMATCH',
        }),
      ]),
    );

    expect(
      persistenceServiceMock.saveDraft,
    ).toHaveBeenCalledTimes(1);

    expect(
      persistenceServiceMock.saveDraft,
    ).toHaveBeenCalledWith(
      'teacher-user-id',
      expect.objectContaining(
        request,
      ),
      validPaper,
    );

    expect(
      result.generatedPaper,
    ).toEqual(validPaper);

    expect(
      result.validationErrors,
    ).toEqual([]);

    expect(
      result.repairCount,
    ).toBe(1);

    expect(
      result.status,
    ).toBe('COMPLETED');

    expect(
      result.persistedAssessment,
    ).toEqual(
      expect.objectContaining({
        assessmentId:
          'ASM-001',

        source:
          'AI_GENERATED',

        status:
          'DRAFT',
      }),
    );
  });

  it('uses two repairs when the first repair is still invalid', async () => {
    const firstInvalidPaper = {
      ...validPaper,
      durationMinutes: 99,
    };

    const secondInvalidPaper = {
      ...validPaper,
      durationMinutes: 60,
    };

    aiServiceMock.generateStructured.mockResolvedValue(
      firstInvalidPaper,
    );

    repairServiceMock.repair
      .mockResolvedValueOnce(
        secondInvalidPaper,
      )
      .mockResolvedValueOnce(
        validPaper,
      );

    const graph = buildGraph();

    const result =
      await graph.invoke({
        teacherUserId:
          'teacher-user-id',

        request,
      });

    expect(
      repairServiceMock.repair,
    ).toHaveBeenCalledTimes(2);

    expect(
      persistenceServiceMock.saveDraft,
    ).toHaveBeenCalledTimes(1);

    expect(
      result.generatedPaper,
    ).toEqual(validPaper);

    expect(
      result.validationErrors,
    ).toEqual([]);

    expect(
      result.repairCount,
    ).toBe(2);

    expect(
      result.status,
    ).toBe('COMPLETED');

    expect(
      result.persistedAssessment,
    ).toEqual(
      expect.objectContaining({
        assessmentId:
          'ASM-001',

        kind: 'TEST',

        source:
          'AI_GENERATED',

        status:
          'DRAFT',
      }),
    );
  });

  it('stops after two failed repairs and does not persist', async () => {
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

    const graph = buildGraph();

    const result =
      await graph.invoke({
        teacherUserId:
          'teacher-user-id',

        request,
      });

    expect(
      repairServiceMock.repair,
    ).toHaveBeenCalledTimes(2);

    expect(
      result.repairCount,
    ).toBe(2);

    expect(
      result.validationErrors,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code:
            'DURATION_MISMATCH',
        }),
      ]),
    );

    expect(
      result.status,
    ).toBe('FAILED');

    expect(
      persistenceServiceMock.saveDraft,
    ).not.toHaveBeenCalled();

    expect(
      result.persistedAssessment,
    ).toBeUndefined();
  });

  it('uses teacher history before generating and persists the result', async () => {
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

    const graph = buildGraph();

    const result =
      await graph.invoke({
        teacherUserId:
          'teacher-user-id',

        request,
      });

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

    expect(
      persistenceServiceMock.saveDraft,
    ).toHaveBeenCalledTimes(1);

    expect(
      result.status,
    ).toBe('COMPLETED');

    expect(
      result.persistedAssessment,
    ).toEqual(
      expect.objectContaining({
        assessmentId:
          'ASM-001',

        source:
          'AI_GENERATED',

        status:
          'DRAFT',
      }),
    );
  });

  it('works without teacher history', async () => {
    retrieverMock.retrieve.mockResolvedValue(
      [],
    );

    aiServiceMock.generateStructured.mockResolvedValue(
      validPaper,
    );

    const graph = buildGraph();

    const result =
      await graph.invoke({
        teacherUserId:
          'new-teacher-id',

        request,
      });

    expect(
      retrieverMock.retrieve,
    ).toHaveBeenCalledTimes(1);

    expect(
      aiServiceMock.generateStructured,
    ).toHaveBeenCalledTimes(1);

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
    ).not.toContain(
      'TEACHER STYLE CONTEXT',
    );

    expect(
      result.status,
    ).toBe('COMPLETED');

    expect(
      result.persistedAssessment,
    ).toBeDefined();
  });

  it('does not persist when initial AI generation fails', async () => {
    aiServiceMock.generateStructured.mockRejectedValue(
      new Error(
        'AI unavailable',
      ),
    );

    const graph = buildGraph();

    await expect(
      graph.invoke({
        teacherUserId:
          'teacher-user-id',

        request,
      }),
    ).rejects.toThrow(
      'AI unavailable',
    );

    expect(
      repairServiceMock.repair,
    ).not.toHaveBeenCalled();

    expect(
      persistenceServiceMock.saveDraft,
    ).not.toHaveBeenCalled();
  });

  it('does not generate or persist when teacher retrieval fails', async () => {
    retrieverMock.retrieve.mockRejectedValue(
      new Error(
        'Retrieval failed',
      ),
    );

    const graph = buildGraph();

    await expect(
      graph.invoke({
        teacherUserId:
          'teacher-user-id',

        request,
      }),
    ).rejects.toThrow(
      'Retrieval failed',
    );

    expect(
      aiServiceMock.generateStructured,
    ).not.toHaveBeenCalled();

    expect(
      repairServiceMock.repair,
    ).not.toHaveBeenCalled();

    expect(
      persistenceServiceMock.saveDraft,
    ).not.toHaveBeenCalled();
  });

  it('propagates persistence failure after successful validation', async () => {
    aiServiceMock.generateStructured.mockResolvedValue(
      validPaper,
    );

    persistenceServiceMock.saveDraft.mockRejectedValue(
      new Error(
        'Persistence failed',
      ),
    );

    const graph = buildGraph();

    await expect(
      graph.invoke({
        teacherUserId:
          'teacher-user-id',

        request,
      }),
    ).rejects.toThrow(
      'Persistence failed',
    );

    expect(
      repairServiceMock.repair,
    ).not.toHaveBeenCalled();

    expect(
      persistenceServiceMock.saveDraft,
    ).toHaveBeenCalledTimes(1);
  });
});