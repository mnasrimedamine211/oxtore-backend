import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Flat, frontend-facing read model for an Order.
 *
 * The `Order` table has no `reference`, `productName`, `productImage`,
 * `currency` or `seller` columns — these are all derived at read time from
 * `items` (Json) plus a best-effort lookup of the first item's Product /
 * Boutique. See OrdersService.toOrderResponse() for the derivation logic.
 */
export class OrderResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: "Derived order number, e.g. 'ORD-3FA85F64' (no reference column exists on Order)" })
  reference: string;

  @ApiProperty()
  productName: string;

  @ApiPropertyOptional({ nullable: true })
  productImage: string | null;

  @ApiProperty()
  amount: number;

  @ApiProperty({ description: "Best-effort currency resolved from the first item's boutique; defaults to 'USD' since Order does not track currency" })
  currency: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({ nullable: true, description: "Boutique name for the first item's boutique" })
  seller: string | null;
}
