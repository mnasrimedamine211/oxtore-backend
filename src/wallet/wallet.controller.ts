import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { WalletOperationDto } from './dto/wallet-operation.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('Wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'Get user wallet balance' })
  getWallet(@CurrentUser() user: JwtPayload) {
    return this.walletService.getWallet(user.sub);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List wallet transactions' })
  getTransactions(
    @CurrentUser() user: JwtPayload,
    @Query() query: PaginationDto,
  ) {
    return this.walletService.getTransactions(user.sub, query);
  }

  @Post('deposit')
  @ApiOperation({ summary: 'Deposit to wallet' })
  deposit(@CurrentUser() user: JwtPayload, @Body() dto: WalletOperationDto) {
    return this.walletService.deposit(user.sub, dto);
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Withdraw from wallet' })
  withdraw(@CurrentUser() user: JwtPayload, @Body() dto: WalletOperationDto) {
    return this.walletService.withdraw(user.sub, dto);
  }
}
