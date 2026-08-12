export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiGenerateTextRequest {
  messages: AiMessage[];
}

export interface AiGenerateTextResponse {
  content: string;
}

export interface AiProvider {
  generateText(
    request: AiGenerateTextRequest,
  ): Promise<AiGenerateTextResponse>;
}