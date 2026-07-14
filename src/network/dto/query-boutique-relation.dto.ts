import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryBoutiqueRelationDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  boutiqueId?: string;
}
