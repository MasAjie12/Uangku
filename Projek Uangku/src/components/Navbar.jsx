import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'
import ReminderBell from './ReminderBell'

export default function Navbar() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  async function logout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const linkStyle = ({ isActive }) => ({
    padding: '0.5rem 0.9rem',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: '0.88rem',
    textDecoration: 'none',
    color: isActive ? '#F6F1E4' : '#3C554C',
    background: isActive ? '#16332B' : 'transparent',
  })

  return (
    <header className="app-navbar">
      <div className="nav-top-row">
        <div className="nav-brand">
          <span>Uangku</span>
        </div>
        <div className="nav-account">
          <ReminderBell />
          {profile && (
            <span className="nav-profile" title={`${profile.nama_tampilan} · ${profile.peran}`}>
              {profile.nama_tampilan} · <strong>{profile.peran}</strong>
            </span>
          )}
          <button className="btn btn-ghost nav-logout" onClick={logout}>Keluar</button>
        </div>
      </div>

      <nav className="main-nav" aria-label="Navigasi utama">
        <NavLink to="/" style={linkStyle} end>Catat</NavLink>
        <NavLink to="/laporan" style={linkStyle}>Laporan</NavLink>
        <NavLink to="/pengaturan" style={linkStyle}>Pengaturan</NavLink>
      </nav>

    </header>
  )
}
