import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'

const KATEGORI_DEFAULT = {
  pemasukan: ['Gaji', 'Bonus', 'Usaha Sampingan', 'Hadiah', 'Lainnya'],
  pengeluaran: ['Belanja Harian', 'Listrik & Air', 'Transportasi', 'Pendidikan', 'Kesehatan', 'Cicilan', 'Lainnya'],
}

export default function TransaksiForm({ onSaved }) {
  const { session } = useAuth()
  const [tipe, setTipe] = useState('pengeluaran')
  const [kategori, setKategori] = useState('')
  const [kategoriCustom, setKategoriCustom] = useState('')
  const [jumlah, setJumlah] = useState('')
  const [keterangan, setKeterangan] = useState('')
  const [sumberTujuan, setSumberTujuan] = useState('')
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const opsiKategori = KATEGORI_DEFAULT[tipe]
  const kategoriFinal = kategori === '__custom__' ? kategoriCustom.trim() : kategori

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!kategoriFinal) {
      setError('Pilih atau isi kategori terlebih dahulu.')
      return
    }
    const nominal = Number(jumlah)
    if (!nominal || nominal <= 0) {
      setError('Nominal harus lebih dari 0.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('transaksi').insert({
      user_id: session.user.id,
      tipe,
      kategori: kategoriFinal,
      jumlah: nominal,
      keterangan: keterangan.trim() || null,
      sumber_tujuan: sumberTujuan.trim() || null,
      tanggal,
    })
    setSaving(false)
    if (error) {
      setError('Gagal menyimpan: ' + error.message)
      return
    }
    setKategori('')
    setKategoriCustom('')
    setJumlah('')
    setKeterangan('')
    setSumberTujuan('')
    onSaved && onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: '1.4rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.1rem' }}>
        {['pengeluaran', 'pemasukan'].map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => { setTipe(t); setKategori('') }}
            style={{
              flex: 1,
              padding: '0.65rem',
              borderRadius: 10,
              border: '1px solid #DED4BE',
              fontWeight: 700,
              fontSize: '0.88rem',
              background: tipe === t ? (t === 'pemasukan' ? '#E4F0E7' : '#F5E5E1') : '#fff',
              color: tipe === t ? (t === 'pemasukan' ? '#2F7A54' : '#B1483A') : '#3C554C',
            }}
          >
            {t === 'pemasukan' ? '+ Pemasukan' : '− Pengeluaran'}
          </button>
        ))}
      </div>

      <div className="field">
        <label>Nominal (Rp)</label>
        <input
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          value={jumlah}
          onChange={(e) => setJumlah(e.target.value)}
          placeholder="mis. 50000"
          required
        />
      </div>

      <div className="field">
        <label>Kategori</label>
        <select value={kategori} onChange={(e) => setKategori(e.target.value)} required>
          <option value="" disabled>Pilih kategori…</option>
          {opsiKategori.map((k) => <option key={k} value={k}>{k}</option>)}
          <option value="__custom__">+ Buat kategori baru</option>
        </select>
      </div>

      {kategori === '__custom__' && (
        <div className="field">
          <label>Nama kategori baru</label>
          <input value={kategoriCustom} onChange={(e) => setKategoriCustom(e.target.value)} placeholder="mis. Hobi" required />
        </div>
      )}

      <div className="field">
        <label>{tipe === 'pemasukan' ? 'Uang ini dari mana?' : 'Uang ini untuk apa / dibayar ke mana?'}</label>
        <input value={sumberTujuan} onChange={(e) => setSumberTujuan(e.target.value)} placeholder={tipe === 'pemasukan' ? 'mis. Kantor, Klien A' : 'mis. Warung Bu Sari, PLN'} />
      </div>

      <div className="field">
        <label>Keterangan tambahan</label>
        <textarea rows={2} value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="Catatan opsional…" />
      </div>

      <div className="field">
        <label>Tanggal</label>
        <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required />
      </div>

      {error && <p style={{ color: '#B1483A', fontSize: '0.85rem' }}>{error}</p>}

      <button className="btn btn-primary" style={{ width: '100%' }} disabled={saving}>
        {saving ? 'Menyimpan…' : 'Simpan Catatan'}
      </button>
    </form>
  )
}
