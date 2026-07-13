import { Module } from '@nestjs/common';
import { StockRequestsController } from './stock-requests.controller';
import { StockRequestsService } from './stock-requests.service';

@Module({
  controllers: [StockRequestsController],
  providers: [StockRequestsService],
  exports: [StockRequestsService],
})
export class StockRequestsModule {}
