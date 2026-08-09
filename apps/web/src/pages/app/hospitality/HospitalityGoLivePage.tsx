import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Globe2, RefreshCw, Rocket, Save } from 'lucide-react';
import { api } from '../../../lib/api';
import { PageHeader, useToast } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface Property { id: string; nama: string; code: string }
interface Readiness extends Record<string, number> { buildings: number; sellable_spaces: number; inventory_days: number; waitlist_open: number; revenue_pending: number; channel_pending: number; channel_exceptions: number; published_content: number }
interface Domain { id: string; host: string; domainKind: string; status: string; verificationRecord: string | null; tlsStatus: string; certificateExpiresAt: string | null; lastError: string | null }
interface Content { id: string; content_type: string; slug: string; title: string; summary: string | null; status: string; version: number }

export function HospitalityGoLivePage() {
  const toast = useToast();
  const message = useErrorMessage();
  const client = useQueryClient();
  const [propertyId, setPropertyId] = useState('');
  const [domain, setDomain] = useState('');
  const [building, setBuilding] = useState({ code: '', name: '' });
  const [content, setContent] = useState({ contentType: 'PAGE', slug: '', title: '', summary: '' });
  const [inventory, setInventory] = useState({ roomTypeId: '', startDate: '', endDate: '' });
  const [forecast, setForecast] = useState({ startDate: '', days: '30' });

  const properties = useQuery({ queryKey: ['hospitality-properti'], queryFn: () => api.get<Property[]>('/hospitality/properti') });
  useEffect(() => { if (!propertyId && properties.data?.[0]) setPropertyId(properties.data[0].id); }, [propertyId, properties.data]);
  const readiness = useQuery({ queryKey: ['hospitality-go-live', propertyId], queryFn: () => api.get<Readiness>(`/hospitality/go-live/${propertyId}/readiness`), enabled: !!propertyId });
  const domains = useQuery({ queryKey: ['hospitality-domains'], queryFn: () => api.get<Domain[]>('/hospitality/domains') });
  const contents = useQuery({ queryKey: ['hospitality-site-content'], queryFn: () => api.get<Content[]>('/hospitality/go-live/site/content') });

  const setContext = useActionMutation(() => api.post(`/hospitality/go-live/${propertyId}/active-context`, { roleCode: 'HOSPITALITY_ADMIN' }), 'Konteks properti aktif.', ['hospitality-go-live']);
  const addDomain = useActionMutation(() => api.post<{ verificationRecord: string; verificationValue: string }>('/hospitality/domains', { host: domain }), 'Domain dicatat. Pasang bukti DNS yang ditampilkan.', ['hospitality-domains']);
  const addBuilding = useActionMutation(() => api.post(`/hospitality/go-live/${propertyId}/buildings`, building), 'Gedung ditambahkan.', ['hospitality-go-live']);
  const saveContent = useActionMutation(() => api.post('/hospitality/go-live/site/content', { ...content, body: { blocks: [] }, seo: { title: content.title, description: content.summary } }), 'Konten disimpan untuk review.', ['hospitality-site-content']);
  const reconcile = useActionMutation(() => api.post(`/hospitality/go-live/${propertyId}/inventory/reconcile`, inventory), 'Ledger inventory direkonsiliasi.', ['hospitality-go-live']);
  const generateForecast = useActionMutation(() => api.post(`/hospitality/go-live/${propertyId}/revenue/forecast`, { startDate: forecast.startDate, days: Number(forecast.days) }), 'Forecast berbasis pace diperbarui.', ['hospitality-go-live']);

  const verifyDomain = useMutation({ mutationFn: (id: string) => api.post(`/hospitality/domains/${id}/verify`, {}), onSuccess: () => { toast.push('Domain terverifikasi; menunggu sertifikat TLS.', 'success'); void client.invalidateQueries({ queryKey: ['hospitality-domains'] }); }, onError: (e) => toast.push(message(e, (_k, f) => f ?? 'Verifikasi gagal.'), 'error') });
  const publish = useMutation({ mutationFn: (id: string) => api.post(`/hospitality/go-live/site/content/${id}/publish`, {}), onSuccess: () => { toast.push('Konten diterbitkan.', 'success'); void client.invalidateQueries({ queryKey: ['hospitality-site-content'] }); } });

  const metrics = readiness.data ? Object.entries(readiness.data) : [];
  return <div className="space-y-6">
    <PageHeader title="Go-live Control Center" description="CMS, domain, konteks properti, inventory, revenue, dan bukti readiness dalam satu workspace." />
    <section className="card p-5">
      <div className="flex flex-wrap items-end gap-3"><label className="min-w-64 text-sm font-semibold">Properti aktif<select className="input mt-1" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>{(properties.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.code} — {p.nama}</option>)}</select></label><button className="btn-primary" disabled={!propertyId || setContext.isPending} onClick={() => setContext.mutate()}><CheckCircle2 className="h-4 w-4" />Gunakan konteks</button><button className="btn-secondary" onClick={() => void readiness.refetch()}><RefreshCw className="h-4 w-4" />Muat ulang</button></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{metrics.map(([key, value]) => <div key={key} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"><p className="text-xs uppercase text-slate-500">{key.replaceAll('_', ' ')}</p><p className="mt-1 text-2xl font-black">{value}</p></div>)}</div>
    </section>

    <div className="grid gap-6 xl:grid-cols-2">
      <section className="card p-5"><h2 className="flex items-center gap-2 font-bold"><Globe2 className="h-5 w-5 text-indigo-600" />Custom domain & TLS</h2><div className="mt-4 flex gap-2"><input className="input" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="booking.hotelanda.com" /><button className="btn-primary" disabled={!domain || addDomain.isPending} onClick={() => addDomain.mutate()}>Tambah</button></div>{addDomain.data && <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900"><p>Record: <code>{addDomain.data.verificationRecord}</code></p><p>Value: <code className="break-all">{addDomain.data.verificationValue}</code></p></div>}<div className="mt-4 space-y-2">{(domains.data ?? []).map((d) => <div key={d.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800"><div className="flex items-center justify-between gap-3"><div><p className="font-bold">{d.host}</p><p className="text-xs text-slate-500">{d.status} · TLS {d.tlsStatus}</p></div>{d.status === 'PENDING' && <button className="btn-secondary" onClick={() => verifyDomain.mutate(d.id)}>Verifikasi DNS</button>}</div>{d.lastError && <p className="mt-2 text-xs text-red-600">{d.lastError}</p>}</div>)}</div></section>

      <section className="card p-5"><h2 className="flex items-center gap-2 font-bold"><Save className="h-5 w-5 text-indigo-600" />CMS situs properti</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><select className="input" value={content.contentType} onChange={(e) => setContent({ ...content, contentType: e.target.value })}><option>PAGE</option><option>ARTICLE</option><option>FAQ</option><option>GALLERY</option><option>MENU</option></select><input className="input" value={content.slug} onChange={(e) => setContent({ ...content, slug: e.target.value })} placeholder="slug-halaman" /><input className="input sm:col-span-2" value={content.title} onChange={(e) => setContent({ ...content, title: e.target.value })} placeholder="Judul" /><textarea className="input sm:col-span-2" value={content.summary} onChange={(e) => setContent({ ...content, summary: e.target.value })} placeholder="Ringkasan" /><button className="btn-primary sm:col-span-2" disabled={!content.slug || !content.title || saveContent.isPending} onClick={() => saveContent.mutate()}>Simpan draft</button></div><div className="mt-4 space-y-2">{(contents.data ?? []).map((c) => <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800"><div><p className="font-bold">{c.title}</p><p className="text-xs text-slate-500">{c.content_type}/{c.slug} · {c.status} · v{c.version}</p></div>{c.status !== 'PUBLISHED' && <button className="btn-secondary" onClick={() => publish.mutate(c.id)}>Terbitkan</button>}</div>)}</div></section>

      <section className="card p-5"><h2 className="font-bold">Fondasi properti & ledger</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><input className="input" value={building.code} onChange={(e) => setBuilding({ ...building, code: e.target.value })} placeholder="Kode gedung" /><input className="input" value={building.name} onChange={(e) => setBuilding({ ...building, name: e.target.value })} placeholder="Nama gedung" /><button className="btn-secondary sm:col-span-2" disabled={!propertyId || !building.code || !building.name} onClick={() => addBuilding.mutate()}>Tambah gedung</button><input className="input sm:col-span-2" value={inventory.roomTypeId} onChange={(e) => setInventory({ ...inventory, roomTypeId: e.target.value })} placeholder="ID tipe kamar" /><input type="date" className="input" value={inventory.startDate} onChange={(e) => setInventory({ ...inventory, startDate: e.target.value })} /><input type="date" className="input" value={inventory.endDate} onChange={(e) => setInventory({ ...inventory, endDate: e.target.value })} /><button className="btn-primary sm:col-span-2" disabled={!inventory.roomTypeId || !inventory.startDate || !inventory.endDate} onClick={() => reconcile.mutate()}>Rekonsiliasi ledger stay-date</button></div></section>

      <section className="card p-5"><h2 className="flex items-center gap-2 font-bold"><Rocket className="h-5 w-5 text-indigo-600" />Revenue forecast</h2><p className="mt-2 text-sm text-slate-500">Forecast memakai reservation on-books dan pickup 7/30 hari; rekomendasi harga tetap memerlukan review dan publish terpisah.</p><div className="mt-4 flex flex-wrap gap-3"><input type="date" className="input max-w-52" value={forecast.startDate} onChange={(e) => setForecast({ ...forecast, startDate: e.target.value })} /><input type="number" min="1" max="365" className="input max-w-28" value={forecast.days} onChange={(e) => setForecast({ ...forecast, days: e.target.value })} /><button className="btn-primary" disabled={!propertyId || !forecast.startDate} onClick={() => generateForecast.mutate()}>Generate</button></div></section>
    </div>
  </div>;
}

function useActionMutation<T>(action: () => Promise<T>, success: string, invalidate: string[]) {
  const toast = useToast();
  const message = useErrorMessage();
  const client = useQueryClient();
  return useMutation({ mutationFn: action, onSuccess: () => { toast.push(success, 'success'); void client.invalidateQueries({ queryKey: invalidate }); }, onError: (error) => toast.push(message(error, (_key, fallback) => fallback ?? 'Operasi gagal.'), 'error') });
}
