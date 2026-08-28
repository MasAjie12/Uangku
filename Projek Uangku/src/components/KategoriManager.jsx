import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'

export default function KategoriManager() {
  const { session } = useAuth()
  const [pemasukan, setPemasukan] = useState([])
  const [pengeluaran, setPengeluaran] = useState([])
  const [baruPemasukan, setBaruPemasukan] = useState('')
  const [baruPengeluaran, setBaruPengeluaran] = useState('')
  const [error, setError] = useState('')
  const [pesan, setPesan] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingValue, setEditingValue] = useState('')
  const [editingTipe, setEditingTipe] = useState('')
  const [editingNamaLama, setEditingNamaLama] = useState('')
  const [editingUpdateLama, setEditingUpdateLama] = useState(true)
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    muat()
    const channel = supabase.channel('kategori-realtime-manager')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kategori' }, muat)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transaksi' }, muat)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
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
    setPesan('')
    const { error } = await supabase.from('kategori').insert({ tipe, nama: namaBersih })
    if (error) {
      setError(error.code === '23505' ? 'Kategori itu sudah ada.' : 'Gagal menambah: ' + error.message)
      return
    }
    reset('')
    muat()
  }

  async function hapus(id, tipe, nama) {
    const { count } = await supabase
      .from('transaksi')
      .select('id', { count: 'exact', head: true })
      .eq('kategori', nama)
      .eq('tipe', tipe)
    const pesanKonfirmasi = count > 0
      ? `Kategori "${nama}" masih dipakai di ${count} transaksi. Kategori akan hilang dari daftar pilihan, tapi ${count} transaksi lama tetap menampilkan nama "${nama}" (datanya tidak hilang/berubah). Lanjutkan hapus?`
      : `Hapus kategori "${nama}"?`
    if (!confirm(pesanKonfirmasi)) return
    setPesan('')
    await supabase.from('kategori').delete().eq('id', id)
    muat()
  }

  function mulaiEdit(k) {
    setError('')
    setPesan('')
    setEditingId(k.id)
    setEditingValue(k.nama)
    setEditingTipe(k.tipe)
    setEditingNamaLama(k.nama)
    setEditingUpdateLama(true)
  }

  function batalEdit() {
    setEditingId(null)
    setEditingValue('')
    setEditingTipe('')
    setEditingNamaLama('')
  }

  async function simpanEdit(id) {
    const namaBaru = editingValue.trim()
    if (!namaBaru) {
      setError('Nama kategori tidak boleh kosong.')
      return
    }
    if (namaBaru === editingNamaLama) {
      batalEdit()
      return
    }
    setSavingEdit(true)
    setError('')
    setPesan('')

    // Perubahan nama kategori dilakukan melalui RPC keluarga agar seluruh transaksi
    // anggota keluarga ikut diperbarui, bukan hanya transaksi milik akun yang mengedit.
    const { data, error } = await supabase.rpc('ubah_nama_kategori_keluarga', {
      p_kategori_id: id,
      p_nama_baru: namaBaru,
      p_perbarui_transaksi: editingUpdateLama,
    })

    if (error) {
      setSavingEdit(false)
      setError(error.message || 'Gagal menyimpan perubahan kategori.')
      return
    }

    const jumlahDiperbarui = Number(data?.[0]?.jumlah_transaksi ?? data?.jumlah_transaksi ?? 0)
    const namaLama = editingNamaLama
    setSavingEdit(false)
    batalEdit()
    await muat()

    if (editingUpdateLama) {
      setPesan(`Nama kategori “${namaLama}” diubah menjadi “${namaBaru}”. ${jumlahDiperbarui} transaksi seluruh anggota keluarga ikut diperbarui, sehingga histori dan laporan tetap sinkron.`)
    } else {
      setPesan(`Nama kategori diubah menjadi “${namaBaru}”. Transaksi lama tetap menggunakan kategori sebelumnya.`)
    }
  }

  return (
    <div className="card" style={{ padding: '1.3rem 1.4rem', marginBottom: '1.4rem' }}>
      <h3 style={{ fontSize: '1.05rem', marginBottom: '0.3rem' }}>Kelola Kategori</h3>
      <p style={{ fontSize: '0.85rem', color: '#3C554C', marginTop: 0, marginBottom: '1.1rem' }}>
        Tambah, ubah nama, atau hapus kategori pemasukan & pengeluaran sesuai kebutuhan keluargamu.
      </p>

      {error && <p style={{ color: '#B1483A', fontSize: '0.85rem', marginBottom: '0.8rem' }}>{error}</p>}
      {pesan && <p style={{ color: '#2F7A54', fontSize: '0.85rem', marginBottom: '0.8rem', lineHeight: 1.5 }}>{pesan}</p>}

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
          editingUpdateLama={editingUpdateLama}
          setEditingUpdateLama={setEditingUpdateLama}
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
          editingUpdateLama={editingUpdateLama}
          setEditingUpdateLama={setEditingUpdateLama}
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
  editingId, editingValue, setEditingValue, editingUpdateLama, setEditingUpdateLama,
  onMulaiEdit, onBatalEdit, onSimpanEdit, savingEdit,
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
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
                >
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
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
                  </div>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '0.72rem', color: '#3C554C', lineHeight: 1.4, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editingUpdateLama}
                      onChange={(e) => setEditingUpdateLama(e.target.checked)}
                      style={{ marginTop: 2 }}
                    />
                    <span>
                      Perbarui juga <strong>semua transaksi keluarga</strong> yang sudah memakai nama lama,
                      supaya histori, laporan & grafik semua anggota tetap sinkron.
                    </span>
                  </label>
                </form>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.87rem' }}>{k.nama}</span>
                  <div style={{ display: 'flex', gap: '0.7rem', flex: '0 0 auto' }}>
                    <button onClick={() => onMulaiEdit(k)} style={{ background: 'none', border: 'none', color: '#3C6E71', fontSize: '0.78rem', padding: 0 }}>
                      Edit
                    </button>
                    <button onClick={() => onHapus(k.id, k.tipe, k.nama)} style={{ background: 'none', border: 'none', color: '#B1483A', fontSize: '0.78rem', padding: 0 }}>
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
