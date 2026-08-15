import { createHash, randomBytes } from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

const VERTICAL = 'hospitality';

@Injectable()
export class HospitalityDomainService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.verticalSiteDomain.findMany({
      where: { tenantId, vertical: VERTICAL },
      select: { id: true, host: true, domainKind: true, status: true, verifiedAt: true, verificationMethod: true,
        verificationRecord: true, verificationCheckedAt: true, tlsStatus: true, certificateExpiresAt: true, lastError: true, updatedAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async register(tenantId: string, rawHost: string) {
    const host = normalizeHost(rawHost);
    if (host === 'mitrainap.id' || host.endsWith('.mitrainap.id')) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Domain terkelola mitrainap.id tidak didaftarkan sebagai custom domain.');
    }
    const token = randomBytes(32).toString('base64url');
    const verificationRecord = `_mitrainap-verification.${host}`;
    try {
      const row = await this.prisma.verticalSiteDomain.create({
        data: { tenantId, host, vertical: VERTICAL, status: 'PENDING', domainKind: 'CUSTOM',
          verificationMethod: 'DNS_TXT', verificationTokenHash: digest(token), verificationRecord,
          tlsStatus: 'PENDING_VERIFICATION' },
        select: { id: true, host: true, status: true, verificationRecord: true, tlsStatus: true },
      });
      return { ...row, verificationValue: `mitrainap-verification=${token}` };
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw AppError.conflict(ErrorCodes.CONFLICT, 'Domain sudah terdaftar.');
      throw error;
    }
  }

  async verify(tenantId: string, id: string) {
    const domain = await this.prisma.verticalSiteDomain.findFirst({ where: { id, tenantId, vertical: VERTICAL, domainKind: 'CUSTOM' } });
    if (!domain?.verificationRecord || !domain.verificationTokenHash) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Custom domain tidak ditemukan.');
    let records: string[][];
    try {
      records = await resolveTxt(domain.verificationRecord);
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'DNS TXT belum tersedia';
      await this.prisma.verticalSiteDomain.update({ where: { id }, data: { verificationCheckedAt: new Date(), lastError: message } });
      throw AppError.conflict(ErrorCodes.CONFLICT, 'DNS TXT belum dapat diverifikasi. Periksa record lalu coba lagi.');
    }
    const matched = records.flat().some((value) => {
      const token = value.startsWith('mitrainap-verification=') ? value.slice('mitrainap-verification='.length) : '';
      return token.length > 0 && digest(token) === domain.verificationTokenHash;
    });
    if (!matched) {
      await this.prisma.verticalSiteDomain.update({ where: { id }, data: { verificationCheckedAt: new Date(), lastError: 'DNS_TXT_MISMATCH' } });
      throw AppError.conflict(ErrorCodes.CONFLICT, 'Nilai DNS TXT tidak cocok.');
    }
    return this.prisma.verticalSiteDomain.update({
      where: { id },
      data: { status: 'PENDING', verifiedAt: new Date(), verificationCheckedAt: new Date(), tlsStatus: 'PENDING_CERTIFICATE', lastError: null },
      select: { id: true, host: true, status: true, verifiedAt: true, tlsStatus: true },
    });
  }

  async revoke(tenantId: string, id: string) {
    const result = await this.prisma.verticalSiteDomain.updateMany({
      where: { id, tenantId, vertical: VERTICAL, domainKind: 'CUSTOM' },
      data: { status: 'REVOKED', tlsStatus: 'REVOKED', version: { increment: 1 } },
    });
    if (!result.count) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Custom domain tidak ditemukan.');
    return { revoked: true };
  }

  async activateTls(id: string, providerReference: string, expiresAt: string) {
    const expiry = new Date(expiresAt);
    if (!providerReference.trim() || Number.isNaN(expiry.valueOf()) || expiry <= new Date(Date.now() + 24 * 60 * 60 * 1000)) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Bukti provider dan masa berlaku sertifikat lebih dari 24 jam wajib diisi.');
    }
    const result = await this.prisma.verticalSiteDomain.updateMany({
      where: { id, vertical: VERTICAL, domainKind: 'CUSTOM', verifiedAt: { not: null }, tlsStatus: 'PENDING_CERTIFICATE' },
      data: { status: 'ACTIVE', tlsStatus: 'ACTIVE', tlsProviderReference: providerReference.trim(), certificateExpiresAt: expiry, lastError: null, version: { increment: 1 } },
    });
    if (!result.count) throw AppError.conflict(ErrorCodes.CONFLICT, 'Domain belum terverifikasi atau status TLS tidak dapat diaktifkan.');
    return { active: true, certificateExpiresAt: expiry };
  }
}

function normalizeHost(raw: string): string {
  const host = (raw ?? '').trim().toLowerCase().replace(/\.$/, '');
  if (host.length > 253 || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) {
    throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Nama domain tidak valid.');
  }
  return host;
}
function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }
