import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  user: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    avatar: string | null;
    role: string;
    ownedBoutiqueIds: string[];
    activeBoutiqueId: string | null;
    permissions: string[];
    isVerified: boolean;
    createdAt: Date;
  };
}
