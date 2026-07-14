import { ApiProperty } from '@nestjs/swagger';

export class WalletTransactionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ['deposit', 'withdrawal', 'transfer', 'profit', 'fee'] })
  type: 'deposit' | 'withdrawal' | 'transfer' | 'profit' | 'fee';

  @ApiProperty()
  label: string;

  @ApiProperty()
  date: Date;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  currency: string;
}

export class WalletBalanceDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  available: number;

  @ApiProperty()
  margin: number;

  @ApiProperty()
  blocked: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  monthlyGain: number;

  @ApiProperty()
  monthlyGainPercent: number;
}

export class WalletResponseDto {
  @ApiProperty({ type: WalletBalanceDto })
  balance: WalletBalanceDto;

  @ApiProperty({ type: [WalletTransactionResponseDto] })
  transactions: WalletTransactionResponseDto[];
}
