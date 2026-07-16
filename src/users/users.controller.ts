import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Param,
  Post,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.usersService.getProfile(user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Get('me/settings')
  @ApiOperation({ summary: 'Get current user settings (language, currency, notifications)' })
  getSettings(@CurrentUser() user: JwtPayload) {
    return this.usersService.getSettings(user.sub);
  }

  @Patch('me/settings')
  @ApiOperation({ summary: 'Update user settings (language, currency, notifications)' })
  updateSettings(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.usersService.updateSettings(user.sub, dto);
  }

  // NOTE: the frontend contract wants buyer-facing stats here
  // ({ ordersCount, wishlistCount, rating }); see the comment above
  // UsersService.getStats for why that isn't implemented yet.
  @Get('me/stats')
  @ApiOperation({ summary: 'Get user statistics (sales, products, boutiques)' })
  getStats(@CurrentUser() user: JwtPayload) {
    return this.usersService.getStats(user.sub);
  }

  @Post('me/active-boutique/:boutiqueId')
  @ApiOperation({ summary: 'Set active boutique for current user' })
  setActiveBoutique(
    @CurrentUser() user: JwtPayload,
    @Param('boutiqueId') boutiqueId: string,
  ) {
    return this.usersService.setActiveBoutique(user.sub, boutiqueId);
  }

  // ============================================
  // Self-or-admin :userId variants
  // ============================================

  @Get(':userId')
  @ApiOperation({ summary: 'Get a user profile by id (self or admin)' })
  getProfileById(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
  ) {
    this.assertSelfOrAdmin(user, userId);
    return this.usersService.getProfile(userId);
  }

  @Patch(':userId')
  @ApiOperation({ summary: 'Update a user profile by id (self or admin)' })
  updateProfileById(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    this.assertSelfOrAdmin(user, userId);
    return this.usersService.updateProfile(userId, dto);
  }

  @Get(':userId/settings')
  @ApiOperation({ summary: 'Get a user settings by id (self or admin)' })
  getSettingsById(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
  ) {
    this.assertSelfOrAdmin(user, userId);
    return this.usersService.getSettings(userId);
  }

  @Patch(':userId/settings')
  @ApiOperation({ summary: 'Update a user settings by id (self or admin)' })
  updateSettingsById(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    this.assertSelfOrAdmin(user, userId);
    return this.usersService.updateSettings(userId, dto);
  }

  // NOTE: the frontend contract wants buyer-facing stats here
  // ({ ordersCount, wishlistCount, rating }); see the comment above
  // UsersService.getStats for why that isn't implemented yet.
  @Get(':userId/stats')
  @ApiOperation({ summary: 'Get a user statistics by id (self or admin)' })
  getStatsById(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
  ) {
    this.assertSelfOrAdmin(user, userId);
    return this.usersService.getStats(userId);
  }

  private assertSelfOrAdmin(user: JwtPayload, userId: string) {
    if (user.sub !== userId && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'You do not have access to this resource',
      );
    }
  }
}
