import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('Sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a sale (transactional: stock decrease + inventory movement + notification)' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateSaleDto) {
    return this.salesService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List sales for a boutique' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('boutiqueId') boutiqueId: string,
    @Query() query: PaginationDto,
  ) {
    return this.salesService.findAll(user.sub, boutiqueId, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get sales statistics' })
  getStats(
    @CurrentUser() user: JwtPayload,
    @Query('boutiqueId') boutiqueId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.salesService.getStats(user.sub, boutiqueId, dateFrom, dateTo);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sale by ID' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.salesService.findOne(user.sub, id);
  }
}
