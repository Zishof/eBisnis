/**
 * Adapter penyedia Ollama.
 *
 * ## Satu-satunya tempat yang berbicara dengan Ollama
 *
 * Seluruh akses berjalan lewat sini, dari sisi server. Peramban **tidak pernah**
 * memanggil Ollama langsung — dan itu bukan sekadar aturan gaya:
 *
 * 1. Alamat penyedianya akan terlihat siapa pun yang membuka peralatan
 *    pengembang, dan siapa pun yang mengetahuinya dapat memakai server itu
 *    tanpa melewati kuota, izin, maupun pencatatan.
 * 2. Penyamaran data hanya dapat ditegakkan di sisi server. Peramban yang
 *    menyusun promptnya sendiri akan mengirim apa saja yang ada di layarnya.
 * 3. Tanpa perantara, tidak ada satu pun catatan tentang siapa menanyakan apa.
 *
 * ## Nama model tidak pernah dikarang
 *
 * Tidak ada satu pun nama model yang ditulis sebagai konstanta di berkas ini.
 * Model ditemukan dengan bertanya kepada penyedianya, dan kemampuannya
 * ditetapkan dengan mencobanya — bukan ditebak dari namanya.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DiscoveredModel {
  name: string;
  family: string | null;
  parameterSize: string | null;
  quantization: string | null;
  sizeBytes: number | null;
  contextLength: number | null;
}

export interface ProviderHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  latencyMs: number | null;
  version: string | null;
  modelCount: number | null;
  note: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  /** JSON Schema; Ollama menerimanya apa adanya sebagai `format`. */
  schema?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface ChatResponse {
  content: string;
  promptTokens: number | null;
  completionTokens: number | null;
  durationMs: number;
}

/** Ambang lambat sebelum penyedia dianggap DEGRADED. */
const DEGRADED_LATENCY_MS = 5_000;

/**
 * Berapa kali gagal berturut-turut sebelum pemutus arus terbuka.
 *
 * Tiga, bukan satu: satu kegagalan dapat berarti satu permintaan yang
 * kebetulan berat. Tiga berturut-turut berarti penyedianya memang bermasalah.
 */
const CIRCUIT_FAILURE_THRESHOLD = 3;

/**
 * Berapa lama pemutus arus tetap terbuka.
 *
 * Selama terbuka, permintaan ditolak SEKETIKA tanpa menunggu batas waktu.
 * Tanpa pemutus arus, penyedia yang mati membuat setiap permintaan menunggu
 * penuh sampai batas waktunya — dan seratus permintaan yang masing-masing
 * menunggu tiga menit akan menghabiskan seluruh koneksi yang tersedia.
 */
const CIRCUIT_COOLDOWN_MS = 60_000;

@Injectable()
export class OllamaAdapter {
  private readonly logger = new Logger(OllamaAdapter.name);

