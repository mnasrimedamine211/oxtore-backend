import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class DiscoverableBoutiquesDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      'User id to check ownership/management against. Defaults to the current authenticated user.',
  })
  @IsOptional()
  @IsString()
  excludeUserId?: string;
}
