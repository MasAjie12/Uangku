import React, { useMemo, useState } from 'react'
import { formatRupiah, formatTanggal, formatTanggalJam } from '../utils'
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

  if (!items.length) return <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#3C554C' }}>Belum ada catatan pada pencarian ini.</div>

  return <>
    <div className="card" style={{ padding: '0.4rem 0' }}>
      {shown.map((tx, idx) => <div key={tx.id} style={{ display:'flex', justifyContent:'space-between', gap:'1rem', padding:'0.9rem 1.3rem', borderTop:idx===0?'none':'1px solid #EFE9D9' }}>
        <div style={{ minWidth:0 }}>
          <div style={{fontWeight:600,fontSize:'.95rem',color:'#16332B'}}>{tx.kategori}{tx.sumber_tujuan&&<span style={{fontWeight:400,color:'#3C554C'}}> · {tx.sumber_tujuan}</span>}</div>
          {tx.keterangan&&<div style={{fontSize:'.85rem',color:'#3C554C',marginTop:2}}>{tx.keterangan}</div>}
          <div style={{fontSize:'.78rem',color:'#3C554C',marginTop:6}}><strong>Tanggal transaksi:</strong> {formatTanggal(tx.tanggal)}</div>
          <div style={{fontSize:'.74rem',color:'#8A7F68',marginTop:3}}>Dicatat oleh <strong>{tx.profiles?.nama_tampilan||'—'}</strong> ({tx.profiles?.peran||'Anggota'}) · waktu pencatatan {formatTanggalJam(tx.created_at)}</div>
        </div>
        <div style={{textAlign:'right',display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6}}>
          <div className="mono" style={{fontWeight:700,color:tx.tipe==='pemasukan'?'#2F7A54':'#B1483A',whiteSpace:'nowrap'}}>{tx.tipe==='pemasukan'?'+':'−'}{formatRupiah(tx.jumlah)}</div>
          {tx.user_id===session.user.id&&<div style={{display:'flex',gap:8}}><button onClick={()=>setEditing(tx)} className="text-button">Edit</button><button onClick={()=>hapus(tx.id)} className="text-button danger-text">Hapus</button></div>}
        </div>
      </div>)}
    </div>
    {visible < items.length && <button className="btn btn-ghost load-more" onClick={()=>setVisible(v=>v+5)}>Lihat Selengkapnya ({Math.min(5, items.length-visible)} lagi)</button>}
    {visible >= items.length && items.length > 5 && <button className="btn btn-ghost load-more" onClick={()=>setVisible(5)}>Tampilkan lebih sedikit</button>}
    {editing && <EditModal tx={editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);onChanged&&onChanged()}} />}
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
