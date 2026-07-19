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
@WebSocketGateway({ namespace: '/notifications', cors: { origin: true, credentials: true } })
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
}
