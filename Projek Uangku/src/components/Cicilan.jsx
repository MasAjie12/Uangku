import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'
import { formatRupiah, formatNominalInput, parseNominalInput, formatTanggal, toISODateLocal } from '../utils'

const WARNA_KATEGORI = ['#2F7A54', '#C79A3D', '#B1483A', '#3C6E71', '#8A5A44', '#6B7FD7', '#A3812F', '#4E8098']

const FONT_MAX = 1.05 // rem
const FONT_MIN = 0.62 // rem
const FONT_STEP = 0.03 // rem

// Nominal yang ukurannya otomatis mengecil supaya SELALU muat dalam satu
// baris di dalam kartu, seberapa panjang pun angkanya (ratusan ribu s/d
// miliaran). Berbeda dari menebak ukuran font dari jumlah karakter, di sini
// lebar teks diukur langsung di browser (scrollWidth vs clientWidth) lalu
// disusutkan sampai benar-benar pas, dan diukur ulang tiap kali ukuran
// kartu berubah (resize / rotasi layar / lebar layar berbeda-beda).
function AutoFitNominal({ value, color }) {
  const ref = useRef(null)
  const [fontSize, setFontSize] = useState(FONT_MAX)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    function sesuaikan() {
      let size = FONT_MAX
      el.style.fontSize = size + 'rem'
      let aman = 0
      while (el.scrollWidth > el.clientWidth && size > FONT_MIN && aman < 30) {
        size = Math.round((size - FONT_STEP) * 100) / 100
        el.style.fontSize = size + 'rem'
        aman++
      }
      setFontSize(size)
    }

    sesuaikan()

    const ro = new ResizeObserver(() => sesuaikan())
    ro.observe(el.parentElement || el)
    return () => ro.disconnect()
  }, [value])

  return (
    <strong ref={ref} style={{ color, fontSize: fontSize + 'rem' }}>
      {value}
    </strong>
  )
}

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
              <AutoFitNominal value={formatRupiah(totalNominal)} color="#16332B" />
            </div>
            <div>
              <span>Belum lunas</span>
              <AutoFitNominal value={formatRupiah(totalBelumLunas)} color={totalBelumLunas > 0 ? '#B1483A' : '#2F7A54'} />
            </div>
          </div>

          {pieData.length > 0 && (
            <div className="card cicilan-pie-card">
              <h3 className="cicilan-pie-title">Cicilan berdasarkan Kategori</h3>
              <div className="cicilan-pie-report-wrap">
                <div className="cicilan-pie-chart-box">
                  <ResponsiveContainer width="100%" height={230}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" outerRadius="72%" paddingAngle={2} label={false} labelLine={false}>
                        {pieData.map((_, i) => <Cell key={i} fill={WARNA_KATEGORI[i % WARNA_KATEGORI.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => formatRupiah(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="cicilan-pie-category-list">
                  {pieData.map((item, i) => {
                    const pct = totalNominal ? ((item.value / totalNominal) * 100).toFixed(1) : '0.0'
                    return (
                      <div className="cicilan-pie-category-item" key={item.name}>
                        <span className="cicilan-pie-category-name"><i style={{ background: WARNA_KATEGORI[i % WARNA_KATEGORI.length] }}></i>{item.name}</span>
                        <span className="cicilan-pie-category-value">{pct}% · {formatRupiah(item.value)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="cicilan-history-card">
            <div className="cicilan-toolbar">
              <div>
                <div className="cicilan-history-title">Daftar Cicilan</div>
                <div className="cicilan-history-subtitle">Geser tabel ke samping pada layar HP untuk melihat semua informasi.</div>
              </div>
              <div className="cicilan-count">{items.length} cicilan</div>
            </div>

            <div className="cicilan-scroll" role="region" aria-label="Daftar cicilan" tabIndex="0">
              <table className="cicilan-table">
                <colgroup>
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '8%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Lunas</th>
                    <th>Tanggal</th>
                    <th>Kategori</th>
                    <th>Nominal</th>
                    <th>Toko</th>
                    <th>Tenor</th>
                    <th>Keterangan</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className={it.lunas ? 'cicilan-row-lunas' : ''}>
                      <td>
                        <button
                          type="button"
                          className={`cicilan-badge ${it.lunas ? 'lunas' : 'belum'}`}
                          onClick={() => toggleLunas(it)}
                        >
                          {it.lunas ? '✓ Sudah lunas' : 'Belum lunas'}
                        </button>
                      </td>
                      <td className="cicilan-date">{formatTanggal(it.tanggal)}</td>
                      <td className="cicilan-main">{it.kategori}</td>
                      <td className="cicilan-amount mono">{formatRupiah(it.nominal)}</td>
                      <td>{it.toko || <span className="muted">—</span>}</td>
                      <td>{it.tenor ? `${it.tenor} bulan` : <span className="muted">—</span>}</td>
                      <td className="cicilan-wrap">{it.keterangan}</td>
                      <td>
                        <button type="button" onClick={() => hapus(it.id)} className="text-button danger-text">Hapus</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="cicilan-scroll-hint"><span>↔</span> Geser ke samping untuk melihat kolom lainnya</div>
          </div>
        </>
      )}

      <style>{`
        .cicilan-summary { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:.9rem; margin-bottom:1rem; align-items:stretch; }
        .cicilan-summary > div { display:flex; flex-direction:column; justify-content:center; min-width:0; border:1px solid #EFE9D9; border-radius:10px; padding:.85rem .9rem; }
        .cicilan-summary span { display:block; font-size:.72rem; color:#8A7F68; margin-bottom:.3rem; }
        .cicilan-summary strong { display:block; color:#16332B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-variant-numeric:tabular-nums; line-height:1.25; transition:font-size .1s ease; }
        .cicilan-pie-card { padding:1.3rem; margin-bottom:1.1rem; }
        .cicilan-pie-title { font-size:1rem; margin:0 0 1rem; }
        .cicilan-pie-report-wrap { display:flex; flex-direction:column; min-width:0; }
        .cicilan-pie-chart-box { width:100%; min-width:0; }
        .cicilan-pie-category-list { display:flex; flex-direction:column; gap:.45rem; margin-top:.35rem; border-top:1px solid #EFE9D9; padding-top:.7rem; }
        .cicilan-pie-category-item { display:flex; justify-content:space-between; align-items:center; gap:.8rem; font-size:.74rem; min-width:0; }
        .cicilan-pie-category-name { display:flex; align-items:center; gap:.45rem; min-width:0; color:#3C554C; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .cicilan-pie-category-name i { width:9px; height:9px; border-radius:50%; flex:0 0 auto; }
        .cicilan-pie-category-value { color:#8A7F68; text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }

        /* Tabel cicilan bergaya sama seperti Riwayat Transaksi */
        .cicilan-history-card { overflow:hidden; min-width:0; max-width:100%; border:1px solid var(--line); border-radius:14px; background:#fff; }
        .cicilan-toolbar { display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1rem 1.1rem; border-bottom:1px solid #EFE9D9; background:linear-gradient(180deg,#fff,#FFFDF7); }
        .cicilan-history-title { font-family:var(--font-display); font-size:1rem; font-weight:600; color:var(--ink); }
        .cicilan-history-subtitle { margin-top:.25rem; color:#8A7F68; font-size:.72rem; line-height:1.45; }
        .cicilan-count { flex:0 0 auto; border:1px solid var(--line); background:#fff; border-radius:999px; padding:.35rem .65rem; color:var(--ink-soft); font-size:.7rem; font-weight:700; white-space:nowrap; }
        .cicilan-scroll { width:100%; min-width:0; max-width:100%; display:block; overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch; overscroll-behavior-x:contain; touch-action:pan-x; scrollbar-width:thin; }
        .cicilan-scroll:focus-visible { outline:2px solid var(--gold); outline-offset:-2px; }
        .cicilan-table { width:100%; min-width:820px; table-layout:fixed; border-collapse:separate; border-spacing:0; font-size:.76rem; }
        .cicilan-table th, .cicilan-table td { padding:.78rem .75rem; border-bottom:1px solid #EFE9D9; text-align:left; vertical-align:middle; white-space:normal; word-break:break-word; }
        .cicilan-table th { position:sticky; top:0; z-index:1; background:#F9F5EA; color:var(--ink-soft); font-size:.68rem; text-transform:uppercase; letter-spacing:.035em; }
        .cicilan-table tbody tr { transition:background .15s ease; }
        .cicilan-table tbody tr:hover { background:#FFFDF7; }
        .cicilan-table tbody tr:last-child td { border-bottom:0; }
        .cicilan-main { font-weight:650; color:var(--ink); }
        .cicilan-amount { font-weight:750; color:var(--ink); white-space:nowrap; }
        .cicilan-date { color:#6F6656; white-space:nowrap; }
        .cicilan-wrap { line-height:1.4; }
        .cicilan-row-lunas .cicilan-main, .cicilan-row-lunas .cicilan-date, .cicilan-row-lunas .cicilan-wrap { color:#9A8F7A; }
        .cicilan-badge { display:inline-flex; align-items:center; border-radius:999px; padding:.32rem .65rem; font-size:.68rem; font-weight:700; border:1px solid transparent; cursor:pointer; white-space:nowrap; }
        .cicilan-badge.belum { color:#7A5A16; background:#FFF8E7; border-color:#E9D6A5; }
        .cicilan-badge.lunas { color:#286846; background:var(--income-soft); border-color:#CFE3D3; }
        .cicilan-scroll-hint { display:none; text-align:center; padding:.55rem .75rem; border-top:1px solid #EFE9D9; color:#8A7F68; font-size:.68rem; background:#FFFEFA; }
        .cicilan-scroll-hint span { font-size:.9rem; margin-right:.25rem; }
        @media(max-width:780px){
          .cicilan-pie-category-value{font-size:.7rem}
          .cicilan-scroll{ width:100%; overflow-x:scroll; }
          .cicilan-toolbar{ align-items:flex-start; padding:.85rem .9rem; }
          .cicilan-scroll-hint{ display:block; }
          .cicilan-table{ min-width:820px; }
          .cicilan-table th,.cicilan-table td{ padding:.7rem .65rem; }
          .cicilan-table th{ font-size:.64rem; }
          .cicilan-count{ font-size:.64rem; }
        }
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
