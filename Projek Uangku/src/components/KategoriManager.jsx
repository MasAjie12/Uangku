import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function KategoriManager() {
  const [pemasukan, setPemasukan] = useState([])
  const [pengeluaran, setPengeluaran] = useState([])
  const [baruPemasukan, setBaruPemasukan] = useState('')
  const [baruPengeluaran, setBaruPengeluaran] = useState('')
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingValue, setEditingValue] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    muat()
  }, [])

  async function muat() {
    const { data } = await supabase.from('kategori').select('id, tipe, nama').order('nama')
    setPemasukan((data || []).filter((k) => k.tipe === 'pemasukan'))
    setPengeluaran((data || []).filter((k) => k.tipe === 'pengeluaran'))
  }

  async function tambah(tipe, nama, reset) {
    const namaBersih = nama.trim()
    if (!namaBersih) return
    setError('')
    const { error } = await supabase.from('kategori').insert({ tipe, nama: namaBersih })
    if (error) {
      setError(error.code === '23505' ? 'Kategori itu sudah ada.' : 'Gagal menambah: ' + error.message)
      return
    }
    reset('')
    muat()
  }

  async function hapus(id) {
    if (!confirm('Hapus kategori ini? Catatan lama yang sudah pakai kategori ini tidak akan berubah.')) return
    await supabase.from('kategori').delete().eq('id', id)
    muat()
  }

  function mulaiEdit(k) {
    setError('')
    setEditingId(k.id)
    setEditingValue(k.nama)
  }

  function batalEdit() {
    setEditingId(null)
    setEditingValue('')
  }

  async function simpanEdit(id) {
    const namaBaru = editingValue.trim()
    if (!namaBaru) {
      setError('Nama kategori tidak boleh kosong.')
      return
    }
    setSavingEdit(true)
    setError('')
    const { data, error } = await supabase
      .from('kategori')
      .update({ nama: namaBaru })
      .eq('id', id)
      .select()
    setSavingEdit(false)
    if (error) {
      setError(error.code === '23505' ? 'Nama kategori itu sudah dipakai.' : 'Gagal menyimpan: ' + error.message)
      return
    }
    if (!data || data.length === 0) {
      // RLS menolak perubahan tanpa mengembalikan error eksplisit.
      setError('Perubahan tidak tersimpan (tidak ada izin mengubah kategori ini). Pastikan skema database Supabase sudah yang terbaru.')
      return
    }
    setEditingId(null)
    setEditingValue('')
    muat()
  }

  return (
    <div className="card" style={{ padding: '1.3rem 1.4rem', marginBottom: '1.4rem' }}>
      <h3 style={{ fontSize: '1.05rem', marginBottom: '0.3rem' }}>Kelola Kategori</h3>
      <p style={{ fontSize: '0.85rem', color: '#3C554C', marginTop: 0, marginBottom: '1.1rem' }}>
        Tambah, ubah nama, atau hapus kategori pemasukan & pengeluaran sesuai kebutuhan keluargamu.
        Mengubah nama kategori tidak mengubah catatan transaksi lama yang sudah memakai nama sebelumnya.
      </p>

      {error && <p style={{ color: '#B1483A', fontSize: '0.85rem', marginBottom: '0.8rem' }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }} className="kategori-grid">
        <KolomKategori
          judul="Pemasukan"
          warna="#2F7A54"
          list={pemasukan}
          nilaiBaru={baruPemasukan}
          setNilaiBaru={setBaruPemasukan}
          onTambah={() => tambah('pemasukan', baruPemasukan, setBaruPemasukan)}
          onHapus={hapus}
          editingId={editingId}
          editingValue={editingValue}
          setEditingValue={setEditingValue}
          onMulaiEdit={mulaiEdit}
          onBatalEdit={batalEdit}
          onSimpanEdit={simpanEdit}
          savingEdit={savingEdit}
        />
        <KolomKategori
          judul="Pengeluaran"
          warna="#B1483A"
          list={pengeluaran}
          nilaiBaru={baruPengeluaran}
          setNilaiBaru={setBaruPengeluaran}
          onTambah={() => tambah('pengeluaran', baruPengeluaran, setBaruPengeluaran)}
          onHapus={hapus}
          editingId={editingId}
          editingValue={editingValue}
          setEditingValue={setEditingValue}
          onMulaiEdit={mulaiEdit}
          onBatalEdit={batalEdit}
          onSimpanEdit={simpanEdit}
          savingEdit={savingEdit}
        />
      </div>

      <style>{`
        @media (max-width: 620px) {
          .kategori-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

function KolomKategori({
  judul, warna, list, nilaiBaru, setNilaiBaru, onTambah, onHapus,
  editingId, editingValue, setEditingValue, onMulaiEdit, onBatalEdit, onSimpanEdit, savingEdit,
}) {
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: warna, marginBottom: '0.6rem' }}>{judul}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.8rem' }}>
        {list.length === 0 && <span style={{ fontSize: '0.8rem', color: '#8A7F68' }}>Belum ada kategori.</span>}
        {list.map((k) => {
          const sedangEdit = editingId === k.id
          return (
            <div key={k.id} style={{ background: '#FAF6EA', borderRadius: 8, padding: '0.4rem 0.7rem' }}>
              {sedangEdit ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); onSimpanEdit(k.id) }}
                  style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}
                >
                  <input
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    autoFocus
                    style={{ flex: 1, border: '1px solid #DED4BE', borderRadius: 8, padding: '0.35rem 0.55rem', fontSize: '0.85rem' }}
                  />
                  <button
                    type="submit"
                    disabled={savingEdit}
                    style={{ background: 'none', border: 'none', color: '#2F7A54', fontWeight: 700, fontSize: '0.78rem', padding: 0, whiteSpace: 'nowrap' }}
                  >
                    {savingEdit ? 'Menyimpan…' : 'Simpan'}
                  </button>
                  <button
                    type="button"
                    onClick={onBatalEdit}
                    disabled={savingEdit}
                    style={{ background: 'none', border: 'none', color: '#8A7F68', fontSize: '0.78rem', padding: 0, whiteSpace: 'nowrap' }}
                  >
                    Batal
                  </button>
                </form>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.87rem' }}>{k.nama}</span>
                  <div style={{ display: 'flex', gap: '0.7rem', flex: '0 0 auto' }}>
                    <button onClick={() => onMulaiEdit(k)} style={{ background: 'none', border: 'none', color: '#3C6E71', fontSize: '0.78rem', padding: 0 }}>
                      Edit
                    </button>
                    <button onClick={() => onHapus(k.id)} style={{ background: 'none', border: 'none', color: '#B1483A', fontSize: '0.78rem', padding: 0 }}>
                      Hapus
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); onTambah() }}
        style={{ display: 'flex', gap: '0.4rem' }}
      >
        <input
          value={nilaiBaru}
          onChange={(e) => setNilaiBaru(e.target.value)}
          placeholder="Kategori baru…"
          style={{ flex: 1, border: '1px solid #DED4BE', borderRadius: 8, padding: '0.45rem 0.6rem', fontSize: '0.85rem' }}
        />
        <button className="btn btn-ghost" style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem' }}>Tambah</button>
      </form>
    </div>
  )
}
