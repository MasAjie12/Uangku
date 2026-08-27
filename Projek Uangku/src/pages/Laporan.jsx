import React, { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { supabase } from '../supabaseClient'
import { formatRupiah } from '../utils'
import SummaryCards from '../components/SummaryCards'

const WARNA_KATEGORI = ['#2F7A54', '#C79A3D', '#B1483A', '#3C6E71', '#8A5A44', '#6B7FD7', '#A3812F', '#4E8098']

function toISODate(d) {
  return d.toISOString().slice(0, 10)
}

function awalBulanIni() {
  const d = new Date()
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1))
}

function hariIni() {
  return toISODate(new Date())
}

function mundurHari(n) {
  const d = new Date()
  d.setDate(d.getDate() - (n - 1))
  return toISODate(d)
}

export default function Laporan() {
  const [semua, setSemua] = useState([])
  const [tanggalAwal, setTanggalAwal] = useState(awalBulanIni())
  const [tanggalAkhir, setTanggalAkhir] = useState(hariIni())

  useEffect(() => {
    supabase
      .from('transaksi')
      .select('*')
      .order('tanggal', { ascending: true })
      .then(({ data }) => setSemua(data || []))
  }, [])

  const dataRange = useMemo(
    () => semua.filter((t) => t.tanggal >= tanggalAwal && t.tanggal <= tanggalAkhir),
    [semua, tanggalAwal, tanggalAkhir]
  )

  const totalMasuk = dataRange.filter((t) => t.tipe === 'pemasukan').reduce((s, t) => s + Number(t.jumlah), 0)
  const totalKeluar = dataRange.filter((t) => t.tipe === 'pengeluaran').reduce((s, t) => s + Number(t.jumlah), 0)

  const jumlahHari = useMemo(() => {
    const a = new Date(tanggalAwal)
    const b = new Date(tanggalAkhir)
    return Math.max(1, Math.round((b - a) / 86400000) + 1)
  }, [tanggalAwal, tanggalAkhir])

  const pakaiPerBulan = jumlahHari > 62

  const dataGrafik = useMemo(() => {
    const map = {}
    dataRange.forEach((t) => {
      const key = pakaiPerBulan ? t.tanggal.slice(0, 7) : t.tanggal
      if (!map[key]) map[key] = { key, pemasukan: 0, pengeluaran: 0 }
      map[key][t.tipe] += Number(t.jumlah)
    })
    return Object.values(map)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((row) => ({ ...row, label: formatLabel(row.key, pakaiPerBulan) }))
  }, [dataRange, pakaiPerBulan])

  const pengeluaranPerKategori = useMemo(() => {
    const map = {}
    dataRange.filter((t) => t.tipe === 'pengeluaran').forEach((t) => {
      map[t.kategori] = (map[t.kategori] || 0) + Number(t.jumlah)
    })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [dataRange])

  function terapkanPreset(preset) {
    if (preset === '7hari') { setTanggalAwal(mundurHari(7)); setTanggalAkhir(hariIni()) }
    if (preset === '30hari') { setTanggalAwal(mundurHari(30)); setTanggalAkhir(hariIni()) }
    if (preset === 'bulanIni') { setTanggalAwal(awalBulanIni()); setTanggalAkhir(hariIni()) }
    if (preset === 'semua') {
      const tanggalPalingLama = semua.length ? semua[0].tanggal : hariIni()
      setTanggalAwal(tanggalPalingLama)
      setTanggalAkhir(hariIni())
    }
  }

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '1.4rem' }}>
      <div style={{ marginBottom: '1.2rem' }}>
        <h2 style={{ fontSize: '1.5rem' }}>Laporan Keuangan</h2>
        <p style={{ color: '#3C554C', marginTop: 4 }}>Pilih rentang tanggal untuk melihat ringkasannya.</p>
      </div>

      <div className="card" style={{ padding: '1rem 1.2rem', marginBottom: '1.4rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
          {[
            ['7hari', '7 Hari Terakhir'],
            ['30hari', '30 Hari Terakhir'],
            ['bulanIni', 'Bulan Ini'],
            ['semua', 'Semua'],
          ].map(([key, label]) => (
            <button key={key} type="button" onClick={() => terapkanPreset(key)} className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Dari tanggal</label>
            <input type="date" value={tanggalAwal} max={tanggalAkhir} onChange={(e) => setTanggalAwal(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Sampai tanggal</label>
            <input type="date" value={tanggalAkhir} min={tanggalAwal} max={hariIni()} onChange={(e) => setTanggalAkhir(e.target.value)} />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '1.4rem' }}>
        <SummaryCards totalMasuk={totalMasuk} totalKeluar={totalKeluar} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1.4rem' }} className="laporan-grid">
        <div className="card" style={{ padding: '1.3rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>
            Pemasukan vs Pengeluaran {pakaiPerBulan ? 'per Bulan' : 'per Hari'}
          </h3>
          {dataGrafik.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dataGrafik}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFE9D9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000000 ? `${v / 1000000}jt` : `${v / 1000}rb`)} />
                <Tooltip formatter={(v) => formatRupiah(v)} />
                <Legend />
                <Bar dataKey="pemasukan" name="Pemasukan" fill="#2F7A54" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pengeluaran" name="Pengeluaran" fill="#B1483A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card" style={{ padding: '1.3rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Pengeluaran per Kategori</h3>
          {pengeluaranPerKategori.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pengeluaranPerKategori} dataKey="value" nameKey="name" outerRadius={90} label={(d) => d.name}>
                  {pengeluaranPerKategori.map((_, i) => <Cell key={i} fill={WARNA_KATEGORI[i % WARNA_KATEGORI.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatRupiah(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 780px) {
          .laporan-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

function EmptyChart() {
  return <p style={{ color: '#8A7F68', textAlign: 'center', padding: '2rem 0' }}>Belum ada data pada rentang ini.</p>
}

function formatLabel(key, isBulan) {
  if (isBulan) {
    const [y, m] = key.split('-')
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
  }
  const [y, m, d] = key.split('-')
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}
