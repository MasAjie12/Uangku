import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'

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
    <div className="app-navbar" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.9rem 1.4rem',
      borderBottom: '1px solid #DED4BE',
      background: '#FFFFFF',
      position: 'sticky',
      top: 0,
      zIndex: 10,
      flexWrap: 'wrap',
      gap: '0.6rem',
    }}>
      <div className="nav-top-row">
        <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', fontWeight: 700, color: '#16332B' }}>
          Uangku
        </span>
        <div className="nav-account" style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
        {profile && (
          <span style={{ fontSize: '0.85rem', color: '#3C554C' }}>
            {profile.nama_tampilan} · <strong style={{ color: '#C79A3D' }}>{profile.peran}</strong>
          </span>
        )}
          <button className="btn btn-ghost" onClick={logout}>Keluar</button>
        </div>
      </div>
      <nav className="main-nav" style={{ display: 'flex', gap: '0.4rem' }}>
        <NavLink to="/" style={linkStyle} end>Catat</NavLink>
        <NavLink to="/laporan" style={linkStyle}>Laporan</NavLink>
        <NavLink to="/pengaturan" style={linkStyle}>Pengaturan</NavLink>
      </nav>
    </div>
  )
}
