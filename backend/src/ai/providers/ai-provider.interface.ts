export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiStructuredOutput {
  name: string;
  schema: Record<string, unknown>;
}

export interface AiGenerateTextRequest {
  messages: AiMessage[];
  structuredOutput?: AiStructuredOutput;
}

export interface AiGenerateTextResponse {
  content: string;
}

export interface AiProvider {
  generateText(
    request: AiGenerateTextRequest,
  ): Promise<AiGenerateTextResponse>;
}