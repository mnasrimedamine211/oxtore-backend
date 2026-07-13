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
import { StockRequestsService } from './stock-requests.service';
import { CreateStockRequestDto } from './dto/create-stock-request.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('Stock Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stock-requests')
export class StockRequestsController {
  constructor(private readonly stockRequestsService: StockRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a stock request' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateStockRequestDto) {
    return this.stockRequestsService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List stock requests (filter by type: sent/received, boutiqueId, status)' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: PaginationDto & { type?: 'sent' | 'received'; boutiqueId?: string; status?: string },
  ) {
    return this.stockRequestsService.findAll(user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get stock request by ID' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.stockRequestsService.findOne(user.sub, id);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve stock request (receiver only)' })
  approve(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.stockRequestsService.approve(user.sub, id);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject stock request (receiver only)' })
  reject(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.stockRequestsService.reject(user.sub, id, reason);
  }

  @Patch(':id/fulfill')
  @ApiOperation({ summary: 'Fulfill stock request (transactional: stock transfer + movements + notification)' })
  fulfill(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.stockRequestsService.fulfill(user.sub, id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel stock request (requester only)' })
  cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.stockRequestsService.cancel(user.sub, id);
  }
}
