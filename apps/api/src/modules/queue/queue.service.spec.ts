import { QueueService } from './queue.service';

const addMock = jest.fn();
const closeMock = jest.fn();
const quitMock = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: addMock,
    close: closeMock,
  })),
}));

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    quit: quitMock,
  }));
});

describe('QueueService', () => {
  let service: QueueService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new QueueService();
  });

  it('enqueues a job with { messageId, channel } and the standard retry options', async () => {
    await service.enqueueChannelOutboundMessage('WHATSAPP' as any, 'msg1');

    expect(addMock).toHaveBeenCalledWith(
      'send-message',
      { messageId: 'msg1', channel: 'WHATSAPP' },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );
  });

  it('enqueues an AI reply job with { tenantId, conversationId, messageId } and its own retry options', async () => {
    await service.enqueueAiReply('t1', 'conv1', 'msg1');

    expect(addMock).toHaveBeenCalledWith(
      'reply',
      { tenantId: 't1', conversationId: 'conv1', messageId: 'msg1' },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );
  });

  it('enqueues a transcription job with { tenantId, messageId } and its own retry options', async () => {
    await service.enqueueTranscription('t1', 'msg1');

    expect(addMock).toHaveBeenCalledWith(
      'transcribe',
      { tenantId: 't1', messageId: 'msg1' },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );
  });

  it('enqueues a Facebook comment reply job with { tenantId, commentId, parentExternalId } and its own retry options', async () => {
    await service.enqueueFacebookCommentReply('t1', 'c1', 'meta-comment-1');

    expect(addMock).toHaveBeenCalledWith(
      'reply',
      { tenantId: 't1', commentId: 'c1', parentExternalId: 'meta-comment-1' },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );
  });

  it('closes the queue and connection on module destroy', async () => {
    await service.onModuleDestroy();
    expect(closeMock).toHaveBeenCalled();
    expect(quitMock).toHaveBeenCalled();
  });
});
