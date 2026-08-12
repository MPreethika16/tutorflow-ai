import {
  InternalServerErrorException,
   ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AiProviderError } from './errors/ai-provider.error';
import { AiService } from './ai.service';
import type {
  AiProvider,
} from './providers/ai-provider.interface';
import { AI_PROVIDER } from './providers/ai-provider.token';
import {
  aiTopicAnalysisSchema,
} from './schemas/ai-topic-analysis.schema';

describe('AiService', () => {
  let service: AiService;

  const providerMock: jest.Mocked<AiProvider> = {
    generateText: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          AiService,
          {
            provide: AI_PROVIDER,
            useValue: providerMock,
          },
        ],
      }).compile();

    service =
      module.get<AiService>(
        AiService,
      );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns a typed object for valid structured output', async () => {
    providerMock.generateText.mockResolvedValue({
      content: JSON.stringify({
        topic:
          'Quadratic Equations',
        difficulty:
          'MEDIUM',
        summary:
          'A Grade 10 algebra topic.',
      }),
    });

    const result =
      await service.generateStructured(
        {
          messages: [
            {
              role: 'user',
              content:
                'Analyze Quadratic Equations.',
            },
          ],
        },
        aiTopicAnalysisSchema,
        'topic_analysis',
      );

    expect(result).toEqual({
      topic:
        'Quadratic Equations',
      difficulty:
        'MEDIUM',
      summary:
        'A Grade 10 algebra topic.',
    });
  });

  it('throws when provider returns invalid JSON', async () => {
    providerMock.generateText.mockResolvedValue({
      content:
        'this is not json',
    });

    await expect(
      service.generateStructured(
        {
          messages: [
            {
              role: 'user',
              content:
                'Analyze a topic.',
            },
          ],
        },
        aiTopicAnalysisSchema,
        'topic_analysis',
      ),
    ).rejects.toThrow(
      new InternalServerErrorException(
        'AI provider returned invalid JSON',
      ),
    );
  });

  it('throws when JSON does not match the schema', async () => {
    providerMock.generateText.mockResolvedValue({
      content: JSON.stringify({
        topic:
          'Quadratic Equations',
        difficulty:
          'moderate',
        summary:
          'A Grade 10 algebra topic.',
      }),
    });

    await expect(
      service.generateStructured(
        {
          messages: [
            {
              role: 'user',
              content:
                'Analyze a topic.',
            },
          ],
        },
        aiTopicAnalysisSchema,
        'topic_analysis',
      ),
    ).rejects.toThrow(
      new InternalServerErrorException(
        'AI provider returned invalid structured output',
      ),
    );
  });

it('maps unexpected provider failures to safe 503 during structured generation', async () => {
  providerMock.generateText.mockRejectedValue(
    new Error(
      'AI provider request failed',
    ),
  );

  await expect(
    service.generateStructured(
      {
        messages: [
          {
            role: 'user',
            content:
              'Analyze a topic.',
          },
        ],
      },
      aiTopicAnalysisSchema,
      'topic_analysis',
    ),
  ).rejects.toThrow(
    new ServiceUnavailableException(
      'AI service is temporarily unavailable',
    ),
  );
});

  it('passes structured output schema to the provider', async () => {
    providerMock.generateText.mockResolvedValue({
      content: JSON.stringify({
        topic:
          'Quadratic Equations',
        difficulty:
          'MEDIUM',
        summary:
          'A Grade 10 algebra topic.',
      }),
    });

    await service.generateStructured(
      {
        messages: [
          {
            role: 'user',
            content:
              'Analyze Quadratic Equations.',
          },
        ],
      },
      aiTopicAnalysisSchema,
      'topic_analysis',
    );

    expect(
      providerMock.generateText,
    ).toHaveBeenCalledTimes(1);

    const request =
      providerMock.generateText.mock
        .calls[0][0];

    expect(
      request.structuredOutput,
    ).toBeDefined();

    expect(
      request.structuredOutput?.name,
    ).toBe('topic_analysis');

    expect(
      request.structuredOutput?.schema,
    ).toEqual(
      expect.objectContaining({
        type: 'object',
      }),
    );
  });

  it('delegates normal text generation to the provider', async () => {
    providerMock.generateText.mockResolvedValue({
      content:
        'TutorFlow AI connected',
    });

    const result =
      await service.generateText({
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
      });

    expect(result).toEqual({
      content:
        'TutorFlow AI connected',
    });

    expect(
      providerMock.generateText,
    ).toHaveBeenCalledWith({
      messages: [
        {
          role: 'user',
          content: 'Hello',
        },
      ],
    });
  });

  it('maps provider configuration errors to 500 without leaking provider details', async () => {
  providerMock.generateText.mockRejectedValue(
    new AiProviderError(
      'CONFIGURATION',
      'OPENROUTER_API_KEY missing',
    ),
  );

  await expect(
    service.generateText({
      messages: [
        {
          role: 'user',
          content: 'Hello',
        },
      ],
    }),
  ).rejects.toThrow(
    new InternalServerErrorException(
      'AI service is not configured',
    ),
  );
});

it('maps provider rate-limit errors to safe 503', async () => {
  providerMock.generateText.mockRejectedValue(
    new AiProviderError(
      'RATE_LIMIT',
      'OpenRouter 429 rate limit exceeded',
      429,
    ),
  );

  await expect(
    service.generateText({
      messages: [
        {
          role: 'user',
          content: 'Hello',
        },
      ],
    }),
  ).rejects.toThrow(
    new ServiceUnavailableException(
      'AI service is temporarily unavailable',
    ),
  );
});

it('maps provider timeout errors to safe 503', async () => {
  providerMock.generateText.mockRejectedValue(
    new AiProviderError(
      'TIMEOUT',
      'Request timed out after 15000ms',
    ),
  );

  await expect(
    service.generateText({
      messages: [
        {
          role: 'user',
          content: 'Hello',
        },
      ],
    }),
  ).rejects.toThrow(
    new ServiceUnavailableException(
      'AI service is temporarily unavailable',
    ),
  );
});

it('maps provider unavailable errors to safe 503', async () => {
  providerMock.generateText.mockRejectedValue(
    new AiProviderError(
      'UNAVAILABLE',
      'OpenRouter 503 provider unavailable',
      503,
    ),
  );

  await expect(
    service.generateText({
      messages: [
        {
          role: 'user',
          content: 'Hello',
        },
      ],
    }),
  ).rejects.toThrow(
    new ServiceUnavailableException(
      'AI service is temporarily unavailable',
    ),
  );
});

it('does not leak provider-specific error details', async () => {
  providerMock.generateText.mockRejectedValue(
    new AiProviderError(
      'AUTHENTICATION',
      'Invalid OpenRouter API key sk-secret-example',
      401,
    ),
  );

  try {
    await service.generateText({
      messages: [
        {
          role: 'user',
          content: 'Hello',
        },
      ],
    });
  } catch (error) {
    expect(error).toBeInstanceOf(
      ServiceUnavailableException,
    );

    expect(
      (error as Error).message,
    ).toBe(
      'AI service is temporarily unavailable',
    );

    expect(
      (error as Error).message,
    ).not.toContain(
      'sk-secret-example',
    );
  }
});

it('maps unknown provider failures to safe 503', async () => {
  providerMock.generateText.mockRejectedValue(
    new Error(
      'unexpected provider failure',
    ),
  );

  await expect(
    service.generateText({
      messages: [
        {
          role: 'user',
          content: 'Hello',
        },
      ],
    }),
  ).rejects.toThrow(
    new ServiceUnavailableException(
      'AI service is temporarily unavailable',
    ),
  );
});


});