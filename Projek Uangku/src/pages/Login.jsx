import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import PasswordField from '../components/PasswordField'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data: email, error: lookupError } = await supabase.rpc('get_login_email', { p_username: username })
    if (lookupError || !email) {
      setLoading(false)
      setError('Username atau kata sandi salah.')
      return
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setLoading(false)
    if (error) {
      setError('Username atau kata sandi salah.')
      return
    }
    navigate('/')
  }

  async function handleGoogleLogin() {
    setError('')
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      setGoogleLoading(false)
      setError('Gagal masuk dengan Google: ' + error.message)
    }
    // Kalau berhasil, browser akan dialihkan ke Google lalu kembali lagi
    // ke aplikasi — jadi tidak perlu setGoogleLoading(false) di sini.
  }

  return (
    <div style={wrapStyle}>
      <div className="card" style={cardStyle}>
        <h1 style={{ fontSize: '1.6rem', marginBottom: '0.2rem' }}>UangKu</h1>
        <p style={{ color: '#3C554C', marginTop: 0, marginBottom: '1.4rem', fontSize: '0.92rem' }}>
          Sahabat Keuangan Kamu. Catat Apapun, Darimanapun.
        </p>

        <button
          type="button"
          className="btn-google"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
        >
          <GoogleIcon />
          {googleLoading ? 'Mengalihkan ke Google…' : 'Masuk dengan Google'}
        </button>

        <div className="login-divider"><span>atau pakai username</span></div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus placeholder="mis. aji123" />
          </div>
          <div className="field">
            <label>Kata sandi</label>
            <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" autoComplete="current-password" />
            <span style={{ textAlign: 'right' }}>
              <Link to="/lupa-password" style={{ fontSize: '0.8rem', color: '#C79A3D', fontWeight: 600 }}>Lupa password?</Link>
            </span>
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

      <style>{`
        .btn-google {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: .6rem;
          border: 1px solid #E3DCC8;
          background: #fff;
          color: #3C3225;
          border-radius: 10px;
          padding: 0.68rem 1.1rem;
          font-weight: 600;
          font-size: 0.92rem;
          cursor: pointer;
          transition: box-shadow .15s ease, transform .08s ease;
        }
        .btn-google:hover { box-shadow: 0 2px 10px rgba(0,0,0,.06); }
        .btn-google:active { transform: scale(0.98); }
        .btn-google:disabled { opacity: .65; cursor: default; }
        .login-divider {
          display: flex;
          align-items: center;
          gap: .7rem;
          margin: 1rem 0 1.1rem;
          color: #A69B84;
          font-size: .74rem;
        }
        .login-divider::before, .login-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #EFE9D9;
        }
      `}</style>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.85 2.09-1.81 2.73v2.27h2.93c1.71-1.58 2.69-3.9 2.69-6.64z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.93-2.27c-.81.55-1.85.87-3.03.87-2.33 0-4.31-1.58-5.02-3.7H.96v2.33C2.44 15.98 5.48 18 9 18z" />
      <path fill="#FBBC05" d="M3.98 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.3-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.02-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.6-2.6C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.95l3.02 2.33C4.69 5.16 6.67 3.58 9 3.58z" />
    </svg>
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
