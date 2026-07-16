import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
    });
    if (!profile) throw new NotFoundException('User not found');
    return this.formatProfile(profile);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const profile = await this.prisma.profile.update({
      where: { id: userId },
      data: {
        ...(dto.fullName && { fullName: dto.fullName }),
        ...(dto.phone && { phone: dto.phone }),
        ...(dto.avatar && { avatar: dto.avatar }),
      },
    });
    return this.formatProfile(profile);
  }

  async getSettings(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
    });
    if (!profile) throw new NotFoundException('User not found');

    const settings = (profile.metadata as any)?.settings || {};
    return {
      language: settings.language || 'en',
      currency: settings.currency || 'USD',
      emailNotifications: settings.emailNotifications ?? true,
      pushNotifications: settings.pushNotifications ?? true,
    };
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
    });
    if (!profile) throw new NotFoundException('User not found');

    const metadata = profile.metadata as any || {};
    const updatedMetadata = {
      ...metadata,
      settings: {
        ...(metadata.settings || {}),
        ...(dto.language && { language: dto.language }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.emailNotifications !== undefined && { emailNotifications: dto.emailNotifications }),
        ...(dto.pushNotifications !== undefined && { pushNotifications: dto.pushNotifications }),
      },
    };

    const updated = await this.prisma.profile.update({
      where: { id: userId },
      data: { metadata: updatedMetadata },
    });
    return {
      language: updatedMetadata.settings?.language || 'en',
      currency: updatedMetadata.settings?.currency || 'USD',
      emailNotifications: updatedMetadata.settings?.emailNotifications ?? true,
      pushNotifications: updatedMetadata.settings?.pushNotifications ?? true,
    };
  }

  // NOTE: the frontend contract wants buyer-facing stats here
  // ({ ordersCount, wishlistCount, rating }), but this schema has no
  // wishlist/rating concept — returning the current seller-facing stats
  // as-is; reshaping this needs a product decision, not just a shape fix.
  async getStats(userId: string) {
    const [salesCount, productsCount, boutiquesCount] = await Promise.all([
      this.prisma.sale.count({
        where: { soldBy: userId, deletedAt: null },
      }),
      this.prisma.product.count({
        where: { ownerBoutique: { managerId: userId }, deletedAt: null },
      }),
      this.prisma.boutiqueOwner.count({
        where: { userId },
      }),
    ]);

    return {
      totalSales: salesCount,
      totalProducts: productsCount,
      totalBoutiques: boutiquesCount,
    };
  }

  async setActiveBoutique(userId: string, boutiqueId: string) {
    const ownership = await this.prisma.boutiqueOwner.findUnique({
      where: { boutiqueId_userId: { boutiqueId, userId } },
    });
    const boutique = await this.prisma.boutique.findUnique({
      where: { id: boutiqueId },
    });
    if (!ownership && boutique?.managerId !== userId) {
      throw new NotFoundException('Boutique not found or access denied');
    }

    const updated = await this.prisma.profile.update({
      where: { id: userId },
      data: { activeBoutiqueId: boutiqueId },
    });
    return this.formatProfile(updated);
  }

  private async formatProfile(profile: any) {
    const ownedBoutiques = await this.prisma.boutiqueOwner.findMany({
      where: { userId: profile.id },
      select: { boutiqueId: true },
    });

    return {
      id: profile.id,
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      avatar: profile.avatar,
      role: profile.role,
      ownedBoutiqueIds: ownedBoutiques.map((o) => o.boutiqueId),
      activeBoutiqueId: profile.activeBoutiqueId,
      permissions: profile.permissions,
      isVerified: profile.isVerified,
      createdAt: profile.createdAt,
    };
  }
}
