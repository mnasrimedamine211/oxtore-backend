import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Param,
  Post,
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

  @Patch('me/settings')
  @ApiOperation({ summary: 'Update user settings (language, currency, notifications)' })
  updateSettings(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.usersService.updateSettings(user.sub, dto);
  }

  @Get('me/stats')
  @ApiOperation({ summary: 'Get user statistics (sales, products, boutiques, wallet)' })
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
}
