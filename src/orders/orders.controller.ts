import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

// NOTE: this controller intentionally has no class-level `@Controller('orders')` prefix.
// Explicit paths are used per-route instead so that both the existing `/orders` routes and
// the new `/users/:userId/orders` routes can live on the same controller/module without
// touching orders.module.ts or app.module.ts.
@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('orders')
  @ApiOperation({ summary: 'Create an order (checkout: stock decrease + movements + wallet payment + notification)' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.sub, dto);
  }

  @Get('orders')
  @ApiOperation({ summary: 'List user orders' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: PaginationDto & { status?: string },
  ) {
    return this.ordersService.findAll(user.sub, query);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get order by ID' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ordersService.findOne(user.sub, id);
  }

  @Patch('orders/:id/cancel')
  @ApiOperation({ summary: 'Cancel order (restores stock, refunds wallet)' })
  cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ordersService.cancel(user.sub, id);
  }

  @Get('users/:userId/orders')
  @ApiOperation({ summary: "List a specific user's orders (self or admin only)" })
  findAllForUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Query() query: PaginationDto & { status?: string },
  ) {
    this.assertSelfOrAdmin(user, userId);
    return this.ordersService.findAll(userId, query);
  }

  @Get('users/:userId/orders/:orderId')
  @ApiOperation({ summary: "Get a specific user's order by ID (self or admin only)" })
  findOneForUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Param('orderId') orderId: string,
  ) {
    this.assertSelfOrAdmin(user, userId);
    return this.ordersService.findOne(userId, orderId);
  }

  private assertSelfOrAdmin(user: JwtPayload, userId: string) {
    if (user.sub !== userId && user.role !== 'ADMIN') {
      throw new ForbiddenException('You are not allowed to access this resource');
    }
  }
}
