import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Order } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateOrderDto) {
    // Validate stock for all items
    for (const item of dto.items) {
      const stockItem = await this.prisma.stockItem.findFirst({
        where: { productId: item.productId, boutiqueId: item.boutiqueId, deletedAt: null },
      });
      if (!stockItem || stockItem.quantity < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for product ${item.productId} in boutique ${item.boutiqueId}`,
        );
      }
    }

    const subtotal = dto.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    const discount = dto.discount || 0;
    const tax = dto.tax || 0;
    const shipping = dto.shipping || 0;
    const total = subtotal - discount + tax + shipping;

    const created = await this.prisma.$transaction(async (tx) => {
      // 1. Create the order
      const order = await tx.order.create({
        data: {
          userId,
          items: dto.items as any,
          subtotal,
          discount,
          tax,
          shipping,
          total,
          paymentMethod: dto.paymentMethod || 'wallet',
          paymentStatus: dto.paymentMethod === 'wallet' ? 'paid' : 'unpaid',
          status: dto.paymentMethod === 'wallet' ? 'paid' : 'pending',
          shippingAddress: dto.shippingAddress,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          note: dto.note,
        },
      });

      // 2. Decrease stock and create inventory movements
      for (const item of dto.items) {
        const stockItem = await tx.stockItem.findFirst({
          where: { productId: item.productId, boutiqueId: item.boutiqueId, deletedAt: null },
        });
        if (!stockItem) throw new BadRequestException('Stock item not found');

        await tx.stockItem.update({
          where: { id: stockItem.id },
          data: { quantity: { decrement: item.quantity } },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            boutiqueId: item.boutiqueId,
            type: 'out',
            reason: 'sale',
            quantity: item.quantity,
            referenceId: order.id,
            referenceType: 'order',
            createdBy: userId,
          },
        });
      }

      // 3. If wallet payment, deduct from wallet
      if (dto.paymentMethod === 'wallet') {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet || Number(wallet.balance) < total) {
          throw new BadRequestException('Insufficient wallet balance');
        }

        const updatedWallet = await tx.wallet.update({
          where: { userId },
          data: { balance: { decrement: total } },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: updatedWallet.id,
            type: 'order_payment',
            amount: -total,
            balanceAfter: updatedWallet.balance,
            referenceId: order.id,
            referenceType: 'order',
            note: `Order payment`,
          },
        });
      }

      // 4. Notify all boutique managers
      const boutiqueIds = [...new Set(dto.items.map((i) => i.boutiqueId))];
      for (const boutiqueId of boutiqueIds) {
        const boutique = await tx.boutique.findUnique({ where: { id: boutiqueId } });
        if (boutique?.managerId) {
          await tx.notification.create({
            data: {
              userId: boutique.managerId,
              type: 'order',
              title: 'New Order',
              message: `A new order has been placed`,
              data: { orderId: order.id, total },
            },
          });
        }
      }

      return order;
    });

    return this.toOrderResponse(created);
  }

  async findAll(userId: string, query: PaginationDto & { status?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId, deletedAt: null };
    if (query.status) where.status = query.status;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: await Promise.all(orders.map((order) => this.toOrderResponse(order))),
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
    const order = await this.prisma.order.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.toOrderResponse(order);
  }

  async cancel(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (!['pending', 'paid'].includes(order.status)) {
      throw new BadRequestException('Only pending or paid orders can be cancelled');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: { status: 'cancelled' },
      });

      // Restore stock
      const items = order.items as any[];
      for (const item of items) {
        const stockItem = await tx.stockItem.findFirst({
          where: { productId: item.productId, boutiqueId: item.boutiqueId, deletedAt: null },
        });
        if (stockItem) {
          await tx.stockItem.update({
            where: { id: stockItem.id },
            data: { quantity: { increment: item.quantity } },
          });
        }

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            boutiqueId: item.boutiqueId,
            type: 'in',
            reason: 'return',
            quantity: item.quantity,
            referenceId: id,
            referenceType: 'order',
            createdBy: userId,
          },
        });
      }

      // Refund wallet if paid with wallet
      if (order.paymentMethod === 'wallet' && order.paymentStatus === 'paid') {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (wallet) {
          const updatedWallet = await tx.wallet.update({
            where: { userId },
            data: { balance: { increment: order.total } },
          });

          await tx.walletTransaction.create({
            data: {
              walletId: updatedWallet.id,
              type: 'refund',
              amount: order.total,
              balanceAfter: updatedWallet.balance,
              referenceId: id,
              referenceType: 'order',
              note: 'Order cancellation refund',
            },
          });
        }
      }

      return updated;
    });
  }

  /**
   * Maps a raw `Order` row to the flat frontend read-model:
   * { id, reference, productName, productImage, amount, currency, status, createdAt, seller }
   *
   * `Order` has no `reference`/`productName`/`productImage`/`currency`/`seller` columns, so
   * these are derived here:
   *  - reference: synthesized deterministically from the id ('ORD-' + first 8 chars, uppercased).
   *  - productName/productImage: `items` (Json) only stores {productId, quantity, unitPrice,
   *    boutiqueId} per line (see `create()` above) — no name/image is persisted on the order
   *    itself — so we look up the first item's Product for its name/images.
   *  - currency/seller: best-effort resolved from the first item's boutique (boutiqueId is
   *    stored directly on each item). Order does not track a currency at all today; if the
   *    boutique lookup fails for any reason we fall back to 'USD'.
   */
  private async toOrderResponse(order: Order): Promise<OrderResponseDto> {
    const items = Array.isArray(order.items) ? (order.items as any[]) : [];
    const firstItem = items[0];

    let productName = 'Unknown product';
    let productImage: string | null = null;
    // NOTE: Order has no currency column — 'USD' is a placeholder default when the
    // first item's boutique can't be resolved.
    let currency = 'USD';
    let seller: string | null = null;

    if (firstItem) {
      const [product, boutique] = await Promise.all([
        firstItem.productId
          ? this.prisma.product.findUnique({
              where: { id: firstItem.productId },
              select: { name: true, images: true },
            })
          : null,
        firstItem.boutiqueId
          ? this.prisma.boutique.findUnique({
              where: { id: firstItem.boutiqueId },
              select: { name: true, currency: true },
            })
          : null,
      ]);

      const firstItemName = product?.name ?? 'Unknown product';
      productName =
        items.length > 1 ? `${firstItemName} +${items.length - 1} more` : firstItemName;
      productImage = product?.images?.[0] ?? null;

      if (boutique) {
        currency = boutique.currency;
        seller = boutique.name;
      }
    }

    return {
      id: order.id,
      reference: `ORD-${order.id.slice(0, 8).toUpperCase()}`,
      productName,
      productImage,
      amount: Number(order.total),
      currency,
      status: order.status,
      createdAt: order.createdAt,
      seller,
    };
  }
}
