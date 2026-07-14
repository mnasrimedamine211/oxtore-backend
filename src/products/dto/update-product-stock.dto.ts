import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProductStockDto {
  @ApiProperty({ example: 1, description: 'Quantity sold to decrement from stock' })
  @IsInt()
  @Min(1)
  quantitySold: number;
}
