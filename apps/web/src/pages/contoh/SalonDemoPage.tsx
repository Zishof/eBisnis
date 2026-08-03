import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Crown,
  Download,
  LogIn,
  ReceiptText,
  Scissors,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
} from 'lucide-react';
import { useAuth } from '../../app/auth-context';
import {
  buatProdukSalon,
  buatTransaksiSalon,
  jamKerjaSalon,
  kursiSalon,
  ringkasTransaksi,
  type KategoriSalon,
  type ProdukSalon,
  type TransaksiSalon,
} from './salon-data';

const warna = ['#1d4ed8', '#059669', '#f97316', '#9333ea', '#0891b2', '#be123c'];

const uang = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const angka = new Intl.NumberFormat('id-ID');

type Tab = 'website' | 'booking' | 'dashboard' | 'produk' | 'transaksi';

const AKUN_UJI_SALON = [
  {
    label: 'Pelanggan',
    username: 'pelanggan.salon',
    password: 'SalonDemo#2026',
    roleCode: 'PELAPOR_TIKET',
    tujuan: 'Melihat promo, booking, invoice, struk, dan riwayat kunjungan.',
    icon: UserRound,
  },
  {
    label: 'Manajemen Salon',
    username: 'manajemen.salon',
    password: 'SalonDemo#2026',
    roleCode: 'MANAJER_OPERASIONAL',
    tujuan: 'Mengelola booking, layanan, petugas, kursi, stok, dan operasional harian.',
    icon: Users,
  },
  {
    label: 'Pemilik Salon',
    username: 'pemilik.salon',
    password: 'SalonDemo#2026',
    roleCode: 'PEMILIK_USAHA',
    tujuan: 'Membaca dashboard omzet, laba, tren, performa layanan, dan keputusan bisnis.',
    icon: Crown,
  },
];

