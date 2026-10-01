import { RealtimeGateway } from './realtime.gateway';

function fakeSocket(overrides: Partial<any> = {}): any {
  return {
    data: {},
    handshake: { auth: {} },
    join: jest.fn(),
    leave: jest.fn(),
    disconnect: jest.fn(),
    ...overrides,
  };
}

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let jwtService: any;
  let prisma: any;

  beforeEach(() => {
    jwtService = { verify: jest.fn() };
    prisma = { raw: { conversation: { findUnique: jest.fn() } } };
    gateway = new RealtimeGateway(jwtService, prisma);
    gateway.server = { to: jest.fn().mockReturnValue({ emit: jest.fn() }) } as any;
  });

  describe('handleConnection', () => {
    it('disconnects a client with neither a JWT nor a webchatToken', async () => {
      const client = fakeSocket();
      await gateway.handleConnection(client as any);
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('disconnects a client with an invalid JWT', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid');
      });
      const client = fakeSocket({ handshake: { auth: { token: 'bad' } } });
      await gateway.handleConnection(client as any);
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('accepts a valid JWT, stores the resolved tenantId, and auto-joins the tenant-wide room', async () => {
      jwtService.verify.mockReturnValue({ tenantId: 't1', sub: 'user1' });
      const client = fakeSocket({ handshake: { auth: { token: 'good' } } });
      await gateway.handleConnection(client as any);
      expect(client.data.tenantId).toBe('t1');
      expect(client.join).toHaveBeenCalledWith('tenant:t1');
    });

    it('disconnects a webchatToken that matches no conversation', async () => {
      prisma.raw.conversation.findUnique.mockResolvedValue(null);
      const client = fakeSocket({ handshake: { auth: { webchatToken: 'bad' } } });
      await gateway.handleConnection(client as any);
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('auto-joins a visitor to its own conversation room on a valid webchatToken', async () => {
      prisma.raw.conversation.findUnique.mockResolvedValue({ id: 'conv1', tenantId: 't1' });
      const client = fakeSocket({ handshake: { auth: { webchatToken: 'real' } } });
      await gateway.handleConnection(client as any);
      expect(client.data.conversationId).toBe('conv1');
      expect(client.join).toHaveBeenCalledWith('conversation:conv1');
    });
  });

  describe('handleJoinConversation — tenant isolation', () => {
    it('refuses to join a conversation belonging to a different tenant', async () => {
      prisma.raw.conversation.findUnique.mockResolvedValue({ tenantId: 'tenant-B' });
      const client = fakeSocket({ data: { tenantId: 'tenant-A' } });

      await gateway.handleJoinConversation(client as any, { conversationId: 'conv-of-tenant-B' });

      expect(client.join).not.toHaveBeenCalled();
    });

    it('joins the room when the conversation belongs to the staff client\'s own tenant', async () => {
      prisma.raw.conversation.findUnique.mockResolvedValue({ tenantId: 'tenant-A' });
      const client = fakeSocket({ data: { tenantId: 'tenant-A' } });

      await gateway.handleJoinConversation(client as any, { conversationId: 'conv1' });

      expect(client.join).toHaveBeenCalledWith('conversation:conv1');
    });

    it('ignores the request from an already-scoped webchat client (it never needs to join another room)', async () => {
      const client = fakeSocket({ data: { tenantId: 't1', conversationId: 'own-conv' } });
      await gateway.handleJoinConversation(client as any, { conversationId: 'someone-elses-conv' });
      expect(prisma.raw.conversation.findUnique).not.toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe('handleMessageCreated', () => {
    it('emits message:new to both the conversation room and the tenant-wide room', () => {
      const emitFn = jest.fn();
      const toSpy = jest.fn().mockReturnValue({ emit: emitFn });
      gateway.server = { to: toSpy } as any;

      gateway.handleMessageCreated({ conversationId: 'conv1', tenantId: 't1' });

      expect(toSpy).toHaveBeenCalledWith('conversation:conv1');
      expect(toSpy).toHaveBeenCalledWith('tenant:t1');
      expect(emitFn).toHaveBeenCalledTimes(2);
      expect(emitFn).toHaveBeenCalledWith('message:new', { conversationId: 'conv1' });
    });
  });
});
