import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiUsageService {
  constructor(private prisma: PrismaService) {}

  async summary() {
    const rows = await this.prisma.client.aiUsage.findMany({
      include: { agent: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const totals = rows.reduce(
      (acc: any, r: any) => {
        acc.totalCalls += 1;
        acc.promptTokens += r.promptTokens;
        acc.completionTokens += r.completionTokens;
        acc.totalTokens += r.totalTokens;
        return acc;
      },
      { totalCalls: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    );

    return { totals, recent: rows.slice(0, 20) };
  }
}
