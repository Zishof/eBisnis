/**
 * pnpm domain:vertical <perintah> [pilihan]
 *
 * Mendaftarkan host situs publik vertikal ke control plane (IR-005).
 *
 * Tanpa baris di `platform.vertical_site_domain`, `koperasi.ebisnis.id` tidak
 * menunjuk penyewa mana pun dan situsnya menjawab 404 — sekalipun Apache sudah
 * meneruskannya dan aplikasinya sudah berjalan. Pemetaan itulah satu-satunya
 * jalan yang sah: nama skema tidak boleh datang dari alamat.
 *
 * ## Perintah
 *
 *   list                                  daftar seluruh host terdaftar
 *   register --host H --tenant T --vertical V [--verify]
 *   verify   --host H                     menandai terbukti dimiliki
 *   suspend  --host H --reason R          menghentikan tanpa menghapus
 *
 * ## Mengapa `--verify` terpisah dari `register`
 *
 * Host yang belum terbukti dimiliki penyewanya tidak melayani apa pun —
 * ditegakkan constraint. Pada pemasangan awal, operator server memang
 * mengetahui kepemilikannya (ia yang memasang DNS-nya), jadi `--verify`
 * disediakan. Untuk domain yang dibawa penyewa sendiri, pembuktiannya harus
 * lewat DNS dan `--verify` tidak boleh dipakai.
 */

import 'dotenv/config';
import { createSeedContext } from './seed-runner';
import { parseArgs } from './cli-utils';
import {
  bolehDipakaiMencari,
  kunciSimpanan,
} from '../infrastructure/tenant/public-host';

const VERTIKAL_DIKENAL = ['cooperative', 'health', 'village'];

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const perintah = process.argv[2];
  const ctx = await createSeedContext();

  try {
    if (!perintah || perintah === 'list') {
      const rows = await ctx.prisma.verticalSiteDomain.findMany({
        orderBy: [{ vertical: 'asc' }, { host: 'asc' }],
        include: {
          tenant: {
            select: { schemaRegistry: { select: { username: true, schemaName: true } } },
          },
        },
      });
      if (rows.length === 0) {
        process.stdout.write('Belum ada host vertikal terdaftar.\n');
        return;
      }
      process.stdout.write(
        `${'HOST'.padEnd(36)}${'VERTIKAL'.padEnd(14)}${'STATUS'.padEnd(12)}${'TERBUKTI'.padEnd(10)}PENYEWA\n`,
      );
      for (const r of rows) {
        process.stdout.write(
          `${r.host.padEnd(36)}${r.vertical.padEnd(14)}${r.status.padEnd(12)}` +
            `${(r.verifiedAt ? 'ya' : 'BELUM').padEnd(10)}${r.tenant?.schemaRegistry?.username ?? '—'}\n`,
        );
      }
      return;
    }

    const hostMentah = args.options.host;
    if (!hostMentah) {
      process.stderr.write('Wajib menyertakan --host.\n');
      process.exit(1);
    }

    /*
     * Dinormalkan dengan penormal yang SAMA dengan jalur pembacaan. Penyimpanan
     * dan pembacaan yang memakai penormal berbeda menghasilkan baris yang
     * tersimpan tetapi tidak pernah ditemukan — dan gejalanya hanyalah situs
     * yang "tidak bekerja", tanpa galat apa pun.
     */
    const host = kunciSimpanan(hostMentah);
    if (!host) {
      process.stderr.write(
        `Host "${hostMentah}" tidak sah atau tidak boleh dipakai memetakan penyewa.\n`,
      );
      process.exit(1);
    }
    const gerbang = bolehDipakaiMencari(host);
    if (!gerbang.allowed) {
      process.stderr.write(`Host "${host}" ditolak: ${gerbang.code}.\n`);
      process.exit(1);
    }

    if (perintah === 'register') {
      const vertical = args.options.vertical ?? 'cooperative';
      if (!VERTIKAL_DIKENAL.includes(vertical)) {
        process.stderr.write(
          `Vertikal "${vertical}" tidak dikenal. Pilih: ${VERTIKAL_DIKENAL.join(', ')}.\n`,
        );
        process.exit(1);
      }

      const kunciPenyewa = args.options.tenant;
      if (!kunciPenyewa) {
        process.stderr.write('Wajib menyertakan --tenant <username atau schema>.\n');
        process.exit(1);
      }

      const registry = await ctx.prisma.tenantSchemaRegistry.findFirst({
        where: {
          OR: [{ username: kunciPenyewa }, { schemaName: kunciPenyewa }],
        },
      });
      if (!registry) {
        process.stderr.write(`Penyewa "${kunciPenyewa}" tidak ditemukan pada registry.\n`);
        process.exit(1);
      }
      if (registry.status !== 'READY') {
        /*
         * Penyewa yang skemanya belum siap tidak boleh menerima permintaan
         * publik. Menolak di sini lebih baik daripada mendaftarkan host yang
         * kelak menjawab 404 tanpa ada yang tahu sebabnya.
         */
        process.stderr.write(
          `Skema penyewa "${kunciPenyewa}" berstatus ${registry.status}, belum READY.\n`,
        );
        process.exit(1);
      }

      const terbukti = args.flags.has('verify');
      const baris = await ctx.prisma.verticalSiteDomain.upsert({
        where: { host },
        create: {
          host,
          tenantId: registry.tenantId,
          vertical,
          status: terbukti ? 'ACTIVE' : 'PENDING',
          verifiedAt: terbukti ? new Date() : null,
        },
        update: {
          tenantId: registry.tenantId,
          vertical,
          ...(terbukti ? { status: 'ACTIVE', verifiedAt: new Date() } : {}),
        },
      });

      process.stdout.write(
        `Host ${baris.host} → penyewa ${registry.username} (${registry.schemaName}), ` +
          `vertikal ${baris.vertical}, status ${baris.status}.\n`,
      );
      if (!terbukti) {
        process.stdout.write(
          'Belum terbukti dimiliki, jadi BELUM melayani. Jalankan `verify --host` bila ' +
            'kepemilikannya sudah dipastikan.\n',
        );
      }
      return;
    }

    if (perintah === 'verify') {
      const baris = await ctx.prisma.verticalSiteDomain.update({
        where: { host },
        data: { status: 'ACTIVE', verifiedAt: new Date() },
      });
      process.stdout.write(`Host ${baris.host} ditandai terbukti dan aktif.\n`);
      return;
    }

    if (perintah === 'suspend') {
      const alasan = args.options.reason;
      if (!alasan) {
        process.stderr.write('Wajib menyertakan --reason.\n');
        process.exit(1);
      }
      const baris = await ctx.prisma.verticalSiteDomain.update({
        where: { host },
        data: { status: 'SUSPENDED' },
      });
      /*
       * Dihentikan, bukan dihapus. Host yang dihapus dapat didaftarkan ulang
       * penyewa lain tanpa jejak; yang dihentikan meninggalkan barisnya, dan
       * siapa pun yang memeriksanya kelak dapat melihat bahwa ia pernah ada.
       */
      process.stdout.write(`Host ${baris.host} dihentikan. Alasan: ${alasan}\n`);
      return;
    }

    process.stderr.write(
      `Perintah "${perintah}" tidak dikenal. Pilih: list, register, verify, suspend.\n`,
    );
    process.exit(1);
  } finally {
    await ctx.app.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
