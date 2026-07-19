import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsGateway } from '../common/gateways/notifications.gateway';
import { CreateStockRequestDto } from './dto/create-stock-request.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  stockRequestStatusToApi,
  stockRequestStatusFromApi,
} from '../common/utils/enum-case.util';

@Injectable()
export class StockRequestsService {
  constructor(
    private prisma: PrismaService,
    private notificationsGateway: NotificationsGateway,
  ) {}

  async create(userId: string, dto: CreateStockRequestDto) {
    await this.checkBoutiqueAccess(userId, dto.requesterId);

    // Check if boutiques are in the same network
    const relation = await this.prisma.boutiqueRelation.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { requesterId: dto.requesterId, receiverId: dto.receiverId },
          { requesterId: dto.receiverId, receiverId: dto.requesterId },
        ],
      },
    });
    if (!relation) {
      throw new BadRequestException('Boutiques must be in the same network');
    }

    const request = await this.prisma.stockRequest.create({
      data: {
        productId: dto.productId,
        requesterId: dto.requesterId,
        receiverId: dto.receiverId,
        quantity: dto.quantity,
        note: dto.note,
        createdBy: userId,
        status: 'pending',
      },
      include: { product: true, requester: true, receiver: true },
    });

    // Notify receiver boutique manager
    const receiver = await this.prisma.boutique.findUnique({
      where: { id: dto.receiverId },
    });
    if (receiver?.managerId) {
      const notification = await this.prisma.notification.create({
        data: {
          userId: receiver.managerId,
          type: 'stock_request',
          title: 'New Stock Request',
          message: `Stock request for ${request.quantity} units of ${request.product.name}`,
          data: { stockRequestId: request.id },
        },
      });
      this.notificationsGateway.emitToUser(receiver.managerId, notification);
    }

    return this.formatStockRequest(request);
  }

  async findAll(
    userId: string,
    query: PaginationDto & {
      type?: 'sent' | 'received';
      boutiqueId?: string;
      boutiqueIds?: string;
      status?: string;
    },
  ) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const userBoutiques = await this.getUserBoutiqueIds(userId);
    const where: any = { deletedAt: null };

    if (query.boutiqueIds) {
      const requestedIds = query.boutiqueIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      const accessibleIds = requestedIds.filter((id) => userBoutiques.includes(id));
      where.OR = [
        { requesterId: { in: accessibleIds } },
        { receiverId: { in: accessibleIds } },
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
      const dbStatus = stockRequestStatusFromApi(query.status);
      if (dbStatus) where.status = dbStatus;
    }

    const [requests, total] = await Promise.all([
      this.prisma.stockRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { product: true, requester: true, receiver: true },
      }),
      this.prisma.stockRequest.count({ where }),
    ]);

    return {
      data: requests.map((r) => this.formatStockRequest(r)),
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
    const request = await this.getRequestForUser(userId, id);
    return this.formatStockRequest(request);
  }

  /** Fetches the raw (unformatted, DB-cased) stock request, enforcing access. Internal use only. */
  private async getRequestForUser(userId: string, id: string) {
    const request = await this.prisma.stockRequest.findFirst({
      where: { id, deletedAt: null },
      include: { product: true, requester: true, receiver: true },
    });
    if (!request) throw new NotFoundException('Stock request not found');

    const userBoutiques = await this.getUserBoutiqueIds(userId);
    if (!userBoutiques.includes(request.requesterId) && !userBoutiques.includes(request.receiverId)) {
      throw new ForbiddenException('Access denied');
    }

    return request;
  }

  async approve(userId: string, id: string) {
    const request = await this.getRequestForUser(userId, id);

    // Only receiver can approve
    const userBoutiques = await this.getUserBoutiqueIds(userId);
    if (!userBoutiques.includes(request.receiverId)) {
      throw new ForbiddenException('Only the receiving boutique can approve');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be approved');
    }

    // Check receiver has enough stock
    const receiverStock = await this.prisma.stockItem.findFirst({
      where: { productId: request.productId, boutiqueId: request.receiverId, deletedAt: null },
    });
    if (!receiverStock || receiverStock.quantity < request.quantity) {
      throw new BadRequestException('Receiver has insufficient stock');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.stockRequest.update({
        where: { id },
        data: { status: 'approved' },
      });

      // Notify requester
      const requester = await tx.boutique.findUnique({
        where: { id: request.requesterId },
      });
      let notification = null;
      if (requester?.managerId) {
        notification = await tx.notification.create({
          data: {
            userId: requester.managerId,
            type: 'stock_request',
            title: 'Stock Request Approved',
            message: `Your stock request for ${request.quantity} units has been approved`,
            data: { stockRequestId: id },
          },
        });
      }

      return { updated, notification };
    });

    if (updated.notification) {
      this.notificationsGateway.emitToUser(updated.notification.userId, updated.notification);
    }

    return this.formatStockRequest(updated.updated);
  }

  async reject(userId: string, id: string, rejectionReason?: string) {
    const request = await this.getRequestForUser(userId, id);

    const userBoutiques = await this.getUserBoutiqueIds(userId);
    if (!userBoutiques.includes(request.receiverId)) {
      throw new ForbiddenException('Only the receiving boutique can reject');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be rejected');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.stockRequest.update({
        where: { id },
        data: { status: 'rejected', rejectionReason: rejectionReason ?? null },
      });

      // Notify requester
      const requester = await tx.boutique.findUnique({
        where: { id: request.requesterId },
      });
      let notification = null;
      if (requester?.managerId) {
        notification = await tx.notification.create({
          data: {
            userId: requester.managerId,
            type: 'stock_request',
            title: 'Stock Request Rejected',
            message: `Your stock request has been rejected${rejectionReason ? `: ${rejectionReason}` : ''}`,
            data: { stockRequestId: id },
          },
        });
      }

      return { updated, notification };
    });

    if (updated.notification) {
      this.notificationsGateway.emitToUser(updated.notification.userId, updated.notification);
    }

    return this.formatStockRequest(updated.updated);
  }

  async fulfill(userId: string, id: string) {
    const request = await this.getRequestForUser(userId, id);

    const userBoutiques = await this.getUserBoutiqueIds(userId);
    if (!userBoutiques.includes(request.receiverId)) {
      throw new ForbiddenException('Only the receiving boutique can fulfill');
    }

    if (request.status !== 'approved') {
      throw new BadRequestException('Only approved requests can be fulfilled');
    }

    // Verify stock still available
    const receiverStock = await this.prisma.stockItem.findFirst({
      where: { productId: request.productId, boutiqueId: request.receiverId, deletedAt: null },
    });
    if (!receiverStock || receiverStock.quantity < request.quantity) {
      throw new BadRequestException('Insufficient stock to fulfill');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Update request status
      const updated = await tx.stockRequest.update({
        where: { id },
        data: { status: 'fulfilled' },
      });

      // 2. Decrease receiver stock
      await tx.stockItem.update({
        where: { id: receiverStock.id },
        data: { quantity: { decrement: request.quantity } },
      });

      // 3. Increase or create requester stock
      const requesterStock = await tx.stockItem.findFirst({
        where: { productId: request.productId, boutiqueId: request.requesterId, deletedAt: null },
      });
      if (requesterStock) {
        await tx.stockItem.update({
          where: { id: requesterStock.id },
          data: { quantity: { increment: request.quantity } },
        });
      } else {
        await tx.stockItem.create({
          data: {
            productId: request.productId,
            boutiqueId: request.requesterId,
            quantity: request.quantity,
          },
        });
      }

      // 4. Create inventory movements for both boutiques
      await tx.inventoryMovement.create({
        data: {
          productId: request.productId,
          boutiqueId: request.receiverId,
          type: 'out',
          reason: 'transfer_out',
          quantity: request.quantity,
          referenceId: id,
          referenceType: 'stock_request',
          createdBy: userId,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          productId: request.productId,
          boutiqueId: request.requesterId,
          type: 'in',
          reason: 'transfer_in',
          quantity: request.quantity,
          referenceId: id,
          referenceType: 'stock_request',
          createdBy: userId,
        },
      });

      // 5. Notify requester
      const requester = await tx.boutique.findUnique({
        where: { id: request.requesterId },
      });
      let notification = null;
      if (requester?.managerId) {
        notification = await tx.notification.create({
          data: {
            userId: requester.managerId,
            type: 'stock_request',
            title: 'Stock Request Fulfilled',
            message: `Your stock request for ${request.quantity} units has been fulfilled`,
            data: { stockRequestId: id },
          },
        });
      }

      return { updated, notification };
    });

    if (updated.notification) {
      this.notificationsGateway.emitToUser(updated.notification.userId, updated.notification);
    }

    return this.formatStockRequest(updated.updated);
  }

  async cancel(userId: string, id: string) {
    const request = await this.getRequestForUser(userId, id);
    const userBoutiques = await this.getUserBoutiqueIds(userId);
    if (!userBoutiques.includes(request.requesterId)) {
      throw new ForbiddenException('Only the requesting boutique can cancel');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be cancelled');
    }

    const updated = await this.prisma.stockRequest.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    return this.formatStockRequest(updated);
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

  /** Converts the DB-cased `status` to the uppercase API contract value. */
  private formatStockRequest<T extends { status: string }>(request: T): T {
    return { ...request, status: stockRequestStatusToApi(request.status) };
  }
}
