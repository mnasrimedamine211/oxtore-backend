import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateBoutiqueDto } from './dto/create-boutique.dto';
import { UpdateBoutiqueDto } from './dto/update-boutique.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class BoutiquesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateBoutiqueDto) {
    const boutique = await this.prisma.boutique.create({
      data: {
        name: dto.name,
        logo: dto.logo,
        address: dto.address,
        phone: dto.phone,
        description: dto.description || '',
        managerId: userId,
        status: 'pending',
        language: dto.language || 'en',
        currency: dto.currency || 'USD',
        categories: dto.categories || [],
      },
    });

    await this.prisma.boutiqueOwner.create({
      data: { boutiqueId: boutique.id, userId },
    });

    return this.getFormattedBoutique(boutique.id);
  }

  async findAll(userId: string, query: PaginationDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      OR: [
        { managerId: userId },
        { owners: { some: { userId } } },
      ],
    };

    const [boutiques, total] = await Promise.all([
      this.prisma.boutique.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { products: true, employees: true } },
          owners: { select: { userId: true } },
          manager: { select: { fullName: true } },
        },
      }),
      this.prisma.boutique.count({ where }),
    ]);

    const revenueMap = await this.getRevenueMap(boutiques.map((b) => b.id));

    return {
      data: boutiques.map((b) =>
        this.formatBoutique({ ...b, _revenue: revenueMap.get(b.id) || 0 }),
      ),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async findDiscoverable(
    currentUserId: string,
    excludeUserId: string | undefined,
    query: PaginationDto,
  ) {
    const targetUserId = excludeUserId || currentUserId;
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where = {
      status: 'active' as const,
      deletedAt: null,
      managerId: { not: targetUserId },
      owners: { none: { userId: targetUserId } },
    };

    const [boutiques, total] = await Promise.all([
      this.prisma.boutique.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { products: true, employees: true } },
          owners: { select: { userId: true } },
          manager: { select: { fullName: true } },
        },
      }),
      this.prisma.boutique.count({ where }),
    ]);

    const revenueMap = await this.getRevenueMap(boutiques.map((b) => b.id));

    return {
      data: boutiques.map((b) =>
        this.formatBoutique({ ...b, _revenue: revenueMap.get(b.id) || 0 }),
      ),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async findOne(userId: string, id: string) {
    const boutique = await this.prisma.boutique.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [
          { managerId: userId },
          { owners: { some: { userId } } },
        ],
      },
      include: {
        owners: { include: { user: true } },
        employees: { where: { deletedAt: null } },
        manager: { select: { fullName: true } },
        _count: { select: { products: true, sales: true } },
      },
    });
    if (!boutique) throw new NotFoundException('Boutique not found');

    const revenueAgg = await this.prisma.sale.aggregate({
      where: { boutiqueId: id, deletedAt: null, status: 'completed' },
      _sum: { total: true },
    });

    return this.formatBoutique({
      ...boutique,
      _revenue: Number(revenueAgg._sum.total || 0),
    });
  }

  async update(userId: string, id: string, dto: UpdateBoutiqueDto) {
    await this.checkAccess(userId, id);
    await this.prisma.boutique.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.logo !== undefined && { logo: dto.logo }),
        ...(dto.address && { address: dto.address }),
        ...(dto.phone && { phone: dto.phone }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.language && { language: dto.language }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.categories && { categories: dto.categories }),
      },
    });
    return this.getFormattedBoutique(id);
  }

  async remove(userId: string, id: string) {
    await this.checkAccess(userId, id);
    await this.prisma.boutique.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Boutique deleted successfully' };
  }

  async getStats(userId: string, id: string) {
    await this.checkAccess(userId, id);
    const [sales, products, employees, stockItems] = await Promise.all([
      this.prisma.sale.count({ where: { boutiqueId: id, deletedAt: null } }),
      this.prisma.product.count({ where: { ownerBoutiqueId: id, deletedAt: null } }),
      this.prisma.employee.count({ where: { boutiqueId: id, deletedAt: null } }),
      this.prisma.stockItem.count({ where: { boutiqueId: id, deletedAt: null } }),
    ]);

    const totalRevenue = await this.prisma.sale.aggregate({
      where: { boutiqueId: id, deletedAt: null, status: 'completed' },
      _sum: { total: true },
    });

    return {
      totalSales: sales,
      totalProducts: products,
      totalEmployees: employees,
      totalStockItems: stockItems,
      totalRevenue: totalRevenue._sum.total || 0,
    };
  }

  async addOwner(userId: string, boutiqueId: string, newOwnerEmail: string) {
    await this.checkAccess(userId, boutiqueId);
    const newOwner = await this.prisma.profile.findUnique({
      where: { email: newOwnerEmail },
    });
    if (!newOwner) throw new NotFoundException('User not found');

    await this.prisma.boutiqueOwner.create({
      data: { boutiqueId, userId: newOwner.id },
    });
    return { message: 'Owner added successfully' };
  }

  async removeOwner(userId: string, boutiqueId: string, ownerUserId: string) {
    await this.checkAccess(userId, boutiqueId);
    await this.prisma.boutiqueOwner.delete({
      where: { boutiqueId_userId: { boutiqueId, userId: ownerUserId } },
    });
    return { message: 'Owner removed successfully' };
  }

  private async checkAccess(userId: string, boutiqueId: string) {
    const boutique = await this.prisma.boutique.findFirst({
      where: {
        id: boutiqueId,
        deletedAt: null,
        OR: [
          { managerId: userId },
          { owners: { some: { userId } } },
        ],
      },
    });
    if (!boutique) throw new ForbiddenException('Access denied to this boutique');
    return boutique;
  }

  /**
   * Sum of `total` for a boutique's completed sales, batched across many
   * boutiques in a single groupBy query (avoids N+1 when formatting a list).
   */
  private async getRevenueMap(boutiqueIds: string[]): Promise<Map<string, number>> {
    if (boutiqueIds.length === 0) return new Map();
    const rows = await this.prisma.sale.groupBy({
      by: ['boutiqueId'],
      where: { boutiqueId: { in: boutiqueIds }, deletedAt: null, status: 'completed' },
      _sum: { total: true },
    });
    return new Map(rows.map((r) => [r.boutiqueId, Number(r._sum.total || 0)]));
  }

  /** Refetches a single boutique with all fields needed for formatBoutique. */
  private async getFormattedBoutique(id: string) {
    const boutique = await this.prisma.boutique.findUnique({
      where: { id },
      include: {
        manager: { select: { fullName: true } },
        owners: { select: { userId: true } },
        _count: { select: { products: true, employees: true } },
      },
    });
    if (!boutique) throw new NotFoundException('Boutique not found');

    const revenueAgg = await this.prisma.sale.aggregate({
      where: { boutiqueId: id, deletedAt: null, status: 'completed' },
      _sum: { total: true },
    });

    return this.formatBoutique({
      ...boutique,
      _revenue: Number(revenueAgg._sum.total || 0),
    });
  }

  private formatBoutique(boutique: any) {
    const employeeCount =
      boutique._count?.employees ??
      (Array.isArray(boutique.employees) ? boutique.employees.length : 0);
    const productCount = boutique._count?.products ?? 0;
    const ownerIds = Array.isArray(boutique.owners)
      ? boutique.owners.map((o: any) => o.userId)
      : [];
    const managerName = boutique.manager?.fullName ?? null;
    const revenue = boutique._revenue ?? 0;
    const hasOwnerDetails =
      Array.isArray(boutique.owners) &&
      boutique.owners.length > 0 &&
      boutique.owners[0].user !== undefined;

    return {
      id: boutique.id,
      name: boutique.name,
      logo: boutique.logo,
      address: boutique.address,
      phone: boutique.phone,
      description: boutique.description,
      status: boutique.status,
      language: boutique.language,
      currency: boutique.currency,
      categories: boutique.categories,
      managerId: boutique.managerId,
      managerName,
      createdAt: boutique.createdAt,
      employeeCount,
      productCount,
      revenue,
      ownerIds,
      ...(boutique._count && { counts: boutique._count }),
      ...(hasOwnerDetails && {
        owners: boutique.owners.map((o: any) => ({ id: o.user.id, fullName: o.user.fullName, email: o.user.email })),
      }),
      ...(Array.isArray(boutique.employees) && { employees: boutique.employees }),
    };
  }
}
