import { AiCatalogService } from './ai-catalog.service';

describe('AiCatalogService', () => {
  let service: AiCatalogService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      client: {
        aiProvider: { findMany: jest.fn() },
        aiModel: { findMany: jest.fn() },
        tenantAiCredential: { findMany: jest.fn() },
      },
    };
    service = new AiCatalogService(prisma);
  });

  it('marks a provider as connected only when this tenant has its own credential for it', async () => {
    prisma.client.aiProvider.findMany.mockResolvedValue([
      { id: 'p-openai', type: 'OPENAI', label: 'OpenAI' },
      { id: 'p-anthropic', type: 'ANTHROPIC', label: 'Anthropic' },
    ]);
    prisma.client.tenantAiCredential.findMany.mockResolvedValue([{ providerId: 'p-openai' }]);

    const result = await service.listProviders('t1');

    expect(prisma.client.tenantAiCredential.findMany).toHaveBeenCalledWith({
      where: { tenantId: 't1' },
      select: { providerId: true },
    });
    expect(result).toEqual([
      { id: 'p-openai', type: 'OPENAI', label: 'OpenAI', connected: true },
      { id: 'p-anthropic', type: 'ANTHROPIC', label: 'Anthropic', connected: false },
    ]);
  });

  it('filters out models belonging to a provider this tenant has not configured', async () => {
    prisma.client.aiModel.findMany.mockResolvedValue([
      { name: 'gpt-4o-mini', providerId: 'p-openai', provider: { type: 'OPENAI' } },
      { name: 'claude-sonnet-4-5', providerId: 'p-anthropic', provider: { type: 'ANTHROPIC' } },
    ]);
    prisma.client.tenantAiCredential.findMany.mockResolvedValue([{ providerId: 'p-openai' }]);

    const result = await service.listModels('t1');

    expect(result).toEqual([{ name: 'gpt-4o-mini', providerId: 'p-openai', provider: { type: 'OPENAI' } }]);
    expect(prisma.client.aiModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'ACTIVE' } }),
    );
  });

  it('scopes the credential lookup to the given tenant, never a different one', async () => {
    prisma.client.aiProvider.findMany.mockResolvedValue([]);
    prisma.client.tenantAiCredential.findMany.mockResolvedValue([]);

    await service.listProviders('tenant-a');

    expect(prisma.client.tenantAiCredential.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a' },
      select: { providerId: true },
    });
  });
});
