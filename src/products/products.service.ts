import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductStockDto } from './dto/update-product-stock.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

const PRODUCT_INCLUDE = {
  stockItems: { where: { deletedAt: null } },
  wholesaleTiers: true,
  productCommissions: true,
} as const;

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, boutiqueId: string, dto: CreateProductDto) {
    await this.checkBoutiqueAccess(userId, boutiqueId);

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description || '',
        category: dto.category || '',
        images: dto.images || [],
        ownerBoutiqueId: boutiqueId,
        sku: dto.sku,
        barcode: dto.barcode,
        cost: dto.cost || 0,
        price: dto.price,
        wholesalePrice: dto.wholesalePrice || 0,
        minWholesaleQty: dto.minWholesaleQty || 0,
        commission: dto.commission || 0,
        isActive: dto.isActive ?? true,
        wholesaleTiers: {
          create: (dto.wholesaleTiers || []).map((tier) => ({
            minQty: tier.minQty,
            unitPrice: tier.unitPrice,
          })),
        },
        productCommissions: {
          create: (dto.commissions || []).map((commission) => ({
            actor: commission.actor as any,
            type: commission.type as any,
            value: commission.value,
          })),
        },
      },
      include: PRODUCT_INCLUDE,
    });
    return this.formatProduct(product);
  }

  async findAll(
    userId: string,
    boutiqueId: string,
    query: PaginationDto & { category?: string; isActive?: boolean },
  ) {
    await this.checkBoutiqueAccess(userId, boutiqueId);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { ownerBoutiqueId: boutiqueId, deletedAt: null };
    if (query.category) where.category = query.category;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: PRODUCT_INCLUDE,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products.map((p) => this.formatProduct(p)),
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
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...PRODUCT_INCLUDE,
        ownerBoutique: true,
      },
    });
    if (!product) throw new NotFoundException('Product not found');

    await this.checkBoutiqueAccess(userId, product.ownerBoutiqueId);

    return this.formatProduct(product);
  }

  async update(userId: string, id: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Product not found');
    await this.checkBoutiqueAccess(userId, product.ownerBoutiqueId);

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.images !== undefined && { images: dto.images }),
        ...(dto.sku !== undefined && { sku: dto.sku }),
        ...(dto.barcode !== undefined && { barcode: dto.barcode }),
        ...(dto.cost !== undefined && { cost: dto.cost }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.wholesalePrice !== undefined && { wholesalePrice: dto.wholesalePrice }),
        ...(dto.minWholesaleQty !== undefined && { minWholesaleQty: dto.minWholesaleQty }),
        ...(dto.commission !== undefined && { commission: dto.commission }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.wholesaleTiers !== undefined && {
          wholesaleTiers: {
            deleteMany: {},
            create: dto.wholesaleTiers.map((tier) => ({
              minQty: tier.minQty,
              unitPrice: tier.unitPrice,
            })),
          },
        }),
        ...(dto.commissions !== undefined && {
          productCommissions: {
            deleteMany: {},
            create: dto.commissions.map((commission) => ({
              actor: commission.actor as any,
              type: commission.type as any,
              value: commission.value,
            })),
          },
        }),
      },
      include: PRODUCT_INCLUDE,
    });
    return this.formatProduct(updated);
  }

  async remove(userId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Product not found');
    await this.checkBoutiqueAccess(userId, product.ownerBoutiqueId);

    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Product deleted successfully' };
  }

  async updateStock(userId: string, id: string, dto: UpdateProductStockDto) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Product not found');
    await this.checkBoutiqueAccess(userId, product.ownerBoutiqueId);

    await this.prisma.$transaction(async (tx) => {
      const stockItem = await tx.stockItem.findFirst({
        where: { productId: product.id, boutiqueId: product.ownerBoutiqueId, deletedAt: null },
      });
      if (!stockItem || stockItem.available < dto.quantitySold) {
        throw new BadRequestException('Insufficient stock to fulfill this sale');
      }

      const newQuantity = stockItem.quantity - dto.quantitySold;
      const newAvailable = stockItem.available - dto.quantitySold;

      await tx.stockItem.update({
        where: { id: stockItem.id },
        data: {
          quantity: newQuantity,
          available: newAvailable,
          status: this.computeStockStatus(newQuantity, stockItem.safetyStock, stockItem.reorderLevel) as any,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          productId: product.id,
          boutiqueId: product.ownerBoutiqueId,
          type: 'out',
          reason: 'sale',
          referenceType: 'product_stock_update',
          referenceId: product.id,
          quantity: dto.quantitySold,
          createdBy: userId,
        },
      });
    });

    return this.findOne(userId, id);
  }

  /**
   * Mirrors the in_stock/low_stock/out_of_stock threshold logic used for StockItem.status
   * elsewhere in the stock domain (quantity vs. safetyStock/reorderLevel).
   */
  private computeStockStatus(quantity: number, safetyStock: number, reorderLevel: number) {
    if (quantity <= 0) return 'out_of_stock';
    if (quantity <= reorderLevel || quantity <= safetyStock) return 'low_stock';
    return 'in_stock';
  }

  private async getUserBoutiqueIds(userId: string): Promise<string[]> {
    const [managed, owned] = await Promise.all([
      this.prisma.boutique.findMany({ where: { managerId: userId, deletedAt: null }, select: { id: true } }),
      this.prisma.boutiqueOwner.findMany({ where: { userId }, select: { boutiqueId: true } }),
    ]);
    return [...new Set([...managed.map((b) => b.id), ...owned.map((o) => o.boutiqueId)])];
  }

  private async checkBoutiqueAccess(userId: string, boutiqueId: string) {
    const userBoutiques = await this.getUserBoutiqueIds(userId);
    if (!userBoutiques.includes(boutiqueId)) {
      throw new ForbiddenException('Access denied to this boutique');
    }
  }

  private formatProduct(product: any) {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      images: product.images,
      ownerBoutiqueId: product.ownerBoutiqueId,
      sku: product.sku,
      barcode: product.barcode,
      cost: product.cost,
      price: product.price,
      wholesalePrice: product.wholesalePrice,
      minWholesaleQty: product.minWholesaleQty,
      commission: product.commission,
      isActive: product.isActive,
      metadata: product.metadata,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      wholesaleTiers: (product.wholesaleTiers || []).map((tier: any) => ({
        minQty: tier.minQty,
        unitPrice: tier.unitPrice,
      })),
      commissions: (product.productCommissions || []).map((commission: any) => ({
        actor: commission.actor,
        type: commission.type,
        value: commission.value,
      })),
      ...(product.stockItems && { stock: product.stockItems }),
      ...(product.ownerBoutique && { ownerBoutique: { id: product.ownerBoutique.id, name: product.ownerBoutique.name } }),
    };
  }
}
