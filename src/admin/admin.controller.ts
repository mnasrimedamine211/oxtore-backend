import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get platform-wide statistics (admin only)' })
  getStats() {
    return this.adminService.getStats();
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get recent platform activity (admin only)' })
  getRecentActivity(@Query('limit') limit?: string) {
    return this.adminService.getRecentActivity(limit ? parseInt(limit, 10) : 10);
  }

  @Get('boutiques')
  @ApiOperation({ summary: 'List all boutiques (admin only)' })
  getBoutiques(@Query() query: PaginationDto & { status?: string }) {
    return this.adminService.getBoutiques(query);
  }

  @Patch('boutiques/:id/approve')
  @ApiOperation({ summary: 'Approve a boutique (admin only)' })
  approveBoutique(@Param('id') id: string) {
    return this.adminService.approveBoutique(id);
  }

  @Patch('boutiques/:id/suspend')
  @ApiOperation({ summary: 'Suspend a boutique (admin only)' })
  suspendBoutique(@Param('id') id: string) {
    return this.adminService.suspendBoutique(id);
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users (admin only)' })
  getUsers(@Query() query: PaginationDto & { role?: string }) {
    return this.adminService.getUsers(query);
  }
}
