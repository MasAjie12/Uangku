import React from 'react'
import { formatRupiah, formatTanggal, formatTanggalJam } from '../utils'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'

export default function TransaksiList({ items, onChanged }) {
  const { session } = useAuth()

  async function hapus(id) {
    if (!confirm('Hapus catatan ini?')) return
    const { error } = await supabase.from('transaksi').delete().eq('id', id)
    if (error) return alert('Gagal menghapus: ' + error.message)
    onChanged && onChanged()
  }

  if (!items.length) return <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#3C554C' }}>Belum ada catatan pada pencarian ini.</div>

  return (
    <div className="card" style={{ padding: '0.4rem 0' }}>
      {items.map((tx, idx) => (
        <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.9rem 1.3rem', borderTop: idx === 0 ? 'none' : '1px solid #EFE9D9' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#16332B' }}>
              {tx.kategori}{tx.sumber_tujuan && <span style={{ fontWeight: 400, color: '#3C554C' }}> · {tx.sumber_tujuan}</span>}
            </div>
            {tx.keterangan && <div style={{ fontSize: '0.85rem', color: '#3C554C', marginTop: 2 }}>{tx.keterangan}</div>}
            <div style={{ fontSize: '0.78rem', color: '#3C554C', marginTop: 6 }}>
              <strong>Tanggal transaksi:</strong> {formatTanggal(tx.tanggal)}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#8A7F68', marginTop: 3 }}>
              Dicatat oleh <strong>{tx.profiles?.nama_tampilan || '—'}</strong> ({tx.profiles?.peran || 'Anggota'}) · waktu pencatatan {formatTanggalJam(tx.created_at)}
            </div>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div className="mono" style={{ fontWeight: 700, color: tx.tipe === 'pemasukan' ? '#2F7A54' : '#B1483A', whiteSpace: 'nowrap' }}>
              {tx.tipe === 'pemasukan' ? '+' : '−'}{formatRupiah(tx.jumlah)}
            </div>
            {tx.user_id === session.user.id && <button onClick={() => hapus(tx.id)} style={{ background: 'none', border: 'none', color: '#B1483A', fontSize: '0.75rem', padding: 0 }}>Hapus</button>}
          </div>
        </div>
      ))}
    </div>
  )
}
