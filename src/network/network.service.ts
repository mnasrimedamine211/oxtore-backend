import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateBoutiqueRequestDto } from './dto/create-boutique-request.dto';
import { AcceptBoutiqueRequestDto } from './dto/accept-boutique-request.dto';
import { RejectBoutiqueRequestDto } from './dto/reject-boutique-request.dto';
import { QueryBoutiqueRequestDto } from './dto/query-boutique-request.dto';
import { CreateBoutiqueRelationDto } from './dto/create-boutique-relation.dto';
import { UpdateBoutiqueRelationDto } from './dto/update-boutique-relation.dto';
import { QueryBoutiqueRelationDto } from './dto/query-boutique-relation.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  boutiqueRequestStatusToApi,
  boutiqueRequestStatusFromApi,
} from '../common/utils/enum-case.util';

@Injectable()
export class NetworkService {
  constructor(private prisma: PrismaService) {}

  async createRequest(userId: string, dto: CreateBoutiqueRequestDto) {
    const requesterId = dto.fromBoutiqueId;
    const receiverId = dto.toBoutiqueId;

    await this.checkBoutiqueAccess(userId, requesterId);

    if (requesterId === receiverId) {
      throw new BadRequestException('Cannot send request to self');
    }

    // Check if already related
    const existingRelation = await this.prisma.boutiqueRelation.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { requesterId, receiverId },
          { requesterId: receiverId, receiverId: requesterId },
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
          { requesterId, receiverId },
          { requesterId: receiverId, receiverId: requesterId },
        ],
      },
    });
    if (existingRequest) {
      throw new BadRequestException('A pending request already exists');
    }

    const request = await this.prisma.boutiqueRequest.create({
      data: {
        requesterId,
        receiverId,
        type: dto.type,
        status: 'pending',
        message: dto.message || '',
      },
      include: { requester: true, receiver: true },
    });

    // Notify receiver manager
    const receiver = await this.prisma.boutique.findUnique({
      where: { id: receiverId },
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

    return this.formatRequest(request);
  }

  async findAllRequests(userId: string, query: QueryBoutiqueRequestDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const userBoutiques = await this.getUserBoutiqueIds(userId);
    const where: any = { deletedAt: null };

    if (query.boutiqueIds) {
      const ids = query.boutiqueIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      const notAllowed = ids.some((id) => !userBoutiques.includes(id));
      if (notAllowed) {
        throw new ForbiddenException('Access denied to this boutique');
      }
      where.OR = [
        { requesterId: { in: ids } },
        { receiverId: { in: ids } },
      ];
    } else if (query.boutiqueId) {
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

    if (query.status) {
      const dbStatus = boutiqueRequestStatusFromApi(query.status);
      if (!dbStatus) {
        // Status has no DB equivalent (e.g. CANCELLED) - no row could ever match.
        return {
          data: [],
          meta: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
      }
      where.status = dbStatus;
    }

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
      data: requests.map((r) => this.formatRequest(r)),
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

  async acceptRequest(userId: string, requestId: string, dto: AcceptBoutiqueRequestDto) {
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

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Update request status
      const updatedRequest = await tx.boutiqueRequest.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          respondedBy: dto.respondedBy,
          respondedAt: new Date(),
        },
        include: { requester: true, receiver: true },
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

      return updatedRequest;
    });

    return this.formatRequest(updated);
  }

  async rejectRequest(userId: string, requestId: string, dto: RejectBoutiqueRequestDto) {
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

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.boutiqueRequest.update({
        where: { id: requestId },
        data: {
          status: 'rejected',
          respondedBy: dto.respondedBy,
          respondedAt: new Date(),
          rejectionReason: dto.rejectionReason,
        },
        include: { requester: true, receiver: true },
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

      return updatedRequest;
    });

    return this.formatRequest(updated);
  }

  async findAllRelations(userId: string, query: QueryBoutiqueRelationDto) {
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
      }),
      this.prisma.boutiqueRelation.count({ where }),
    ]);

    return {
      data: relations.map((r) => this.formatRelation(r)),
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

  async createRelation(userId: string, dto: CreateBoutiqueRelationDto) {
    const requesterId = dto.fromBoutiqueId;
    const receiverId = dto.toBoutiqueId;

    await this.checkBoutiqueAccess(userId, requesterId);

    if (requesterId === receiverId) {
      throw new BadRequestException('Cannot create a relation with self');
    }

    const existingRelation = await this.prisma.boutiqueRelation.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { requesterId, receiverId },
          { requesterId: receiverId, receiverId: requesterId },
        ],
      },
    });
    if (existingRelation) {
      throw new BadRequestException('Boutiques are already connected');
    }

    const relation = await this.prisma.boutiqueRelation.create({
      data: {
        requesterId,
        receiverId,
        type: dto.type,
        status: 'ACTIVE',
        approvedBy: dto.approvedBy,
        approvedAt: new Date(),
      },
    });

    return this.formatRelation(relation);
  }

  async updateRelation(userId: string, relationId: string, dto: UpdateBoutiqueRelationDto) {
    const relation = await this.prisma.boutiqueRelation.findFirst({
      where: { id: relationId, deletedAt: null },
    });
    if (!relation) throw new NotFoundException('Relation not found');

    const userBoutiques = await this.getUserBoutiqueIds(userId);
    if (!userBoutiques.includes(relation.requesterId) && !userBoutiques.includes(relation.receiverId)) {
      throw new ForbiddenException('Access denied');
    }

    const updated = await this.prisma.boutiqueRelation.update({
      where: { id: relationId },
      data: { status: dto.status },
    });

    return this.formatRelation(updated);
  }

  async getNetworkProducts(userId: string, boutiqueId: string, query: PaginationDto) {
    await this.checkBoutiqueAccess(userId, boutiqueId);

    // Get all related boutique IDs where the relation is ACTIVE
    const relations = await this.prisma.boutiqueRelation.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
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
      isPublic: true,
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

  private formatRequest(request: any) {
    const { requesterId, receiverId, requester, receiver, status, ...rest } = request;
    return {
      ...rest,
      fromBoutiqueId: requesterId,
      toBoutiqueId: receiverId,
      fromBoutiqueName: requester?.name,
      toBoutiqueName: receiver?.name,
      status: boutiqueRequestStatusToApi(status),
    };
  }

  private formatRelation(relation: any) {
    const { requesterId, receiverId, requester, receiver, ...rest } = relation;
    return {
      ...rest,
      fromBoutiqueId: requesterId,
      toBoutiqueId: receiverId,
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
