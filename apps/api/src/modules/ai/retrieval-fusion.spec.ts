import {
  cosineSimilarity,
  describeRetriever,
  reciprocalRankFusion,
  RRF_K,
} from './retrieval-fusion';

describe('cosineSimilarity', () => {
  it('vektor identik menghasilkan 1', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])!).toBeCloseTo(1, 10);
  });

  it('vektor berlawanan menghasilkan -1', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])!).toBeCloseTo(-1, 10);
  });

  it('vektor tegak lurus menghasilkan 0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])!).toBeCloseTo(0, 10);
  });

  it('besaran tidak berpengaruh, hanya arah', () => {
    // Sifat inti kosinus: dokumen panjang dan pendek yang bertema sama tetap
    // dinilai mirip.
    expect(cosineSimilarity([1, 1], [100, 100])!).toBeCloseTo(1, 10);
  });

  it('dimensi berbeda menghasilkan NULL, bukan 0', () => {
    /*
     * Nol berarti "tidak mirip sama sekali", dan itu pernyataan yang berbeda
     * dari "tidak dapat dibandingkan". Memakai nol akan membuat potongan yang
     * dimensinya salah — yaitu yang embeddingnya dari model lain — tampak
     * sebagai potongan yang benar-benar tidak relevan, sehingga penyebabnya
     * tidak pernah terlihat.
     */
    expect(cosineSimilarity([1, 2, 3], [1, 2])).toBeNull();
  });

  it('vektor nol menghasilkan NULL', () => {
    // Vektor nol tidak punya arah, sehingga sudut terhadapnya tidak terdefinisi.
    expect(cosineSimilarity([0, 0], [1, 1])).toBeNull();
    expect(cosineSimilarity([1, 1], [0, 0])).toBeNull();
  });

  it('vektor kosong menghasilkan NULL', () => {
    expect(cosineSimilarity([], [])).toBeNull();
  });

  it('masukan yang bukan array menghasilkan NULL', () => {
    expect(cosineSimilarity(null as unknown as number[], [1])).toBeNull();
  });
});

describe('reciprocalRankFusion', () => {
  it('dokumen yang muncul pada kedua daftar naik ke atas', () => {
    // Inti penggabungan: kesepakatan dua cara pencarian lebih meyakinkan
    // daripada keyakinan satu cara.
    const hasil = reciprocalRankFusion([
      { weight: 1, items: [{ id: 'a', score: 9 }, { id: 'b', score: 8 }] },
      { weight: 1, items: [{ id: 'c', score: 9 }, { id: 'b', score: 8 }] },
    ]);
    expect(hasil[0].id).toBe('b');
  });

  it('hanya memakai URUTAN, bukan nilai skornya', () => {
    /*
     * ts_rank dan kosinus berada pada skala yang sama sekali berbeda.
     * Menjumlahkannya berarti membandingkan hal yang tidak sebanding, dan
     * hasilnya didominasi skala yang kebetulan lebih besar.
     *
     * Diuji dengan skor yang sengaja timpang: hasilnya harus sama persis
     * dengan skor yang seimbang, karena hanya urutannya yang dipakai.
     */
    const timpang = reciprocalRankFusion([
      { weight: 1, items: [{ id: 'a', score: 999999 }, { id: 'b', score: 0.0001 }] },
    ]);
    const seimbang = reciprocalRankFusion([
      { weight: 1, items: [{ id: 'a', score: 1 }, { id: 'b', score: 0.9 }] },
    ]);
    expect(timpang.map((h) => h.id)).toEqual(seimbang.map((h) => h.id));
    expect(timpang[0].score).toBeCloseTo(seimbang[0].score, 12);
  });

  it('bobot menentukan pengaruh sebuah daftar', () => {
    const semantikBerat = reciprocalRankFusion([
      { weight: 0.2, items: [{ id: 'leksikal', score: 1 }] },
      { weight: 0.8, items: [{ id: 'semantik', score: 1 }] },
    ]);
    expect(semantikBerat[0].id).toBe('semantik');
  });

  it('satu daftar kosong tidak menggagalkan penggabungan', () => {
    // Terjadi nyata ketika model embedding belum ada: daftar semantiknya kosong.
    const hasil = reciprocalRankFusion([
      { weight: 1, items: [{ id: 'a', score: 1 }] },
      { weight: 1, items: [] },
    ]);
    expect(hasil.map((h) => h.id)).toEqual(['a']);
  });

  it('kedua daftar kosong menghasilkan daftar kosong', () => {
    expect(reciprocalRankFusion([{ weight: 1, items: [] }])).toEqual([]);
  });

  it('urutan hasil menurun menurut skor gabungan', () => {
    const hasil = reciprocalRankFusion([
      { weight: 1, items: [{ id: 'a', score: 1 }, { id: 'b', score: 1 }, { id: 'c', score: 1 }] },
    ]);
    for (let i = 1; i < hasil.length; i += 1) {
      expect(hasil[i - 1].score).toBeGreaterThanOrEqual(hasil[i].score);
    }
  });

  it('k besar meredam pengaruh peringkat teratas', () => {
    const kecil = reciprocalRankFusion(
      [{ weight: 1, items: [{ id: 'a', score: 1 }, { id: 'b', score: 1 }] }],
      1,
    );
    const besar = reciprocalRankFusion(
      [{ weight: 1, items: [{ id: 'a', score: 1 }, { id: 'b', score: 1 }] }],
      1000,
    );
    const selisihKecil = kecil[0].score - kecil[1].score;
    const selisihBesar = besar[0].score - besar[1].score;
    expect(selisihBesar).toBeLessThan(selisihKecil);
  });

  it('k bawaan enam puluh sesuai literatur RRF', () => {
    expect(RRF_K).toBe(60);
  });

  it('dokumen yang sama pada satu daftar tidak dihitung dua kali', () => {
    const hasil = reciprocalRankFusion([
      { weight: 1, items: [{ id: 'a', score: 1 }, { id: 'a', score: 0.5 }] },
    ]);
    expect(hasil.filter((h) => h.id === 'a').length).toBe(1);
  });
});

describe('describeRetriever', () => {
  it('menjelaskan cara gagal masing-masing jenis', () => {
    // Pengguna yang tidak menemukan sesuatu berhak tahu apakah pencariannya
    // berbasis kata atau makna — keduanya gagal dengan cara berbeda.
    expect(describeRetriever('LEXICAL')).toContain('KATA KUNCI');
    expect(describeRetriever('SEMANTIC')).toContain('MAKNA');
    expect(describeRetriever('HYBRID')).toContain('kata kunci');
    expect(describeRetriever('HYBRID')).toContain('makna');
  });

  it('penjelasan leksikal menyebut keterbatasannya', () => {
    expect(describeRetriever('LEXICAL')).toContain('kata berbeda');
  });

  it('penjelasan semantik menyebut keterbatasannya', () => {
    // Nomor surat tidak punya makna yang dapat didekati.
    expect(describeRetriever('SEMANTIC')).toContain('persis');
  });
});
