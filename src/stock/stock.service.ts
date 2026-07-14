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
import { AdjustStockMovementDto } from './dto/adjust-stock-movement.dto';
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
    return this.performStockAdjustment(userId, {
      productId: dto.productId,
      boutiqueId: dto.boutiqueId,
      type: dto.type,
      reason: dto.reason,
      quantity: dto.quantity,
      note: dto.note,
    });
  }

  /**
   * Path-based alias for adjustStock (POST /stock/:productId/movements): derives
   * boutiqueId from the product's owner boutique and defaults reason to
   * 'adjustment', then delegates to the same shared transaction logic.
   */
  async adjustStockForProduct(userId: string, productId: string, dto: AdjustStockMovementDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Product not found');

    return this.performStockAdjustment(userId, {
      productId,
      boutiqueId: product.ownerBoutiqueId,
      type: dto.type,
      reason: 'adjustment',
      quantity: dto.qty,
      note: dto.note,
    });
  }

  /**
   * Shared core of the stock adjustment transaction used by both
   * POST /stock/adjust and POST /stock/:productId/movements.
   *
   * `quantity` is the signed delta to apply for type 'adj' (positive
   * increases, negative decreases); for 'in'/'out' it is the unsigned
   * amount and direction is taken from `type`, matching prior behavior.
   */
  private async performStockAdjustment(
    userId: string,
    params: {
      productId: string;
      boutiqueId: string;
      type: 'in' | 'out' | 'adj';
      reason: string;
      quantity: number;
      note?: string;
    },
  ) {
    await this.checkBoutiqueAccess(userId, params.boutiqueId);

    const stockItem = await this.prisma.stockItem.findFirst({
      where: { productId: params.productId, boutiqueId: params.boutiqueId, deletedAt: null },
    });
    if (!stockItem) throw new NotFoundException('Stock item not found');

    const delta =
      params.type === 'in'
        ? params.quantity
        : params.type === 'out'
          ? -params.quantity
          : params.quantity;

    if (stockItem.quantity + delta < 0) {
      throw new BadRequestException('Insufficient stock');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.stockItem.update({
        where: { id: stockItem.id },
        data: { quantity: { increment: delta } },
      });

      await tx.inventoryMovement.create({
        data: {
          productId: params.productId,
          boutiqueId: params.boutiqueId,
          type: params.type,
          reason: params.reason as any,
          quantity: Math.abs(params.quantity),
          note: params.note,
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
