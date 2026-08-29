import React, { useMemo, useState } from 'react'
import { formatRupiah, formatTanggal, formatTanggalJam, namaPencatat } from '../utils'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'

export default function TransaksiList({ items, onChanged }) {
  const { session } = useAuth()
  const [visible, setVisible] = useState(5)
  const [editing, setEditing] = useState(null)
  const shown = useMemo(() => items.slice(0, visible), [items, visible])

  async function hapus(id) {
    if (!confirm('Hapus catatan ini?')) return
    const { error } = await supabase.from('transaksi').delete().eq('id', id)
    if (error) return alert('Gagal menghapus: ' + error.message)
    onChanged && onChanged()
  }

  if (!items.length) return <div className="card history-empty">Belum ada catatan pada pencarian ini.</div>

  return <>
    <div className="history-card card">
      <div className="history-toolbar">
        <div>
          <div className="history-title">Riwayat transaksi</div>
          <div className="history-subtitle">Geser tabel ke samping pada layar HP untuk melihat semua informasi.</div>
        </div>
        <div className="history-count">{items.length} transaksi</div>
      </div>

      <div className="history-scroll" role="region" aria-label="Histori transaksi" tabIndex="0">
        <table className="history-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Jenis</th>
              <th>Kategori</th>
              <th>Nominal</th>
              <th>Sumber / Tujuan</th>
              <th>Keterangan</th>
              <th>Dicatat oleh</th>
              <th>Waktu pencatatan</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((tx) => {
              const masuk = tx.tipe === 'pemasukan'
              const milikSaya = tx.user_id === session.user.id
              const pencatat = namaPencatat(tx)
              return <tr key={tx.id}>
                <td className="history-date">{formatTanggal(tx.tanggal)}</td>
                <td><span className={`transaction-badge ${masuk ? 'income' : 'expense'}`}>{masuk ? 'Pemasukan' : 'Pengeluaran'}</span></td>
                <td className="history-main">{tx.kategori}</td>
                <td className={`history-amount mono ${masuk ? 'income-text' : 'expense-text'}`}>{masuk ? '+' : '−'}{formatRupiah(tx.jumlah)}</td>
                <td>{tx.sumber_tujuan || <span className="muted">—</span>}</td>
                <td className="history-wrap">{tx.keterangan || <span className="muted">—</span>}</td>
                <td><strong>{pencatat.nama}</strong><small className="history-role">{pencatat.peran}</small></td>
                <td className="history-created">{formatTanggalJam(tx.created_at)}</td>
                <td>
                  {milikSaya ? <div className="history-actions"><button onClick={() => setEditing(tx)} className="text-button">Edit</button><button onClick={() => hapus(tx.id)} className="text-button danger-text">Hapus</button></div> : <span className="muted">—</span>}
                </td>
              </tr>
            })}
          </tbody>
        </table>
      </div>

      <div className="history-scroll-hint"><span>↔</span> Geser ke samping untuk melihat kolom lainnya</div>
    </div>

    {visible < items.length && <button className="btn btn-ghost load-more" onClick={() => setVisible(v => v + 5)}>Lihat Selengkapnya ({Math.min(5, items.length - visible)} lagi)</button>}
    {visible >= items.length && items.length > 5 && <button className="btn btn-ghost load-more" onClick={() => setVisible(5)}>Tampilkan lebih sedikit</button>}
    {editing && <EditModal tx={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged && onChanged() }} />}
  </>
}

function EditModal({tx,onClose,onSaved}) {
  const [jumlah,setJumlah]=useState(String(Number(tx.jumlah).toLocaleString('id-ID')))
  const [tanggal,setTanggal]=useState(tx.tanggal)
  const [kategori,setKategori]=useState(tx.kategori)
  const [sumber,setSumber]=useState(tx.sumber_tujuan||'')
  const [ket,setKet]=useState(tx.keterangan||'')
  const [saving,setSaving]=useState(false)
  async function save(e){e.preventDefault();setSaving(true);const nominal=Number(jumlah.replace(/\D/g,''));const {error}=await supabase.from('transaksi').update({tanggal,kategori,jumlah:nominal,sumber_tujuan:sumber.trim()||null,keterangan:ket.trim()||null}).eq('id',tx.id);setSaving(false);if(error)return alert('Gagal menyimpan: '+error.message);onSaved()}
  return <div className="modal-backdrop"><form className="card modal" onSubmit={save}><h3>Edit Transaksi</h3><div className="field"><label>Tanggal transaksi</label><input type="date" value={tanggal} onChange={e=>setTanggal(e.target.value)} required/></div><div className="field"><label>Kategori</label><input value={kategori} onChange={e=>setKategori(e.target.value)} required/></div><div className="field"><label>Nominal (Rp)</label><input inputMode="numeric" value={jumlah} onChange={e=>setJumlah(e.target.value.replace(/\D/g,'').replace(/\B(?=(\d{3})+(?!\d))/g,'.'))} required/></div><div className="field"><label>Sumber/Tujuan</label><input value={sumber} onChange={e=>setSumber(e.target.value)}/></div><div className="field"><label>Keterangan</label><textarea value={ket} onChange={e=>setKet(e.target.value)}/></div><div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={saving}>{saving?'Menyimpan…':'Simpan perubahan'}</button></div></form></div>
}
