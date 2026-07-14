import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateSaleDto) {
    await this.checkBoutiqueAccess(userId, dto.boutiqueId);

    // Validate stock availability before transaction
    for (const item of dto.items) {
      const stockItem = await this.prisma.stockItem.findFirst({
        where: { productId: item.productId, boutiqueId: dto.boutiqueId, deletedAt: null },
      });
      if (!stockItem || stockItem.quantity < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for product ${item.productId}`,
        );
      }
    }

    // Calculate totals
    const subtotal = dto.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    const discount = dto.discount || 0;
    const tax = dto.tax || 0;
    const total = subtotal - discount + tax;

    // Execute everything in a single transaction
    const sale = await this.prisma.$transaction(async (tx) => {
      // 1. Create the sale
      const createdSale = await tx.sale.create({
        data: {
          boutiqueId: dto.boutiqueId,
          employeeId: dto.employeeId || null,
          soldBy: userId,
          items: dto.items as any,
          subtotal,
          discount,
          tax,
          total,
          paymentMethod: dto.paymentMethod || 'cash',
          status: 'completed',
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          note: dto.note,
        },
      });

      // 2. Decrease stock and 3. Create inventory movements
      for (const item of dto.items) {
        const stockItem = await tx.stockItem.findFirst({
          where: { productId: item.productId, boutiqueId: dto.boutiqueId, deletedAt: null },
        });
        if (!stockItem) throw new BadRequestException('Stock item not found');

        await tx.stockItem.update({
          where: { id: stockItem.id },
          data: { quantity: { decrement: item.quantity } },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            boutiqueId: dto.boutiqueId,
            type: 'out',
            reason: 'sale',
            quantity: item.quantity,
            referenceId: createdSale.id,
            referenceType: 'sale',
            createdBy: userId,
          },
        });
      }

      // 4. Create notification for the boutique manager
      const boutique = await tx.boutique.findUnique({
        where: { id: dto.boutiqueId },
      });
      if (boutique?.managerId) {
        await tx.notification.create({
          data: {
            userId: boutique.managerId,
            type: 'sale',
            title: 'New Sale',
            message: `A sale of ${total} was completed`,
            data: { saleId: createdSale.id, total },
          },
        });
      }

      return createdSale;
    });

    return this.formatSale(sale);
  }

  async findAll(userId: string, boutiqueId: string, query: PaginationDto) {
    await this.checkBoutiqueAccess(userId, boutiqueId);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { boutiqueId, deletedAt: null };
    if (query.search) {
      where.OR = [
        { customerName: { contains: query.search, mode: 'insensitive' } },
        { customerPhone: { contains: query.search } },
      ];
    }

    const [sales, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { employee: true },
      }),
      this.prisma.sale.count({ where }),
    ]);

    return {
      data: sales.map((s) => this.formatSale(s)),
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
    const sale = await this.prisma.sale.findFirst({
      where: { id, deletedAt: null },
      include: { employee: true, boutique: true },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    await this.checkBoutiqueAccess(userId, sale.boutiqueId);
    return this.formatSale(sale);
  }

  async getStats(userId: string, boutiqueId: string, dateFrom?: string, dateTo?: string) {
    await this.checkBoutiqueAccess(userId, boutiqueId);

    const where: any = { boutiqueId, deletedAt: null, status: 'completed' };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [totalSales, totalRevenue, avgSale] = await Promise.all([
      this.prisma.sale.count({ where }),
      this.prisma.sale.aggregate({ where, _sum: { total: true } }),
      this.prisma.sale.aggregate({ where, _avg: { total: true } }),
    ]);

    return {
      totalSales,
      totalRevenue: totalRevenue._sum.total || 0,
      averageSaleValue: avgSale._avg.total || 0,
    };
  }

  async getCommissions(userId: string, boutiqueId: string, sellerId?: string) {
    await this.checkBoutiqueAccess(userId, boutiqueId);

    const where: any = { boutiqueId, deletedAt: null };
    if (sellerId) where.sellerId = sellerId;

    const sales = await this.prisma.sale.findMany({
      where,
      select: { sellerId: true, commissions: true },
    });

    const totals = new Map<string, number>();
    for (const sale of sales) {
      if (!sale.sellerId) continue;

      const commissions = Array.isArray(sale.commissions) ? (sale.commissions as any[]) : [];
      const saleTotal = commissions.reduce((sum, entry) => sum + (Number(entry?.amount) || 0), 0);

      totals.set(sale.sellerId, (totals.get(sale.sellerId) || 0) + saleTotal);
    }

    return Array.from(totals.entries()).map(([sellerId, total]) => ({ sellerId, total }));
  }

  private async checkBoutiqueAccess(userId: string, boutiqueId: string) {
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
  }

  private formatSale(sale: any) {
    return {
      id: sale.id,
      boutiqueId: sale.boutiqueId,
      employeeId: sale.employeeId,
      soldBy: sale.soldBy,
      items: sale.items,
      subtotal: sale.subtotal,
      discount: sale.discount,
      tax: sale.tax,
      total: sale.total,
      paymentMethod: sale.paymentMethod,
      status: sale.status,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      note: sale.note,
      createdAt: sale.createdAt,
      ...(sale.employee && { employee: { id: sale.employee.id, fullName: sale.employee.fullName } }),
      ...(sale.boutique && { boutique: { id: sale.boutique.id, name: sale.boutique.name } }),
    };
  }
}
