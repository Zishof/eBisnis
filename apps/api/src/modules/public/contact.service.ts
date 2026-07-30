import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import sanitizeHtml from 'sanitize-html';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../../infrastructure/audit/audit.service';

@Injectable()
export class ContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async submit(
    input: { name: string; email: string; phone?: string; subject: string; message: string },
    meta: { ipAddress?: string; localeCode?: string; requestId?: string },
  ) {
    // Pesan disimpan sebagai teks bersih; tidak ada HTML yang dapat dieksekusi.
    const created = await this.prisma.contactMessage.create({
      data: {
        name: stripAll(input.name),
        email: input.email.trim().toLowerCase(),
        phone: input.phone ? stripAll(input.phone) : null,
        subject: stripAll(input.subject),
        message: stripAll(input.message),
        localeCode: meta.localeCode ?? 'id',
        ipAddress: meta.ipAddress ?? null,
        status: 'NEW',
      },
      select: { id: true, createdAt: true },
    });

    await this.audit.record({
      moduleCode: 'CMS',
      actionCode: 'CONTACT_MESSAGE_RECEIVED',
      entityType: 'ContactMessage',
      entityId: created.id,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      metadata: { subject: stripAll(input.subject) },
    });

    return {
      id: created.id,
      receivedAt: created.createdAt,
      message: 'Pesan Anda telah kami terima. Tim kami akan menghubungi Anda.',
    };
  }

  async subscribeNewsletter(email: string, localeCode: string) {
    const normalized = email.trim().toLowerCase();
    const confirmToken = randomBytes(24).toString('hex');

    const existing = await this.prisma.newsletterSubscriber.findUnique({
      where: { email: normalized },
    });

    if (existing) {
      if (existing.status === 'SUBSCRIBED') {
        return { status: 'ALREADY_SUBSCRIBED', message: 'Surel ini sudah berlangganan.' };
      }
      await this.prisma.newsletterSubscriber.update({
        where: { email: normalized },
        data: {
          status: 'SUBSCRIBED',
          subscribedAt: new Date(),
          unsubscribedAt: null,
          localeCode,
          confirmToken,
        },
      });
      return { status: 'RESUBSCRIBED', message: 'Langganan buletin Anda telah diaktifkan kembali.' };
    }

    await this.prisma.newsletterSubscriber.create({
      data: {
        email: normalized,
        localeCode,
        status: 'SUBSCRIBED',
        subscribedAt: new Date(),
        confirmToken,
      },
    });
    return { status: 'SUBSCRIBED', message: 'Terima kasih. Anda telah berlangganan buletin kami.' };
  }
}

/** Menghapus seluruh tag HTML — input publik tidak boleh menyimpan markup. */
function stripAll(value: string): string {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim();
}
