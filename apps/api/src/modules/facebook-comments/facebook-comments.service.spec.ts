import { FacebookCommentsService } from './facebook-comments.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';

describe('FacebookCommentsService', () => {
  let service: FacebookCommentsService;
  let prisma: any;
  let tenantContext: any;
  let queueService: any;
  const originalFetch = global.fetch;

  beforeEach(() => {
    prisma = {
      raw: {
        metaConnection: { findUnique: jest.fn() },
        comment: { findUnique: jest.fn() },
      },
      client: {
        post: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
        comment: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
      },
    };
    tenantContext = { setContext: jest.fn() };
    queueService = { enqueueFacebookCommentReply: jest.fn() };
    service = new FacebookCommentsService(prisma, tenantContext, queueService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('list', () => {
    it('lists posts newest-first with their comments oldest-first', async () => {
      prisma.client.post.findMany.mockResolvedValue([]);
      await service.list();
      expect(prisma.client.post.findMany).toHaveBeenCalledWith({
        include: { comments: { orderBy: { createdAt: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('reply', () => {
    it('throws NotFoundError when the target comment does not exist', async () => {
      prisma.client.comment.findUnique.mockResolvedValue(null);
      await expect(service.reply('missing', { message: 'Hola' })).rejects.toThrow(NotFoundError);
    });

    it('throws ValidationError when the target comment has no externalId yet', async () => {
      prisma.client.comment.findUnique.mockResolvedValue({ id: 'c1', externalId: null, postId: 'p1' });
      await expect(service.reply('c1', { message: 'Hola' })).rejects.toThrow(ValidationError);
    });

    it('creates an OUTBOUND comment and enqueues the send job with the parent comment_id', async () => {
      prisma.client.comment.findUnique.mockResolvedValue({
        id: 'c1',
        tenantId: 'tenant-1',
        externalId: 'meta-comment-1',
        postId: 'p1',
      });
      prisma.client.comment.create.mockResolvedValue({ id: 'reply1', direction: 'OUTBOUND', message: 'Gracias!' });

      const result = await service.reply('c1', { message: 'Gracias!' });

      expect(prisma.client.comment.create).toHaveBeenCalledWith({
        data: { postId: 'p1', parentId: 'c1', direction: 'OUTBOUND', message: 'Gracias!' },
      });
      expect(queueService.enqueueFacebookCommentReply).toHaveBeenCalledWith('tenant-1', 'reply1', 'meta-comment-1');
      expect(result).toEqual({ id: 'reply1', direction: 'OUTBOUND', message: 'Gracias!' });
    });
  });

  describe('handleFeedChange', () => {
    it('no-ops when pageId is missing', async () => {
      await service.handleFeedChange(undefined, { item: 'comment', verb: 'add', comment_id: 'x' });
      expect(prisma.raw.metaConnection.findUnique).not.toHaveBeenCalled();
    });

    it('ignores non-comment feed items', async () => {
      await service.handleFeedChange('page-1', { item: 'like', verb: 'add' });
      expect(prisma.raw.metaConnection.findUnique).not.toHaveBeenCalled();
    });

    it('ignores comment edits/removals (only verb "add" is handled)', async () => {
      await service.handleFeedChange('page-1', { item: 'comment', verb: 'remove', comment_id: 'x' });
      expect(prisma.raw.metaConnection.findUnique).not.toHaveBeenCalled();
    });

    it('no-ops when there is no connection for the page id', async () => {
      prisma.raw.metaConnection.findUnique.mockResolvedValue(null);
      await service.handleFeedChange('page-1', { item: 'comment', verb: 'add', comment_id: 'x' });
      expect(tenantContext.setContext).not.toHaveBeenCalled();
    });

    it('ignores the echo of our own reply (from.id === pageId)', async () => {
      prisma.raw.metaConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1', accessToken: 'token' });
      await service.handleFeedChange('page-1', {
        item: 'comment',
        verb: 'add',
        comment_id: 'x',
        from: { id: 'page-1', name: 'My Page' },
      });
      expect(prisma.raw.comment.findUnique).not.toHaveBeenCalled();
    });

    it('skips a comment_id already ingested (idempotency)', async () => {
      prisma.raw.metaConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1', accessToken: 'token' });
      prisma.raw.comment.findUnique.mockResolvedValue({ id: 'existing' });

      await service.handleFeedChange('page-1', {
        item: 'comment',
        verb: 'add',
        comment_id: 'meta-comment-1',
        from: { id: 'user-1', name: 'Ana' },
      });

      expect(prisma.client.post.findFirst).not.toHaveBeenCalled();
    });

    it('creates the Post (fetching its details) and a top-level INBOUND Comment for a new comment', async () => {
      prisma.raw.metaConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1', accessToken: 'page-token' });
      prisma.raw.comment.findUnique.mockResolvedValue(null);
      prisma.client.post.findFirst.mockResolvedValue(null);
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'Nuevo producto disponible', permalink_url: 'https://facebook.com/post/1' }),
      }) as any;
      prisma.client.post.create.mockResolvedValue({ id: 'post-db-1', externalId: 'post-1' });

      await service.handleFeedChange('page-1', {
        item: 'comment',
        verb: 'add',
        comment_id: 'meta-comment-1',
        post_id: 'post-1',
        parent_id: 'post-1', // top-level comment: parent_id === post_id
        message: '¿Tienen delivery?',
        from: { id: 'user-1', name: 'Ana' },
      });

      expect(tenantContext.setContext).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v19.0/post-1?fields=message,permalink_url',
        { headers: { Authorization: 'Bearer page-token' } },
      );
      expect(prisma.client.post.create).toHaveBeenCalledWith({
        data: { externalId: 'post-1', message: 'Nuevo producto disponible', permalink: 'https://facebook.com/post/1' },
      });
      expect(prisma.client.comment.create).toHaveBeenCalledWith({
        data: {
          postId: 'post-db-1',
          externalId: 'meta-comment-1',
          parentId: undefined,
          direction: 'INBOUND',
          authorExternalId: 'user-1',
          authorName: 'Ana',
          message: '¿Tienen delivery?',
        },
      });
    });

    it('links a nested reply to its parent Comment row when parent_id differs from post_id', async () => {
      prisma.raw.metaConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1', accessToken: 'page-token' });
      prisma.raw.comment.findUnique.mockResolvedValue(null);
      prisma.client.post.findFirst.mockResolvedValue({ id: 'post-db-1', externalId: 'post-1' });
      prisma.client.comment.findFirst.mockResolvedValue({ id: 'parent-db-1', externalId: 'meta-comment-1' });
      global.fetch = jest.fn();

      await service.handleFeedChange('page-1', {
        item: 'comment',
        verb: 'add',
        comment_id: 'meta-comment-2',
        post_id: 'post-1',
        parent_id: 'meta-comment-1',
        message: 'Gracias por responder',
        from: { id: 'user-2', name: 'Luis' },
      });

      expect(global.fetch).not.toHaveBeenCalled();
      expect(prisma.client.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ parentId: 'parent-db-1' }) }),
      );
    });
  });
});
