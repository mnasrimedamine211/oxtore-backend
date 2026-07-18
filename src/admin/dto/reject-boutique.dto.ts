import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectBoutiqueDto {
  @ApiProperty({ example: 'Missing required business documentation' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
