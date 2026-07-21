import { Injectable, Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Notification } from '@prisma/client';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: true, credentials: true },
  // Mobile clients flip between WiFi/cellular and get backgrounded constantly — the
  // socket.io defaults (pingTimeout 20s) are tuned for stable desktop/browser links and
  // read as "notifications don't work" when a phone's radio briefly drops. Give the
  // connection more slack before declaring it dead, and let short drops (e.g. a tunnel
  // handoff) resume transparently instead of forcing a full reconnect + re-auth.
  pingTimeout: 60000,
  pingInterval: 25000,
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() private server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token =
      (client.handshake.auth?.['token'] as string | undefined) ||
      (client.handshake.query?.['token'] as string | undefined);

    if (!token) {
      client.emit('auth_error', { message: 'Missing authentication token' });
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });
      client.data.userId = payload.sub;
      await client.join(`user:${payload.sub}`);
    } catch {
      // Emitted before disconnect so the client can tell "your token expired, refresh
      // and reconnect with a new one" apart from a plain network drop — without this,
      // a stale access token silently reused on reconnect kills notifications for good.
      client.emit('auth_error', { message: 'Invalid or expired token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(): void {
    // socket.io removes the client from all rooms automatically on disconnect
  }

  /** Emits a freshly-created notification to every connected socket for that user, if any. */
  emitToUser(userId: string, notification: Notification): void {
    if (!this.server) return;
    try {
      this.server.to(`user:${userId}`).emit('notification:new', this.notificationsService.mapNotification(notification));
    } catch (err) {
      this.logger.warn(`Failed to emit notification to user ${userId}: ${(err as Error).message}`);
    }
  }

  /** Emits an arbitrary named event to every connected socket for that user (state-sync, not a notification). */
  emitEventToUser(userId: string, event: string, payload: unknown): void {
    if (!this.server) return;
    try {
      this.server.to(`user:${userId}`).emit(event, payload);
    } catch (err) {
      this.logger.warn(`Failed to emit ${event} to user ${userId}: ${(err as Error).message}`);
    }
  }
}
