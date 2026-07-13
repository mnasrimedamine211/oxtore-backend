import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEmployeeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({ enum: ['ADMIN', 'MANAGER', 'SUPERVISOR', 'SELLER', 'USER'] })
  @IsOptional()
  @IsIn(['ADMIN', 'MANAGER', 'SUPERVISOR', 'SELLER', 'USER'])
  role?: string;

  @ApiPropertyOptional({ enum: ['active', 'inactive', 'pending'] })
  @IsOptional()
  @IsIn(['active', 'inactive', 'pending'])
  status?: string;
}
