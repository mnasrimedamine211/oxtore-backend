import { Injectable, ForbiddenException } from '@nestjs/common';
import { Boutique } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class BoutiqueAccessService {
  constructor(private prisma: PrismaService) {}

  /** Throws ForbiddenException unless userId manages or owns boutiqueId. */
  async assertAccess(userId: string, boutiqueId: string): Promise<Boutique> {
    const boutique = await this.prisma.boutique.findFirst({
      where: {
        id: boutiqueId,
        deletedAt: null,
        OR: [{ managerId: userId }, { owners: { some: { userId } } }],
      },
    });
    if (!boutique) throw new ForbiddenException('Access denied to this boutique');
    return boutique;
  }
}
