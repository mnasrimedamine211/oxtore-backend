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
import { NetworkService } from './network.service';
import { CreateBoutiqueRequestDto } from './dto/create-boutique-request.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('Network')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('network')
export class NetworkController {
  constructor(private readonly networkService: NetworkService) {}

  @Post('requests')
  @ApiOperation({ summary: 'Create a boutique network request' })
  createRequest(@CurrentUser() user: JwtPayload, @Body() dto: CreateBoutiqueRequestDto) {
    return this.networkService.createRequest(user.sub, dto);
  }

  @Get('requests')
  @ApiOperation({ summary: 'List boutique network requests (filter by type, boutiqueId, status)' })
  findAllRequests(
    @CurrentUser() user: JwtPayload,
    @Query() query: PaginationDto & { type?: 'sent' | 'received'; boutiqueId?: string; status?: string },
  ) {
    return this.networkService.findAllRequests(user.sub, query);
  }

  @Patch('requests/:id/accept')
  @ApiOperation({ summary: 'Accept boutique request (transactional: creates relation + notification)' })
  acceptRequest(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.networkService.acceptRequest(user.sub, id);
  }

  @Patch('requests/:id/reject')
  @ApiOperation({ summary: 'Reject boutique request' })
  rejectRequest(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.networkService.rejectRequest(user.sub, id);
  }

  @Get('relations')
  @ApiOperation({ summary: 'List boutique relations (network connections)' })
  findAllRelations(
    @CurrentUser() user: JwtPayload,
    @Query() query: PaginationDto & { boutiqueId?: string },
  ) {
    return this.networkService.findAllRelations(user.sub, query);
  }

  @Delete('relations/:id')
  @ApiOperation({ summary: 'Remove a boutique relation' })
  removeRelation(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.networkService.removeRelation(user.sub, id);
  }

  @Get('boutiques/:boutiqueId/products')
  @ApiOperation({ summary: 'Get network products for a boutique (products from related boutiques)' })
  getNetworkProducts(
    @CurrentUser() user: JwtPayload,
    @Param('boutiqueId') boutiqueId: string,
    @Query() query: PaginationDto,
  ) {
    return this.networkService.getNetworkProducts(user.sub, boutiqueId, query);
  }
}
