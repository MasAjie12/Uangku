import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import PasswordField from '../components/PasswordField'

export default function ResetPassword() {
  const [siap, setSiap] = useState(false)
  const [password, setPassword] = useState('')
  const [konfirmasi, setKonfirmasi] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sukses, setSukses] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Link dari email membawa token pemulihan yang otomatis diproses oleh
    // supabase-js menjadi sesi sementara, ditandai lewat event PASSWORD_RECOVERY.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setSiap(true)
    })
    // Kalau halaman ini dibuka ulang (mis. refresh) setelah sesi pemulihan
    // sudah terpasang, sesi itu tetap ada meski event-nya tidak terulang.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSiap(true)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Kata sandi minimal 6 karakter.')
      return
    }
    if (password !== konfirmasi) {
      setError('Konfirmasi kata sandi tidak cocok.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setError('Gagal mengubah kata sandi: ' + error.message)
      return
    }
    setSukses(true)
    setTimeout(() => navigate('/'), 2000)
  }

  return (
    <div style={wrapStyle}>
      <div className="card" style={cardStyle}>
        <h1 style={{ fontSize: '1.4rem', marginBottom: '0.2rem' }}>Buat Kata Sandi Baru</h1>

        {!siap ? (
          <p style={{ color: '#3C554C', fontSize: '0.9rem', marginTop: '1rem', lineHeight: 1.5 }}>
            Link ini tidak valid atau sudah kedaluwarsa. Silakan minta link reset baru lewat halaman Lupa Password.
          </p>
        ) : sukses ? (
          <p style={{ color: '#2F7A54', fontSize: '0.9rem', marginTop: '1rem' }}>
            Kata sandi berhasil diubah. Mengarahkan ke halaman utama…
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
            <div className="field">
              <label>Kata sandi baru</label>
              <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="minimal 6 karakter" autoComplete="new-password" />
            </div>
            <div className="field">
              <label>Konfirmasi kata sandi baru</label>
              <PasswordField value={konfirmasi} onChange={(e) => setKonfirmasi(e.target.value)} required placeholder="ulangi kata sandi baru" autoComplete="new-password" />
            </div>
            {error && <p style={{ color: '#B1483A', fontSize: '0.85rem', marginTop: -4 }}>{error}</p>}
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.4rem' }} disabled={loading}>
              {loading ? 'Menyimpan…' : 'Simpan Kata Sandi Baru'}
            </button>
          </form>
        )}
      </div>
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
  maxWidth: 380,
  padding: '2rem 1.8rem',
}
