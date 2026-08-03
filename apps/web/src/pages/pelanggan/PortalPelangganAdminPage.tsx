import { useState } from 'react';
import { Eye, Megaphone, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { PageHeader, useToast } from '../../components/ui';
import {
  bacaKontenPortalPelanggan,
  kontenPortalPelangganBawaan,
  resetKontenPortalPelanggan,
  simpanKontenPortalPelanggan,
  type KontenPortalPelanggan,
} from './konten-portal-pelanggan';

export function PortalPelangganAdminPage() {
  const toast = useToast();
  const [konten, setKonten] = useState<KontenPortalPelanggan>(() => bacaKontenPortalPelanggan());

  const ubah = (patch: Partial<KontenPortalPelanggan>) => setKonten((sekarang) => ({ ...sekarang, ...patch }));

  const simpan = () => {
    simpanKontenPortalPelanggan(konten);
    toast.push('Konten halaman pelanggan demo disimpan.', 'success');
  };

  const reset = () => {
    resetKontenPortalPelanggan();
    setKonten(kontenPortalPelangganBawaan);
    toast.push('Konten demo dikembalikan ke bawaan.', 'info');
  };

  return (
    <div>
      <PageHeader
        title="Portal Pelanggan"
        description="Kelola halaman pelanggan demo, pengumuman toko, produk yang tampil, dan tautan APK Android pelanggan."
        breadcrumbs={[{ label: 'Aplikasi', href: '/app' }, { label: 'Portal Pelanggan' }]}
        actions={
          <>
            <a className="btn-outline" href="/pelanggan/demo" target="_blank" rel="noreferrer">
              <Eye className="h-4 w-4" aria-hidden />
              Lihat halaman
            </a>
            <button type="button" className="btn-outline" onClick={reset}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reset demo
            </button>
            <button type="button" className="btn-primary" onClick={simpan}>
              <Save className="h-4 w-4" aria-hidden />
              Simpan
            </button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="card p-5">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Profil Halaman Depan</h2>
          <div className="mt-4 grid gap-4">
            <Field label="Nama toko" value={konten.namaToko} onChange={(value) => ubah({ namaToko: value })} />
            <Field label="Slug toko" value={konten.slug} onChange={(value) => ubah({ slug: value })} />
            <Field label="Tagline" value={konten.tagline} onChange={(value) => ubah({ tagline: value })} />
            <TextArea
              label="Deskripsi website toko"
              value={konten.deskripsi}
              onChange={(value) => ubah({ deskripsi: value })}
            />
            <Field label="Alamat" value={konten.alamat} onChange={(value) => ubah({ alamat: value })} />
            <Field label="Jam buka" value={konten.jamBuka} onChange={(value) => ubah({ jamBuka: value })} />
            <Field label="WhatsApp toko" value={konten.whatsapp} onChange={(value) => ubah({ whatsapp: value })} />
            <Field
              label="URL APK pelanggan Android"
              value={konten.apkAndroidUrl}
              onChange={(value) => ubah({ apkAndroidUrl: value })}
            />
          </div>
        </section>

        <section className="space-y-6">
          <div className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Pengumuman Toko</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Dipakai untuk diskon barang tertentu, promo, perubahan jam buka, dan info penting lain.
                </p>
              </div>
              <button
                type="button"
                className="btn-outline"
                onClick={() =>
                  ubah({
                    pengumuman: [
                      {
                        id: `pengumuman-${Date.now()}`,
                        judul: 'Pengumuman baru',
                        isi: 'Tulis isi pengumuman di sini.',
                        label: 'Info',
                        tanggal: new Date().toISOString().slice(0, 10),
                      },
                      ...konten.pengumuman,
                    ],
                  })
                }
              >
                <Plus className="h-4 w-4" aria-hidden />
                Tambah
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {konten.pengumuman.map((item, index) => (
                <div key={item.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold">
                      <Megaphone className="h-4 w-4 text-brand-700" aria-hidden />
                      Pengumuman {index + 1}
                    </span>
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1 text-rose-600"
                      onClick={() =>
                        ubah({ pengumuman: konten.pengumuman.filter((_, i) => i !== index) })
                      }
                      aria-label="Hapus pengumuman"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field
                      label="Label"
                      value={item.label}
                      onChange={(value) => {
                        const berikut = [...konten.pengumuman];
                        berikut[index] = { ...item, label: value };
                        ubah({ pengumuman: berikut });
                      }}
                    />
                    <Field
                      label="Tanggal"
                      value={item.tanggal}
                      onChange={(value) => {
                        const berikut = [...konten.pengumuman];
                        berikut[index] = { ...item, tanggal: value };
                        ubah({ pengumuman: berikut });
                      }}
                    />
                    <Field
                      label="Judul"
                      value={item.judul}
                      onChange={(value) => {
                        const berikut = [...konten.pengumuman];
                        berikut[index] = { ...item, judul: value };
                        ubah({ pengumuman: berikut });
                      }}
                    />
                  </div>
                  <div className="mt-3">
                    <TextArea
                      label="Isi"
                      value={item.isi}
                      onChange={(value) => {
                        const berikut = [...konten.pengumuman];
                        berikut[index] = { ...item, isi: value };
                        ubah({ pengumuman: berikut });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Produk yang Tampil</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="table-grid">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th>Kategori</th>
                    <th>Harga</th>
                    <th>Stok</th>
                    <th>Unggulan</th>
                  </tr>
                </thead>
                <tbody>
                  {konten.produk.map((produk, index) => (
                    <tr key={produk.id}>
                      <td>
                        <input
                          className="field-input min-w-44"
                          value={produk.nama}
                          onChange={(event) => {
                            const berikut = [...konten.produk];
                            berikut[index] = { ...produk, nama: event.target.value };
                            ubah({ produk: berikut });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          className="field-input min-w-32"
                          value={produk.kategori}
                          onChange={(event) => {
                            const berikut = [...konten.produk];
                            berikut[index] = { ...produk, kategori: event.target.value };
                            ubah({ produk: berikut });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          className="field-input min-w-28"
                          value={produk.harga}
                          onChange={(event) => {
                            const berikut = [...konten.produk];
                            berikut[index] = { ...produk, harga: event.target.value };
                            ubah({ produk: berikut });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          className="field-input min-w-24"
                          value={produk.stok}
                          onChange={(event) => {
                            const berikut = [...konten.produk];
                            berikut[index] = { ...produk, stok: event.target.value };
                            ubah({ produk: berikut });
                          }}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          checked={produk.unggulan}
                          onChange={(event) => {
                            const berikut = [...konten.produk];
                            berikut[index] = { ...produk, unggulan: event.target.checked };
                            ubah({ produk: berikut });
                          }}
                          aria-label={`Jadikan ${produk.nama} unggulan`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input className="field-input" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <textarea className="field-input" rows={4} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
