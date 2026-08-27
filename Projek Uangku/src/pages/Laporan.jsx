import React, { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { supabase } from '../supabaseClient'
import { formatRupiah } from '../utils'
import SummaryCards from '../components/SummaryCards'

const WARNA_KATEGORI = ['#2F7A54', '#C79A3D', '#B1483A', '#3C6E71', '#8A5A44', '#6B7FD7', '#A3812F', '#4E8098']

export default function Laporan() {
  const [semua, setSemua] = useState([])
  const [bulan, setBulan] = useState(() => new Date().toISOString().slice(0, 7)) // YYYY-MM

  useEffect(() => {
    supabase
      .from('transaksi')
      .select('*')
      .order('tanggal', { ascending: true })
      .then(({ data }) => setSemua(data || []))
  }, [])

  const bulanTersedia = useMemo(() => {
    const set = new Set(semua.map((t) => t.tanggal.slice(0, 7)))
    return Array.from(set).sort().reverse()
  }, [semua])

  const dataBulanIni = useMemo(() => semua.filter((t) => t.tanggal.slice(0, 7) === bulan), [semua, bulan])

  const totalMasuk = dataBulanIni.filter((t) => t.tipe === 'pemasukan').reduce((s, t) => s + Number(t.jumlah), 0)
  const totalKeluar = dataBulanIni.filter((t) => t.tipe === 'pengeluaran').reduce((s, t) => s + Number(t.jumlah), 0)

  // Grafik batang: perbandingan per hari dalam bulan terpilih
  const perHari = useMemo(() => {
    const map = {}
    dataBulanIni.forEach((t) => {
      const hari = t.tanggal.slice(8, 10)
      if (!map[hari]) map[hari] = { hari, pemasukan: 0, pengeluaran: 0 }
      map[hari][t.tipe] += Number(t.jumlah)
    })
    return Object.values(map).sort((a, b) => a.hari.localeCompare(b.hari))
  }, [dataBulanIni])

  // Grafik pie: pengeluaran per kategori
  const pengeluaranPerKategori = useMemo(() => {
    const map = {}
    dataBulanIni.filter((t) => t.tipe === 'pengeluaran').forEach((t) => {
      map[t.kategori] = (map[t.kategori] || 0) + Number(t.jumlah)
    })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [dataBulanIni])

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '1.4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '1.2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem' }}>Laporan Keuangan</h2>
          <p style={{ color: '#3C554C', marginTop: 4 }}>Ringkasan pemasukan dan pengeluaran per bulan.</p>
        </div>
        <select value={bulan} onChange={(e) => setBulan(e.target.value)} style={{ padding: '0.6rem 0.9rem', borderRadius: 10, border: '1px solid #DED4BE' }}>
          {bulanTersedia.length === 0 && <option value={bulan}>{formatBulan(bulan)}</option>}
          {bulanTersedia.map((b) => <option key={b} value={b}>{formatBulan(b)}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: '1.4rem' }}>
        <SummaryCards totalMasuk={totalMasuk} totalKeluar={totalKeluar} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1.4rem' }} className="laporan-grid">
        <div className="card" style={{ padding: '1.3rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Pemasukan vs Pengeluaran per Hari</h3>
          {perHari.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={perHari}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFE9D9" />
                <XAxis dataKey="hari" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000000 ? `${v / 1000000}jt` : `${v / 1000}rb`)} />
                <Tooltip formatter={(v) => formatRupiah(v)} labelFormatter={(l) => `Tanggal ${l}`} />
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
  return <p style={{ color: '#8A7F68', textAlign: 'center', padding: '2rem 0' }}>Belum ada data untuk bulan ini.</p>
}

function formatBulan(ym) {
  const [y, m] = ym.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}
