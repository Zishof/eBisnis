/**
 * Basis pengetahuan dan pencarian bukti.
 *
 * ## Pencarian leksikal, dan mengapa bukan semantik
 *
 * Penyedia menolak embedding pada tingkat konfigurasi server — bukan karena
 * modelnya kurang. Selama bendera `--embeddings` mati, tidak ada satu pun model
 * di sana yang dapat menghasilkan vektor.
 *
 * `Retriever` di bawah adalah antarmuka. Yang ada sekarang mencari secara
 * leksikal memakai pencarian teks penuh PostgreSQL. Ketika embedding kelak
 * tersedia, pencari semantik menjadi pelaksana kedua dari antarmuka yang sama,
 * dan pemanggilnya tidak berubah sama sekali.
 *
 * Pencarian leksikal yang mengembalikan bukti nyata jauh lebih berguna daripada
 * pencarian semantik yang tidak ada.
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { TenantPermissionService } from '../auth/tenant-permission.service';
import type { AuthenticatedUser } from '../../common/decorators';
import type { Evidence } from './prompt-builder';

export interface RetrievedChunk {
  id: string;
  sourceType: string;
  sourceRef: string | null;
  title: string;
  content: string;
  score: number;
  confidentiality: string;
}

/**
 * Antarmuka pencari.
 *
 * Sengaja sempit. Pencari semantik kelak melaksanakannya tanpa mengubah satu
 * baris pun pada pemanggilnya.
 */
export interface Retriever {
  readonly kind: 'LEXICAL' | 'SEMANTIC';
  search(
    schema: string,
    query: string,
    options: { limit: number; allowedMenuCodes: string[]; maxConfidentiality: string },
  ): Promise<RetrievedChunk[]>;
}

/** Urutan kerahasiaan, dari paling terbuka. */
const TINGKAT_RAHASIA = ['BIASA', 'TERBATAS', 'RAHASIA', 'SANGAT_RAHASIA'];

/** Panjang satu potongan, dalam huruf. */
const PANJANG_POTONGAN = 1_200;
/** Tumpang tindih antar potongan, supaya kalimat yang terbelah tetap utuh di salah satunya. */
const TUMPANG_TINDIH = 150;

