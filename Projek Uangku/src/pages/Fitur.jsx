import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'
import ProfessionalTools from '../components/ProfessionalTools'

export default function Fitur() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const { session, profile } = useAuth()

  const muatData = useCallback(async () => {
    const { data } = await supabase
      .from('transaksi')
      .select('*, profiles(nama_tampilan, peran)')
      .order('created_at', { ascending: false })
      .limit(200)
    setItems(data || [])
    setLoading(false)
  }, [session, profile?.keluarga_id])

  useEffect(() => {
    muatData()
    const channel = supabase
      .channel('fitur-transaksi-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transaksi' },
        () => muatData(),
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [muatData])

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '1.4rem' }}>
      <div style={{ marginBottom: '1.2rem' }}>
        <h2 style={{ fontSize: '1.5rem' }}>Fitur</h2>
        <p style={{ color: '#3C554C', marginTop: 4 }}>
          Anggaran, daftar belanja, transaksi berulang, target tabungan, dan tagihan.
        </p>
      </div>

      <div className="professional-dashboard-section">
        {loading ? (
          <p style={{ color: '#3C554C' }}>Memuat…</p>
        ) : (
          <ProfessionalTools transactions={items} />
        )}
      </div>
    </div>
  )
}
