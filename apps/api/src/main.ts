import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { assertEveryRouteIsMarked } from './common/security/route-authorization.audit';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
  });
  // Produksi memakai Apache pada host yang sama. Memercayai hanya koneksi
  // loopback membuat req.ip mengambil alamat yang ditambahkan Apache tanpa
  // membiarkan klien langsung memalsukan X-Forwarded-For. Ini juga memastikan
  // setiap perangkat mendapat ember rate-limit miliknya sendiri.
  app.set('trust proxy', 'loopback');
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
  // Filter galat didaftarkan lewat APP_FILTER pada AppModule agar menerima
  // dependensi; lihat catatan di sana.
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

  // Diperiksa sebelum port dibuka. Menyala dengan endpoint yang tidak menyatakan
  // hak aksesnya lebih buruk daripada tidak menyala: yang pertama diam.
  assertEveryRouteIsMarked(app);

  await app.listen(port, '0.0.0.0');

  logger.log(`API           : http://localhost:${port}/${apiPrefix}`);
  logger.log(`Swagger UI    : http://localhost:${port}/docs`);
  logger.log(`OpenAPI JSON  : http://localhost:${port}/api-json`);
  logger.log(`Health        : http://localhost:${port}/health`);
}

void bootstrap();
