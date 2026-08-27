import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, usernameToEmail } from '../supabaseClient'

export default function Register() {
  const [username, setUsername] = useState('')
  const [namaTampilan, setNamaTampilan] = useState('')
  const [peran, setPeran] = useState('')
  const [password, setPassword] = useState('')
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
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email: usernameToEmail(username),
      password,
      options: {
        data: {
          username: username.trim().toLowerCase(),
          nama_tampilan: namaTampilan || username,
          peran: peran || 'Anggota',
        },
      },
    })
    setLoading(false)
    if (error) {
      setError(error.message.includes('already registered') ? 'Username sudah dipakai.' : error.message)
      return
    }
    navigate('/')
  }

  return (
    <div style={wrapStyle}>
      <div className="card" style={cardStyle}>
        <h1 style={{ fontSize: '1.6rem', marginBottom: '0.2rem' }}>Buat akun Uangku</h1>
        <p style={{ color: '#3C554C', marginTop: 0, marginBottom: '1.4rem', fontSize: '0.92rem' }}>
          Satu akun untuk satu anggota keluarga.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="mis. ayah" />
          </div>
          <div className="field">
            <label>Nama tampilan</label>
            <input value={namaTampilan} onChange={(e) => setNamaTampilan(e.target.value)} placeholder="mis. Pak Budi" />
          </div>
          <div className="field">
            <label>Peran di keluarga</label>
            <input value={peran} onChange={(e) => setPeran(e.target.value)} placeholder="mis. Ayah, Ibu, Anak" />
          </div>
          <div className="field">
            <label>Kata sandi</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="minimal 6 karakter" />
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
