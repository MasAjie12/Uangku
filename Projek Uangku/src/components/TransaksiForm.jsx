import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'
import { formatNominalInput, parseNominalInput, toISODateLocal } from '../utils'

export default function TransaksiForm({ onSaved }) {
  const { session } = useAuth()
  const [tipe, setTipe] = useState('pengeluaran')
  const [daftarKategori, setDaftarKategori] = useState([])
  const [kategori, setKategori] = useState('')
  const [kategoriCustom, setKategoriCustom] = useState('')
  const [jumlah, setJumlah] = useState('')
  const [keterangan, setKeterangan] = useState('')
  const [sumberTujuan, setSumberTujuan] = useState('')
  const [tanggal, setTanggal] = useState(() => toISODateLocal(new Date()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [bukti, setBukti] = useState(null)

  useEffect(() => {
    muatKategori(tipe)
    setKategori('')
  }, [tipe])

  async function muatKategori(t) {
    const { data } = await supabase.from('kategori').select('nama').eq('tipe', t).order('nama')
    setDaftarKategori((data || []).map((k) => k.nama))
  }

  const kategoriFinal = kategori === '__custom__' ? kategoriCustom.trim() : kategori

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!tanggal) return setError('Tanggal transaksi wajib diisi.')
    if (!kategoriFinal) return setError('Pilih atau isi kategori terlebih dahulu.')
    const nominal = parseNominalInput(jumlah)
    if (!nominal || nominal <= 0) return setError('Nominal harus lebih dari 0.')
    setSaving(true)

    if (kategori === '__custom__') {
      const { error: kategoriError } = await supabase.from('kategori').insert({ tipe, nama: kategoriFinal })
      if (kategoriError && !kategoriError.message.toLowerCase().includes('duplicate')) {
        setSaving(false)
        return setError('Gagal membuat kategori: ' + kategoriError.message)
      }
    }

    let buktiPath = null
    if (bukti) {
      const ext = bukti.name.split('.').pop() || 'bin'
      const path = `${session.user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`
      const up = await supabase.storage.from('bukti-transaksi').upload(path, bukti, { upsert: false })
      if (up.error) { setSaving(false); return setError('Gagal mengunggah bukti: ' + up.error.message) }
      buktiPath = path
    }

    const { error } = await supabase.from('transaksi').insert({
      user_id: session.user.id,
      tipe,
      kategori: kategoriFinal,
      jumlah: nominal,
      keterangan: keterangan.trim() || null,
      sumber_tujuan: sumberTujuan.trim() || null,
      tanggal,
      bukti_path: buktiPath,
    })
    setSaving(false)
    if (error) return setError('Gagal menyimpan: ' + error.message)

    setKategori('')
    setKategoriCustom('')
    setJumlah('')
    setKeterangan('')
    setSumberTujuan('')
    setBukti(null)
    muatKategori(tipe)
    onSaved && onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: '1.4rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.1rem' }}>
        {['pengeluaran', 'pemasukan'].map((t) => (
          <button type="button" key={t} onClick={() => setTipe(t)} style={{
            flex: 1, padding: '0.65rem', borderRadius: 10, border: '1px solid #DED4BE',
            fontWeight: 700, fontSize: '0.88rem',
            background: tipe === t ? (t === 'pemasukan' ? '#E4F0E7' : '#F5E5E1') : '#fff',
            color: tipe === t ? (t === 'pemasukan' ? '#2F7A54' : '#B1483A') : '#3C554C',
          }}>
            {t === 'pemasukan' ? '+ Pemasukan' : '− Pengeluaran'}
          </button>
        ))}
      </div>

      <div className="field">
        <label>Tanggal transaksi</label>
        <input type="date" value={tanggal} max={toISODateLocal(new Date())} onChange={(e) => setTanggal(e.target.value)} required />
        <span style={{ fontSize: '0.76rem', color: '#8A7F68' }}>Masukkan tanggal terlebih dahulu, lalu nominal.</span>
      </div>

      <div className="field">
        <label>Nominal (Rp)</label>
        <input
          type="text"
          inputMode="numeric"
          value={jumlah}
          onChange={(e) => setJumlah(formatNominalInput(e.target.value))}
          placeholder="mis. 50.000"
          autoComplete="off"
          required
        />
      </div>

      <div className="field">
        <label>Kategori</label>
        <select value={kategori} onChange={(e) => setKategori(e.target.value)} required>
          <option value="" disabled>Pilih kategori…</option>
          {daftarKategori.map((k) => <option key={k} value={k}>{k}</option>)}
          <option value="__custom__">+ Buat kategori baru</option>
        </select>
        <span style={{ fontSize: '0.76rem', color: '#8A7F68' }}>Kelola daftar kategori lengkap di halaman Pengaturan.</span>
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
        <label>Bukti / struk (opsional)</label>
        <input type="file" accept="image/*,.pdf" onChange={e=>setBukti(e.target.files?.[0] || null)} />
        <span style={{ fontSize: '0.76rem', color: '#8A7F68' }}>Simpan foto struk atau PDF sebagai bukti transaksi.</span>
      </div>

      <div className="field">
        <label>Keterangan tambahan</label>
        <textarea rows={2} value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="Catatan opsional…" />
      </div>

      {error && <p style={{ color: '#B1483A', fontSize: '0.85rem' }}>{error}</p>}
      <button className="btn btn-primary" style={{ width: '100%' }} disabled={saving}>
        {saving ? 'Menyimpan…' : 'Simpan Catatan'}
      </button>
    </form>
  )
}
