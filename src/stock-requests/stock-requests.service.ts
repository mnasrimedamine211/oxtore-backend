import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateStockRequestDto } from './dto/create-stock-request.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class StockRequestsService {
  constructor(private prisma: PrismaService) {}

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
      await this.prisma.notification.create({
        data: {
          userId: receiver.managerId,
          type: 'stock_request',
          title: 'New Stock Request',
          message: `Stock request for ${request.quantity} units of ${request.product.name}`,
          data: { stockRequestId: request.id },
        },
      });
    }

    return request;
  }

  async findAll(userId: string, query: PaginationDto & { type?: 'sent' | 'received'; boutiqueId?: string; status?: string }) {
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

  async findOne(userId: string, id: string) {
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
    const request = await this.findOne(userId, id);

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

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.stockRequest.update({
        where: { id },
        data: { status: 'approved' },
      });

      // Notify requester
      const requester = await tx.boutique.findUnique({
        where: { id: request.requesterId },
      });
      if (requester?.managerId) {
        await tx.notification.create({
          data: {
            userId: requester.managerId,
            type: 'stock_request',
            title: 'Stock Request Approved',
            message: `Your stock request for ${request.quantity} units has been approved`,
            data: { stockRequestId: id },
          },
        });
      }

      return updated;
    });
  }

  async reject(userId: string, id: string, reason?: string) {
    const request = await this.findOne(userId, id);

    const userBoutiques = await this.getUserBoutiqueIds(userId);
    if (!userBoutiques.includes(request.receiverId)) {
      throw new ForbiddenException('Only the receiving boutique can reject');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be rejected');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.stockRequest.update({
        where: { id },
        data: { status: 'rejected', note: reason || request.note },
      });

      // Notify requester
      const requester = await tx.boutique.findUnique({
        where: { id: request.requesterId },
      });
      if (requester?.managerId) {
        await tx.notification.create({
          data: {
            userId: requester.managerId,
            type: 'stock_request',
            title: 'Stock Request Rejected',
            message: `Your stock request has been rejected${reason ? `: ${reason}` : ''}`,
            data: { stockRequestId: id },
          },
        });
      }

      return updated;
    });
  }

  async fulfill(userId: string, id: string) {
    const request = await this.findOne(userId, id);

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

    return this.prisma.$transaction(async (tx) => {
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
      if (requester?.managerId) {
        await tx.notification.create({
          data: {
            userId: requester.managerId,
            type: 'stock_request',
            title: 'Stock Request Fulfilled',
            message: `Your stock request for ${request.quantity} units has been fulfilled`,
            data: { stockRequestId: id },
          },
        });
      }

      return updated;
    });
  }

  async cancel(userId: string, id: string) {
    const request = await this.findOne(userId, id);
    const userBoutiques = await this.getUserBoutiqueIds(userId);
    if (!userBoutiques.includes(request.requesterId)) {
      throw new ForbiddenException('Only the requesting boutique can cancel');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be cancelled');
    }

    return this.prisma.stockRequest.update({
      where: { id },
      data: { status: 'cancelled' },
    });
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
