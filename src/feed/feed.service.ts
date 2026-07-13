import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CursorPaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class FeedService {
  constructor(private prisma: PrismaService) {}

  async getFeed(userId: string, query: CursorPaginationDto) {
    const limit = query.limit || 20;
    const cursor = query.cursor;

    const where: any = {
      deletedAt: null,
      isActive: true,
    };

    let products;
    if (cursor) {
      products = await this.prisma.product.findMany({
        where,
        take: limit + 1,
        skip: 1,
        cursor: { id: cursor },
        orderBy: { createdAt: 'desc' },
        include: {
          ownerBoutique: { select: { id: true, name: true, logo: true } },
          _count: { select: { feedLikes: true } },
          feedLikes: { where: { userId }, select: { userId: true } },
        },
      });
    } else {
      products = await this.prisma.product.findMany({
        where,
        take: limit + 1,
        orderBy: { createdAt: 'desc' },
        include: {
          ownerBoutique: { select: { id: true, name: true, logo: true } },
          _count: { select: { feedLikes: true } },
          feedLikes: { where: { userId }, select: { userId: true } },
        },
      });
    }

    const hasMore = products.length > limit;
    const items = hasMore ? products.slice(0, limit) : products;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      data: items.map((p) => ({
        ...p,
        likesCount: p._count?.feedLikes || 0,
        isLiked: (p.feedLikes?.length || 0) > 0,
        _count: undefined,
        feedLikes: undefined,
      })),
      meta: {
        nextCursor,
        hasMore,
        limit,
      },
    };
  }

  async toggleLike(userId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Product not found');

    const existing = await this.prisma.feedLike.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (existing) {
      await this.prisma.feedLike.delete({
        where: { userId_productId: { userId, productId } },
      });
      const count = await this.prisma.feedLike.count({ where: { productId } });
      return { liked: false, likesCount: count };
    } else {
      await this.prisma.feedLike.create({
        data: { userId, productId },
      });
      const count = await this.prisma.feedLike.count({ where: { productId } });
      return { liked: true, likesCount: count };
    }
  }

  async getLikedProducts(userId: string, query: CursorPaginationDto) {
    const limit = query.limit || 20;
    const cursor = query.cursor;

    const where: any = { userId };
    let likes;
    if (cursor) {
      likes = await this.prisma.feedLike.findMany({
        where,
        take: limit + 1,
        skip: 1,
        cursor: { userId_productId: { userId, productId: cursor } },
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            include: {
              ownerBoutique: { select: { id: true, name: true, logo: true } },
            },
          },
        },
      });
    } else {
      likes = await this.prisma.feedLike.findMany({
        where,
        take: limit + 1,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            include: {
              ownerBoutique: { select: { id: true, name: true, logo: true } },
            },
          },
        },
      });
    }

    const hasMore = likes.length > limit;
    const items = hasMore ? likes.slice(0, limit) : likes;
    const nextCursor = hasMore ? items[items.length - 1].productId : null;

    return {
      data: items.map((l) => l.product),
      meta: { nextCursor, hasMore, limit },
    };
  }
}
