import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class BoutiqueNotifyService {
  constructor(private prisma: PrismaService) {}

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

    for (const uid of userIds) {
      await this.prisma.notification.create({
        data: { userId: uid, type, title, message, data: { boutiqueId, ...data } },
      });
    }
  }
}
