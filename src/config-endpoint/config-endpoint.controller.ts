import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ConfigEndpointService } from './config-endpoint.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('config')
export class ConfigEndpointController {
  constructor(private readonly configService: ConfigEndpointService) {}

  @Get()
  @ApiOperation({ summary: 'Get all configuration (currencies, countries)' })
  getConfig() {
    return this.configService.getConfig();
  }

  @Get('currencies')
  @ApiOperation({ summary: 'Get supported currencies' })
  getCurrencies() {
    return this.configService.getCurrencies();
  }

  @Get('countries')
  @ApiOperation({ summary: 'Get supported countries' })
  getCountries() {
    return this.configService.getCountries();
  }
}
