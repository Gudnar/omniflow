import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';
import { CreateAiAgentDto, UpdateAiAgentDto } from './dto/ai-agent.dto';

const AGENT_INCLUDE = {
  model: { include: { provider: true } },
  knowledgeDocuments: { include: { document: { select: { id: true, title: true, status: true } } } },
};

@Injectable()
export class AiAgentsService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.client.aiAgent.findMany({ include: AGENT_INCLUDE, orderBy: { createdAt: 'asc' } });
  }

  async findOne(id: string) {
    const agent = await this.prisma.client.aiAgent.findUnique({ where: { id }, include: AGENT_INCLUDE });
    if (!agent) throw new NotFoundError('AiAgent');
    return agent;
  }

  // An inbound message only ever triggers a reply when exactly one ACTIVE
  // agent claims its channel (AiReplyService) — enforced here at write time
  // so a conflicting config surfaces immediately as a validation error
  // instead of silently going unanswered later.
  private async assertNoChannelConflict(channels: string[], status: string, excludeId?: string) {
    if (status !== 'ACTIVE' || !channels.length) return;
    const conflicting = await this.prisma.client.aiAgent.findMany({
      where: {
        status: 'ACTIVE',
        channels: { hasSome: channels },
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
    if (conflicting.length) {
      const shared = conflicting[0].channels.find((c: string) => channels.includes(c));
      throw new ValidationError(
        `Ya existe un agente activo ("${conflicting[0].name}") para el canal ${shared}. Desactívalo primero.`,
      );
    }
  }

  // Full-replace-the-set, same convention as channels/escalationKeywords on
  // the agent itself — the form always sends the complete desired list.
  private async setKnowledgeDocuments(agentId: string, documentIds: string[] | undefined, tx: any = this.prisma.client) {
    if (documentIds === undefined) return;
    await tx.aiAgentKnowledgeDocument.deleteMany({ where: { agentId } });
    if (documentIds.length) {
      await tx.aiAgentKnowledgeDocument.createMany({
        data: documentIds.map((documentId) => ({ agentId, documentId })),
      });
    }
  }

  async create(dto: CreateAiAgentDto) {
    const { knowledgeDocumentIds, ...agentData } = dto;
    await this.assertNoChannelConflict(agentData.channels, agentData.status ?? 'INACTIVE');

    const agent = await this.prisma.client.$transaction(async (tx: any) => {
      const created = await tx.aiAgent.create({ data: agentData });
      await this.setKnowledgeDocuments(created.id, knowledgeDocumentIds, tx);
      return created;
    });
    return this.findOne(agent.id);
  }

  async update(id: string, dto: UpdateAiAgentDto) {
    const existing = await this.findOne(id);
    const { knowledgeDocumentIds, ...agentData } = dto;
    const nextStatus = agentData.status ?? existing.status;
    const nextChannels = agentData.channels ?? existing.channels;
    await this.assertNoChannelConflict(nextChannels, nextStatus, id);

    await this.prisma.client.$transaction(async (tx: any) => {
      await tx.aiAgent.update({ where: { id }, data: agentData });
      await this.setKnowledgeDocuments(id, knowledgeDocumentIds, tx);
    });
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.client.aiAgent.delete({ where: { id } });
    return { success: true };
  }
}
