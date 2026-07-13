import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { WalletOperationDto } from './dto/wallet-operation.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  async getWallet(userId: string) {
    let wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await this.prisma.wallet.create({ data: { userId } });
    }
    return wallet;
  }

  async getTransactions(userId: string, query: PaginationDto) {
    const wallet = await this.getWallet(userId);
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { walletId: wallet.id };
    if ((query as any).type) where.type = (query as any).type;

    const [transactions, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.walletTransaction.count({ where }),
    ]);

    return {
      data: transactions,
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

  async deposit(userId: string, dto: WalletOperationDto) {
    return this.processTransaction(userId, 'deposit', dto.amount, dto.note);
  }

  async withdraw(userId: string, dto: WalletOperationDto) {
    const wallet = await this.getWallet(userId);
    if (Number(wallet.balance) < dto.amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }
    return this.processTransaction(userId, 'withdrawal', -dto.amount, dto.note);
  }

  async adjust(userId: string, dto: WalletOperationDto) {
    return this.processTransaction(userId, 'adjustment', dto.amount, dto.note);
  }

  private async processTransaction(userId: string, type: string, amount: number, note?: string) {
    const wallet = await this.getWallet(userId);
    const newBalance = Number(wallet.balance) + amount;
    if (newBalance < 0) {
      throw new BadRequestException('Resulting balance cannot be negative');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { userId },
        data: { balance: newBalance },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: updatedWallet.id,
          type: type as any,
          amount,
          balanceAfter: updatedWallet.balance,
          note,
        },
      });

      // Notify user
      await tx.notification.create({
        data: {
          userId,
          type: 'wallet',
          title: 'Wallet Transaction',
          message: `${type} of ${Math.abs(amount)}`,
          data: { transactionId: transaction.id, amount, balance: updatedWallet.balance },
        },
      });

      return transaction;
    });
  }
}
