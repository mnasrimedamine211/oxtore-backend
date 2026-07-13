import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import appConfig from './app.config';
import databaseConfig from './database.config';
import jwtConfig from './jwt.config';
import redisConfig from './redis.config';
import storageConfig from './storage.config';
import mailConfig from './mail.config';
import whatsappConfig from './whatsapp.config';
import googleConfig from './google.config';
import queueConfig from './queue.config';
import swaggerConfig from './swagger.config';
import securityConfig from './security.config';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: getEnvFilePath(),
      load: [
        appConfig,
        databaseConfig,
        jwtConfig,
        redisConfig,
        storageConfig,
        mailConfig,
        whatsappConfig,
        googleConfig,
        queueConfig,
        swaggerConfig,
        securityConfig,
      ],
    }),
  ],
})
export class ConfigModule {}

function getEnvFilePath(): string {
  const nodeEnv = process.env.NODE_ENV || 'development';
  return `.env.${nodeEnv}`;
}
