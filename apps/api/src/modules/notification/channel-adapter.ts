/**
 * Adapter kanal pemberitahuan.
 *
 * ## Kanal yang belum berkredensial melaporkan apa adanya
 *
 * Surel, web push, WhatsApp, dan pemberitahuan seluler menuntut kredensial yang
 * tidak dimiliki sistem ini. Ada tiga cara menghadapinya, dan dua di antaranya
 * salah:
 *
 * 1. **Melaporkan berhasil padahal tidak terkirim.** Ini yang paling
 *    berbahaya: orang mengira sudah diberi tahu, pekerjaan berhenti menunggu
 *    seseorang yang tidak pernah tahu ia ditunggu, dan tidak ada satu pun tanda
 *    bahwa ada yang salah.
 * 2. **Menolak seluruh pemberitahuan karena satu kanal belum siap.** Kanal yang
 *    bekerja ikut mati, dan pemberitahuan dalam aplikasi yang sebenarnya sudah
 *    berfungsi ikut hilang.
 * 3. **Melaporkan `UNCONFIGURED` beserta keterangan apa yang kurang.** Inilah
 *    yang dilakukan di sini.
 *
 * Keterangan menyebutkan apa yang harus disiapkan operatornya — bukan sekadar
 * "tidak dikonfigurasi", yang memaksa orang menebak.
 */

export const CHANNELS = ['IN_APP', 'EMAIL', 'WEB_PUSH', 'WHATSAPP', 'MOBILE_PUSH'] as const;
export type Channel = (typeof CHANNELS)[number];

export type DeliveryStatus = 'PENDING' | 'SENT' | 'FAILED' | 'UNCONFIGURED' | 'SKIPPED';

export interface DeliveryResult {
  status: DeliveryStatus;
  note?: string;
}

export interface OutgoingNotification {
  notificationId: string;
  title: string;
  body: string;
  deepLink: string | null;
  recipientSubjectId: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  severity: string;
  actionRequired: boolean;
}

export interface ChannelAdapter {
  readonly channel: Channel;
  /** Apakah kanal ini siap dipakai pada lingkungan yang sedang berjalan. */
  isConfigured(): boolean;
  /** Keterangan apa yang kurang; hanya berarti bila `isConfigured()` false. */
  missingRequirement(): string;
  send(notification: OutgoingNotification): Promise<DeliveryResult>;
}

/**
 * Kanal dalam aplikasi.
 *
 * Satu-satunya kanal yang benar-benar berfungsi tanpa kredensial apa pun:
 * "mengirim" berarti barisnya sudah tersimpan, dan barisnya memang sudah
 * tersimpan sebelum adapter ini dipanggil.
 */
export class InAppAdapter implements ChannelAdapter {
  readonly channel = 'IN_APP' as const;

  isConfigured(): boolean {
    return true;
  }

  missingRequirement(): string {
    return '';
  }

  async send(notification: OutgoingNotification): Promise<DeliveryResult> {
    // Barisnya sudah ada di basis data; tidak ada yang perlu dikirim ke mana
    // pun. Yang perlu dipastikan hanya bahwa ia punya penerima.
    if (!notification.recipientSubjectId) {
      return {
        status: 'SKIPPED',
        note: 'Pemberitahuan ini ditujukan kepada peran, bukan kepada orang tertentu. ' +
          'Ia tampil pada lonceng setiap pemegang peran itu tanpa perlu dikirim.',
      };
    }
    return { status: 'SENT' };
  }
}

/**
 * Adapter untuk kanal yang menuntut kredensial.
 *
 * Satu kelas untuk keempatnya karena perilakunya identik selama kredensialnya
 * belum ada: melaporkan apa yang kurang. Ketika kredensialnya kelak tersedia,
 * masing-masing menjadi kelas tersendiri dengan cara kirimnya masing-masing —
 * dan bentuk sekarang tidak menghalangi itu.
 */
export class UnconfiguredAdapter implements ChannelAdapter {
  constructor(
    readonly channel: Channel,
    private readonly requirement: string,
    private readonly envKeys: string[],
  ) {}

  isConfigured(): boolean {
    // Diperiksa saat dipanggil, bukan saat dibuat: kredensial dapat dipasang
    // tanpa membangun ulang aplikasi.
    return this.envKeys.every((key) => Boolean(process.env[key]));
  }

  missingRequirement(): string {
    const kurang = this.envKeys.filter((key) => !process.env[key]);
    return `${this.requirement} Yang belum disetel: ${kurang.join(', ')}.`;
  }

  async send(): Promise<DeliveryResult> {
    if (!this.isConfigured()) {
      return { status: 'UNCONFIGURED', note: this.missingRequirement() };
    }
    // Kredensialnya ada tetapi pengirimnya belum ditulis. Dibedakan tegas dari
    // UNCONFIGURED supaya operator yang sudah menyiapkan kredensial tidak
    // mengira setelannya yang salah.
    return {
      status: 'FAILED',
      note:
        `Kredensial ${this.channel} sudah tersedia tetapi pengirimnya belum ` +
        'diimplementasikan. Ini kekurangan pada aplikasi, bukan pada konfigurasi.',
    };
  }
}

/** Seluruh adapter yang dikenal. */
export function buildAdapters(): ChannelAdapter[] {
  return [
    new InAppAdapter(),
    new UnconfiguredAdapter(
      'EMAIL',
      'Pengiriman surel menuntut server SMTP.',
      ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'],
    ),
    new UnconfiguredAdapter(
      'WEB_PUSH',
      'Web push menuntut sepasang kunci VAPID.',
      ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'],
    ),
    new UnconfiguredAdapter(
      'WHATSAPP',
      'WhatsApp menuntut akun WhatsApp Business API beserta tokennya. ' +
        'Templat pesan juga wajib disetujui Meta lebih dulu — pesan di luar templat ' +
        'yang disetujui akan ditolak penyedianya.',
      ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN'],
    ),
    new UnconfiguredAdapter(
      'MOBILE_PUSH',
      'Pemberitahuan seluler menuntut kredensial Firebase Cloud Messaging.',
      ['FCM_PROJECT_ID', 'FCM_CLIENT_EMAIL', 'FCM_PRIVATE_KEY'],
    ),
  ];
}

/**
 * Mengisi templat.
 *
 * Penanda yang nilainya tidak tersedia dibiarkan APA ADANYA, tidak diganti
 * menjadi kosong maupun "undefined". Judul pemberitahuan yang berbunyi "PO
 * sudah dikirim" tanpa nomornya masih dapat dipahami; yang berbunyi "PO
 * undefined sudah dikirim" tampak seperti sistem yang rusak — dan memang
 * menandakan ada nilai yang lupa diberikan, yang justru perlu terlihat.
 */
export function renderTemplate(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (utuh, kunci: string) => {
    const nilai = values[kunci];
    if (nilai === undefined || nilai === null || nilai === '') return utuh;
    return String(nilai);
  });
}

/** Penanda yang masih tersisa setelah pengisian — berarti ada nilai yang kurang. */
export function missingPlaceholders(rendered: string): string[] {
  return [...rendered.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
}
