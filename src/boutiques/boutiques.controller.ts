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
import { BoutiquesService } from './boutiques.service';
import { CreateBoutiqueDto } from './dto/create-boutique.dto';
import { UpdateBoutiqueDto } from './dto/update-boutique.dto';
import { DiscoverableBoutiquesDto } from './dto/discoverable-boutiques.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('Boutiques')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('boutiques')
export class BoutiquesController {
  constructor(private readonly boutiquesService: BoutiquesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new boutique' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateBoutiqueDto) {
    return this.boutiquesService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List user boutiques' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: PaginationDto) {
    return this.boutiquesService.findAll(user.sub, query);
  }

  @Get('discoverable')
  @ApiOperation({
    summary:
      'List active boutiques the given user is not already an owner or manager of',
  })
  findDiscoverable(
    @CurrentUser() user: JwtPayload,
    @Query() query: DiscoverableBoutiquesDto,
  ) {
    const { excludeUserId, ...pagination } = query;
    return this.boutiquesService.findDiscoverable(
      user.sub,
      excludeUserId,
      pagination,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get boutique by ID' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.boutiquesService.findOne(user.sub, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update boutique' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateBoutiqueDto,
  ) {
    return this.boutiquesService.update(user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete boutique' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.boutiquesService.remove(user.sub, id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get boutique statistics' })
  getStats(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.boutiquesService.getStats(user.sub, id);
  }

  @Post(':id/owners')
  @ApiOperation({ summary: 'Add an owner to boutique' })
  addOwner(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('email') email: string,
  ) {
    return this.boutiquesService.addOwner(user.sub, id, email);
  }

  @Delete(':id/owners/:ownerId')
  @ApiOperation({ summary: 'Remove an owner from boutique' })
  removeOwner(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('ownerId') ownerId: string,
  ) {
    return this.boutiquesService.removeOwner(user.sub, id, ownerId);
  }
}
