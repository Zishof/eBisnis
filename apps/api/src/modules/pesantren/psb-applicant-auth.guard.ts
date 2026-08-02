/**
 * Auth ringan untuk portal calon santri (PSB) -- BUKAN staf.
 *
 * ## Kenapa terpisah total dari `JwtAuthGuard` (auth staf)
 *
 * Seluruh aktor lain di platform ini (pengurus, wali/orang tua lewat
 * `PesantrenPortalWaliController`) masuk lewat jalur staf penuh:
 * `platform_user` + `tenant_membership` + kata sandi sungguhan +
 * `AuthService.login()` + baris `platform_session`. Calon santri BUKAN
 * `platform_user` -- ia mendaftar sendiri lewat situs publik tanpa akun
 * sama sekali (lihat `PesantrenPublicService.psbDaftar`), dan "kata
 * sandi"-nya hanyalah tanggal lahir yang sudah ia isi saat mendaftar.
 * Memaksakannya lewat jalur staf berarti membuat baris `platform_user`
 * palsu untuk setiap pendaftar -- padahal ia bukan pengguna platform.
 *
 * Token portal ini karena itu punya BENTUK BERBEDA (`type: 'psb_applicant'`,
 * bukan `AccessTokenPayload`), ditandatangani `JwtService` yang sama
 * (secret sama, lihat `AuthModule`) tetapi diverifikasi guard SENDIRI --
 * TIDAK pernah lewat `JwtAuthGuard`/`PermissionGuard` global. Endpoint yang
 * memakainya tetap ditandai `@Public()` supaya kedua guard global itu lewat
 * begitu saja, lalu guard ini yang benar-benar memeriksa.
 *
 * TTL sengaja pendek (45 menit, tanpa refresh token) -- risikonya rendah
 * (portal pendaftar, bukan transaksi keuangan bernilai besar) dan pendaftar
 * cukup masuk ulang bila sesinya habis.
 */

import { CanActivate, ExecutionContext, Injectable, createParamDecorator } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { PesantrenPsbService } from './pesantren-psb.service';

export const PSB_APPLICANT_TOKEN_TYPE = 'psb_applicant' as const;

export interface PsbApplicantTokenPayload {
  type: typeof PSB_APPLICANT_TOKEN_TYPE;
  pendaftarId: string;
  schemaName: string;
  tenantId: string;
}

export interface PsbApplicantContext {
  pendaftarId: string;
  schemaName: string;
  tenantId: string;
}

@Injectable()
export class PsbApplicantAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly psb: PesantrenPsbService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { pendaftar?: PsbApplicantContext }>();
    const token = extractToken(request);
    if (!token) {
      throw AppError.unauthorized(ErrorCodes.UNAUTHORIZED, 'Anda belum masuk ke portal pendaftar.');
    }

    let payload: PsbApplicantTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<PsbApplicantTokenPayload>(token, {
        secret: this.config.get<string>('jwt.accessSecret'),
      });
    } catch {
      throw AppError.unauthorized(ErrorCodes.TOKEN_EXPIRED, 'Sesi portal pendaftar tidak valid atau kedaluwarsa.');
    }

    if (payload.type !== PSB_APPLICANT_TOKEN_TYPE) {
      throw AppError.unauthorized(ErrorCodes.UNAUTHORIZED, 'Token tidak sah untuk portal pendaftar.');
    }

    // Diperiksa ulang setiap permintaan (bukan hanya percaya isi token) --
    // pendaftar yang dibatalkan/dihapus pengurus langsung kehilangan akses,
    // tidak menunggu token itu kedaluwarsa sendiri.
    const pendaftar = await this.psb.satuPendaftar(payload.schemaName, payload.pendaftarId);
    if (!pendaftar) {
      throw AppError.unauthorized(
        ErrorCodes.UNAUTHORIZED,
        'Pendaftaran tidak ditemukan lagi. Silakan masuk kembali atau hubungi pengurus pondok.',
      );
    }

    request.pendaftar = {
      pendaftarId: payload.pendaftarId,
      schemaName: payload.schemaName,
      tenantId: payload.tenantId,
    };
    return true;
  }
}

function extractToken(request: Request): string | undefined {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return undefined;
}

/** Analog `@CurrentUser()` staf, untuk portal pendaftar. */
export const CurrentPendaftar = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PsbApplicantContext | undefined =>
    ctx.switchToHttp().getRequest().pendaftar,
);
