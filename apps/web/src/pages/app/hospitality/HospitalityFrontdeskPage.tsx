import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { DataGrid, PageHeader, StatusBadge, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface Property { id: string; code: string; nama: string; business_date: string }
interface BoardRow extends Record<string, unknown> {
  room_stay_id: string; reservation_id: string; code: string; full_name: string;
  checkin_date: string; checkout_date: string; room_id: string | null; room_number: string | null;
  stay_status: string; stay_id: string | null; eta: string | null;
}

export function HospitalityFrontdeskPage() {
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const client = useQueryClient();
  const [propertyId, setPropertyId] = useState('');
  const [businessDate, setBusinessDate] = useState(new Date().toISOString().slice(0, 10));
  const [selected, setSelected] = useState<BoardRow | null>(null);
  const [roomId, setRoomId] = useState('');
  const [eta, setEta] = useState('');
  const [keyValidUntil, setKeyValidUntil] = useState('');
  const [moveRoomId, setMoveRoomId] = useState('');
  const [moveReason, setMoveReason] = useState('');
  const [handover, setHandover] = useState({ shiftCode: '', notes: '' });

  const properties = useQuery({ queryKey: ['hospitality-properti-frontdesk'], queryFn: () => api.get<Property[]>('/hospitality/properti') });
  const board = useQuery({
    queryKey: ['hospitality-frontdesk-board', propertyId, businessDate],
    queryFn: () => api.get<BoardRow[]>(`/hospitality/frontdesk/board?propertyId=${encodeURIComponent(propertyId)}&businessDate=${businessDate}`),
    enabled: !!propertyId,
  });
  const refresh = () => void client.invalidateQueries({ queryKey: ['hospitality-frontdesk-board'] });
  const fail = (e: unknown) => toast.push(errorMessage(e, (_key, fallback) => fallback ?? 'Operasi front office gagal.'), 'error');

  const preArrival = useMutation({
    mutationFn: () => api.post(`/hospitality/frontdesk/room-stays/${selected!.room_stay_id}/pre-arrival`, { eta: eta || undefined }),
    onSuccess: () => { toast.push('Data pre-arrival tersimpan.', 'success'); refresh(); }, onError: fail,
  });
  const checkin = useMutation({
    mutationFn: () => api.post(`/hospitality/frontdesk/room-stays/${selected!.room_stay_id}/check-in`, {
      roomId, identityVerified: true, guaranteeConfirmed: true, registrationCardSigned: true,
      roomReady: true, keyType: 'PHYSICAL', keyValidUntil,
    }, { headers: { 'Idempotency-Key': crypto.randomUUID() } }),
    onSuccess: () => { toast.push('Check-in selesai dan kunci fisik tercatat.', 'success'); refresh(); }, onError: fail,
  });
  const checkout = useMutation({
    mutationFn: () => api.post(`/hospitality/frontdesk/stays/${selected!.stay_id}/check-out`, {}, { headers: { 'Idempotency-Key': crypto.randomUUID() } }),
    onSuccess: () => { toast.push('Check-out selesai dan seluruh kunci dinonaktifkan.', 'success'); refresh(); }, onError: fail,
  });
  const move = useMutation({
    mutationFn: () => api.post(`/hospitality/frontdesk/stays/${selected!.stay_id}/room-move`, { toRoomId: moveRoomId, reason: moveReason, keyType: 'PHYSICAL', keyValidUntil }, { headers: { 'Idempotency-Key': crypto.randomUUID() } }),
    onSuccess: () => { toast.push('Room move tercatat pada audit trail.', 'success'); setMoveRoomId(''); setMoveReason(''); refresh(); }, onError: fail,
  });
  const saveHandover = useMutation({
    mutationFn: () => api.post('/hospitality/frontdesk/handover', { propertyId, ...handover, unresolvedItems: [] }),
    onSuccess: () => { toast.push('Shift handover tersimpan.', 'success'); setHandover({ shiftCode: '', notes: '' }); }, onError: fail,
  });

  const columns: Array<GridColumn<BoardRow>> = [
    { key: 'code', header: 'Reservasi' }, { key: 'full_name', header: 'Tamu' },
    { key: 'checkin_date', header: 'Datang' }, { key: 'checkout_date', header: 'Berangkat' },
    { key: 'room_number', header: 'Kamar', render: (r) => r.room_number ?? 'Belum ditentukan' },
    { key: 'stay_status', header: 'Status', render: (r) => <StatusBadge status={r.stay_status} /> },
    { key: 'action', header: '', render: (r) => <button className="btn-outline" type="button" onClick={() => { setSelected(r); setRoomId(r.room_id ?? ''); }}>Proses</button> },
  ];

  return <>
    <PageHeader title="Front Office" description="Pre-arrival, room assignment, check-in, in-house, room move, check-out, dan shift handover." breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Hospitality' }, { label: 'Front Office' }]} />
    <section className="card mb-4 grid gap-3 p-4 md:grid-cols-2">
      <label><span className="field-label">Properti</span><select className="field-input" value={propertyId} onChange={(e) => { setPropertyId(e.target.value); setSelected(null); }}><option value="">— Pilih properti —</option>{(properties.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.code} — {p.nama}</option>)}</select></label>
      <label><span className="field-label">Business date</span><input className="field-input" type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} /></label>
    </section>
    <DataGrid columns={columns} rows={board.data ?? []} rowKey={(r) => r.room_stay_id} loading={board.isLoading} error={board.isError ? 'Gagal memuat board.' : undefined} onRetry={() => void board.refetch()} emptyTitle={propertyId ? 'Tidak ada arrival/departure/in-house pada tanggal ini.' : 'Pilih properti untuk membuka board.'} />
    {selected && <section className="card mt-4 p-5">
      <h2 className="mb-3 text-lg font-semibold">Proses {selected.code} — {selected.full_name}</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <label><span className="field-label">ETA</span><input className="field-input" type="datetime-local" value={eta} onChange={(e) => setEta(e.target.value)} /></label>
        <div className="flex items-end"><button type="button" className="btn-outline" disabled={preArrival.isPending} onClick={() => preArrival.mutate()}>Simpan pre-arrival</button></div>
      </div>
      {selected.stay_status !== 'IN_HOUSE' && selected.stay_status !== 'CHECKED_OUT' && <div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-3">
        <label><span className="field-label">ID kamar siap</span><input className="field-input" value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="UUID kamar" /></label>
        <label><span className="field-label">Kunci berlaku sampai</span><input className="field-input" type="datetime-local" value={keyValidUntil} onChange={(e) => setKeyValidUntil(e.target.value)} /></label>
        <div className="flex items-end"><button type="button" className="btn-primary" disabled={!roomId || !keyValidUntil || checkin.isPending} onClick={() => checkin.mutate()}>Verifikasi & check-in</button></div>
      </div>}
      {selected.stay_status === 'IN_HOUSE' && <div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-4">
        <label><span className="field-label">ID kamar tujuan</span><input className="field-input" value={moveRoomId} onChange={(e) => setMoveRoomId(e.target.value)} /></label>
        <label><span className="field-label">Alasan room move</span><input className="field-input" value={moveReason} onChange={(e) => setMoveReason(e.target.value)} /></label>
        <div className="flex items-end"><button type="button" className="btn-outline" disabled={!moveRoomId || !moveReason || !keyValidUntil} onClick={() => move.mutate()}>Pindahkan & ganti kunci</button></div>
        <div className="flex items-end"><button type="button" className="btn-primary" onClick={() => checkout.mutate()}>Proses check-out</button></div>
      </div>}
    </section>}
    {propertyId && <section className="card mt-4 p-5"><h2 className="mb-3 text-lg font-semibold">Shift Handover</h2><div className="grid gap-3 md:grid-cols-3"><label><span className="field-label">Kode shift</span><input className="field-input" value={handover.shiftCode} onChange={(e) => setHandover({ ...handover, shiftCode: e.target.value })} /></label><label><span className="field-label">Catatan dan item belum selesai</span><textarea className="field-input" value={handover.notes} onChange={(e) => setHandover({ ...handover, notes: e.target.value })} /></label><div className="flex items-end"><button className="btn-primary" type="button" disabled={!handover.shiftCode || !handover.notes} onClick={() => saveHandover.mutate()}>Simpan handover</button></div></div></section>}
  </>;
}
