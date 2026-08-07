import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AiChatRequest, AiChatResponse, AiProvider } from './ai-provider.interface';
import { AiToolsService } from './ai-tools.service';

@Injectable()
export class MockAiProvider implements AiProvider {
  constructor(private readonly tools: AiToolsService) {}

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    const last = request.messages.filter((m) => m.role === 'user').at(-1)?.content ?? '';
    const lower = last.toLowerCase();

    if (/شاحنة|truck|سطحة|flatbed|نقل|transport|capacity|حمول/.test(last)) {
      const capacityMatch = last.match(/(\d+)\s*(ton|tonne|طن|tons)/i);
      const minCapacityKg = capacityMatch ? Number(capacityMatch[1]) * 1000 : undefined;
      return {
        content:
          request.locale === 'ar'
            ? 'يمكنني مساعدتك في البحث عن الشاحنات المناسبة. هذه بعض الخيارات المتاحة:'
            : 'I can help you find suitable trucks. Here are available options:',
        toolCalls: [
          {
            name: 'searchMarketplaceTrucks',
            arguments: {
              search: last,
              minCapacityKg,
            },
          },
        ],
      };
    }

    if (/quote|عرض|booking|حجز|shipment|شحنة|track|تتبع/.test(lower)) {
      return {
        content:
          request.locale === 'ar'
            ? 'أخبرني برقم طلب عرض السعر أو الشحنة وسأتحقق من حالته ضمن صلاحيات حسابك.'
            : 'Share your quote or shipment reference and I will check its status within your account permissions.',
      };
    }

    return {
      content:
        request.locale === 'ar'
          ? 'مرحباً! أنا مساعد ترانزيت لوجستك. اسألني عن الشاحنات، الحجوزات، عروض الأسعار، أو الشحنات.'
          : 'Hello! I am the Transit Logistic assistant. Ask about trucks, bookings, quotes, or shipments.',
    };
  }
}

@Injectable()
export class OpenAiProvider implements AiProvider {
  constructor(
    private readonly config: ConfigService,
    private readonly fallback: MockAiProvider,
  ) {}

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    const apiKey = this.config.get<string>('ai.openaiApiKey');
    if (!apiKey) return this.fallback.chat(request);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.get<string>('ai.model', 'gpt-4o-mini'),
          messages: request.messages,
          tools: request.tools?.map((tool) => ({
            type: 'function',
            function: { name: tool.name, description: tool.description, parameters: tool.parameters },
          })),
        }),
      });
      if (!response.ok) return this.fallback.chat(request);
      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string; tool_calls?: Array<{ function: { name: string; arguments: string } }> } }>;
      };
      const message = json.choices?.[0]?.message;
      return {
        content: message?.content ?? '',
        toolCalls: message?.tool_calls?.map((call) => ({
          name: call.function.name,
          arguments: JSON.parse(call.function.arguments) as Record<string, unknown>,
        })),
      };
    } catch {
      return this.fallback.chat(request);
    }
  }
}
