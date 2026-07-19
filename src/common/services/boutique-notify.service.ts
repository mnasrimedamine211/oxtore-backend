import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsGateway } from '../gateways/notifications.gateway';

@Injectable()
export class BoutiqueNotifyService {
  constructor(
    private prisma: PrismaService,
    private notificationsGateway: NotificationsGateway,
  ) {}

  /** Notifies a boutique's manager + all owners with the same message. */
  async notifyManagers(
    boutiqueId: string,
    type: NotificationType,
    title: string,
    message: string,
    data: Record<string, unknown> = {},
  ): Promise<void> {
    const boutique = await this.prisma.boutique.findUnique({
      where: { id: boutiqueId },
      include: { owners: true },
    });
    if (!boutique) return;

    const userIds = new Set<string>();
    if (boutique.managerId) userIds.add(boutique.managerId);
    boutique.owners.forEach((o) => userIds.add(o.userId));

    await this.notifyUsers([...userIds], type, title, message, { boutiqueId, ...data });
  }

  /** Notifies every admin (e.g. a boutique was just submitted and needs approval). */
  async notifyAdmins(
    boutiqueId: string,
    type: NotificationType,
    title: string,
    message: string,
    data: Record<string, unknown> = {},
  ): Promise<void> {
    const admins = await this.prisma.profile.findMany({
      where: { role: 'ADMIN', deletedAt: null },
      select: { id: true },
    });
    await this.notifyUsers(admins.map((a) => a.id), type, title, message, { boutiqueId, ...data });
  }

  private async notifyUsers(
    userIds: string[],
    type: NotificationType,
    title: string,
    message: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    for (const uid of userIds) {
      const notification = await this.prisma.notification.create({
        data: { userId: uid, type, title, message, data: data as Prisma.InputJsonValue },
      });
      this.notificationsGateway.emitToUser(uid, notification);
    }
  }
}
