import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryBoutiqueRequestDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['sent', 'received'] })
  @IsOptional()
  @IsIn(['sent', 'received'])
  type?: 'sent' | 'received';

  @ApiPropertyOptional({ description: 'Single boutique id (kept for backward compatibility)' })
  @IsOptional()
  @IsString()
  boutiqueId?: string;

  @ApiPropertyOptional({ description: 'Comma-separated boutique ids; matches requests sent-by OR received-by any of them' })
  @IsOptional()
  @IsString()
  boutiqueIds?: string;

  @ApiPropertyOptional({ enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'] })
  @IsOptional()
  @IsString()
  status?: string;
}
