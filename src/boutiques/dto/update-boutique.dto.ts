import { PartialType } from '@nestjs/swagger';
import { CreateBoutiqueDto } from './create-boutique.dto';

export class UpdateBoutiqueDto extends PartialType(CreateBoutiqueDto) {}
