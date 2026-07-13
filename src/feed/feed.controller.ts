import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FeedService } from './feed.service';
import { CursorPaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('Feed')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get('products')
  @ApiOperation({ summary: 'Get product feed (cursor pagination, includes like status)' })
  getFeed(@CurrentUser() user: JwtPayload, @Query() query: CursorPaginationDto) {
    return this.feedService.getFeed(user.sub, query);
  }

  @Post('products/:id/like')
  @ApiOperation({ summary: 'Toggle like on a product (per-user tracking)' })
  toggleLike(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.feedService.toggleLike(user.sub, id);
  }

  @Get('products/liked')
  @ApiOperation({ summary: 'Get liked products (cursor pagination)' })
  getLiked(@CurrentUser() user: JwtPayload, @Query() query: CursorPaginationDto) {
    return this.feedService.getLikedProducts(user.sub, query);
  }
}
