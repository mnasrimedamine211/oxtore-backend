import { Global, Module } from '@nestjs/common';
import { WinstonLoggerService } from './logger/winston-logger.service';
import { BoutiqueAccessService } from './services/boutique-access.service';
import { BoutiqueNotifyService } from './services/boutique-notify.service';

@Global()
@Module({
  providers: [WinstonLoggerService, BoutiqueAccessService, BoutiqueNotifyService],
  exports: [WinstonLoggerService, BoutiqueAccessService, BoutiqueNotifyService],
})
export class CommonModule {}
