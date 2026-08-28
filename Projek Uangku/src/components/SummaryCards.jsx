import React from 'react'
import { formatRupiah } from '../utils'

export default function SummaryCards({ totalMasuk, totalKeluar, saldoAwal = 0, saldo }) {
  const saldoTampil = typeof saldo === 'number' ? saldo : saldoAwal + totalMasuk - totalKeluar
  const items = [
    ...(saldoAwal ? [{ label: 'Saldo Awal', value: saldoAwal, color: '#C79A3D', bg: '#FFF8E7' }] : []),
    { label: 'Total Pemasukan', value: totalMasuk, color: '#2F7A54', bg: '#E4F0E7' },
    { label: 'Total Pengeluaran', value: totalKeluar, color: '#B1483A', bg: '#F5E5E1' },
    { label: 'Saldo', value: saldoTampil, color: saldoTampil >= 0 ? '#16332B' : '#B1483A', bg: '#FFFFFF' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.9rem' }}>
      {items.map((it) => (
        <div key={it.label} className="card" style={{ padding: '1.1rem 1.2rem', background: it.bg }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#3C554C', marginBottom: '0.3rem' }}>{it.label}</div>
          <div className="mono" style={{ fontSize: '1.35rem', fontWeight: 700, color: it.color }}>
            {formatRupiah(it.value)}
          </div>
        </div>
      ))}
    </div>
  )
}
