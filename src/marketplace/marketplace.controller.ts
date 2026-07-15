import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MarketplaceService } from './marketplace.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { QueryMarketplaceProductsDto } from './dto/query-marketplace-products.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Marketplace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('products')
  @ApiOperation({ summary: 'Browse marketplace products (all active products from all boutiques)' })
  getProducts(@Query() query: QueryMarketplaceProductsDto) {
    const parsed = {
      ...query,
      minPrice: query.minPrice ? parseFloat(query.minPrice) : undefined,
      maxPrice: query.maxPrice ? parseFloat(query.maxPrice) : undefined,
    };
    return this.marketplaceService.getProducts(parsed);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all product categories' })
  getCategories() {
    return this.marketplaceService.getCategories();
  }

  @Get('boutiques')
  @ApiOperation({ summary: 'Browse all active boutiques' })
  getBoutiques(@Query() query: PaginationDto) {
    return this.marketplaceService.getBoutiques(query);
  }
}
