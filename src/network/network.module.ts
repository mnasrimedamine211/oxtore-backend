import { Module } from '@nestjs/common';
import {
  BoutiqueRequestsController,
  BoutiqueRelationsController,
  BoutiqueNetworkProductsController,
} from './network.controller';
import { NetworkService } from './network.service';

@Module({
  controllers: [
    BoutiqueRequestsController,
    BoutiqueRelationsController,
    BoutiqueNetworkProductsController,
  ],
  providers: [NetworkService],
  exports: [NetworkService],
})
export class NetworkModule {}
