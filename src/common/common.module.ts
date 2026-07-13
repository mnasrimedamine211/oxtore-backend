import { Global, Module } from '@nestjs/common';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { WinstonLoggerService } from './logger/winston-logger.service';

@Global()
@Module({
  providers: [WinstonLoggerService, ResponseInterceptor],
  exports: [WinstonLoggerService, ResponseInterceptor],
})
export class CommonModule {}