export function SalonDemoPage() {
  const [tab, setTab] = useState<Tab>('website');
  const [busyRole, setBusyRole] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const { loginDemo } = useAuth();
  const navigate = useNavigate();
  const produk = useMemo(() => buatProdukSalon(), []);
  const transaksi = useMemo(() => buatTransaksiSalon(produk), [produk]);
  const ringkasan = useMemo(() => ringkasTransaksi(transaksi), [transaksi]);
  const produkUnggulan = produk.filter((item) => item.unggulan).slice(0, 8);

  const masukSebagai = async (roleCode: string) => {
    setBusyRole(roleCode);
    setLoginError(null);
  try {
      await loginDemo();
      navigate('/app', { replace: true });
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Tidak dapat membuat sesi demo salon.');
    } finally {
      setBusyRole(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="container-page flex min-h-16 flex-wrap items-center justify-between gap-3 py-3">
          <a href="#atas" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-950 text-white">
              <Scissors className="h-5 w-5" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-bold">Salon Cantik Demo</span>
              <span className="block text-xs text-slate-500">salon.ebisnis.id</span>
            </span>
          </a>
          <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <a
              href="#akun-uji"
              className="inline-flex items-center gap-2 rounded-lg border border-teal-700 px-4 py-2 text-teal-800 transition hover:bg-teal-50"
            >
              <LogIn className="h-4 w-4" aria-hidden />
              Login
            </a>
            {[
              ['website', 'Website'],
              ['booking', 'Booking'],
              ['dashboard', 'Dashboard'],
              ['produk', '100+ Produk'],
              ['transaksi', '1000 Transaksi'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={
                  tab === key
                    ? 'rounded-lg bg-teal-700 px-4 py-2 text-white shadow-sm transition hover:bg-teal-800'
                    : 'rounded-lg px-4 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950'
                }
                onClick={() => setTab(key as Tab)}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <section id="atas" className="border-b border-slate-200 bg-white">
        <div className="container-page grid gap-8 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <span className="section-eyebrow">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Contoh tenant salon dan barber shop
            </span>
            <h1 className="max-w-4xl text-3xl font-bold tracking-tight sm:text-5xl">
              Website booking, katalog layanan, invoice, dan dashboard salon siap uji.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Contoh ini mengikuti brief Barber Shop: pelanggan memilih layanan, tanggal, jam,
              kursi cukur, data kontak, lalu admin melihat status booking sampai selesai dan
              membaca performa transaksi salon.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <MiniStat label="Produk/layanan" value={`${produk.length}+`} />
              <MiniStat label="Transaksi contoh" value={angka.format(transaksi.length)} />
              <MiniStat label="Omzet selesai" value={uang.format(ringkasan.omzet)} />
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-sm">
            <img
              className="h-72 w-full object-cover opacity-90"
              src="https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1200&q=80"
              alt="Interior salon dan barber shop modern"
            />
            <div className="grid gap-3 p-5 text-white sm:grid-cols-3">
              <InfoGelap icon={<Clock className="h-4 w-4" aria-hidden />} label="Booking per jam" />
              <InfoGelap icon={<Users className="h-4 w-4" aria-hidden />} label="6 kursi aktif" />
              <InfoGelap icon={<ReceiptText className="h-4 w-4" aria-hidden />} label="Invoice layanan" />
            </div>
          </div>
        </div>
      </section>

      <div className="container-page py-8">
        {tab === 'website' && <WebsiteSalon produk={produkUnggulan} />}
        {tab === 'website' && (
          <AkunUjiSalon
            busyRole={busyRole}
            error={loginError}
            onMasuk={(roleCode) => void masukSebagai(roleCode)}
          />
        )}
        {tab === 'booking' && <BookingSalon transaksi={transaksi} />}
        {tab === 'dashboard' && <DashboardSalon transaksi={transaksi} produk={produk} />}
        {tab === 'produk' && <ProdukSalonTable produk={produk} />}
        {tab === 'transaksi' && <TransaksiSalonTable transaksi={transaksi} />}
      </div>
    </main>
  );
}

function WebsiteSalon({ produk }: { produk: ProdukSalon[] }) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <PanelInfo
          ikon={<CalendarDays className="h-5 w-5" aria-hidden />}
          judul="Booking online"
          isi="Pelanggan mengisi nama, layanan, tanggal, jam, kursi, nomor telepon, dan email."
        />
        <PanelInfo
          ikon={<Scissors className="h-5 w-5" aria-hidden />}
          judul="Kursi & petugas"
          isi="Setiap kursi punya petugas, jadwal kerja, dan status ketersediaan."
        />
        <PanelInfo
          ikon={<ReceiptText className="h-5 w-5" aria-hidden />}
          judul="Invoice layanan"
          isi="Invoice memuat pelanggan, petugas, kursi, layanan, harga, dan total tagihan."
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Produk dan layanan unggulan</h2>
            <p className="mt-1 text-sm text-slate-600">
              Admin dapat mengganti isi website toko, promosi, dan layanan yang ditampilkan.
            </p>
          </div>
          <a
            className="inline-flex items-center gap-2 rounded-lg border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-50"
            href="/update/ebisnis-pelanggan-salon.apk"
          >
            <Download className="h-4 w-4" aria-hidden />
            APK pelanggan Android
          </a>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {produk.map((item) => (
            <ProdukCard key={item.id} produk={item} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Jam kerja</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="table-grid">
              <thead>
                <tr>
                  <th>Hari</th>
                  <th>Mulai</th>
                  <th>Selesai</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {jamKerjaSalon.map((hari) => (
                  <tr key={hari.hari}>
                    <td>{hari.hari}</td>
                    <td>{hari.mulai}</td>
                    <td>{hari.selesai}</td>
                    <td>{hari.keterangan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Kursi cukur aktif</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {kursiSalon.map((kursi) => (
              <div key={kursi.nama} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-950">{kursi.nama}</p>
                <p className="text-sm text-slate-600">{kursi.petugas}</p>
                <p className="mt-1 text-xs text-slate-500">{kursi.spesialis}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function AkunUjiSalon({
  busyRole,
  error,
  onMasuk,
}: {
  busyRole: string | null;
  error: string | null;
  onMasuk: (roleCode: string) => void;
}) {
  return (
    <section id="akun-uji" className="mt-6 rounded-xl border border-teal-200 bg-teal-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
            Akun uji coba web dan Android
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">
            Masuk sebagai pelanggan, manajemen, atau pemilik salon
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
            Username dan password di bawah dipakai sebagai kredensial demo. Tombol masuk cepat
            membuat sesi sandbox sesuai persona; APK Android pelanggan dan POS memakai daftar
            persona yang sama agar alur uji tidak berbeda antara web dan perangkat.
          </p>
        </div>
        <a
          className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          href="/update/ebisnis-pelanggan-salon.apk"
        >
          <Download className="h-4 w-4" aria-hidden />
          APK pelanggan Android
        </a>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {AKUN_UJI_SALON.map((akun) => {
          const Icon = akun.icon;
          const sibuk = busyRole === akun.roleCode;
          return (
            <article key={akun.roleCode} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-teal-100 text-teal-800">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-bold text-slate-950">{akun.label}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{akun.tujuan}</p>
                </div>
              </div>
              <dl className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Username</dt>
                  <dd className="font-semibold text-slate-950">{akun.username}</dd>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Password</dt>
                  <dd className="font-semibold text-slate-950">{akun.password}</dd>
                </div>
              </dl>
              <button
                type="button"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-wait disabled:opacity-70"
                onClick={() => onMasuk(akun.roleCode)}
                disabled={Boolean(busyRole)}
              >
                <LogIn className="h-4 w-4" aria-hidden />
                {sibuk ? 'Membuka sesi...' : `Masuk sebagai ${akun.label}`}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function BookingSalon({ transaksi }: { transaksi: TransaksiSalon[] }) {
  const booking = transaksi.slice(-18);
  return (
    <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
      <section className="card p-5">
        <h2 className="text-xl font-bold">Form booking pelanggan</h2>
        <div className="mt-4 grid gap-3">
          {[
            'Nama pelanggan',
            'Servis pelayanan',
            'Tanggal akan dilayani',
            'Jam akan dilayani',
            'Nomor kursi cukur',
            'Nomor telepon',
            'Email pelanggan',
          ].map((label) => (
            <label key={label} className="block">
              <span className="field-label">{label}</span>
              <input className="field-input" placeholder={label} readOnly />
            </label>
          ))}
          <button type="button" className="btn-primary">
            Cek ketersediaan kursi
          </button>
        </div>
      </section>
      <section className="card p-5">
        <h2 className="text-xl font-bold">Simulasi ketersediaan kursi hari ini</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {kursiSalon.map((kursi, index) => {
            const item = booking[index];
            const penuh = index % 5 === 0;
            return (
              <div
                key={kursi.nama}
                className={penuh ? 'rounded-lg border border-rose-200 bg-rose-50 p-4' : 'rounded-lg border border-emerald-200 bg-emerald-50 p-4'}
              >
                <p className="font-semibold">{kursi.nama}</p>
                <p className="text-sm text-slate-600">{kursi.petugas}</p>
                <p className={penuh ? 'mt-3 text-sm font-bold text-rose-700' : 'mt-3 text-sm font-bold text-emerald-700'}>
                  {penuh ? 'Full book' : 'Tersedia'}
                </p>
                {item && (
                  <p className="mt-2 text-xs text-slate-600">
                    {item.jam} - {item.pelanggan} - {item.produkNama}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function DashboardSalon({ transaksi, produk }: { transaksi: TransaksiSalon[]; produk: ProdukSalon[] }) {
  const ringkasan = ringkasTransaksi(transaksi);
  const trend = kelompokTanggal(ringkasan.selesai, 14);
  const kategoriData = kelompokKategori(ringkasan.selesai);
  const metodeData = kelompokMetode(ringkasan.selesai);
  const radarData = buatRadar(ringkasan.selesai);
  const statusData = kelompokStatus(transaksi);
  const topProduk = topProdukSalon(ringkasan.selesai).slice(0, 8);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Omzet" value={uang.format(ringkasan.omzet)} />
        <Metric label="Laba" value={uang.format(ringkasan.laba)} />
        <Metric label="Transaksi selesai" value={angka.format(ringkasan.jumlah)} />
        <Metric label="Rata-rata nota" value={uang.format(ringkasan.rataNota)} />
        <Metric label="Produk aktif" value={angka.format(produk.length)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <ChartCard title="Trend omzet 14 hari terakhir">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="tanggal" />
              <YAxis tickFormatter={(value: number) => `${Math.round(value / 1000000)} jt`} />
              <Tooltip formatter={(value: number) => uang.format(value)} />
              <Line type="monotone" dataKey="omzet" stroke="#1d4ed8" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="laba" stroke="#059669" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Spider web performa salon">
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="label" />
              <Radar dataKey="nilai" stroke="#9333ea" fill="#9333ea" fillOpacity={0.32} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <ChartCard title="Omzet per kategori">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={kategoriData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="kategori" hide />
              <YAxis tickFormatter={(value: number) => `${Math.round(value / 1000000)} jt`} />
              <Tooltip formatter={(value: number) => uang.format(value)} />
              <Bar dataKey="omzet" radius={[6, 6, 0, 0]}>
                {kategoriData.map((_, index) => (
                  <Cell key={warna[index % warna.length]} fill={warna[index % warna.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Metode bayar">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={metodeData} dataKey="nilai" nameKey="metode" outerRadius={88} label>
                {metodeData.map((_, index) => (
                  <Cell key={warna[index % warna.length]} fill={warna[index % warna.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => uang.format(value)} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Status booking">
          <div className="space-y-3">
            {statusData.map((item) => (
              <div key={item.status}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{item.status}</span>
                  <span className="font-semibold">{angka.format(item.jumlah)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-brand-700" style={{ width: `${Math.min(100, item.jumlah)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </section>

      <section className="card p-5">
        <h2 className="text-xl font-bold">Layanan terlaris</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="table-grid">
            <thead>
              <tr>
                <th>Layanan</th>
                <th>Kategori</th>
                <th>Transaksi</th>
                <th>Omzet</th>
                <th>Laba</th>
              </tr>
            </thead>
            <tbody>
              {topProduk.map((item) => (
                <tr key={item.nama}>
                  <td>{item.nama}</td>
                  <td>{item.kategori}</td>
                  <td>{angka.format(item.jumlah)}</td>
                  <td>{uang.format(item.omzet)}</td>
                  <td>{uang.format(item.laba)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ProdukSalonTable({ produk }: { produk: ProdukSalon[] }) {
  return (
    <section className="card p-5">
      <h2 className="text-xl font-bold">Data produk dan layanan salon</h2>
      <p className="mt-1 text-sm text-slate-600">Minimal 100 item tersedia sebagai contoh tenant salon.</p>
      <div className="mt-4 max-h-[620px] overflow-auto">
        <table className="table-grid">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama</th>
              <th>Kategori</th>
              <th>Durasi</th>
              <th>Harga</th>
              <th>HPP</th>
              <th>Stok</th>
            </tr>
          </thead>
          <tbody>
            {produk.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.nama}</td>
                <td>{item.kategori}</td>
                <td>{item.durasiMenit ? `${item.durasiMenit} menit` : 'Retail'}</td>
                <td>{uang.format(item.harga)}</td>
                <td>{uang.format(item.hpp)}</td>
                <td>{item.stok ?? 'Layanan'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TransaksiSalonTable({ transaksi }: { transaksi: TransaksiSalon[] }) {
  return (
    <section className="card p-5">
      <h2 className="text-xl font-bold">Data transaksi rolling</h2>
      <p className="mt-1 text-sm text-slate-600">
        1000 transaksi contoh dibuat ulang mengikuti tanggal hari ini agar dashboard terasa terbaru.
      </p>
      <div className="mt-4 max-h-[620px] overflow-auto">
        <table className="table-grid">
          <thead>
            <tr>
              <th>No.</th>
              <th>Tanggal</th>
              <th>Pelanggan</th>
              <th>Layanan</th>
              <th>Kursi</th>
              <th>Status</th>
              <th>Omzet</th>
              <th>Laba</th>
            </tr>
          </thead>
          <tbody>
            {transaksi
              .slice()
              .reverse()
              .map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>
                    {item.tanggal} {item.jam}
                  </td>
                  <td>{item.pelanggan}</td>
                  <td>{item.produkNama}</td>
                  <td>{item.kursi}</td>
                  <td>{item.status}</td>
                  <td>{uang.format(item.omzet)}</td>
                  <td>{uang.format(item.laba)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function InfoGelap({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-slate-100">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function PanelInfo({ ikon, judul, isi }: { ikon: ReactNode; judul: string; isi: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className="grid h-11 w-11 place-items-center rounded-lg bg-teal-50 text-teal-700">{ikon}</span>
      <h2 className="mt-4 text-lg font-bold text-slate-950">{judul}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{isi}</p>
    </article>
  );
}

function ProdukCard({ produk }: { produk: ProdukSalon }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="badge bg-slate-100 text-slate-700">{produk.kategori}</span>
        {produk.unggulan && <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />}
      </div>
      <h3 className="mt-3 font-bold text-slate-950">{produk.nama}</h3>
      <p className="mt-1 text-sm text-slate-500">
        {produk.durasiMenit ? `${produk.durasiMenit} menit` : `Stok ${produk.stok}`}
      </p>
      <p className="mt-3 text-lg font-bold text-teal-800">{uang.format(produk.harga)}</p>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
        <TrendingUp className="h-4 w-4 text-brand-700" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}

function kelompokTanggal(transaksi: TransaksiSalon[], hari: number) {
  const tanggalTerakhir = transaksi[transaksi.length - 1]?.tanggal ?? new Date().toISOString().slice(0, 10);
  const akhir = new Date(`${tanggalTerakhir}T12:00:00`);
  return Array.from({ length: hari }, (_, index) => {
    const tanggal = new Date(akhir);
    tanggal.setDate(akhir.getDate() - (hari - index - 1));
    const iso = tanggal.toISOString().slice(0, 10);
    const items = transaksi.filter((item) => item.tanggal === iso);
    return {
      tanggal: iso.slice(5),
      omzet: items.reduce((total, item) => total + item.omzet, 0),
      laba: items.reduce((total, item) => total + item.laba, 0),
    };
  });
}

function kelompokKategori(transaksi: TransaksiSalon[]) {
  const peta = new Map<KategoriSalon, { kategori: KategoriSalon; omzet: number; laba: number; jumlah: number }>();
  for (const item of transaksi) {
    const sekarang = peta.get(item.kategori) ?? { kategori: item.kategori, omzet: 0, laba: 0, jumlah: 0 };
    sekarang.omzet += item.omzet;
    sekarang.laba += item.laba;
    sekarang.jumlah += 1;
    peta.set(item.kategori, sekarang);
  }
  return [...peta.values()].sort((a, b) => b.omzet - a.omzet);
}

function kelompokMetode(transaksi: TransaksiSalon[]) {
  const peta = new Map<string, number>();
  for (const item of transaksi) peta.set(item.metode, (peta.get(item.metode) ?? 0) + item.omzet);
  return [...peta.entries()].map(([metode, nilai]) => ({ metode, nilai }));
}

function kelompokStatus(transaksi: TransaksiSalon[]) {
  const peta = new Map<string, number>();
  for (const item of transaksi) peta.set(item.status, (peta.get(item.status) ?? 0) + 1);
  return [...peta.entries()].map(([status, jumlah]) => ({ status, jumlah }));
}

function topProdukSalon(transaksi: TransaksiSalon[]) {
  const peta = new Map<string, { nama: string; kategori: KategoriSalon; jumlah: number; omzet: number; laba: number }>();
  for (const item of transaksi) {
    const sekarang = peta.get(item.produkId) ?? {
      nama: item.produkNama,
      kategori: item.kategori,
      jumlah: 0,
      omzet: 0,
      laba: 0,
    };
    sekarang.jumlah += 1;
    sekarang.omzet += item.omzet;
    sekarang.laba += item.laba;
    peta.set(item.produkId, sekarang);
  }
  return [...peta.values()].sort((a, b) => b.omzet - a.omzet);
}

function buatRadar(transaksi: TransaksiSalon[]) {
  const kategoriData = kelompokKategori(transaksi);
  const maxOmzet = Math.max(...kategoriData.map((item) => item.omzet), 1);
  return kategoriData.map((item) => ({
    label: item.kategori.replace(' ', '\n'),
    nilai: Math.round((item.omzet / maxOmzet) * 100),
  }));
}
