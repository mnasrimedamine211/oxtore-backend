import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateBoutiqueRequestDto } from './dto/create-boutique-request.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class NetworkService {
  constructor(private prisma: PrismaService) {}

  async createRequest(userId: string, dto: CreateBoutiqueRequestDto) {
    await this.checkBoutiqueAccess(userId, dto.requesterId);

    if (dto.requesterId === dto.receiverId) {
      throw new BadRequestException('Cannot send request to self');
    }

    // Check if already related
    const existingRelation = await this.prisma.boutiqueRelation.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { requesterId: dto.requesterId, receiverId: dto.receiverId },
          { requesterId: dto.receiverId, receiverId: dto.requesterId },
        ],
      },
    });
    if (existingRelation) {
      throw new BadRequestException('Boutiques are already connected');
    }

    // Check for existing pending request
    const existingRequest = await this.prisma.boutiqueRequest.findFirst({
      where: {
        deletedAt: null,
        status: 'pending',
        OR: [
          { requesterId: dto.requesterId, receiverId: dto.receiverId },
          { requesterId: dto.receiverId, receiverId: dto.requesterId },
        ],
      },
    });
    if (existingRequest) {
      throw new BadRequestException('A pending request already exists');
    }

    const request = await this.prisma.boutiqueRequest.create({
      data: {
        requesterId: dto.requesterId,
        receiverId: dto.receiverId,
        status: 'pending',
        message: dto.message || '',
      },
    });

    // Notify receiver manager
    const receiver = await this.prisma.boutique.findUnique({
      where: { id: dto.receiverId },
    });
    if (receiver?.managerId) {
      await this.prisma.notification.create({
        data: {
          userId: receiver.managerId,
          type: 'boutique_request',
          title: 'New Network Request',
          message: `You have a new network request`,
          data: { boutiqueRequestId: request.id },
        },
      });
    }

    return request;
  }

  async findAllRequests(userId: string, query: PaginationDto & { type?: 'sent' | 'received'; boutiqueId?: string; status?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const userBoutiques = await this.getUserBoutiqueIds(userId);
    const where: any = { deletedAt: null };

    if (query.boutiqueId) {
      if (!userBoutiques.includes(query.boutiqueId)) {
        throw new ForbiddenException('Access denied to this boutique');
      }
      if (query.type === 'sent') {
        where.requesterId = query.boutiqueId;
      } else if (query.type === 'received') {
        where.receiverId = query.boutiqueId;
      } else {
        where.OR = [
          { requesterId: query.boutiqueId },
          { receiverId: query.boutiqueId },
        ];
      }
    } else {
      where.OR = [
        { requesterId: { in: userBoutiques } },
        { receiverId: { in: userBoutiques } },
      ];
    }

    if (query.status) where.status = query.status;

    const [requests, total] = await Promise.all([
      this.prisma.boutiqueRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { requester: true, receiver: true },
      }),
      this.prisma.boutiqueRequest.count({ where }),
    ]);

    return {
      data: requests,
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

  async acceptRequest(userId: string, requestId: string) {
    const request = await this.prisma.boutiqueRequest.findFirst({
      where: { id: requestId, deletedAt: null },
    });
    if (!request) throw new NotFoundException('Request not found');

    // Only receiver can accept
    const userBoutiques = await this.getUserBoutiqueIds(userId);
    if (!userBoutiques.includes(request.receiverId)) {
      throw new ForbiddenException('Only the receiving boutique can accept');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be accepted');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update request status
      const updated = await tx.boutiqueRequest.update({
        where: { id: requestId },
        data: { status: 'approved' },
      });

      // 2. Create boutique relation
      await tx.boutiqueRelation.create({
        data: {
          requesterId: request.requesterId,
          receiverId: request.receiverId,
        },
      });

      // 3. Notify requester manager
      const requester = await tx.boutique.findUnique({
        where: { id: request.requesterId },
      });
      if (requester?.managerId) {
        await tx.notification.create({
          data: {
            userId: requester.managerId,
            type: 'boutique_request',
            title: 'Network Request Accepted',
            message: 'Your network request has been accepted',
            data: { boutiqueRequestId: requestId },
          },
        });
      }

      return updated;
    });
  }

  async rejectRequest(userId: string, requestId: string) {
    const request = await this.prisma.boutiqueRequest.findFirst({
      where: { id: requestId, deletedAt: null },
    });
    if (!request) throw new NotFoundException('Request not found');

    const userBoutiques = await this.getUserBoutiqueIds(userId);
    if (!userBoutiques.includes(request.receiverId)) {
      throw new ForbiddenException('Only the receiving boutique can reject');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be rejected');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.boutiqueRequest.update({
        where: { id: requestId },
        data: { status: 'rejected' },
      });

      const requester = await tx.boutique.findUnique({
        where: { id: request.requesterId },
      });
      if (requester?.managerId) {
        await tx.notification.create({
          data: {
            userId: requester.managerId,
            type: 'boutique_request',
            title: 'Network Request Rejected',
            message: 'Your network request has been rejected',
            data: { boutiqueRequestId: requestId },
          },
        });
      }

      return updated;
    });
  }

  async findAllRelations(userId: string, query: PaginationDto & { boutiqueId?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const userBoutiques = await this.getUserBoutiqueIds(userId);
    const where: any = { deletedAt: null };

    if (query.boutiqueId) {
      if (!userBoutiques.includes(query.boutiqueId)) {
        throw new ForbiddenException('Access denied to this boutique');
      }
      where.OR = [
        { requesterId: query.boutiqueId },
        { receiverId: query.boutiqueId },
      ];
    } else {
      where.OR = [
        { requesterId: { in: userBoutiques } },
        { receiverId: { in: userBoutiques } },
      ];
    }

    const [relations, total] = await Promise.all([
      this.prisma.boutiqueRelation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { requester: true, receiver: true },
      }),
      this.prisma.boutiqueRelation.count({ where }),
    ]);

    return {
      data: relations,
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

  async removeRelation(userId: string, relationId: string) {
    const relation = await this.prisma.boutiqueRelation.findFirst({
      where: { id: relationId, deletedAt: null },
    });
    if (!relation) throw new NotFoundException('Relation not found');

    const userBoutiques = await this.getUserBoutiqueIds(userId);
    if (!userBoutiques.includes(relation.requesterId) && !userBoutiques.includes(relation.receiverId)) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.boutiqueRelation.update({
      where: { id: relationId },
      data: { deletedAt: new Date() },
    });
    return { message: 'Relation removed successfully' };
  }

  async getNetworkProducts(userId: string, boutiqueId: string, query: PaginationDto) {
    await this.checkBoutiqueAccess(userId, boutiqueId);

    // Get all related boutique IDs
    const relations = await this.prisma.boutiqueRelation.findMany({
      where: {
        deletedAt: null,
        OR: [
          { requesterId: boutiqueId },
          { receiverId: boutiqueId },
        ],
      },
    });

    const relatedBoutiqueIds = relations.map((r) =>
      r.requesterId === boutiqueId ? r.receiverId : r.requesterId,
    );

    if (relatedBoutiqueIds.length === 0) {
      return {
        data: [],
        meta: { page: 1, limit: query.limit || 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      };
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
      isActive: true,
      ownerBoutiqueId: { in: relatedBoutiqueIds },
    };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { category: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if ((query as any).category) {
      where.category = (query as any).category;
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ownerBoutique: { select: { id: true, name: true } },
          stockItems: { where: { deletedAt: null }, select: { quantity: true, boutiqueId: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
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
}