  private consecutiveFailures = 0;
  private circuitOpenedAt: number | null = null;

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return (
      this.config.get<string>('ai.ollamaUrl') ??
      process.env.OLLAMA_URL ??
      'http://38.47.182.162:11434'
    ).replace(/\/+$/, '');
  }

  /** Apakah pemutus arus sedang terbuka. */
  isCircuitOpen(): boolean {
    if (this.circuitOpenedAt === null) return false;
    if (Date.now() - this.circuitOpenedAt > CIRCUIT_COOLDOWN_MS) {
      // Masa tunggu lewat: dicoba lagi sekali. Bila gagal, terbuka kembali.
      this.circuitOpenedAt = null;
      this.consecutiveFailures = 0;
      return false;
    }
    return true;
  }

  circuitState(): { open: boolean; failures: number; reopensInMs: number | null } {
    const open = this.isCircuitOpen();
    return {
      open,
      failures: this.consecutiveFailures,
      reopensInMs: open ? CIRCUIT_COOLDOWN_MS - (Date.now() - this.circuitOpenedAt!) : null,
    };
  }

  /**
   * Memeriksa kesehatan penyedia.
   *
   * Tidak pernah melempar: kesehatan yang tidak dapat diperiksa adalah
   * informasi tersendiri, bukan galat yang menghentikan pemanggilnya.
   */
  async health(): Promise<ProviderHealth> {
    const mulai = Date.now();
    try {
      const versi = await this.fetchJson<{ version: string }>('/api/version', { timeoutMs: 8_000 });
      const tags = await this.fetchJson<{ models?: unknown[] }>('/api/tags', { timeoutMs: 15_000 });
      const latencyMs = Date.now() - mulai;
      const modelCount = tags.models?.length ?? 0;

      if (modelCount === 0) {
        // Menjawab tetapi tidak punya model: tidak ada yang dapat dikerjakan.
        return {
          status: 'DEGRADED',
          latencyMs,
          version: versi.version,
          modelCount: 0,
          note: 'Penyedia menjawab tetapi tidak memiliki satu pun model.',
        };
      }
      if (latencyMs > DEGRADED_LATENCY_MS) {
        return {
          status: 'DEGRADED',
          latencyMs,
          version: versi.version,
          modelCount,
          note: `Penyedia menjawab tetapi lambat (${latencyMs} ms untuk pemeriksaan ringan).`,
        };
      }
      return {
        status: 'HEALTHY',
        latencyMs,
        version: versi.version,
        modelCount,
        note: `${modelCount} model tersedia.`,
      };
    } catch (error) {
      return {
        status: 'DOWN',
        latencyMs: Date.now() - mulai,
        version: null,
        modelCount: null,
        note: `Penyedia tidak menjawab: ${(error as Error).message}`,
      };
    }
  }

  /** Model yang benar-benar ada pada penyedia. */
  async discoverModels(): Promise<DiscoveredModel[]> {
    const tags = await this.fetchJson<{
      models?: Array<{
        name: string;
        size?: number;
        details?: { family?: string; parameter_size?: string; quantization_level?: string };
      }>;
    }>('/api/tags', { timeoutMs: 20_000 });

    const hasil: DiscoveredModel[] = [];
    for (const m of tags.models ?? []) {
      // Panjang konteks ditanyakan tersendiri; `/api/tags` tidak memuatnya.
      const contextLength = await this.contextLengthOf(m.name).catch(() => null);
      hasil.push({
        name: m.name,
        family: m.details?.family ?? null,
        parameterSize: m.details?.parameter_size ?? null,
        quantization: m.details?.quantization_level ?? null,
        sizeBytes: m.size ?? null,
        contextLength,
      });
    }
    return hasil;
  }

  /**
   * Menguji kemampuan sebuah model dengan MENCOBANYA.
   *
   * Kemampuan tidak ditebak dari nama. Sebuah server dapat menolak embedding
   * meski modelnya secara teori mampu — dan itu benar-benar terjadi di sini:
   * `/api/embed` menjawab "This server does not support embeddings. Start it
   * with `--embeddings`". Ditebak dari nama, kemampuan itu akan tercatat ada
   * dan setiap pemakaian berikutnya gagal.
   */
  async probeCapabilities(model: string): Promise<{
    chat: boolean;
    embedding: boolean;
    structured: boolean;
    notes: string[];
  }> {
    const notes: string[] = [];

    const chat = await this.tryChat(model, undefined).then(
      () => true,
      (e: Error) => {
        notes.push(`chat: ${e.message}`);
        return false;
      },
    );

    const structured = chat
      ? await this.tryChat(model, {
          type: 'object',
          properties: { ok: { type: 'boolean' } },
          required: ['ok'],
        }).then(
          (isi) => {
            try {
              JSON.parse(isi);
              return true;
            } catch {
              notes.push('structured: keluarannya bukan JSON yang sah');
              return false;
            }
          },
          (e: Error) => {
            notes.push(`structured: ${e.message}`);
            return false;
          },
        )
      : false;

    const embedding = await this.fetchJson<{ embeddings?: number[][] }>('/api/embed', {
      method: 'POST',
      body: { model, input: 'uji' },
      timeoutMs: 30_000,
    }).then(
      (r) => Array.isArray(r.embeddings) && r.embeddings.length > 0,
      (e: Error) => {
        notes.push(`embedding: ${e.message}`);
        return false;
      },
    );

    return { chat, embedding, structured, notes };
  }

  /**
   * Satu pemanggilan percakapan.
   *
   * Batas waktunya panjang dengan sengaja. Model 3B pada perangkat keras biasa
   * membutuhkan belasan detik untuk beberapa ratus token, dan batas waktu yang
   * terlalu pendek akan membatalkan pekerjaan yang sebenarnya berjalan baik.
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (this.isCircuitOpen()) {
      const sisa = Math.ceil((this.circuitState().reopensInMs ?? 0) / 1000);
      throw new Error(
        `Penyedia AI sedang tidak dapat dihubungi setelah ${this.consecutiveFailures} kegagalan ` +
          `berturut-turut. Dicoba lagi dalam ${sisa} detik.`,
      );
    }

    const mulai = Date.now();
    try {
      const respons = await this.fetchJson<{
        message?: { content?: string };
        prompt_eval_count?: number;
        eval_count?: number;
      }>('/api/chat', {
        method: 'POST',
        timeoutMs: request.timeoutMs ?? 180_000,
        body: {
          model: request.model,
          stream: false,
          messages: request.messages,
          ...(request.schema ? { format: request.schema } : {}),
          options: {
            // Nol supaya jawaban yang sama menghasilkan keluaran yang sama.
            // Pada konteks bisnis, jawaban yang berubah-ubah untuk pertanyaan
            // yang sama merusak kepercayaan lebih cepat daripada jawaban yang
            // kurang bervariasi.
            temperature: request.temperature ?? 0,
            num_predict: request.maxTokens ?? 800,
          },
        },
      });

      this.consecutiveFailures = 0;
      return {
        content: respons.message?.content ?? '',
        promptTokens: respons.prompt_eval_count ?? null,
        completionTokens: respons.eval_count ?? null,
        durationMs: Date.now() - mulai,
      };
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Membuat embedding untuk sebuah teks.
   *
   * Galat penyedia diteruskan apa adanya — di sanalah keterangan seperti
   * "does not support embeddings" berada, dan itulah yang dibutuhkan operator.
   */
  async embed(model: string, input: string): Promise<number[]> {
    if (this.isCircuitOpen()) {
      throw new Error('Penyedia AI sedang tidak dapat dihubungi.');
    }
    try {
      const respons = await this.fetchJson<{ embeddings?: number[][] }>('/api/embed', {
        method: 'POST',
        body: { model, input },
        timeoutMs: 60_000,
      });
      const vektor = respons.embeddings?.[0];
      if (!Array.isArray(vektor) || vektor.length === 0) {
        throw new Error('Penyedia menjawab tanpa vektor.');
      }
      this.consecutiveFailures = 0;
      return vektor;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD && this.circuitOpenedAt === null) {
      this.circuitOpenedAt = Date.now();
      this.logger.warn(
        `Pemutus arus AI terbuka setelah ${this.consecutiveFailures} kegagalan berturut-turut.`,
      );
    }
  }

  private async tryChat(model: string, schema?: Record<string, unknown>): Promise<string> {
    const r = await this.fetchJson<{ message?: { content?: string } }>('/api/chat', {
      method: 'POST',
      timeoutMs: 60_000,
      body: {
        model,
        stream: false,
        messages: [{ role: 'user', content: schema ? 'Jawab {"ok":true}' : 'Halo' }],
        ...(schema ? { format: schema } : {}),
        options: { temperature: 0, num_predict: 32 },
      },
    });
    return r.message?.content ?? '';
  }

  private async contextLengthOf(model: string): Promise<number | null> {
    const show = await this.fetchJson<{ model_info?: Record<string, unknown> }>('/api/show', {
      method: 'POST',
      body: { model },
      timeoutMs: 20_000,
    });
    const info = show.model_info ?? {};
    // Kuncinya berbeda antar keluarga model, mis. `qwen2.context_length`.
    const kunci = Object.keys(info).find((k) => k.endsWith('.context_length'));
    const nilai = kunci ? info[kunci] : undefined;
    return typeof nilai === 'number' ? nilai : null;
  }

  /**
   * Pemanggilan HTTP dengan batas waktu.
   *
   * `AbortController` diperlukan: `fetch` tanpa batas waktu akan menggantung
   * selamanya bila penyedianya menerima koneksi lalu diam, dan permintaan yang
   * menggantung tidak pernah membebaskan slot yang dipakainya.
   */
  private async fetchJson<T>(
    path: string,
    options: { method?: string; body?: unknown; timeoutMs?: number } = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
    try {
      const respons = await fetch(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers: options.body ? { 'content-type': 'application/json' } : undefined,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      const teks = await respons.text();
      if (!respons.ok) {
        // Pesan galat penyedia diteruskan apa adanya — di sanalah keterangan
        // seperti "start it with --embeddings" berada, dan itulah yang
        // dibutuhkan operator untuk memperbaikinya.
        throw new Error(`HTTP ${respons.status}: ${teks.slice(0, 300)}`);
      }

      const data = JSON.parse(teks) as T & { error?: string };
      // Ollama menjawab 200 dengan badan `{"error": "..."}` pada sebagian
      // kegagalan. Diabaikan, ia akan tampak sebagai keberhasilan kosong.
      if (data.error) throw new Error(data.error);
      return data;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Penyedia AI tidak menjawab dalam ${options.timeoutMs ?? 30_000} ms.`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
