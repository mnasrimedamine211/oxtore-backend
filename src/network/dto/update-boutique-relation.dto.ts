import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BoutiqueRelationStatus } from '@prisma/client';

export class UpdateBoutiqueRelationDto {
  @ApiProperty({ enum: BoutiqueRelationStatus })
  @IsEnum(BoutiqueRelationStatus)
  status: BoutiqueRelationStatus;
}
