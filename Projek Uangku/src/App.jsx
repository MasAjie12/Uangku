import React, { useEffect, useState, createContext, useContext } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import Register from './pages/Register'
import LupaPassword from './pages/LupaPassword'
import ResetPassword from './pages/ResetPassword'
import LengkapiProfil from './pages/LengkapiProfil'
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
  const location = useLocation()

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
    let percobaan = 0

    function muatProfil() {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
        .then(({ data, error }) => {
          if (!active) return
          if (data) {
            setProfile(data)
            return
          }
          // Untuk login Google, trigger pembuat profil jalan otomatis di
          // database begitu akun dibuat — seharusnya sudah ada saat sesi
          // ini didapat. Tapi kalau ada jeda replikasi, coba ulang sebentar
          // daripada macet di layar "Tunggu Sebentar ya…".
          if (error && percobaan < 5) {
            percobaan += 1
            setTimeout(muatProfil, 700)
          }
        })
    }
    muatProfil()

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

  // Bungkus route yang butuh login. Kalau profil masih perlu melengkapi
  // pilihan keluarga (khusus user baru dari login Google), semua halaman
  // utama dialihkan ke /lengkapi-profil dulu sampai itu selesai.
  function rutePrivat(elemen) {
    if (!session) return <Navigate to="/login" />
    if (profile?.perlu_lengkapi_keluarga) return <Navigate to="/lengkapi-profil" />
    return elemen
  }

  return (
    <AuthContext.Provider value={{ session, profile, setProfile }}>
      <div className="app-shell">
        {session && location.pathname !== '/reset-password' && !profile?.perlu_lengkapi_keluarga && <Navbar />}
        <main className="app-main">
          <PageTransition>
            <Routes>
              <Route path="/login" element={session ? <Navigate to="/" /> : <Login />} />
              <Route path="/register" element={session ? <Navigate to="/" /> : <Register />} />
              <Route path="/lupa-password" element={session ? <Navigate to="/" /> : <LupaPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/lengkapi-profil"
                element={
                  !session ? <Navigate to="/login" /> : !profile?.perlu_lengkapi_keluarga ? <Navigate to="/" /> : <LengkapiProfil />
                }
              />
              <Route path="/" element={rutePrivat(<Dashboard />)} />
              <Route path="/fitur" element={rutePrivat(<Fitur />)} />
              <Route path="/laporan" element={rutePrivat(<Laporan />)} />
              <Route path="/pengaturan" element={rutePrivat(<Pengaturan />)} />
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
