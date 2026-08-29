import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function LupaPassword() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sukses, setSukses] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSukses('')
    setLoading(true)

    const { data: email } = await supabase.rpc('get_login_email', { p_username: username })

    if (!email) {
      setLoading(false)
      setError('Username tidak ditemukan.')
      return
    }

    if (email.endsWith('@uangku.local')) {
      setLoading(false)
      setError('Akun ini belum punya email pemulihan terdaftar. Minta bantuan anggota keluarga lain, atau tambahkan email pemulihan lewat halaman Pengaturan setelah berhasil masuk.')
      return
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) {
      setError('Gagal mengirim link reset: ' + error.message)
      return
    }
    setSukses('Link reset password sudah dikirim ke email pemulihanmu. Buka email itu dan ikuti tautannya untuk membuat kata sandi baru. Jangan lupa cek folder spam kalau belum terlihat.')
  }

  return (
    <div style={wrapStyle}>
      <div className="card" style={cardStyle}>
        <h1 style={{ fontSize: '1.4rem', marginBottom: '0.2rem' }}>Lupa Kata Sandi</h1>
        <p style={{ color: '#3C554C', marginTop: 0, marginBottom: '1.2rem', fontSize: '0.9rem' }}>
          Masukkan username akunmu. Kalau akun itu punya email pemulihan, kami kirimkan link untuk membuat kata sandi baru.
        </p>

        {sukses ? (
          <p style={{ color: '#2F7A54', fontSize: '0.9rem', lineHeight: 1.5 }}>{sukses}</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Username</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus placeholder="mis. aji123" />
            </div>
            {error && <p style={{ color: '#B1483A', fontSize: '0.85rem', marginTop: -4 }}>{error}</p>}
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.4rem' }} disabled={loading}>
              {loading ? 'Mengirim…' : 'Kirim Link Reset'}
            </button>
          </form>
        )}

        <p style={{ fontSize: '0.85rem', color: '#3C554C', marginTop: '1.2rem', textAlign: 'center' }}>
          <Link to="/login" style={{ color: '#C79A3D', fontWeight: 600 }}>Kembali ke halaman Masuk</Link>
        </p>
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
