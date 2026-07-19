import { Global, Module } from '@nestjs/common';
import { WinstonLoggerService } from './logger/winston-logger.service';
import { BoutiqueAccessService } from './services/boutique-access.service';
import { BoutiqueNotifyService } from './services/boutique-notify.service';
import { NotificationsGateway } from './gateways/notifications.gateway';
import { NotificationsModule } from '../notifications/notifications.module';

@Global()
@Module({
  imports: [NotificationsModule],
  providers: [WinstonLoggerService, BoutiqueAccessService, BoutiqueNotifyService, NotificationsGateway],
  exports: [WinstonLoggerService, BoutiqueAccessService, BoutiqueNotifyService, NotificationsGateway],
})
export class CommonModule {}
