import { IsEmail, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'email', enum: ['email', 'whatsapp'] })
  @IsIn(['email', 'whatsapp'])
  method: 'email' | 'whatsapp';
}
