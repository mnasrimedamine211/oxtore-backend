import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateProductDto) {
    await this.checkBoutiqueAccess(userId, dto.ownerBoutiqueId);

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description || '',
        category: dto.category || '',
        images: dto.images || [],
        ownerBoutiqueId: dto.ownerBoutiqueId,
        sku: dto.sku,
        barcode: dto.barcode,
        cost: dto.cost || 0,
        price: dto.price,
        wholesalePrice: dto.wholesalePrice || 0,
        minWholesaleQty: dto.minWholesaleQty || 0,
        commission: dto.commission || 0,
        isActive: dto.isActive ?? true,
      },
    });
    return this.formatProduct(product);
  }

  async findAll(userId: string, query: PaginationDto & { ownerBoutiqueId?: string; category?: string; isActive?: boolean }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const userBoutiques = await this.getUserBoutiqueIds(userId);
    const where: any = { deletedAt: null };

    if (query.ownerBoutiqueId) {
      if (!userBoutiques.includes(query.ownerBoutiqueId)) {
        throw new ForbiddenException('Access denied to this boutique');
      }
      where.ownerBoutiqueId = query.ownerBoutiqueId;
    } else {
      where.ownerBoutiqueId = { in: userBoutiques };
    }

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
        include: { stockItems: { where: { deletedAt: null } } },
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
        stockItems: { where: { deletedAt: null } },
        ownerBoutique: true,
      },
    });
    if (!product) throw new NotFoundException('Product not found');

    const userBoutiques = await this.getUserBoutiqueIds(userId);
    if (!userBoutiques.includes(product.ownerBoutiqueId)) {
      throw new ForbiddenException('Access denied to this product');
    }

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
      },
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
      ...(product.stockItems && { stock: product.stockItems }),
      ...(product.ownerBoutique && { ownerBoutique: { id: product.ownerBoutique.id, name: product.ownerBoutique.name } }),
    };
  }
}
