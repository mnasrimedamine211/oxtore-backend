import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryStockRequestsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['sent', 'received'] })
  @IsOptional()
  @IsIn(['sent', 'received'])
  type?: 'sent' | 'received';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  boutiqueId?: string;

  @ApiPropertyOptional({ description: 'Comma-separated boutique ids' })
  @IsOptional()
  @IsString()
  boutiqueIds?: string;

  @ApiPropertyOptional({ enum: ['PENDING', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED'] })
  @IsOptional()
  @IsString()
  status?: string;
}
