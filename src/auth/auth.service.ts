import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../database/prisma.service';
import { OtpService } from './services/otp.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { JwtPayload } from '../common/decorators/current-user.decorator';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private otpService: OtpService,
  ) {
    this.googleClient = new OAuth2Client(
      this.configService.get<string>('google.clientId'),
    );
  }

  async signup(dto: SignupDto) {
    const existing = await this.prisma.profile.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await argon2.hash(dto.password);

    const profile = await this.prisma.profile.create({
      data: {
        id: crypto.randomUUID(),
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        role: 'USER',
        isVerified: false,
      },
    });

    // Password hash is stored in metadata since profiles has no dedicated password column
    await this.prisma.profile.update({
      where: { id: profile.id },
      data: { metadata: { hashedPassword } as any },
    });

    // OTP is no longer auto-sent here — the frontend shows a delivery-method picker
    // (email/WhatsApp) after signup, which explicitly calls sendOtp() below.
    const tokens = await this.generateTokens(profile);

    return {
      ...tokens,
      user: await this.formatUser(profile),
    };
  }

  async login(dto: LoginDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { email: dto.email },
    });
    if (!profile) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const metadata = profile.metadata as any;
    const storedHash = metadata?.hashedPassword;
    if (!storedHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(storedHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(profile);
    return {
      ...tokens,
      user: await this.formatUser(profile),
    };
  }

  async logout(userId: string) {
    // In a stateless JWT setup, logout is client-side (discard tokens).
    // For server-side revocation, we'd maintain a token blacklist in Redis.
    return { message: 'Logged out successfully' };
  }

  async refreshToken(dto: RefreshTokenDto) {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(dto.refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      const profile = await this.prisma.profile.findUnique({
        where: { id: payload.sub },
      });
      if (!profile) {
        throw new UnauthorizedException('User not found');
      }

      const tokens = await this.generateTokens(profile);
      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { email: dto.email },
    });
    if (!profile) {
      // Don't reveal whether email exists
      return { message: 'If the email exists, a reset code has been sent' };
    }

    const code = this.otpService.generateOtpCode();
    await this.storeOtp(profile.id, code, 'reset');

    const channel = profile.phone ? 'whatsapp' : 'email';
    if (channel === 'whatsapp' && profile.phone) {
      await this.otpService.sendOtp(profile.phone, code, 'whatsapp');
    } else {
      await this.otpService.sendOtp(profile.email, code, 'email');
    }

    return { message: 'If the email exists, a reset code has been sent' };
  }

  /** Sends (or resends) the signup verification code via the caller's chosen channel. */
  async sendOtp(dto: SendOtpDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { email: dto.email },
    });
    if (!profile) {
      throw new NotFoundException('User not found');
    }
    if (dto.method === 'whatsapp' && !profile.phone) {
      throw new BadRequestException('No phone number on file for WhatsApp delivery');
    }

    const code = this.otpService.generateOtpCode();
    await this.storeOtp(profile.id, code, 'email');

    const to = dto.method === 'whatsapp' ? profile.phone! : profile.email;
    await this.otpService.sendOtp(to, code, dto.method);

    return { expiresIn: 600 };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { email: dto.email },
    });
    if (!profile) {
      throw new NotFoundException('User not found');
    }

    const isValid = await this.verifyStoredOtp(profile.id, dto.code, 'email');
    if (!isValid) {
      throw new BadRequestException('Invalid or expired OTP code');
    }

    await this.prisma.profile.update({
      where: { id: profile.id },
      data: { isVerified: true },
    });

    return { message: 'Email verified successfully' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { email: dto.email },
    });
    if (!profile) {
      throw new NotFoundException('User not found');
    }

    const isValid = await this.verifyStoredOtp(profile.id, dto.code, 'reset');
    if (!isValid) {
      throw new BadRequestException('Invalid or expired OTP code');
    }

    const hashedPassword = await argon2.hash(dto.newPassword);
    const metadata = { ...(profile.metadata as any), hashedPassword };

    await this.prisma.profile.update({
      where: { id: profile.id },
      data: { metadata },
    });

    return { message: 'Password reset successfully' };
  }

  async googleLogin(dto: GoogleLoginDto) {
    let ticket;
    try {
      ticket = await this.googleClient.verifyIdToken({
        idToken: dto.idToken,
        audience: this.configService.get<string>('google.clientId'),
      });
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }

    const googlePayload = ticket.getPayload();
    if (!googlePayload || !googlePayload.email) {
      throw new UnauthorizedException('Invalid Google token payload');
    }

    let profile = await this.prisma.profile.findUnique({
      where: { email: googlePayload.email },
    });

    if (!profile) {
      profile = await this.prisma.profile.create({
        data: {
          id: crypto.randomUUID(),
          fullName: googlePayload.name || googlePayload.email.split('@')[0],
          email: googlePayload.email,
          avatar: googlePayload.picture || null,
          role: 'USER',
          isVerified: true,
          metadata: { googleSub: googlePayload.sub } as any,
        },
      });
    } else {
      const metadata = {
        ...(profile.metadata as any),
        googleSub: googlePayload.sub,
      };
      profile = await this.prisma.profile.update({
        where: { id: profile.id },
        data: { isVerified: true, metadata, avatar: profile.avatar || googlePayload.picture || null },
      });
    }

    const tokens = await this.generateTokens(profile);
    return {
      ...tokens,
      user: await this.formatUser(profile),
    };
  }

  async completeProfile(userId: string, dto: CompleteProfileDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
    });
    if (!profile) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.profile.update({
      where: { id: userId },
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        avatar: dto.avatar,
      },
    });

    return this.formatUser(updated);
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================
  // NOTE: formatUser is async because it needs to query the user's
  // BoutiqueOwner rows to build ownedBoutiqueIds.

  private async generateTokens(profile: any) {
    const payload: JwtPayload = {
      sub: profile.id,
      email: profile.email,
      role: profile.role,
      boutiqueId: profile.activeBoutiqueId || undefined,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: this.configService.get<string>('jwt.expiresIn'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async formatUser(profile: any) {
    const ownedBoutiques = await this.prisma.boutiqueOwner.findMany({
      where: { userId: profile.id },
      select: { boutiqueId: true },
    });

    return {
      id: profile.id,
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      avatar: profile.avatar,
      role: profile.role,
      ownedBoutiqueIds: ownedBoutiques.map((o) => o.boutiqueId),
      activeBoutiqueId: profile.activeBoutiqueId,
      permissions: profile.permissions,
      isVerified: profile.isVerified,
      createdAt: profile.createdAt,
    };
  }

  private async storeOtp(userId: string, code: string, type: string) {
    // Store OTP in a simple table or cache. For production, use Redis.
    // Here we use a lightweight approach with the database.
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const key = `otp:${userId}:${type}`;

    // We'll use a simple approach: store in a temporary table
    // For now, we use an in-memory map (acceptable for dev, Redis for prod)
    // In production, this would be Redis with TTL
    this.otpStore.set(key, { code, expiresAt });
  }

  private async verifyStoredOtp(userId: string, code: string, type: string): Promise<boolean> {
    const key = `otp:${userId}:${type}`;
    const stored = this.otpStore.get(key);

    if (!stored) return false;
    if (stored.expiresAt < new Date()) {
      this.otpStore.delete(key);
      return false;
    }
    if (stored.code !== code) return false;

    this.otpStore.delete(key);
    return true;
  }

  // Simple in-memory OTP store (replaced by Redis in production)
  private otpStore = new Map<string, { code: string; expiresAt: Date }>();
}
