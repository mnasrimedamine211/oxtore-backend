import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create an order (checkout: stock decrease + movements + wallet payment + notification)' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List user orders' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: PaginationDto & { status?: string },
  ) {
    return this.ordersService.findAll(user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ordersService.findOne(user.sub, id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel order (restores stock, refunds wallet)' })
  cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ordersService.cancel(user.sub, id);
  }
}
