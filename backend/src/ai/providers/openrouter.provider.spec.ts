import { AiProviderError } from '../errors/ai-provider.error';
import { OpenRouterProvider } from './openrouter.provider';

describe('OpenRouterProvider', () => {
  let provider: OpenRouterProvider;

  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetAllMocks();

    process.env = {
      ...originalEnv,
      OPENROUTER_API_KEY: 'test-key',
      OPENROUTER_MODEL: 'openrouter/free',
      OPENROUTER_BASE_URL:
        'https://openrouter.ai/api/v1',
    };

    provider =
      new OpenRouterProvider();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns generated content for a successful response', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  'TutorFlow AI connected',
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type':
              'application/json',
          },
        },
      ),
    );

    const result =
      await provider.generateText({
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
  });

  it('maps 401 to AUTHENTICATION', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response('', {
        status: 401,
      }),
    );

    await expect(
      provider.generateText({
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'AUTHENTICATION',
      statusCode: 401,
    });
  });

  it('maps 429 to RATE_LIMIT', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response('', {
        status: 429,
      }),
    );

    await expect(
      provider.generateText({
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'RATE_LIMIT',
      statusCode: 429,
    });
  });

  it('maps 503 to UNAVAILABLE', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response('', {
        status: 503,
      }),
    );

    await expect(
      provider.generateText({
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'UNAVAILABLE',
      statusCode: 503,
    });
  });

  it('maps unexpected HTTP errors to UNKNOWN', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response('', {
        status: 418,
      }),
    );

    await expect(
      provider.generateText({
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'UNKNOWN',
      statusCode: 418,
    });
  });

  it('throws CONFIGURATION when API key is missing', async () => {
    delete process.env.OPENROUTER_API_KEY;

    await expect(
      provider.generateText({
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'CONFIGURATION',
    });

    expect(global.fetch).toBe(originalFetch);
  });

  it('throws CONFIGURATION when model is missing', async () => {
    delete process.env.OPENROUTER_MODEL;

    await expect(
      provider.generateText({
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'CONFIGURATION',
    });
  });

  it('maps invalid JSON response to INVALID_RESPONSE', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      {
        ok: true,
        status: 200,
        json: jest
          .fn()
          .mockRejectedValue(
            new SyntaxError(
              'Invalid JSON',
            ),
          ),
      } as unknown as Response,
    );

    await expect(
      provider.generateText({
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('maps missing content to INVALID_RESPONSE', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: null,
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type':
              'application/json',
          },
        },
      ),
    );

    await expect(
      provider.generateText({
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('maps network failures to UNAVAILABLE', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(
        new Error(
          'network connection failed',
        ),
      );

    await expect(
      provider.generateText({
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'UNAVAILABLE',
    });
  });

  it('passes structured output configuration to OpenRouter', async () => {
    const fetchMock =
      jest.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    '{"topic":"Math"}',
                },
              },
            ],
          }),
          {
            status: 200,
            headers: {
              'Content-Type':
                'application/json',
            },
          },
        ),
      );

    global.fetch = fetchMock;

    await provider.generateText({
      messages: [
        {
          role: 'user',
          content: 'Analyze Math',
        },
      ],

      structuredOutput: {
        name: 'topic_analysis',

        schema: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
            },
          },
          required: ['topic'],
          additionalProperties: false,
        },
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, options] =
      fetchMock.mock.calls[0];

    const body = JSON.parse(
      String(options?.body),
    );

    expect(
      body.response_format,
    ).toEqual({
      type: 'json_schema',
      json_schema: {
        name:
          'topic_analysis',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
            },
          },
          required: ['topic'],
          additionalProperties: false,
        },
      },
    });
  });

  it('throws AiProviderError instances', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response('', {
        status: 429,
      }),
    );

    try {
      await provider.generateText({
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
      });
    } catch (error) {
      expect(error).toBeInstanceOf(
        AiProviderError,
      );
    }
  });

  it('maps AbortError to TIMEOUT', async () => {
  const abortError =
    new Error('The operation was aborted');

  abortError.name = 'AbortError';

  global.fetch = jest
    .fn()
    .mockRejectedValue(abortError);

  await expect(
    provider.generateText({
      messages: [
        {
          role: 'user',
          content: 'Hello',
        },
      ],
    }),
  ).rejects.toMatchObject({
    code: 'TIMEOUT',
  });
});
});