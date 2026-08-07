export interface AiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface AiToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AiChatRequest {
  messages: AiMessage[];
  tools?: AiToolDefinition[];
  locale: 'en' | 'ar';
}

export interface AiChatResponse {
  content: string;
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
}

export interface AiProvider {
  chat(request: AiChatRequest): Promise<AiChatResponse>;
}
