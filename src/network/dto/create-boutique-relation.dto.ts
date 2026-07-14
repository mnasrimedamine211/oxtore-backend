import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BoutiqueRelationType } from '@prisma/client';

export class CreateBoutiqueRelationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fromBoutiqueId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  toBoutiqueId: string;

  @ApiProperty({ enum: BoutiqueRelationType })
  @IsEnum(BoutiqueRelationType)
  type: BoutiqueRelationType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  approvedBy: string;
}
