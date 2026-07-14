import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { Wallet, WalletTransaction } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { WalletOperationDto } from './dto/wallet-operation.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { WalletResponseDto, WalletTransactionResponseDto } from './dto/wallet-response.dto';

type ContractTransactionType = 'deposit' | 'withdrawal' | 'transfer' | 'profit' | 'fee';

const RECENT_TRANSACTIONS_LIMIT = 20;

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  async getWallet(userId: string): Promise<WalletResponseDto> {
    const wallet = await this.findOrCreateWallet(userId);
    const transactions = await this.prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: RECENT_TRANSACTIONS_LIMIT,
    });
    return this.toWalletResponse(wallet, transactions);
  }

  async getTransactions(userId: string, query: PaginationDto) {
    const wallet = await this.findOrCreateWallet(userId);
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
      data: transactions.map((t) => this.toTransactionResponse(t, wallet.currency)),
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

  async deposit(userId: string, dto: WalletOperationDto): Promise<WalletTransactionResponseDto> {
    const { wallet, transaction } = await this.processTransaction(
      userId,
      'deposit',
      dto.amount,
      dto.note,
    );
    return this.toTransactionResponse(transaction, wallet.currency);
  }

  async withdraw(userId: string, dto: WalletOperationDto): Promise<WalletTransactionResponseDto> {
    const wallet = await this.findOrCreateWallet(userId);
    if (Number(wallet.balance) < dto.amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }
    const { transaction } = await this.processTransaction(
      userId,
      'withdrawal',
      -dto.amount,
      dto.note,
    );
    return this.toTransactionResponse(transaction, wallet.currency);
  }

  async adjust(userId: string, dto: WalletOperationDto): Promise<WalletTransactionResponseDto> {
    const { wallet, transaction } = await this.processTransaction(
      userId,
      'adjustment',
      dto.amount,
      dto.note,
    );
    return this.toTransactionResponse(transaction, wallet.currency);
  }

  private async findOrCreateWallet(userId: string): Promise<Wallet> {
    let wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await this.prisma.wallet.create({ data: { userId } });
    }
    return wallet;
  }

  private async processTransaction(
    userId: string,
    type: string,
    amount: number,
    note?: string,
  ): Promise<{ wallet: Wallet; transaction: WalletTransaction }> {
    const wallet = await this.findOrCreateWallet(userId);
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

      return { wallet: updatedWallet, transaction };
    });
  }

  /**
   * Maps the raw `Wallet` row + its most recent transactions to the frontend contract shape:
   * { balance: {...}, transactions: [...] }
   */
  private toWalletResponse(
    wallet: Wallet,
    transactions: WalletTransaction[],
  ): WalletResponseDto {
    return {
      balance: {
        total: Number(wallet.total),
        available: Number(wallet.available),
        margin: Number(wallet.margin),
        blocked: Number(wallet.blocked),
        currency: wallet.currency,
        monthlyGain: Number(wallet.monthlyGain),
        monthlyGainPercent: Number(wallet.monthlyGainPercent),
      },
      transactions: transactions.map((t) => this.toTransactionResponse(t, wallet.currency)),
    };
  }

  /**
   * Maps a raw `WalletTransaction` row to { id, type, label, date, amount, currency }.
   * WalletTransaction has no `currency` column of its own — it always uses the parent wallet's.
   */
  private toTransactionResponse(
    transaction: WalletTransaction,
    currency: string,
  ): WalletTransactionResponseDto {
    return {
      id: transaction.id,
      type: this.resolveContractType(transaction),
      label:
        transaction.note && transaction.note.trim().length > 0
          ? transaction.note
          : this.defaultLabel(transaction.type),
      date: transaction.createdAt,
      amount: Number(transaction.amount),
      currency,
    };
  }

  /**
   * `typeV2` exists on the schema for the contract's 5-value enum but is never actually written
   * by processTransaction() above or by orders.service.ts's walletTransaction.create() calls —
   * both only ever set the legacy `type` column. We still prefer typeV2 when present (in case it
   * gets populated in the future / by another writer) and otherwise derive from legacy `type`.
   */
  private resolveContractType(transaction: WalletTransaction): ContractTransactionType {
    if (transaction.typeV2) {
      return transaction.typeV2 as ContractTransactionType;
    }

    switch (transaction.type) {
      case 'deposit':
        return 'deposit';
      case 'withdrawal':
        return 'withdrawal';
      case 'sale_credit':
        return 'profit';
      case 'sale_debit':
        return 'fee';
      case 'refund':
        return 'transfer';
      case 'adjustment':
        return 'fee';
      case 'order_payment':
        return 'fee';
      default:
        return 'fee';
    }
  }

  private defaultLabel(type: WalletTransaction['type']): string {
    switch (type) {
      case 'deposit':
        return 'Deposit';
      case 'withdrawal':
        return 'Withdrawal';
      case 'sale_credit':
        return 'Commission credit';
      case 'sale_debit':
        return 'Sale debit';
      case 'refund':
        return 'Refund';
      case 'adjustment':
        return 'Adjustment';
      case 'order_payment':
        return 'Order payment';
      default:
        return 'Transaction';
    }
  }
}
