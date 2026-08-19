import { Test, TestingModule } from '@nestjs/testing';
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

    const error = await service.generateStructured(
      {
        messages: [{ role: 'user', content: 'Analyze a topic.' }],
      },
      aiTopicAnalysisSchema,
      'topic_analysis',
    ).catch(e => e);
    
    expect(error).toBeInstanceOf(AiProviderError);
    expect(error.code).toBe('INVALID_RESPONSE');
    expect(error.message).toBe('AI provider returned invalid JSON');
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

    const error = await service.generateStructured(
      {
        messages: [{ role: 'user', content: 'Analyze a topic.' }],
      },
      aiTopicAnalysisSchema,
      'topic_analysis',
    ).catch(e => e);
    
    expect(error).toBeInstanceOf(AiProviderError);
    expect(error.code).toBe('INVALID_RESPONSE');
    expect(error.message).toBe('AI provider returned invalid structured output');
  });

it('maps unexpected provider failures to UNKNOWN during structured generation', async () => {
  providerMock.generateText.mockRejectedValue(
    new Error('AI provider request failed'),
  );

  const error = await service.generateStructured(
    { messages: [{ role: 'user', content: 'Analyze a topic.' }] },
    aiTopicAnalysisSchema,
    'topic_analysis',
  ).catch(e => e);
  
  expect(error).toBeInstanceOf(AiProviderError);
  expect(error.code).toBe('UNKNOWN');
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

it('preserves CONFIGURATION error', async () => {
  providerMock.generateText.mockRejectedValue(
    new AiProviderError('CONFIGURATION', 'OPENROUTER_API_KEY missing'),
  );

  const error = await service.generateText({
    messages: [{ role: 'user', content: 'Hello' }],
  }).catch(e => e);
  
  expect(error).toBeInstanceOf(AiProviderError);
  expect(error.code).toBe('CONFIGURATION');
});

it('preserves RATE_LIMIT error', async () => {
  providerMock.generateText.mockRejectedValue(
    new AiProviderError('RATE_LIMIT', 'OpenRouter 429 rate limit exceeded', 429),
  );

  const error = await service.generateText({
    messages: [{ role: 'user', content: 'Hello' }],
  }).catch(e => e);
  
  expect(error).toBeInstanceOf(AiProviderError);
  expect(error.code).toBe('RATE_LIMIT');
});

it('preserves TIMEOUT error', async () => {
  providerMock.generateText.mockRejectedValue(
    new AiProviderError('TIMEOUT', 'Request timed out after 15000ms'),
  );

  const error = await service.generateText({
    messages: [{ role: 'user', content: 'Hello' }],
  }).catch(e => e);
  
  expect(error).toBeInstanceOf(AiProviderError);
  expect(error.code).toBe('TIMEOUT');
});

it('preserves UNAVAILABLE error', async () => {
  providerMock.generateText.mockRejectedValue(
    new AiProviderError('UNAVAILABLE', 'OpenRouter 503 provider unavailable', 503),
  );

  const error = await service.generateText({
    messages: [{ role: 'user', content: 'Hello' }],
  }).catch(e => e);
  
  expect(error).toBeInstanceOf(AiProviderError);
  expect(error.code).toBe('UNAVAILABLE');
});

it('preserves AUTHENTICATION error but does not leak provider-specific error details to generic handlers (handled at controller level if needed)', async () => {
  providerMock.generateText.mockRejectedValue(
    new AiProviderError('AUTHENTICATION', 'Invalid OpenRouter API key sk-secret-example', 401),
  );

  const error = await service.generateText({
    messages: [{ role: 'user', content: 'Hello' }],
  }).catch(e => e);
  
  expect(error).toBeInstanceOf(AiProviderError);
  expect(error.code).toBe('AUTHENTICATION');
  // It's acceptable for the domain error to contain details;
  // hiding it from users should happen in an ExceptionFilter or Controller.
});

it('maps unknown provider failures to UNKNOWN error', async () => {
  providerMock.generateText.mockRejectedValue(
    new Error('unexpected provider failure'),
  );

  const error = await service.generateText({
    messages: [{ role: 'user', content: 'Hello' }],
  }).catch(e => e);
  
  expect(error).toBeInstanceOf(AiProviderError);
  expect(error.code).toBe('UNKNOWN');
});


});