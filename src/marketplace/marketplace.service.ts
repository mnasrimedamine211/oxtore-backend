import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class MarketplaceService {
  constructor(private prisma: PrismaService) {}

  async getProducts(
    query: PaginationDto & {
      category?: string;
      minPrice?: number;
      maxPrice?: number;
      condition?: string;
      saleType?: string;
      q?: string;
    },
  ) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
      isActive: true,
      visibility: 'public',
      ownerBoutique: { status: 'active' },
    };

    if (query.category) where.category = query.category;

    const andConditions: any[] = [];
    const search = query.search || query.q;
    if (search) {
      andConditions.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {};
      if (query.minPrice !== undefined) where.price.gte = query.minPrice;
      if (query.maxPrice !== undefined) where.price.lte = query.maxPrice;
    }
    if (query.condition) {
      where.condition = query.condition.toLowerCase();
    }
    if (query.saleType) {
      const mapped = query.saleType.toLowerCase();
      andConditions.push({ OR: [{ saleType: mapped }, { saleType: 'both' }] });
    }
    if (andConditions.length) where.AND = andConditions;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ownerBoutique: { select: { id: true, name: true, logo: true } },
          stockItems: { select: { available: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products.map((p) => this.toMarketplaceProduct(p)),
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

  private toMarketplaceProduct(product: any) {
    // Buyer-facing saleType has no "both" value — default a dual-mode product to RETAIL for browsing.
    const saleType = product.saleType === 'both' ? 'RETAIL' : product.saleType?.toUpperCase();
    // "commission" transactionMode has no buyer-facing equivalent — treat it like a direct sale.
    const transactionMode = product.transactionMode === 'commission' ? 'direct' : product.transactionMode;
    const stock = Array.isArray(product.stockItems) && product.stockItems.length
      ? product.stockItems.reduce((sum: number, s: any) => sum + (s.available || 0), 0)
      : (product.inventory as any)?.quantity ?? 0;

    return {
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images?.[0] ?? null,
      images: product.images ?? [],
      category: product.category,
      condition: product.condition?.toUpperCase(),
      saleType,
      transactionMode,
      description: product.description,
      stock,
      boutique: product.ownerBoutique?.name ?? null,
      boutiqueId: product.ownerBoutiqueId,
    };
  }

  async getCategories() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true, icon: true, slug: true },
    });
  }

  async getBoutiques(query: PaginationDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
      status: 'active',
    };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [boutiques, total] = await Promise.all([
      this.prisma.boutique.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { products: { where: { deletedAt: null, isActive: true } } } } },
      }),
      this.prisma.boutique.count({ where }),
    ]);

    return {
      data: boutiques,
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
}
