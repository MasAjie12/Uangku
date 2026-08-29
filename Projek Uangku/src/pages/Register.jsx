import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, usernameToEmail } from '../supabaseClient'
import PasswordField from '../components/PasswordField'

export default function Register() {
  const [mode, setMode] = useState('buat') // 'buat' | 'gabung'
  const [username, setUsername] = useState('')
  const [namaTampilan, setNamaTampilan] = useState('')
  const [peran, setPeran] = useState('')
  const [password, setPassword] = useState('')
  const [emailPemulihan, setEmailPemulihan] = useState('')
  const [namaKeluarga, setNamaKeluarga] = useState('')
  const [kodeUndangan, setKodeUndangan] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Kata sandi minimal 6 karakter.')
      return
    }
    if (mode === 'gabung' && kodeUndangan.trim().length < 4) {
      setError('Masukkan kode undangan yang valid.')
      return
    }
    const emailBersih = emailPemulihan.trim().toLowerCase()
    const polaEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (emailBersih && !polaEmail.test(emailBersih)) {
      setError('Format email pemulihan tidak valid.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email: emailBersih || usernameToEmail(username),
      password,
      options: {
        data: {
          username: username.trim().toLowerCase(),
          nama_tampilan: namaTampilan || username,
          peran: peran || 'Anggota',
          mode,
          nama_keluarga: namaKeluarga,
          kode_undangan: kodeUndangan,
        },
      },
    })
    setLoading(false)
    if (error) {
      let pesan = error.message
      if (pesan.includes('already registered')) pesan = emailBersih ? 'Email pemulihan itu sudah dipakai akun lain.' : 'Username sudah dipakai.'
      if (pesan.includes('Kode undangan tidak ditemukan')) pesan = 'Kode undangan tidak ditemukan. Periksa kembali kode yang diberikan anggota keluargamu.'
      setError(pesan)
      return
    }
    navigate('/')
  }

  return (
    <div style={wrapStyle}>
      <div className="card" style={cardStyle}>
        <h1 style={{ fontSize: '1.6rem', marginBottom: '0.2rem' }}>Buat akun Uangku</h1>
        <p style={{ color: '#3C554C', marginTop: 0, marginBottom: '1.2rem', fontSize: '0.92rem' }}>
          Satu akun untuk satu anggota keluarga.
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.2rem' }}>
          <button type="button" onClick={() => setMode('buat')} style={toggleStyle(mode === 'buat')}>
            Buat keluarga baru
          </button>
          <button type="button" onClick={() => setMode('gabung')} style={toggleStyle(mode === 'gabung')}>
            Gabung pakai kode
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'buat' ? (
            <div className="field">
              <label>Nama keluarga <span style={{ fontWeight: 400, color: '#8A7F68' }}>(opsional)</span></label>
              <input
                value={namaKeluarga}
                onChange={(e) => setNamaKeluarga(e.target.value)}
                placeholder="mis. Keluarga Setiawan"
              />
              <span style={{ fontSize: '0.78rem', color: '#8A7F68' }}>
                Boleh dikosongkan dulu — nanti bisa diubah di halaman Pengaturan.
              </span>
            </div>
          ) : (
            <div className="field">
              <label>Kode undangan</label>
              <input
                value={kodeUndangan}
                onChange={(e) => setKodeUndangan(e.target.value.toUpperCase())}
                placeholder="mis. AB12CD"
                maxLength={6}
                style={{ textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700 }}
                required
              />
              <span style={{ fontSize: '0.78rem', color: '#8A7F68' }}>Minta kode ini ke anggota keluarga yang sudah lebih dulu punya akun Uangku.</span>
            </div>
          )}

          <div className="field">
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="mis. masaji123" />
          </div>
          <div className="field">
            <label>Nama tampilan</label>
            <input value={namaTampilan} onChange={(e) => setNamaTampilan(e.target.value)} placeholder="mis. Aji Setiawan" />
          </div>
          <div className="field">
            <label>Peran di keluarga</label>
            <input value={peran} onChange={(e) => setPeran(e.target.value)} placeholder="mis. Ayah, Ibu, Anak" />
          </div>
          <div className="field">
            <label>Kata sandi</label>
            <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="minimal 6 karakter" autoComplete="new-password" />
          </div>
          <div className="field">
            <label>Email <span style={{ fontWeight: 400, color: '#8A7F68' }}>(opsional, untuk lupa password)</span></label>
            <input
              type="email"
              value={emailPemulihan}
              onChange={(e) => setEmailPemulihan(e.target.value)}
              placeholder="mis. nama@gmail.com"
            />
            <span style={{ fontSize: '0.78rem', color: '#8A7F68' }}>
              Kalau diisi, kamu bisa reset password sendiri lewat email ini jika lupa. Boleh dikosongkan.
            </span>
          </div>
          {error && <p style={{ color: '#B1483A', fontSize: '0.85rem', marginTop: -4 }}>{error}</p>}
          <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.4rem' }} disabled={loading}>
            {loading ? 'Mendaftarkan…' : 'Daftar'}
          </button>
        </form>
        <p style={{ fontSize: '0.85rem', color: '#3C554C', marginTop: '1.2rem', textAlign: 'center' }}>
          Sudah punya akun? <Link to="/login" style={{ color: '#C79A3D', fontWeight: 600 }}>Masuk</Link>
        </p>
      </div>
    </div>
  )
}

function toggleStyle(active) {
  return {
    flex: 1,
    padding: '0.6rem',
    borderRadius: 10,
    border: '1px solid #DED4BE',
    fontWeight: 700,
    fontSize: '0.82rem',
    background: active ? '#16332B' : '#fff',
    color: active ? '#F6F1E4' : '#3C554C',
  }
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
