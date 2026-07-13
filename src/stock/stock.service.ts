import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { UpdateStockItemDto } from './dto/update-stock-item.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class StockService {
  constructor(private prisma: PrismaService) {}

  async createStockItem(userId: string, dto: CreateStockItemDto) {
    await this.checkBoutiqueAccess(userId, dto.boutiqueId);

    const existing = await this.prisma.stockItem.findFirst({
      where: { productId: dto.productId, boutiqueId: dto.boutiqueId, deletedAt: null },
    });
    if (existing) throw new BadRequestException('Stock item already exists for this product/boutique');

    const stockItem = await this.prisma.stockItem.create({
      data: {
        productId: dto.productId,
        boutiqueId: dto.boutiqueId,
        quantity: dto.quantity,
        minQuantity: dto.minQuantity || 0,
        location: dto.location,
      },
    });

    // Create initial inventory movement if quantity > 0
    if (dto.quantity > 0) {
      await this.prisma.inventoryMovement.create({
        data: {
          productId: dto.productId,
          boutiqueId: dto.boutiqueId,
          type: 'in',
          reason: 'initial',
          quantity: dto.quantity,
          createdBy: userId,
        },
      });
    }

    return stockItem;
  }

  async findAll(userId: string, boutiqueId: string, query: PaginationDto) {
    await this.checkBoutiqueAccess(userId, boutiqueId);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { boutiqueId, deletedAt: null };
    if (query.search) {
      where.product = {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { sku: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.stockItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: { product: true },
      }),
      this.prisma.stockItem.count({ where }),
    ]);

    return {
      data: items,
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
    const item = await this.prisma.stockItem.findFirst({
      where: { id, deletedAt: null },
      include: { product: true, boutique: true },
    });
    if (!item) throw new NotFoundException('Stock item not found');
    await this.checkBoutiqueAccess(userId, item.boutiqueId);
    return item;
  }

  async update(userId: string, id: string, dto: UpdateStockItemDto) {
    const item = await this.prisma.stockItem.findFirst({
      where: { id, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Stock item not found');
    await this.checkBoutiqueAccess(userId, item.boutiqueId);

    return this.prisma.stockItem.update({
      where: { id },
      data: {
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.minQuantity !== undefined && { minQuantity: dto.minQuantity }),
        ...(dto.location !== undefined && { location: dto.location }),
      },
    });
  }

  async remove(userId: string, id: string) {
    const item = await this.prisma.stockItem.findFirst({
      where: { id, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Stock item not found');
    await this.checkBoutiqueAccess(userId, item.boutiqueId);

    await this.prisma.stockItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Stock item deleted successfully' };
  }

  async adjustStock(userId: string, dto: AdjustStockDto) {
    await this.checkBoutiqueAccess(userId, dto.boutiqueId);

    const stockItem = await this.prisma.stockItem.findFirst({
      where: { productId: dto.productId, boutiqueId: dto.boutiqueId, deletedAt: null },
    });
    if (!stockItem) throw new NotFoundException('Stock item not found');

    if (dto.type === 'out' && stockItem.quantity < dto.quantity) {
      throw new BadRequestException('Insufficient stock');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.stockItem.update({
        where: { id: stockItem.id },
        data: {
          quantity: dto.type === 'in'
            ? { increment: dto.quantity }
            : { decrement: dto.quantity },
        },
      });

      await tx.inventoryMovement.create({
        data: {
          productId: dto.productId,
          boutiqueId: dto.boutiqueId,
          type: dto.type,
          reason: dto.reason as any,
          quantity: dto.quantity,
          note: dto.note,
          createdBy: userId,
        },
      });

      return updated;
    });
  }

  async getMovements(userId: string, boutiqueId: string, query: PaginationDto) {
    await this.checkBoutiqueAccess(userId, boutiqueId);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { boutiqueId };
    if (query.search) {
      where.product = {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { sku: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const [movements, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { product: true },
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    return {
      data: movements,
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

  async getLowStock(userId: string, boutiqueId: string) {
    await this.checkBoutiqueAccess(userId, boutiqueId);

    const items = await this.prisma.stockItem.findMany({
      where: { boutiqueId, deletedAt: null },
      include: { product: true },
    });

    const lowStock = items.filter((item) => item.quantity <= item.minQuantity);
    return { data: lowStock, count: lowStock.length };
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
}
