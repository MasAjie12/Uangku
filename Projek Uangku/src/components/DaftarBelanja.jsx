import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'

// Fitur Daftar Belanja: checklist belanja sederhana untuk keluarga.
// CATATAN: fitur ini SENGAJA dibuat terpisah dari data keuangan (transaksi,
// anggaran, laporan, dll). Menambah/mencentang/menghapus item di sini
// tidak menyentuh tabel manapun selain "daftar_belanja" itu sendiri.
//
// `embedded`: true saat dipasang sebagai salah satu tab di dalam kartu
// "Alat Keuangan" (ProfessionalTools) — menghilangkan bungkus kartu &
// judul ganda karena tab bar induk sudah menampilkan judul/deskripsinya.
export default function DaftarBelanja({ embedded = false }) {
  const { profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [namaBaru, setNamaBaru] = useState('')
  const [menambah, setMenambah] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    muat()
    const channel = supabase
      .channel('daftar-belanja-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daftar_belanja' },
        () => muat(),
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function muat() {
    const { data, error } = await supabase
      .from('daftar_belanja')
      .select('*')
      .order('created_at', { ascending: true })
    if (!error) setItems(data || [])
    setLoading(false)
  }

  async function tambah(e) {
    e.preventDefault()
    const namaBersih = namaBaru.trim()
    if (!namaBersih || !profile?.keluarga_id) return
    setMenambah(true)
    setError('')
    const { error } = await supabase.from('daftar_belanja').insert({
      keluarga_id: profile.keluarga_id,
      user_id: profile.id,
      nama: namaBersih,
      sudah_dibeli: false,
    })
    setMenambah(false)
    if (error) {
      setError('Gagal menambah: ' + error.message)
      return
    }
    setNamaBaru('')
    muat()
  }

  async function toggleBeli(item) {
    // Optimistic update supaya terasa instan, tetap disinkronkan ulang oleh realtime/muat().
    setItems((list) => list.map((it) => (it.id === item.id ? { ...it, sudah_dibeli: !it.sudah_dibeli } : it)))
    const { error } = await supabase
      .from('daftar_belanja')
      .update({ sudah_dibeli: !item.sudah_dibeli })
      .eq('id', item.id)
    if (error) muat() // rollback kalau gagal
  }

  async function hapus(id) {
    setItems((list) => list.filter((it) => it.id !== id))
    await supabase.from('daftar_belanja').delete().eq('id', id)
  }

  async function hapusYangSudahDibeli() {
    const idSudahDibeli = items.filter((it) => it.sudah_dibeli).map((it) => it.id)
    if (idSudahDibeli.length === 0) return
    if (!confirm(`Hapus ${idSudahDibeli.length} item yang sudah dibeli dari daftar?`)) return
    setItems((list) => list.filter((it) => !it.sudah_dibeli))
    await supabase.from('daftar_belanja').delete().in('id', idSudahDibeli)
  }

  const totalItem = items.length
  const belumDibeli = items.filter((it) => !it.sudah_dibeli).length
  const semuaSudahDibeli = totalItem > 0 && belumDibeli === 0

  const isi = (
    <>
      <form onSubmit={tambah} className="inline-form" style={{ marginBottom: '0.9rem' }}>
        <input
          value={namaBaru}
          onChange={(e) => setNamaBaru(e.target.value)}
          placeholder="mis. Beras 5kg, Minyak goreng…"
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary" disabled={menambah || !namaBaru.trim()}>
          {menambah ? 'Menambah…' : '+ Tambah'}
        </button>
      </form>

      {error && <p style={{ color: '#B1483A', fontSize: '0.82rem', marginBottom: '0.7rem' }}>{error}</p>}

      {loading ? (
        <p style={{ color: '#8A7F68', fontSize: '0.85rem' }}>Memuat…</p>
      ) : totalItem === 0 ? (
        <p style={{ color: '#8A7F68', fontSize: '0.85rem' }}>Daftar belanja masih kosong. Tambahkan barang pertamamu di atas.</p>
      ) : (
        <>
          {semuaSudahDibeli && (
            <div className="goal-alert">🎉 Daftar Belanjamu sudah lengkap, nih.</div>
          )}
          {!semuaSudahDibeli && (
            <div className="bill-alert">⚠️ Oops, ada yang lupa dibeli nih. Cek lagi daftar belanjamu.</div>
          )}

          <div className="shopping-list">
            {items.map((item) => (
              <div key={item.id} className={`shopping-item ${item.sudah_dibeli ? 'is-bought' : ''}`}>
                <button
                  type="button"
                  className="shopping-checkbox"
                  onClick={() => toggleBeli(item)}
                  aria-label={item.sudah_dibeli ? 'Tandai belum terbeli' : 'Tandai sudah terbeli'}
                >
                  {item.sudah_dibeli ? '✓' : ''}
                </button>
                <div className="shopping-item-body" onClick={() => toggleBeli(item)}>
                  <span className="shopping-item-nama">{item.nama}</span>
                  <span className={`shopping-item-status ${item.sudah_dibeli ? 'status-terbeli' : 'status-belum'}`}>
                    {item.sudah_dibeli ? 'sudah terbeli' : 'belum terbeli'}
                  </span>
                </div>
                <button type="button" className="shopping-hapus" onClick={() => hapus(item.id)} aria-label="Hapus item">
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.9rem' }}>
            <span style={{ fontSize: '0.76rem', color: '#8A7F68' }}>
              {totalItem - belumDibeli} dari {totalItem} sudah dibeli
            </span>
            <button
              type="button"
              onClick={hapusYangSudahDibeli}
              disabled={totalItem - belumDibeli === 0}
              style={{ background: 'none', border: 'none', color: '#B1483A', fontSize: '0.76rem', padding: 0 }}
            >
              Hapus yang sudah dibeli
            </button>
          </div>
        </>
      )}
    </>
  )

  if (embedded) {
    return <section className="shopping-embedded">{isi}</section>
  }

  return (
    <div className="card professional-card shopping-card">
      <div className="pro-head">
        <div>
          <h3>Daftar Belanja</h3>
          <p>Tulis apa saja yang ingin dibeli, lalu centang saat sudah dibeli di toko — supaya tidak ada yang kelupaan.</p>
        </div>
      </div>
      {isi}
    </div>
  )
}
