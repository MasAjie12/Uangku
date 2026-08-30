import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'

// Ditampilkan sekali saja untuk user baru yang masuk lewat Google.
// Karena login Google tidak melalui form Register (jadi tidak ada
// nama_keluarga/kode_undangan yang dikirim), trigger database otomatis
// membuatkan mereka satu keluarga baru sendirian. Di sinilah mereka
// memilih: lanjut pakai keluarga baru itu (boleh ganti nama dulu), atau
// gabung ke keluarga yang sudah ada pakai kode undangan.
export default function LengkapiProfil() {
  const { profile, setProfile } = useAuth()
  const navigate = useNavigate()

  const [keluarga, setKeluarga] = useState(null)
  const [namaKeluarga, setNamaKeluarga] = useState('')
  const [kodeUndangan, setKodeUndangan] = useState('')
  const [mode, setMode] = useState('baru') // 'baru' | 'gabung'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    supabase
      .from('keluarga')
      .select('*')
      .eq('id', profile.keluarga_id)
      .single()
      .then(({ data }) => {
        if (active && data) {
          setKeluarga(data)
          setNamaKeluarga(data.nama)
        }
      })
    return () => { active = false }
  }, [profile.keluarga_id])

  async function selesaikanOnboarding() {
    const { data, error } = await supabase
      .from('profiles')
      .update({ perlu_lengkapi_keluarga: false })
      .eq('id', profile.id)
      .select()
      .single()
    if (error) throw error
    setProfile(data)
    navigate('/')
  }

  async function lanjutKeluargaBaru(e) {
    e.preventDefault()
    setError('')
    if (!namaKeluarga.trim()) {
      setError('Nama keluarga tidak boleh kosong.')
      return
    }
    setLoading(true)
    try {
      if (keluarga && namaKeluarga.trim() !== keluarga.nama) {
        const { error: errUpdate } = await supabase
          .from('keluarga')
          .update({ nama: namaKeluarga.trim() })
          .eq('id', keluarga.id)
        if (errUpdate) throw errUpdate
      }
      await selesaikanOnboarding()
    } catch (err) {
      setError('Gagal menyimpan: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function gabungKeKeluargaLain(e) {
    e.preventDefault()
    setError('')
    if (kodeUndangan.trim().length < 4) {
      setError('Masukkan kode undangan yang valid.')
      return
    }
    setLoading(true)
    try {
      const { error: errGabung } = await supabase.rpc('gabung_keluarga', { kode_input: kodeUndangan.trim() })
      if (errGabung) throw errGabung
      await selesaikanOnboarding()
    } catch (err) {
      setError('Gagal gabung: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={wrapStyle}>
      <div className="card" style={cardStyle}>
        <h1 style={{ fontSize: '1.4rem', marginBottom: '0.3rem' }}>Selamat datang, {profile.nama_tampilan}! 👋</h1>
        <p style={{ color: '#3C554C', marginTop: 0, marginBottom: '1.3rem', fontSize: '0.9rem' }}>
          Satu langkah lagi. Uangku dipakai per keluarga — pilih mau mulai keluarga baru, atau gabung ke keluarga yang sudah ada.
        </p>

        <div className="onboarding-tabs">
          <button type="button" className={mode === 'baru' ? 'active' : ''} onClick={() => setMode('baru')}>Keluarga baru</button>
          <button type="button" className={mode === 'gabung' ? 'active' : ''} onClick={() => setMode('gabung')}>Gabung pakai kode</button>
        </div>

        {mode === 'baru' ? (
          <form onSubmit={lanjutKeluargaBaru}>
            <p style={{ fontSize: '0.82rem', color: '#8A7F68', marginBottom: '0.9rem' }}>
              Kami sudah siapkan satu keluarga baru untukmu. Beri nama (bisa diganti lagi nanti lewat Pengaturan), lalu lanjutkan.
            </p>
            <div className="field">
              <label>Nama keluarga</label>
              <input
                value={namaKeluarga}
                onChange={(e) => setNamaKeluarga(e.target.value)}
                placeholder="mis. Keluarga Budi"
                required
                autoFocus
              />
            </div>
            {error && <p style={{ color: '#B1483A', fontSize: '0.85rem', marginTop: -4 }}>{error}</p>}
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.4rem' }} disabled={loading}>
              {loading ? 'Menyimpan…' : 'Lanjutkan'}
            </button>
          </form>
        ) : (
          <form onSubmit={gabungKeKeluargaLain}>
            <p style={{ fontSize: '0.82rem', color: '#8A7F68', marginBottom: '0.9rem' }}>
              Sudah ada anggota keluarga yang lebih dulu pakai Uangku? Minta kode undangan mereka (bisa dilihat di halaman Pengaturan mereka), lalu masukkan di sini.
            </p>
            <div className="field">
              <label>Kode undangan</label>
              <input
                value={kodeUndangan}
                onChange={(e) => setKodeUndangan(e.target.value.toUpperCase())}
                placeholder="mis. AB12CD"
                required
                autoFocus
              />
            </div>
            {error && <p style={{ color: '#B1483A', fontSize: '0.85rem', marginTop: -4 }}>{error}</p>}
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.4rem' }} disabled={loading}>
              {loading ? 'Memproses…' : 'Gabung'}
            </button>
          </form>
        )}
      </div>

      <style>{`
        .onboarding-tabs { display:flex; gap:.5rem; margin-bottom:1.1rem; border-bottom:1px solid #EFE9D9; }
        .onboarding-tabs button {
          flex:1; border:none; background:transparent; padding:.6rem .4rem; font-size:.82rem; font-weight:650;
          color:#8A7F68; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px;
        }
        .onboarding-tabs button.active { color:#16332B; border-bottom-color:#C79A3D; }
      `}</style>
    </div>
  )
}

const wrapStyle = {
  display: 'grid',
  placeItems: 'center',
  minHeight: '100vh',
  padding: '1.2rem',
}
const cardStyle = {
  width: '100%',
  maxWidth: 420,
  padding: '2rem 1.8rem',
}
