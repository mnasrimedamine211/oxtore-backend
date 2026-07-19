import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { QueryAdminBoutiquesDto } from './dto/query-admin-boutiques.dto';
import { QueryAdminUsersDto } from './dto/query-admin-users.dto';
import { RejectBoutiqueDto } from './dto/reject-boutique.dto';
import { UpdateBoutiqueDto } from '../boutiques/dto/update-boutique.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { OrdersService } from '../orders/orders.service';
import { QueryOrdersDto } from '../orders/dto/query-orders.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly ordersService: OrdersService,
  ) {}

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
  getBoutiques(@Query() query: QueryAdminBoutiquesDto) {
    return this.adminService.getBoutiques(query);
  }

  @Patch('boutiques/:id/approve')
  @ApiOperation({ summary: 'Approve a boutique (admin only)' })
  approveBoutique(@CurrentUser() admin: JwtPayload, @Param('id') id: string) {
    return this.adminService.approveBoutique(id, admin.sub);
  }

  @Patch('boutiques/:id/reject')
  @ApiOperation({ summary: 'Reject a boutique with a reason (admin only)' })
  rejectBoutique(
    @CurrentUser() admin: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RejectBoutiqueDto,
  ) {
    return this.adminService.rejectBoutique(id, admin.sub, dto.reason);
  }

  @Patch('boutiques/:id/suspend')
  @ApiOperation({ summary: 'Suspend a boutique (admin only)' })
  suspendBoutique(@Param('id') id: string) {
    return this.adminService.suspendBoutique(id);
  }

  @Patch('boutiques/:id')
  @ApiOperation({ summary: 'Edit any boutique (admin only)' })
  updateBoutique(@Param('id') id: string, @Body() dto: UpdateBoutiqueDto) {
    return this.adminService.updateBoutique(id, dto);
  }

  @Delete('boutiques/:id')
  @ApiOperation({ summary: 'Delete any boutique (admin only)' })
  deleteBoutique(@Param('id') id: string) {
    return this.adminService.deleteBoutique(id);
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users (admin only)' })
  getUsers(@Query() query: QueryAdminUsersDto) {
    return this.adminService.getUsers(query);
  }

  @Get('orders')
  @ApiOperation({ summary: 'List all orders across the platform (admin only)' })
  getOrders(@Query() query: QueryOrdersDto) {
    return this.ordersService.findAllAdmin(query);
  }
}
