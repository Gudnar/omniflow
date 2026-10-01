import { AiTranscriptionService } from './ai-transcription.service';

describe('AiTranscriptionService', () => {
  let service: AiTranscriptionService;
  let prisma: any;
  let tenantContext: any;
  let transcriptionAdapter: any;
  let aiReplyService: any;
  const originalFetch = global.fetch;

  beforeEach(() => {
    prisma = {
      client: {
        message: { findUnique: jest.fn(), update: jest.fn() },
      },
    };
    tenantContext = { setContext: jest.fn() };
    transcriptionAdapter = { transcribe: jest.fn() };
    aiReplyService = { generateReply: jest.fn() };
    service = new AiTranscriptionService(prisma, tenantContext, transcriptionAdapter, aiReplyService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sets tenant context before doing anything else', async () => {
    prisma.client.message.findUnique.mockResolvedValue(null);
    await service.transcribeAndReply('t1', 'msg1');
    expect(tenantContext.setContext).toHaveBeenCalledWith({ tenantId: 't1' });
  });

  it('no-ops when the message does not exist', async () => {
    prisma.client.message.findUnique.mockResolvedValue(null);
    await service.transcribeAndReply('t1', 'msg1');
    expect(transcriptionAdapter.transcribe).not.toHaveBeenCalled();
  });

  it('no-ops when the message is not of type AUDIO', async () => {
    prisma.client.message.findUnique.mockResolvedValue({ id: 'msg1', type: 'TEXT', attachments: [] });
    await service.transcribeAndReply('t1', 'msg1');
    expect(transcriptionAdapter.transcribe).not.toHaveBeenCalled();
  });

  it('no-ops when the AUDIO message has no attachment', async () => {
    prisma.client.message.findUnique.mockResolvedValue({ id: 'msg1', type: 'AUDIO', attachments: [] });
    await service.transcribeAndReply('t1', 'msg1');
    expect(transcriptionAdapter.transcribe).not.toHaveBeenCalled();
  });

  it('no-ops without transcribing when the stored audio cannot be downloaded', async () => {
    prisma.client.message.findUnique.mockResolvedValue({
      id: 'msg1',
      type: 'AUDIO',
      attachments: [{ url: 'http://x/audio.ogg', fileName: 'audio.ogg', mimeType: 'audio/ogg' }],
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as any;

    await service.transcribeAndReply('t1', 'msg1');

    expect(transcriptionAdapter.transcribe).not.toHaveBeenCalled();
    expect(aiReplyService.generateReply).not.toHaveBeenCalled();
  });

  it('transcribes the downloaded audio, updates the message content, then hands off to AiReplyService', async () => {
    prisma.client.message.findUnique.mockResolvedValue({
      id: 'msg1',
      type: 'AUDIO',
      conversationId: 'conv1',
      attachments: [{ url: 'http://x/audio.ogg', fileName: 'audio.ogg', mimeType: 'audio/ogg' }],
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(Buffer.from('fake-audio-bytes')),
    }) as any;
    transcriptionAdapter.transcribe.mockResolvedValue('¿Tienen delivery?');

    await service.transcribeAndReply('t1', 'msg1');

    expect(transcriptionAdapter.transcribe).toHaveBeenCalledWith(Buffer.from('fake-audio-bytes'), 'audio.ogg', 'audio/ogg');
    expect(prisma.client.message.update).toHaveBeenCalledWith({
      where: { id: 'msg1' },
      data: { content: '¿Tienen delivery?' },
    });
    expect(aiReplyService.generateReply).toHaveBeenCalledWith('t1', 'conv1', 'msg1');
  });

  it('falls back to a placeholder when the transcript is blank', async () => {
    prisma.client.message.findUnique.mockResolvedValue({
      id: 'msg1',
      type: 'AUDIO',
      conversationId: 'conv1',
      attachments: [{ url: 'http://x/audio.ogg', fileName: 'audio.ogg', mimeType: 'audio/ogg' }],
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(Buffer.from('x')) }) as any;
    transcriptionAdapter.transcribe.mockResolvedValue('   ');

    await service.transcribeAndReply('t1', 'msg1');

    expect(prisma.client.message.update).toHaveBeenCalledWith({
      where: { id: 'msg1' },
      data: { content: '[Audio sin contenido reconocible]' },
    });
  });
});
