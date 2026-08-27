import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, usernameToEmail } from '../supabaseClient'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    })
    setLoading(false)
    if (error) {
      setError('Username atau kata sandi salah.')
      return
    }
    navigate('/')
  }

  return (
    <div style={wrapStyle}>
      <div className="card" style={cardStyle}>
        <h1 style={{ fontSize: '1.6rem', marginBottom: '0.2rem' }}>Uangku</h1>
        <p style={{ color: '#3C554C', marginTop: 0, marginBottom: '1.4rem', fontSize: '0.92rem' }}>
          Catatan kas keluarga, bisa dibuka dari mana saja.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus placeholder="mis. ayah" />
          </div>
          <div className="field">
            <label>Kata sandi</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
          </div>
          {error && <p style={{ color: '#B1483A', fontSize: '0.85rem', marginTop: -4 }}>{error}</p>}
          <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.4rem' }} disabled={loading}>
            {loading ? 'Masuk…' : 'Masuk'}
          </button>
        </form>
        <p style={{ fontSize: '0.85rem', color: '#3C554C', marginTop: '1.2rem', textAlign: 'center' }}>
          Belum punya akun? <Link to="/register" style={{ color: '#C79A3D', fontWeight: 600 }}>Daftar di sini</Link>
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
