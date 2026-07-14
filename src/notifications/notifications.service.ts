import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { Notification, NotificationType } from '@prisma/client';

export type ContractNotificationType =
  | 'sale'
  | 'commission'
  | 'stock'
  | 'hr'
  | 'system'
  | 'network'
  | 'stock_request';

export interface NotificationResponse {
  id: string;
  userId: string;
  type: ContractNotificationType;
  title: string;
  body: string | null;
  icon: string;
  read: boolean;
  meta: unknown;
  createdAt: Date;
}

const TYPE_MAP: Record<NotificationType, ContractNotificationType> = {
  sale: 'sale',
  stock_request: 'stock_request',
  boutique_request: 'network',
  system: 'system',
  order: 'system',
  wallet: 'system',
  feed: 'system',
  employee: 'hr',
};

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  mapNotification(notification: Notification): NotificationResponse {
    return {
      id: notification.id,
      userId: notification.userId,
      type: TYPE_MAP[notification.type],
      title: notification.title,
      body: notification.message,
      icon: notification.icon,
      read: notification.isRead,
      meta: notification.data,
      createdAt: notification.createdAt,
    };
  }

  async findAll(userId: string, query: PaginationDto & { isRead?: boolean }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (query.isRead !== undefined) where.isRead = query.isRead;
    if ((query as any).type) where.type = (query as any).type;

    const [notifications, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      data: notifications.map((n) => this.mapNotification(n)),
      meta: {
        unread,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async markAsRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) throw new NotFoundException('Notification not found');

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    return this.mapNotification(updated);
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return notifications.map((n) => this.mapNotification(n));
  }

  async remove(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) throw new NotFoundException('Notification not found');

    await this.prisma.notification.delete({ where: { id } });
    return { message: 'Notification deleted' };
  }
}
