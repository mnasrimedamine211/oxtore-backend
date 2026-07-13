import { Module } from '@nestjs/common';
import { ConfigEndpointController } from './config-endpoint.controller';
import { ConfigEndpointService } from './config-endpoint.service';

@Module({
  controllers: [ConfigEndpointController],
  providers: [ConfigEndpointService],
})
export class ConfigEndpointModule {}
