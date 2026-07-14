import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { WalletOperationDto } from './dto/wallet-operation.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

// NOTE: like OrdersController, this controller has no class-level `@Controller('wallet')`
// prefix — explicit per-route paths are used instead so both the existing `/wallet` routes and
// the new `/users/:userId/wallet` routes can live here without touching wallet.module.ts or
// app.module.ts.
@ApiTags('Wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('wallet')
  @ApiOperation({ summary: 'Get user wallet balance + recent transactions' })
  getWallet(@CurrentUser() user: JwtPayload) {
    return this.walletService.getWallet(user.sub);
  }

  @Get('wallet/transactions')
  @ApiOperation({ summary: 'List wallet transactions' })
  getTransactions(
    @CurrentUser() user: JwtPayload,
    @Query() query: PaginationDto,
  ) {
    return this.walletService.getTransactions(user.sub, query);
  }

  @Post('wallet/deposit')
  @ApiOperation({ summary: 'Deposit to wallet' })
  deposit(@CurrentUser() user: JwtPayload, @Body() dto: WalletOperationDto) {
    return this.walletService.deposit(user.sub, dto);
  }

  @Post('wallet/withdraw')
  @ApiOperation({ summary: 'Withdraw from wallet' })
  withdraw(@CurrentUser() user: JwtPayload, @Body() dto: WalletOperationDto) {
    return this.walletService.withdraw(user.sub, dto);
  }

  @Get('users/:userId/wallet')
  @ApiOperation({ summary: "Get a specific user's wallet balance + recent transactions (self or admin only)" })
  getWalletForUser(@CurrentUser() user: JwtPayload, @Param('userId') userId: string) {
    this.assertSelfOrAdmin(user, userId);
    return this.walletService.getWallet(userId);
  }

  @Get('users/:userId/wallet/transactions')
  @ApiOperation({ summary: "List a specific user's wallet transactions (self or admin only)" })
  getTransactionsForUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Query() query: PaginationDto,
  ) {
    this.assertSelfOrAdmin(user, userId);
    return this.walletService.getTransactions(userId, query);
  }

  private assertSelfOrAdmin(user: JwtPayload, userId: string) {
    if (user.sub !== userId && user.role !== 'ADMIN') {
      throw new ForbiddenException('You are not allowed to access this resource');
    }
  }
}
