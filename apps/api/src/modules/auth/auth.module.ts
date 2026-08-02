import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  AuthController,
  MeController,
  SecurityAuditController,
  SessionController,
} from './auth.controller';
import { TenantPermissionService } from './tenant-permission.service';
import { SessionService } from './session.service';
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
  controllers: [AuthController, MeController, SessionController, SecurityAuditController],
  providers: [
    AuthService,
    TenantPermissionService,
    SessionService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
  /*
   * `JwtModule` diekspor ulang -- `AuthModule` sendiri `@Global()`, jadi ini
   * membuat `JwtService` (dengan secret/TTL yang SAMA) siap dipakai modul
   * mana pun tanpa registrasi ulang. Dipakai pertama kali oleh portal
   * pendaftar PSB (`PsbApplicantAuthGuard`, lihat modul pesantren) untuk
   * menandatangani token bertipe BERBEDA dari token staf -- bukan lewat
   * `AuthService.login()`, sebab pendaftar bukan `platform_user`.
   */
  exports: [AuthService, TenantPermissionService, SessionService, JwtModule],
})
export class AuthModule {}
