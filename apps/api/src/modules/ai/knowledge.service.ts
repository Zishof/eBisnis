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
import { EmbeddingService } from '../../infrastructure/ai/embedding.service';
import type { AuthenticatedUser } from '../../common/decorators';
import type { Evidence } from './prompt-builder';
import {
  describeRetriever,
  reciprocalRankFusion,
  type RetrieverKind,
} from './retrieval-fusion';

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
  /** Cara pencarian dasar; hibrida dipilih saat berjalan bila memungkinkan. */
  readonly kind = 'LEXICAL' as const;
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly permissions: TenantPermissionService,
    private readonly embeddings: EmbeddingService,
  ) {}

  /**
   * Menentukan cara pencarian yang dipakai sekarang.
   *
   * Bukan disetel lewat konfigurasi melainkan disimpulkan dari kenyataan: bila
   * ada model embedding DAN ada potongan yang sudah bervektor, pencariannya
   * hibrida. Konfigurasi yang menyatakan "semantik" padahal tidak ada model
   * embeddingnya hanya menghasilkan pencarian yang gagal diam-diam.
   */
  async activeRetriever(schema: string): Promise<{
    kind: RetrieverKind;
    model: string | null;
    note: string;
    reason: string;
    remedy: string | null;
  }> {
    const keadaan = await this.embeddings.availability();
    if (!keadaan.available || !keadaan.model) {
      return {
        kind: 'LEXICAL',
        model: null,
        note: describeRetriever('LEXICAL'),
        reason: keadaan.reason,
        remedy: keadaan.remedy,
      };
    }

    const bervektor = await this.tenantDb.query<{ n: string }>(
      schema,
      `SELECT count(*) AS n FROM "${schema}".knowledge_chunk
        WHERE is_active AND embedding IS NOT NULL AND embedding_model = $1`,
      [keadaan.model],
    );

    if (Number(bervektor[0]?.n ?? 0) === 0) {
      return {
        kind: 'LEXICAL',
        model: keadaan.model,
        note: describeRetriever('LEXICAL'),
        reason: `Model ${keadaan.model} tersedia, tetapi belum ada potongan yang bervektor.`,
        remedy: 'Jalankan POST /ai/knowledge/embed untuk membuat vektornya.',
      };
    }

    return {
      kind: 'HYBRID',
      model: keadaan.model,
      note: describeRetriever('HYBRID'),
      reason: `${bervektor[0].n} potongan bervektor dengan model ${keadaan.model}.`,
      remedy: null,
    };
  }

  /**
   * Pencarian semantik.
   *
   * Kesamaan dihitung oleh fungsi SQL, bukan di sisi aplikasi: menarik seluruh
   * vektor ke memori untuk membandingkannya akan memindahkan pekerjaan basis
   * data ke proses aplikasi yang jauh lebih sempit memorinya.
   *
   * `cosine_similarity` mengembalikan NULL untuk vektor yang dimensinya
   * berbeda, dan NULL tersaring sendiri oleh perbandingan. Potongan dari model
   * lain karena itu tidak pernah ikut — bukan karena disaring, melainkan karena
   * tidak dapat dibandingkan.
   */
  async searchSemantic(
    schema: string,
    query: string,
    options: {
      limit: number;
      allowedMenuCodes: string[];
      maxConfidentiality: string;
      model: string;
      minSimilarity?: number;
    },
  ): Promise<RetrievedChunk[]> {
    if (options.allowedMenuCodes.length === 0) return [];

    const vektor = await this.embeddings.embedWith(options.model, query);
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
              "${schema}".cosine_similarity(embedding, $1::float8[]) AS score
         FROM "${schema}".knowledge_chunk
        WHERE is_active
          AND embedding IS NOT NULL
          AND embedding_model = $2
          AND required_menu_code = ANY($3::text[])
          AND confidentiality = ANY($4::text[])
          AND "${schema}".cosine_similarity(embedding, $1::float8[]) > $5
        ORDER BY score DESC
        LIMIT $6`,
      [
        vektor.vector,
        options.model,
        options.allowedMenuCodes,
        bolehRahasia,
        // Ambang bawaan menyaring potongan yang kemiripannya kebetulan. Tanpa
        // ambang, pencarian semantik SELALU mengembalikan hasil sebanyak limit
        // — termasuk untuk pertanyaan yang tidak ada jawabannya sama sekali,
        // dan bukti yang tidak relevan lebih buruk daripada tidak ada bukti
        // karena model akan tetap berusaha memakainya.
        options.minSimilarity ?? 0.35,
        options.limit,
      ],
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
   * Pencarian hibrida.
   *
   * Menjalankan keduanya lalu menggabungkannya dengan RRF. Kegagalan sisi
   * semantik tidak menggagalkan pencarian: hasil leksikal tetap dikembalikan,
   * karena bukti yang kurang lengkap tetap lebih berguna daripada galat.
   */
  async searchHybrid(
    schema: string,
    query: string,
    options: {
      limit: number;
      allowedMenuCodes: string[];
      maxConfidentiality: string;
      model: string;
    },
  ): Promise<RetrievedChunk[]> {
    // Masing-masing mengambil lebih banyak daripada yang akhirnya dipakai,
    // supaya penggabungan punya bahan untuk menaikkan yang disepakati keduanya.
    const ambil = Math.max(options.limit * 3, 10);

    const [leksikal, semantik] = await Promise.all([
      this.search(schema, query, { ...options, limit: ambil }),
      this.searchSemantic(schema, query, { ...options, limit: ambil }).catch((error: Error) => {
        this.logger.warn(`Sisi semantik gagal, memakai leksikal saja: ${error.message}`);
        return [] as RetrievedChunk[];
      }),
    ]);

    const gabungan = reciprocalRankFusion([
      // Leksikal sedikit lebih berat: pada data ERP, yang dicari orang sering
      // berupa nomor dan kode yang justru tidak punya makna untuk didekati.
      { weight: 1.0, items: leksikal.map((c) => ({ id: c.id, score: c.score })) },
      { weight: 0.9, items: semantik.map((c) => ({ id: c.id, score: c.score })) },
    ]);

    const peta = new Map<string, RetrievedChunk>();
    for (const c of [...leksikal, ...semantik]) peta.set(c.id, c);

    return gabungan.slice(0, options.limit).map((g) => {
      const chunk = peta.get(g.id)!;
      // Skor yang dikembalikan adalah skor GABUNGAN, bukan skor salah satu
      // sisi — mencampurnya akan membuat angka pada jawaban tidak berarti.
      return { ...chunk, score: Math.round(g.score * 10_000) / 10_000 };
    });
  }

  /**
   * Membuat vektor untuk potongan yang belum punya.
   *
   * Dikerjakan bertahap dan dapat diulang: potongan yang sudah bervektor dengan
   * model yang sama dilewati, sehingga pemanggilan kedua hanya mengerjakan
   * sisanya. Pekerjaan yang harus selesai sekali jalan akan selalu gagal pada
   * korpus yang cukup besar.
   */
  async embedPending(
    schema: string,
    batchSize = 50,
  ): Promise<{ embedded: number; failed: number; remaining: number; model: string | null }> {
    const keadaan = await this.embeddings.availability();
    if (!keadaan.available || !keadaan.model) {
      throw new Error(`${keadaan.reason} ${keadaan.remedy ?? ''}`.trim());
    }

    const tertunda = await this.tenantDb.query<{ id: string; title: string; content: string }>(
      schema,
      `SELECT id::text, title, content FROM "${schema}".knowledge_chunk
        WHERE is_active
          AND (embedding IS NULL OR embedding_model IS DISTINCT FROM $1)
        ORDER BY indexed_at
        LIMIT $2`,
      [keadaan.model, batchSize],
    );

    let embedded = 0;
    let failed = 0;

    for (const potongan of tertunda) {
      try {
        // Judul ikut disertakan: ia sering memuat kata kunci yang tidak muncul
        // pada isinya.
        const hasil = await this.embeddings.embedWith(
          keadaan.model,
          `${potongan.title}\n${potongan.content}`,
        );
        await this.tenantDb.query(
          schema,
          `UPDATE "${schema}".knowledge_chunk
              SET embedding = $2::float8[], embedding_model = $3,
                  embedding_dim = $4, embedded_at = now()
            WHERE id = $1::uuid`,
          [potongan.id, hasil.vector, hasil.model, hasil.dimensions],
        );
        embedded += 1;
      } catch (error) {
        failed += 1;
        this.logger.warn(`Vektor potongan ${potongan.id} gagal: ${(error as Error).message}`);
      }
    }

    const sisa = await this.tenantDb.query<{ n: string }>(
      schema,
      `SELECT count(*) AS n FROM "${schema}".knowledge_chunk
        WHERE is_active AND (embedding IS NULL OR embedding_model IS DISTINCT FROM $1)`,
      [keadaan.model],
    );

    return { embedded, failed, remaining: Number(sisa[0]?.n ?? 0), model: keadaan.model };
  }

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

    const opsi = {
      limit,
      allowedMenuCodes: menuBoleh,
      // Kerahasiaan tertinggi yang boleh terbaca lewat AI sengaja dibatasi
      // TERBATAS. Surat berlabel RAHASIA tidak dikirim ke model bahasa, bahkan
      // untuk pemiliknya — sekali isinya keluar dari server, ia tidak dapat
      // ditarik kembali.
      maxConfidentiality: 'TERBATAS',
    };

    // Cara pencariannya ditentukan oleh kenyataan, bukan oleh konfigurasi.
    const pencari = await this.activeRetriever(user.schemaName);
    const chunks =
      pencari.kind === 'HYBRID' && pencari.model
        ? await this.searchHybrid(user.schemaName, query, { ...opsi, model: pencari.model })
        : await this.search(user.schemaName, query, opsi);

    return {
      evidence: chunks.map((c) => ({
        source: `${c.sourceType}: ${c.title}`,
        reference: c.sourceRef ?? undefined,
        content: c.content,
      })),
      chunks,
      retriever: pencari.kind,
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

    const pencari = await this.activeRetriever(schema);
    const vektor = await this.tenantDb.query<{ n: string; model: string | null }>(
      schema,
      `SELECT count(*) AS n, embedding_model AS model
         FROM "${schema}".knowledge_chunk
        WHERE is_active AND embedding IS NOT NULL
        GROUP BY embedding_model`,
    );

    return {
      // Dinyatakan terang-terangan supaya tidak ada yang mengira pencariannya
      // semantik padahal bukan, maupun sebaliknya.
      retriever: pencari.kind,
      retrieverModel: pencari.model,
      note: pencari.note,
      reason: pencari.reason,
      remedy: pencari.remedy,
      embedded: vektor.map((v) => ({ model: v.model, chunks: Number(v.n) })),
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
