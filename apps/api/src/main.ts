import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const apiPrefix = config.get<string>('apiPrefix', 'api/v1');
  const port = config.get<number>('port', 3000);
  const corsOrigins = config.get<string[]>('corsOrigins', []);

  app.setGlobalPrefix(apiPrefix, {
    exclude: ['health', 'docs', 'api-json'],
  });

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cookieParser());

  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
    exposedHeaders: ['x-request-id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('eBisnis.id API')
    .setDescription(
      'API platform SaaS POS dan ERP multi-tenant eBisnis.id. ' +
        'Control plane pada schema `platform`, data ERP pada schema per tenant.',
    )
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .addTag('public', 'Endpoint publik: website, pendaftaran, demo, paket')
    .addTag('auth', 'Autentikasi dan sesi')
    .addTag('platform', 'Portal Platform Super Admin')
    .addTag('pricing', 'Katalog modul, paket, harga, dan diskon')
    .addTag('billing', 'Langganan, perangkat, dan invoice')
    .addTag('payments', 'Esmartlink: create-order, callback, inquiry, rekonsiliasi')
    .addTag('cms', 'Manajemen konten website publik')
    .addTag('tenant', 'Master data dan dokumen ERP tenant')
    .addTag('seed', 'Verifikasi, perbaikan, dan pembersihan data contoh')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'api-json',
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port, '0.0.0.0');

  logger.log(`API           : http://localhost:${port}/${apiPrefix}`);
  logger.log(`Swagger UI    : http://localhost:${port}/docs`);
  logger.log(`OpenAPI JSON  : http://localhost:${port}/api-json`);
  logger.log(`Health        : http://localhost:${port}/health`);
}

void bootstrap();
