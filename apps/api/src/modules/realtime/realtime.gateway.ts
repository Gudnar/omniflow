import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '@omniflow/types';
import { PrismaService } from '../prisma/prisma.service';

function conversationRoom(conversationId: string): string {
  return `conversation:${conversationId}`;
}

function tenantRoom(tenantId: string): string {
  return `tenant:${tenantId}`;
}

/**
 * Socket.IO is used ONLY to notify "a new message landed in this
 * conversation" (a bare {conversationId} ping) — clients react by re-running
 * the exact same, already-tested REST fetch (GET /conversations/:id/messages
 * or the public webchat equivalent). This avoids duplicating any
 * serialization or tenant-scoping logic over the socket layer; sending a
 * message stays 100% REST.
 *
 * Two trust levels connect here, distinguished by which auth field the
 * client sends at handshake:
 *  - `token` — a staff member's JWT (same secret as the HTTP API, verified
 *    manually since Passport's AuthGuard('jwt') is built around Express's
 *    Request object, not a socket handshake).
 *  - `webchatToken` — an anonymous Página de Enlaces visitor's chat session,
 *    scoped to exactly the one Conversation it was issued for.
 * Every room join is checked against the resolved tenantId (or, for a
 * webchat token, against its own single conversationId) — never trusts a
 * conversationId the client merely claims.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    const { token, webchatToken } = client.handshake.auth as { token?: string; webchatToken?: string };

    if (token) {
      try {
        const payload = this.jwtService.verify<JwtPayload>(token);
        client.data.tenantId = payload.tenantId;
        client.data.userId = payload.sub;
        // Every staff member auto-joins their tenant's room — this is what
        // lets the conversations LIST page (which doesn't have any one
        // conversation "open") learn that a new/updated conversation exists
        // at all, as opposed to conversation:<id> which only reaches
        // whoever has that specific thread open.
        client.join(tenantRoom(payload.tenantId));
      } catch {
        client.disconnect(true);
      }
      return;
    }

    if (webchatToken) {
      const conversation = await this.prisma.raw.conversation.findUnique({ where: { webchatToken } });
      if (!conversation) {
        client.disconnect(true);
        return;
      }
      client.data.tenantId = conversation.tenantId;
      client.data.conversationId = conversation.id;
      client.join(conversationRoom(conversation.id));
      return;
    }

    client.disconnect(true);
  }

  // Only a staff (JWT) client ever sends this — a webchat client already
  // auto-joined its one conversation in handleConnection and has no reason
  // to ask for another one (client.data.conversationId being unset is what
  // distinguishes "staff, no fixed room yet" from "webchat, already scoped").
  @SubscribeMessage('join:conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.data.tenantId || client.data.conversationId || !data?.conversationId) return;

    const conversation = await this.prisma.raw.conversation.findUnique({
      where: { id: data.conversationId },
      select: { tenantId: true },
    });
    if (!conversation || conversation.tenantId !== client.data.tenantId) return;

    client.join(conversationRoom(data.conversationId));
  }

  @SubscribeMessage('leave:conversation')
  handleLeaveConversation(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    if (!data?.conversationId || client.data.conversationId === data.conversationId) return;
    client.leave(conversationRoom(data.conversationId));
  }

  @OnEvent('message.created')
  handleMessageCreated(payload: { conversationId: string; tenantId: string }) {
    const message = { conversationId: payload.conversationId };
    this.server.to(conversationRoom(payload.conversationId)).emit('message:new', message);
    this.server.to(tenantRoom(payload.tenantId)).emit('message:new', message);
  }
}
