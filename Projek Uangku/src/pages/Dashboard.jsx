import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import TransaksiForm from '../components/TransaksiForm'
import TransaksiList from '../components/TransaksiList'
import SummaryCards from '../components/SummaryCards'

export default function Dashboard() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const muatData = useCallback(async () => {
    const { data } = await supabase
      .from('transaksi')
      .select('*, profiles(nama_tampilan, peran)')
      .order('created_at', { ascending: false })
      .limit(30)
    setItems(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    muatData()
    const channel = supabase
      .channel('transaksi-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transaksi' }, () => {
        muatData()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [muatData])

  const totalMasuk = items.filter((i) => i.tipe === 'pemasukan').reduce((s, i) => s + Number(i.jumlah), 0)
  const totalKeluar = items.filter((i) => i.tipe === 'pengeluaran').reduce((s, i) => s + Number(i.jumlah), 0)

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '1.4rem' }}>
      <div style={{ marginBottom: '1.2rem' }}>
        <h2 style={{ fontSize: '1.5rem' }}>Catat Transaksi</h2>
        <p style={{ color: '#3C554C', marginTop: 4 }}>Ringkasan 30 catatan terbaru dari seluruh anggota keluarga.</p>
      </div>

      <div style={{ marginBottom: '1.4rem' }}>
        <SummaryCards totalMasuk={totalMasuk} totalKeluar={totalKeluar} />
      </div>

      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 380px) 1fr', gap: '1.4rem', alignItems: 'start' }}>
        <TransaksiForm onSaved={muatData} />
        <div>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '0.7rem' }}>Histori Terbaru</h3>
          {loading ? <p style={{ color: '#3C554C' }}>Memuat…</p> : <TransaksiList items={items} onChanged={muatData} />}
        </div>
      </div>

      <style>{`
        @media (max-width: 780px) {
          .dashboard-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
