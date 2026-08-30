import React, { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'
import { formatRupiah, formatNominalInput, parseNominalInput, formatTanggal, toISODateLocal } from '../utils'

const WARNA_KATEGORI = ['#2F7A54', '#C79A3D', '#B1483A', '#3C6E71', '#8A5A44', '#6B7FD7', '#A3812F', '#4E8098']

const FORM_KOSONG = {
  kategori: '',
  keterangan: '',
  toko: '',
  tanggal: toISODateLocal(new Date()),
  nominal: '',
  tenor: '',
}

// Fitur Cicilan: pencatat cicilan barang, murni untuk dokumentasi/checklist.
// CATATAN: SENGAJA terpisah dari data keuangan (transaksi, anggaran, laporan,
// dll). Menambah/mencentang/menghapus cicilan di sini tidak menyentuh tabel
// manapun selain "cicilan" itu sendiri — tidak memengaruhi saldo, laporan,
// atau perhitungan keuangan lainnya di aplikasi.
export default function Cicilan({ embedded = false }) {
  const { profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(FORM_KOSONG)
  const [menyimpan, setMenyimpan] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    muat()
    const channel = supabase
      .channel('cicilan-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cicilan' }, () => muat())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function muat() {
    const { data, error } = await supabase
      .from('cicilan')
      .select('*')
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false })
    if (!error) setItems(data || [])
    setLoading(false)
  }

  async function tambah(e) {
    e.preventDefault()
    if (!form.kategori.trim() || !form.keterangan.trim() || !parseNominalInput(form.nominal) || !profile?.keluarga_id) {
      setError('Isi minimal kategori, keterangan, dan nominal.')
      return
    }
    setMenyimpan(true)
    setError('')
    const { error } = await supabase.from('cicilan').insert({
      keluarga_id: profile.keluarga_id,
      user_id: profile.id,
      kategori: form.kategori.trim(),
      keterangan: form.keterangan.trim(),
      toko: form.toko.trim() || null,
      tanggal: form.tanggal,
      nominal: parseNominalInput(form.nominal),
      tenor: form.tenor ? Number(form.tenor) : null,
      lunas: false,
    })
    setMenyimpan(false)
    if (error) {
      setError('Gagal menyimpan: ' + error.message)
      return
    }
    setForm(FORM_KOSONG)
    muat()
  }

  async function toggleLunas(item) {
    setItems((list) => list.map((it) => (it.id === item.id ? { ...it, lunas: !it.lunas } : it)))
    const { error } = await supabase.from('cicilan').update({ lunas: !item.lunas }).eq('id', item.id)
    if (error) muat()
  }

  async function hapus(id) {
    if (!confirm('Hapus catatan cicilan ini?')) return
    setItems((list) => list.filter((it) => it.id !== id))
    await supabase.from('cicilan').delete().eq('id', id)
  }

  const pieData = useMemo(() => {
    const m = {}
    items.forEach((it) => { m[it.kategori] = (m[it.kategori] || 0) + Number(it.nominal) })
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [items])

  const totalNominal = items.reduce((s, it) => s + Number(it.nominal), 0)
  const totalBelumLunas = items.filter((it) => !it.lunas).reduce((s, it) => s + Number(it.nominal), 0)

  const isi = (
    <>
      <form onSubmit={tambah} className="inline-form" style={{ marginBottom: '0.5rem' }}>
        <input
          value={form.kategori}
          onChange={(e) => setForm({ ...form, kategori: e.target.value })}
          placeholder="Kategori (mis. Elektronik)"
          required
        />
        <input
          value={form.keterangan}
          onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
          placeholder="Nama cicilan (mis. Kulkas 2 Pintu)"
          required
        />
        <input
          value={form.toko}
          onChange={(e) => setForm({ ...form, toko: e.target.value })}
          placeholder="Dibeli di toko mana?"
        />
        <input
          type="date"
          value={form.tanggal}
          max={toISODateLocal(new Date())}
          onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
        />
        <input
          inputMode="numeric"
          value={form.nominal}
          onChange={(e) => setForm({ ...form, nominal: formatNominalInput(e.target.value) })}
          placeholder="Nominal harga barang (Rp)"
          required
        />
        <input
          type="number"
          min="1"
          value={form.tenor}
          onChange={(e) => setForm({ ...form, tenor: e.target.value })}
          placeholder="Tenor (bulan)"
        />
        <button className="btn btn-primary" disabled={menyimpan}>
          {menyimpan ? 'Menyimpan…' : '+ Tambah Cicilan'}
        </button>
      </form>
      {error && <p style={{ color: '#B1483A', fontSize: '0.82rem', marginBottom: '0.7rem' }}>{error}</p>}
      <p style={{ fontSize: '0.72rem', color: '#8A7F68', margin: '0 0 1rem' }}>
        Fitur ini hanya catatan/checklist pribadi — tidak memengaruhi saldo, anggaran, atau laporan keuangan.
      </p>

      {loading ? (
        <p style={{ color: '#8A7F68', fontSize: '0.85rem' }}>Memuat…</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#8A7F68', fontSize: '0.85rem' }}>Belum ada cicilan yang dicatat. Tambahkan yang pertama lewat form di atas.</p>
      ) : (
        <>
          <div className="cicilan-summary">
            <div>
              <span>Total nilai cicilan</span>
              <strong>{formatRupiah(totalNominal)}</strong>
            </div>
            <div>
              <span>Belum lunas</span>
              <strong style={{ color: totalBelumLunas > 0 ? '#B1483A' : '#2F7A54' }}>{formatRupiah(totalBelumLunas)}</strong>
            </div>
          </div>

          {pieData.length > 0 && (
            <div className="cicilan-pie-wrap">
              <div className="cicilan-pie-box">
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" outerRadius="72%" paddingAngle={2} label={false} labelLine={false}>
                      {pieData.map((_, i) => <Cell key={i} fill={WARNA_KATEGORI[i % WARNA_KATEGORI.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatRupiah(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="cicilan-pie-legend">
                {pieData.map((item, i) => {
                  const pct = totalNominal ? ((item.value / totalNominal) * 100).toFixed(1) : '0.0'
                  return (
                    <div className="pie-category-item" key={item.name}>
                      <span className="pie-category-name"><i style={{ background: WARNA_KATEGORI[i % WARNA_KATEGORI.length] }}></i>{item.name}</span>
                      <span className="pie-category-value">{pct}% · {formatRupiah(item.value)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ overflowX: 'auto', marginTop: '0.9rem' }}>
            <table className="report-table cicilan-table">
              <thead>
                <tr>
                  <th>Lunas</th>
                  <th>Tanggal</th>
                  <th>Kategori</th>
                  <th>Nominal</th>
                  <th>Toko</th>
                  <th>Tenor</th>
                  <th>Keterangan</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className={it.lunas ? 'cicilan-row-lunas' : ''}>
                    <td>
                      <button
                        type="button"
                        className={`cicilan-checklist ${it.lunas ? 'is-lunas' : ''}`}
                        onClick={() => toggleLunas(it)}
                      >
                        {it.lunas ? '✓ Sudah lunas' : 'Belum lunas'}
                      </button>
                    </td>
                    <td>{formatTanggal(it.tanggal)}</td>
                    <td>{it.kategori}</td>
                    <td className="mono" style={{ fontWeight: 700 }}>{formatRupiah(it.nominal)}</td>
                    <td>{it.toko || '—'}</td>
                    <td>{it.tenor ? `${it.tenor} bulan` : '—'}</td>
                    <td>{it.keterangan}</td>
                    <td>
                      <button type="button" onClick={() => hapus(it.id)} style={{ background: 'none', border: 'none', color: '#B1483A', fontSize: '0.76rem', padding: 0 }}>
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <style>{`
        .cicilan-summary { display:flex; gap:.9rem; flex-wrap:wrap; margin-bottom:1rem; }
        .cicilan-summary > div { flex:1 1 160px; border:1px solid #EFE9D9; border-radius:10px; padding:.7rem .9rem; }
        .cicilan-summary span { display:block; font-size:.72rem; color:#8A7F68; margin-bottom:.25rem; }
        .cicilan-summary strong { font-size:1rem; color:#16332B; }
        .cicilan-pie-wrap { display:flex; flex-wrap:wrap; gap:1rem; align-items:center; border-top:1px solid #EFE9D9; padding-top:.9rem; margin-bottom:.5rem; }
        .cicilan-pie-box { flex:1 1 200px; min-width:180px; }
        .cicilan-pie-legend { flex:1 1 200px; display:flex; flex-direction:column; gap:.45rem; min-width:180px; }
        .cicilan-checklist { border:1px solid #E9D6A5; background:#FFF8E7; color:#7A5A16; font-size:.72rem; font-weight:700; padding:.35rem .6rem; border-radius:999px; white-space:nowrap; cursor:pointer; }
        .cicilan-checklist.is-lunas { border-color:#CFE3D3; background:#EEF6EF; color:#2F7A54; }
        .cicilan-row-lunas td { color:#8A7F68; }
        .cicilan-table th, .cicilan-table td { white-space:nowrap; }
        .cicilan-table td:nth-child(7) { white-space:normal; min-width:160px; }
        @media(max-width:780px){ .cicilan-summary,.cicilan-pie-wrap{flex-direction:column} }
      `}</style>
    </>
  )

  if (embedded) return <section className="cicilan-embedded">{isi}</section>

  return (
    <div className="card professional-card">
      <div className="pro-head">
        <div>
          <h3>Cicilan</h3>
          <p>Catat barang yang sedang dicicil, tandai kalau sudah lunas.</p>
        </div>
      </div>
      {isi}
    </div>
  )
}
