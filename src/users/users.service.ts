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
      include: {
        activeBoutique: true,
        ownedBoutiques: { include: { boutique: true } },
        wallet: true,
      },
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

  async getStats(userId: string) {
    const [salesCount, productsCount, boutiquesCount, wallet] = await Promise.all([
      this.prisma.sale.count({
        where: { soldBy: userId, deletedAt: null },
      }),
      this.prisma.product.count({
        where: { ownerBoutique: { managerId: userId }, deletedAt: null },
      }),
      this.prisma.boutiqueOwner.count({
        where: { userId },
      }),
      this.prisma.wallet.findUnique({ where: { userId } }),
    ]);

    return {
      totalSales: salesCount,
      totalProducts: productsCount,
      totalBoutiques: boutiquesCount,
      walletBalance: wallet ? wallet.balance : 0,
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

  private formatProfile(profile: any) {
    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      phone: profile.phone,
      avatar: profile.avatar,
      role: profile.role,
      isVerified: profile.isVerified,
      activeBoutique: profile.activeBoutique
        ? {
            id: profile.activeBoutique.id,
            name: profile.activeBoutique.name,
            currency: profile.activeBoutique.currency,
          }
        : null,
      wallet: profile.wallet
        ? { balance: profile.wallet.balance, currency: profile.wallet.currency }
        : null,
      createdAt: profile.createdAt,
    };
  }
}
