import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBoutiqueRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  requesterId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  receiverId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;
}
