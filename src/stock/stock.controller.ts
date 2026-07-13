import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { StockService } from './stock.service';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { UpdateStockItemDto } from './dto/update-stock-item.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('Stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post('items')
  @ApiOperation({ summary: 'Create a stock item' })
  createItem(@CurrentUser() user: JwtPayload, @Body() dto: CreateStockItemDto) {
    return this.stockService.createStockItem(user.sub, dto);
  }

  @Get('items')
  @ApiOperation({ summary: 'List stock items for a boutique' })
  findAllItems(
    @CurrentUser() user: JwtPayload,
    @Query('boutiqueId') boutiqueId: string,
    @Query() query: PaginationDto,
  ) {
    return this.stockService.findAll(user.sub, boutiqueId, query);
  }

  @Get('items/:id')
  @ApiOperation({ summary: 'Get stock item by ID' })
  findOneItem(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.stockService.findOne(user.sub, id);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Update stock item' })
  updateItem(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateStockItemDto,
  ) {
    return this.stockService.update(user.sub, id, dto);
  }

  @Delete('items/:id')
  @ApiOperation({ summary: 'Soft delete stock item' })
  removeItem(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.stockService.remove(user.sub, id);
  }

  @Post('adjust')
  @ApiOperation({ summary: 'Adjust stock (in/out) with inventory movement' })
  adjust(@CurrentUser() user: JwtPayload, @Body() dto: AdjustStockDto) {
    return this.stockService.adjustStock(user.sub, dto);
  }

  @Get('movements')
  @ApiOperation({ summary: 'List inventory movements for a boutique' })
  getMovements(
    @CurrentUser() user: JwtPayload,
    @Query('boutiqueId') boutiqueId: string,
    @Query() query: PaginationDto,
  ) {
    return this.stockService.getMovements(user.sub, boutiqueId, query);
  }

  @Get('low')
  @ApiOperation({ summary: 'Get low stock items for a boutique' })
  getLowStock(
    @CurrentUser() user: JwtPayload,
    @Query('boutiqueId') boutiqueId: string,
  ) {
    return this.stockService.getLowStock(user.sub, boutiqueId);
  }
}
