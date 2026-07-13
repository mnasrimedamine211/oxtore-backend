import { IsNumber, Min, IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WalletOperationDto {
  @ApiProperty({ minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ enum: ['deposit', 'withdrawal', 'adjustment'] })
  @IsOptional()
  @IsIn(['deposit', 'withdrawal', 'adjustment'])
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
