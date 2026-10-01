import { AiCatalogService } from './ai-catalog.service';

describe('AiCatalogService', () => {
  let service: AiCatalogService;
  let prisma: any;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    prisma = {
      client: {
        aiProvider: { findMany: jest.fn() },
        aiModel: { findMany: jest.fn() },
      },
    };
    service = new AiCatalogService(prisma);
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
    process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
  });

  it('marks a provider as connected only when its API key env var is set', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    delete process.env.ANTHROPIC_API_KEY;
    prisma.client.aiProvider.findMany.mockResolvedValue([
      { type: 'OPENAI', label: 'OpenAI' },
      { type: 'ANTHROPIC', label: 'Anthropic' },
    ]);

    const result = await service.listProviders();

    expect(result).toEqual([
      { type: 'OPENAI', label: 'OpenAI', connected: true },
      { type: 'ANTHROPIC', label: 'Anthropic', connected: false },
    ]);
  });

  it('filters out models belonging to an unconfigured provider', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    delete process.env.ANTHROPIC_API_KEY;
    prisma.client.aiModel.findMany.mockResolvedValue([
      { name: 'gpt-4o-mini', provider: { type: 'OPENAI' } },
      { name: 'claude-sonnet-4-5', provider: { type: 'ANTHROPIC' } },
    ]);

    const result = await service.listModels();

    expect(result).toEqual([{ name: 'gpt-4o-mini', provider: { type: 'OPENAI' } }]);
    expect(prisma.client.aiModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'ACTIVE' } }),
    );
  });
});
