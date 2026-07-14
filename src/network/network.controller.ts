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
import { NetworkService } from './network.service';
import { CreateBoutiqueRequestDto } from './dto/create-boutique-request.dto';
import { AcceptBoutiqueRequestDto } from './dto/accept-boutique-request.dto';
import { RejectBoutiqueRequestDto } from './dto/reject-boutique-request.dto';
import { QueryBoutiqueRequestDto } from './dto/query-boutique-request.dto';
import { CreateBoutiqueRelationDto } from './dto/create-boutique-relation.dto';
import { UpdateBoutiqueRelationDto } from './dto/update-boutique-relation.dto';
import { QueryBoutiqueRelationDto } from './dto/query-boutique-relation.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('Network')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('boutique-requests')
export class BoutiqueRequestsController {
  constructor(private readonly networkService: NetworkService) {}

  @Post()
  @ApiOperation({ summary: 'Create a boutique network request' })
  createRequest(@CurrentUser() user: JwtPayload, @Body() dto: CreateBoutiqueRequestDto) {
    return this.networkService.createRequest(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List boutique network requests (filter by boutiqueIds, type, boutiqueId, status)' })
  findAllRequests(@CurrentUser() user: JwtPayload, @Query() query: QueryBoutiqueRequestDto) {
    return this.networkService.findAllRequests(user.sub, query);
  }

  @Patch(':id/accept')
  @ApiOperation({ summary: 'Accept boutique request (transactional: creates relation + notification)' })
  acceptRequest(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AcceptBoutiqueRequestDto,
  ) {
    return this.networkService.acceptRequest(user.sub, id, dto);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject boutique request' })
  rejectRequest(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RejectBoutiqueRequestDto,
  ) {
    return this.networkService.rejectRequest(user.sub, id, dto);
  }
}

@ApiTags('Network')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('boutique-relations')
export class BoutiqueRelationsController {
  constructor(private readonly networkService: NetworkService) {}

  @Get()
  @ApiOperation({ summary: 'List boutique relations (network connections)' })
  findAllRelations(@CurrentUser() user: JwtPayload, @Query() query: QueryBoutiqueRelationDto) {
    return this.networkService.findAllRelations(user.sub, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a boutique relation directly' })
  createRelation(@CurrentUser() user: JwtPayload, @Body() dto: CreateBoutiqueRelationDto) {
    return this.networkService.createRelation(user.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a boutique relation status' })
  updateRelation(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateBoutiqueRelationDto,
  ) {
    return this.networkService.updateRelation(user.sub, id, dto);
  }
}

@ApiTags('Network')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('boutiques')
export class BoutiqueNetworkProductsController {
  constructor(private readonly networkService: NetworkService) {}

  @Get(':id/network-products')
  @ApiOperation({ summary: 'Get network products for a boutique (products from related boutiques)' })
  getNetworkProducts(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query() query: PaginationDto,
  ) {
    return this.networkService.getNetworkProducts(user.sub, id, query);
  }
}
