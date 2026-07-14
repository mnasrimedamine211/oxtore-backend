import { IsIn, IsNumber, IsOptional, IsString, NotEquals } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Body for POST /stock/:productId/movements — a slimmer, path-based alias for
 * the existing POST /stock/adjust endpoint. `boutiqueId` and `reason` are
 * derived server-side (see StockService.adjustStockForProduct).
 */
export class AdjustStockMovementDto {
  @ApiProperty({ enum: ['in', 'out', 'adj'] })
  @IsIn(['in', 'out', 'adj'])
  type: 'in' | 'out' | 'adj';

  @ApiProperty()
  @IsNumber()
  @NotEquals(0)
  qty: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
