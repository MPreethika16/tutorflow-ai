import { Test, TestingModule } from '@nestjs/testing';

import { AiService } from './ai.service';
import { PaperGenerationService } from './paper-generation.service';

describe('PaperGenerationService', () => {
  let service: PaperGenerationService;

  const aiServiceMock = {
    generateStructured: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          PaperGenerationService,
          {
            provide: AiService,
            useValue: aiServiceMock,
          },
        ],
      }).compile();

    service = module.get<PaperGenerationService>(
      PaperGenerationService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('builds the generation request and delegates to AiService', async () => {
    const generatedPaper = {
      title: 'Quadratic Equations Test',
      instructions: [
        'Answer all questions.',
      ],
      durationMinutes: 45,
      totalMarks: 5,
      questions: [
        {
          type: 'MCQ',
          prompt:
            'Which expression is quadratic?',
          marks: 1,
          difficulty: 'EASY',
          options: [
            {
              id: 'A',
              text: 'x + 1',
            },
            {
              id: 'B',
              text: 'x² + 2x + 1',
            },
          ],
          correctOption: 'B',
          explanation:
            'The highest power is 2.',
        },
        {
          type: 'SHORT_ANSWER',
          prompt:
            'What does the discriminant tell us?',
          marks: 4,
          difficulty: 'MEDIUM',
          modelAnswer:
            'It tells us the nature of the roots.',
          gradingInstructions:
            'Award marks for correctly identifying the nature of the roots.',
        },
      ],
    };

    aiServiceMock.generateStructured.mockResolvedValue(
      generatedPaper,
    );

    const result = await service.generate({
      board: 'CBSE',
      grade: '10',
      subject: 'Mathematics',
      topic: 'Quadratic Equations',
      kind: 'TEST',
      totalMarks: 5,
      durationMinutes: 45,
      additionalInstructions:
        'Include conceptual questions.',
    });

    expect(result).toEqual(generatedPaper);

    expect(
      aiServiceMock.generateStructured,
    ).toHaveBeenCalledTimes(1);

    const [
      request,
      schema,
      schemaName,
    ] =
      aiServiceMock.generateStructured.mock
        .calls[0];

    expect(schemaName).toBe(
      'generated_paper',
    );

    expect(schema).toBeDefined();

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

    const userMessage =
      request.messages.find(
        (message: {
          role: string;
          content: string;
        }) =>
          message.role === 'user',
      );

    expect(
      userMessage?.content,
    ).toContain(
      'Quadratic Equations',
    );

    expect(
      userMessage?.content,
    ).toContain(
      'Total marks: 5',
    );

    expect(
      userMessage?.content,
    ).toContain(
      'Duration: 45 minutes',
    );

    expect(
      userMessage?.content,
    ).toContain(
      'Include conceptual questions.',
    );
  });

  it('works without additional instructions', async () => {
    aiServiceMock.generateStructured.mockResolvedValue({
      title: 'Revision',
      instructions: [
        'Answer all questions.',
      ],
      durationMinutes: 20,
      totalMarks: 1,
      questions: [
        {
          type: 'TRUE_FALSE',
          prompt:
            'A quadratic equation has degree 2.',
          marks: 1,
          difficulty: 'EASY',
          correctAnswer: true,
          explanation:
            'Quadratic equations are second-degree equations.',
        },
      ],
    });

    await service.generate({
      board: 'CBSE',
      grade: '10',
      subject: 'Mathematics',
      topic: 'Quadratic Equations',
      kind: 'PRACTICE',
      totalMarks: 1,
      durationMinutes: 20,
    });

    const [request] =
      aiServiceMock.generateStructured.mock
        .calls[0];

    const userMessage =
      request.messages.find(
        (message: {
          role: string;
          content: string;
        }) =>
          message.role === 'user',
      );

    expect(
      userMessage?.content,
    ).not.toContain(
      'Additional instructions:',
    );
  });

  it('propagates AiService generation failures', async () => {
    aiServiceMock.generateStructured.mockRejectedValue(
      new Error(
        'AI service is temporarily unavailable',
      ),
    );

    await expect(
      service.generate({
        board: 'CBSE',
        grade: '10',
        subject: 'Mathematics',
        topic: 'Quadratic Equations',
        kind: 'TEST',
        totalMarks: 20,
        durationMinutes: 30,
      }),
    ).rejects.toThrow(
      'AI service is temporarily unavailable',
    );
  });
});