import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@/types/user';

import { PrismaService } from '../../database/prisma.service';

import type { AiMessage } from './ai-provider.interface';
import { MockAiProvider, OpenAiProvider } from './ai-providers.service';
import { AiToolsService } from './ai-tools.service';

const TOOLS = [
  {
    name: 'searchMarketplaceTrucks',
    description: 'Search approved truck listings',
    parameters: { type: 'object', properties: { search: { type: 'string' }, minCapacityKg: { type: 'number' } } },
  },
  {
    name: 'getTruckDetails',
    description: 'Get truck listing by slug',
    parameters: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] },
  },
  {
    name: 'getQuoteStatus',
    description: 'Get quote request status for current user',
    parameters: { type: 'object', properties: { quoteId: { type: 'string' } }, required: ['quoteId'] },
  },
  {
    name: 'getShipmentStatus',
    description: 'Get shipment status for current user',
    parameters: { type: 'object', properties: { shipmentId: { type: 'string' } }, required: ['shipmentId'] },
  },
  {
    name: 'getFleetMetrics',
    description: 'Fleet owner dashboard metrics',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'getAdminMetrics',
    description: 'Admin platform metrics',
    parameters: { type: 'object', properties: {} },
  },
];

@Injectable()
export class AiChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tools: AiToolsService,
    private readonly mock: MockAiProvider,
    private readonly openai: OpenAiProvider,
  ) {}

  private provider() {
    return this.config.get<string>('ai.provider', 'mock') === 'openai' ? this.openai : this.mock;
  }

  async listSessions(user: User) {
    return this.prisma.aiChatSession.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
  }

  async getMessages(user: User, sessionId: string) {
    const session = await this.prisma.aiChatSession.findFirst({
      where: { id: sessionId, userId: user.id },
    });
    if (!session) return [];
    return this.prisma.aiChatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async chat(user: User, input: { message: string; sessionId?: string; locale?: 'en' | 'ar' }) {
    const locale = input.locale ?? (user.locale as 'en' | 'ar') ?? 'ar';
    let session = input.sessionId
      ? await this.prisma.aiChatSession.findFirst({ where: { id: input.sessionId, userId: user.id } })
      : null;

    if (!session) {
      session = await this.prisma.aiChatSession.create({
        data: {
          userId: user.id,
          role: user.role,
          locale,
          title: input.message.slice(0, 80),
        },
      });
    }

    await this.prisma.aiChatMessage.create({
      data: { sessionId: session.id, role: 'user', content: input.message },
    });

    const history = await this.prisma.aiChatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    const systemPrompt =
      locale === 'ar'
        ? `أنت مساعد ترانزيت لوجستك. دور المستخدم: ${user.role}. لا تكشف بيانات حساسة. استخدم أدوات المنصة فقط.`
        : `You are Transit Logistic assistant. User role: ${user.role}. Never expose secrets. Use platform tools only.`;

    const messages: AiMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({ role: m.role as AiMessage['role'], content: m.content })),
    ];

    const response = await this.provider().chat({ messages, tools: TOOLS, locale });
    let finalContent = response.content;
    const cards: unknown[] = [];

    if (response.toolCalls?.length) {
      for (const call of response.toolCalls) {
        const result = await this.tools.execute(user, call.name, call.arguments);
        cards.push({ tool: call.name, result });
        if (call.name === 'searchMarketplaceTrucks' && result && typeof result === 'object' && 'items' in result) {
          finalContent +=
            locale === 'ar'
              ? `\n\nوجدت ${(result as { items: unknown[] }).items.length} شاحنة.`
              : `\n\nFound ${(result as { items: unknown[] }).items.length} trucks.`;
        }
      }
    }

    const assistant = await this.prisma.aiChatMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: finalContent,
        metadata: { cards } as never,
      },
    });

    await this.prisma.aiChatSession.update({
      where: { id: session.id },
      data: { updatedAt: new Date() },
    });

    return { sessionId: session.id, message: assistant, cards };
  }
}