@Injectable()
export class KnowledgeService implements Retriever {
  readonly kind = 'LEXICAL' as const;
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly permissions: TenantPermissionService,
  ) {}

  /**
   * Mencari potongan yang relevan.
   *
   * ## Izin diperiksa di dalam kueri, bukan sesudahnya
   *
   * Menyaring hasil setelah kueri berarti potongan rahasia sempat terbaca ke
   * memori aplikasi, dan satu kesalahan penyaringan membuatnya lolos. Disaring
   * di dalam kueri, potongan yang tidak boleh dilihat tidak pernah terambil.
   */
  async search(
    schema: string,
    query: string,
    options: { limit: number; allowedMenuCodes: string[]; maxConfidentiality: string },
  ): Promise<RetrievedChunk[]> {
    if (options.allowedMenuCodes.length === 0) return [];

    const batasRahasia = TINGKAT_RAHASIA.indexOf(options.maxConfidentiality);
    const bolehRahasia = TINGKAT_RAHASIA.slice(0, batasRahasia + 1);

    const rows = await this.tenantDb.query<{
      id: string;
      source_type: string;
      source_ref: string | null;
      title: string;
      content: string;
      score: number;
      confidentiality: string;
    }>(
      schema,
      `SELECT id::text, source_type, source_ref, title, content, confidentiality,
              ts_rank(search_vector, plainto_tsquery('simple', $1)) AS score
         FROM "${schema}".knowledge_chunk
        WHERE is_active
          AND search_vector @@ plainto_tsquery('simple', $1)
          AND required_menu_code = ANY($2::text[])
          AND confidentiality = ANY($3::text[])
        ORDER BY score DESC, indexed_at DESC
        LIMIT $4`,
      [query, options.allowedMenuCodes, bolehRahasia, options.limit],
    );

    return rows.map((r) => ({
      id: r.id,
      sourceType: r.source_type,
      sourceRef: r.source_ref,
      title: r.title,
      content: r.content,
      score: Number(r.score),
      confidentiality: r.confidentiality,
    }));
  }

  /**
   * Mencari bukti untuk sebuah pertanyaan, dibatasi izin penggunanya.
   *
   * Menu yang boleh dilihat dihitung dari izin efektif pengguna — termasuk
   * penyempitan oleh peran aktif. Seseorang yang sedang memakai peran terbatas
   * tidak memperoleh bukti dari luar peran itu.
   */
  async findEvidence(
    user: AuthenticatedUser,
    query: string,
    limit = 5,
  ): Promise<{ evidence: Evidence[]; chunks: RetrievedChunk[]; retriever: string }> {
    if (!user.schemaName) return { evidence: [], chunks: [], retriever: this.kind };

    const izin = await this.permissions.resolve(user.schemaName, user.userId, user.activeRoleId);
    // Menu yang punya hak READ; itulah yang boleh menjadi sumber bukti.
    const menuBoleh = [...izin]
      .filter((p) => p.endsWith('.READ'))
      .map((p) => p.split('.')[0]);

    const chunks = await this.search(user.schemaName, query, {
      limit,
      allowedMenuCodes: menuBoleh,
      // Kerahasiaan tertinggi yang boleh terbaca lewat AI sengaja dibatasi
      // TERBATAS. Surat berlabel RAHASIA tidak dikirim ke model bahasa, bahkan
      // untuk pemiliknya — sekali isinya keluar dari server, ia tidak dapat
      // ditarik kembali.
      maxConfidentiality: 'TERBATAS',
    });

    return {
      evidence: chunks.map((c) => ({
        source: `${c.sourceType}: ${c.title}`,
        reference: c.sourceRef ?? undefined,
        content: c.content,
      })),
      chunks,
      retriever: this.kind,
    };
  }

  /**
   * Memasukkan sebuah dokumen ke basis pengetahuan.
   *
   * Isi dipotong dengan tumpang tindih supaya kalimat yang terbelah tetap utuh
   * pada salah satu potongan. Tanpa tumpang tindih, jawaban yang bergantung
   * pada kalimat di perbatasan akan selalu kehilangan separuhnya.
   */
  async indexDocument(
    schema: string,
    doc: {
      sourceType: 'SURAT_MASUK' | 'SURAT_KELUAR' | 'HELP' | 'SOP' | 'CATATAN';
      sourceId: string | null;
      sourceRef: string | null;
      title: string;
      content: string;
      requiredMenuCode: string;
      confidentiality?: string;
    },
  ): Promise<{ chunks: number }> {
    const potongan = chunkText(doc.content, PANJANG_POTONGAN, TUMPANG_TINDIH);

    for (let i = 0; i < potongan.length; i += 1) {
      const isi = potongan[i];
      const hash = createHash('sha256').update(isi).digest('hex').slice(0, 64);
      await this.tenantDb.query(
        schema,
        `INSERT INTO "${schema}".knowledge_chunk
           (source_type, source_id, source_ref, title, content, chunk_index,
            required_menu_code, confidentiality, content_hash)
         VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, COALESCE($8, 'BIASA'), $9)
         ON CONFLICT (source_type, source_id, chunk_index) DO UPDATE
           SET title = EXCLUDED.title,
               content = EXCLUDED.content,
               source_ref = EXCLUDED.source_ref,
               required_menu_code = EXCLUDED.required_menu_code,
               confidentiality = EXCLUDED.confidentiality,
               content_hash = EXCLUDED.content_hash,
               is_active = TRUE,
               indexed_at = now(),
               updated_at = now()`,
        [
          doc.sourceType,
          doc.sourceId,
          doc.sourceRef,
          doc.title.slice(0, 500),
          isi,
          i,
          doc.requiredMenuCode,
          doc.confidentiality ?? null,
          hash,
        ],
      );
    }

    return { chunks: potongan.length };
  }

  /** Menyegarkan indeks dari surat yang sudah ada. */
  async reindexSurat(schema: string): Promise<{ incoming: number; outgoing: number }> {
    const masuk = await this.tenantDb.query<{
      id: string;
      agenda_number: string;
      subject: string;
      summary: string | null;
      sender_name: string;
      confidentiality: string;
    }>(
      schema,
      `SELECT id::text, agenda_number, subject, summary, sender_name, confidentiality
         FROM "${schema}".surat_incoming
        WHERE deleted_at IS NULL
          -- Surat rahasia TIDAK diindeks sama sekali. Menyaringnya saat
          -- pencarian saja berarti salinannya tetap ada di tabel yang lebih
          -- mudah dibaca daripada tabel aslinya.
          AND confidentiality IN ('BIASA', 'TERBATAS')`,
    );

    for (const s of masuk) {
      await this.indexDocument(schema, {
        sourceType: 'SURAT_MASUK',
        sourceId: s.id,
        sourceRef: s.agenda_number,
        title: s.subject,
        content: [`Pengirim: ${s.sender_name}`, s.subject, s.summary ?? ''].join('\n'),
        requiredMenuCode: 'SURAT_MASUK',
        confidentiality: s.confidentiality,
      });
    }

    const keluar = await this.tenantDb.query<{
      id: string;
      letter_number: string | null;
      subject: string;
      body: string | null;
      recipient_name: string;
    }>(
      schema,
      `SELECT id::text, letter_number, subject, body, recipient_name
         FROM "${schema}".surat_outgoing
        WHERE deleted_at IS NULL
          -- Hanya surat yang sudah terbit. Konsep yang belum disetujui belum
          -- menjadi kenyataan, dan menjadikannya bukti akan membuat AI
          -- menjawab berdasarkan sesuatu yang mungkin batal.
          AND status IN ('DITERBITKAN', 'DIKIRIM', 'DIARSIPKAN')`,
    );

    for (const s of keluar) {
      await this.indexDocument(schema, {
        sourceType: 'SURAT_KELUAR',
        sourceId: s.id,
        sourceRef: s.letter_number,
        title: s.subject,
        content: [`Kepada: ${s.recipient_name}`, s.subject, s.body ?? ''].join('\n'),
        requiredMenuCode: 'SURAT_KELUAR',
      });
    }

    return { incoming: masuk.length, outgoing: keluar.length };
  }

  async stats(schema: string) {
    const rows = await this.tenantDb.query<{
      source_type: string;
      n: string;
      terakhir: Date | null;
    }>(
      schema,
      `SELECT source_type, count(*) AS n, max(indexed_at) AS terakhir
         FROM "${schema}".knowledge_chunk WHERE is_active
        GROUP BY source_type ORDER BY source_type`,
    );

    return {
      retriever: this.kind,
      // Dinyatakan terang-terangan supaya tidak ada yang mengira pencariannya
      // semantik.
      note:
        'Pencarian bersifat LEKSIKAL (kata kunci), bukan semantik. Penyedia AI menolak ' +
        'embedding pada tingkat konfigurasi server; nyalakan `--embeddings` pada Ollama ' +
        'untuk memungkinkan pencarian semantik.',
      bySource: rows.map((r) => ({
        sourceType: r.source_type,
        chunks: Number(r.n),
        lastIndexedAt: r.terakhir,
      })),
    };
  }
}

