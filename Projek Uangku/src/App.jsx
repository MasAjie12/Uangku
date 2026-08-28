import React, { useEffect, useState, createContext, useContext } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Fitur from './pages/Fitur'
import Laporan from './pages/Laporan'
import Pengaturan from './pages/Pengaturan'
import Navbar from './components/Navbar'
import Footer from './components/Footer'

export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

function App() {
  const [session, setSession] = useState(undefined) // undefined = belum dicek, null = belum login
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }
    let active = true
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (active) setProfile(data)
      })
    return () => {
      active = false
    }
  }, [session])

  if (session === undefined || (session && profile === null)) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', fontFamily: 'Inter, sans-serif', color: '#3C554C' }}>
        Tunggu Sebentar ya…
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ session, profile, setProfile }}>
      <div className="app-shell">
        {session && <Navbar />}
        <main className="app-main">
          <PageTransition>
            <Routes>
              <Route path="/login" element={session ? <Navigate to="/" /> : <Login />} />
              <Route path="/register" element={session ? <Navigate to="/" /> : <Register />} />
              <Route path="/" element={session ? <Dashboard /> : <Navigate to="/login" />} />
              <Route path="/fitur" element={session ? <Fitur /> : <Navigate to="/login" />} />
              <Route path="/laporan" element={session ? <Laporan /> : <Navigate to="/login" />} />
              <Route path="/pengaturan" element={session ? <Pengaturan /> : <Navigate to="/login" />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </PageTransition>
        </main>
        <Footer />
      </div>
    </AuthContext.Provider>
  )
}

// Membungkus tiap halaman dengan animasi fade + geser halus saat berpindah route.
// key={pathname} membuat React memasang ulang node ini setiap ganti halaman,
// sehingga animasi CSS "page-enter" otomatis terputar dari awal.
function PageTransition({ children }) {
  const location = useLocation()
  return (
    <div key={location.pathname} className="page-enter">
      {children}
    </div>
  )
}

export default App
