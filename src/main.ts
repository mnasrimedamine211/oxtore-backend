import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as rateLimit from 'express-rate-limit';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Railway (and any single-hop reverse proxy) puts an X-Forwarded-For header on every
  // request. Without this, Express ignores that header and req.ip resolves to Railway's
  // own proxy address — identical for every visitor — so express-rate-limit ends up
  // rate-limiting the entire user base as if it were one client instead of per-IP.
  app.set('trust proxy', 1);

  const apiPrefix = configService.get<string>('app.apiPrefix') || 'api';
  const port = configService.get<number>('app.port') || 3000;
  const corsOrigin = configService.get<string>('app.corsOrigin') || '*';

  // Every JWT ever issued while running on the fallback secret is forgeable by anyone
  // who reads this source file. Warn loudly rather than refusing to boot — this app may
  // still be running on the fallback in production today, and crashing on startup would
  // turn a security gap into an outage instead of giving anyone a chance to fix it first.
  if (configService.get<string>('app.nodeEnv') === 'production') {
    const usingDefaultSecret =
      configService.get<string>('jwt.secret') === 'dev-jwt-secret-change-in-production';
    const usingDefaultRefreshSecret =
      configService.get<string>('jwt.refreshSecret') === 'dev-refresh-secret-change-in-production';
    if (usingDefaultSecret || usingDefaultRefreshSecret) {
      logger.error(
        'SECURITY WARNING: JWT_SECRET and/or JWT_REFRESH_SECRET are not set in this environment — ' +
          'running in production with the insecure default signing secret from source control. ' +
          'Set both to strong random values in the production environment ASAP and redeploy.',
      );
    }
  }

  app.setGlobalPrefix(apiPrefix);

  // Default Express body limit (100kb) is too small for product/boutique image uploads
  // sent as base64 data URLs inline in the JSON body — raise it to 25mb.
  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ extended: true, limit: '25mb' }));

  app.use(helmet());
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(','),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.use(
    rateLimit.default({
      windowMs: 60 * 1000,
      max: configService.get<number>('security.rateLimitMax') || 100,
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle(configService.get<string>('swagger.title') || 'Oxtore API')
    .setDescription(configService.get<string>('swagger.description') || 'Mobile Marketplace Backend API')
    .setVersion(configService.get<string>('swagger.version') || '1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  const swaggerPath = configService.get<string>('swagger.path') || 'api';
  SwaggerModule.setup(swaggerPath, app, document);

  await app.listen(port);
  logger.log(`Application running on http://localhost:${port}/${apiPrefix}`);
  logger.log(`Swagger docs at http://localhost:${port}/${swaggerPath}`);
}

bootstrap();