/**
 * Memotong teks panjang menjadi potongan bertumpang tindih.
 *
 * Tumpang tindih diperlukan karena kalimat yang jatuh tepat di perbatasan akan
 * terbelah. Tanpa tumpang tindih, jawaban yang bergantung pada kalimat itu
 * selalu kehilangan separuhnya — dan separuh kalimat sering berubah artinya.
 */
export function chunkText(text: string, size: number, overlap: number): string[] {
  const bersih = text.trim();
  if (bersih.length === 0) return [];
  if (bersih.length <= size) return [bersih];

  const hasil: string[] = [];
  let mulai = 0;

  while (mulai < bersih.length) {
    let akhir = Math.min(mulai + size, bersih.length);

    // Dipotong pada batas kalimat bila ada di dekat ujungnya, supaya potongan
    // tidak berakhir di tengah kata.
    if (akhir < bersih.length) {
      const jendela = bersih.slice(mulai, akhir);
      const titik = Math.max(
        jendela.lastIndexOf('. '),
        jendela.lastIndexOf('.\n'),
        jendela.lastIndexOf('\n\n'),
      );
      if (titik > size * 0.5) akhir = mulai + titik + 1;
    }

    hasil.push(bersih.slice(mulai, akhir).trim());
    if (akhir >= bersih.length) break;

    /*
     * Titik mulai berikutnya WAJIB lebih besar daripada yang sekarang.
     *
     * Bila `overlap` sama besar atau lebih besar daripada kemajuan satu
     * putaran, `akhir - overlap` akan sama dengan atau lebih kecil daripada
     * `mulai`, dan perulangannya tidak pernah maju — menghasilkan potongan yang
     * sama berulang kali sampai memori habis.
     *
     * Kemajuannya dipaksa sedikitnya satu huruf.
     */
    const berikutnya = akhir - overlap;
    mulai = berikutnya > mulai ? berikutnya : akhir;
  }

  return hasil.filter((p) => p.length > 0);
}
