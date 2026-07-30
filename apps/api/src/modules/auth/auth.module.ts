import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthController, MeController } from './auth.controller';
import { TenantPermissionService } from './tenant-permission.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionGuard } from './guards/permission.guard';

@Global()
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret'),
        signOptions: { expiresIn: config.get<string>('jwt.accessTtl', '15m') },
      }),
    }),
  ],
  controllers: [AuthController, MeController],
  providers: [
    AuthService,
    TenantPermissionService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
  exports: [AuthService, TenantPermissionService],
})
export class AuthModule {}
