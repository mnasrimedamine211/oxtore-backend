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
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductStockDto } from './dto/update-product-stock.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('boutiques/:boutiqueId/products')
  @ApiOperation({ summary: 'Create a product in a boutique' })
  create(
    @CurrentUser() user: JwtPayload,
    @Param('boutiqueId') boutiqueId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.create(user.sub, boutiqueId, dto);
  }

  @Get('boutiques/:boutiqueId/products')
  @ApiOperation({ summary: 'List products for a boutique (filter by category, isActive)' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Param('boutiqueId') boutiqueId: string,
    @Query() query: PaginationDto & { category?: string; isActive?: string },
  ) {
    const parsed = {
      ...query,
      isActive: query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined,
    };
    return this.productsService.findAll(user.sub, boutiqueId, parsed);
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get product by ID' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.productsService.findOne(user.sub, id);
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Update product' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(user.sub, id, dto);
  }

  @Patch('products/:id/stock')
  @ApiOperation({ summary: 'Decrement product stock after a sale' })
  updateStock(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProductStockDto,
  ) {
    return this.productsService.updateStock(user.sub, id, dto);
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Soft delete product' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.productsService.remove(user.sub, id);
  }
}
