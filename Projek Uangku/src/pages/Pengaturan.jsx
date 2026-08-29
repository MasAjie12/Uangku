import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'
import KategoriManager from '../components/KategoriManager'
import { disablePushNotifications, enablePushNotifications, getPushState, isPushSupported } from '../pushNotifications'

export default function Pengaturan() {
  const { session, profile, setProfile } = useAuth()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)

  async function logout() {
    if (!confirm('Yakin ingin keluar dari akun ini?')) return
    setLoggingOut(true)
    await supabase.auth.signOut()
    navigate('/login')
  }
  const [keluarga, setKeluarga] = useState(null)
  const [anggota, setAnggota] = useState([])
  const [draft, setDraft] = useState({})
  const [savingId, setSavingId] = useState(null)
  const [pesan, setPesan] = useState('')
  const [disalin, setDisalin] = useState(false)
  const [editNamaKeluarga, setEditNamaKeluarga] = useState(false)
  const [namaKeluargaDraft, setNamaKeluargaDraft] = useState('')
  const [savingKeluarga, setSavingKeluarga] = useState(false)
  const [tampilkanGabung, setTampilkanGabung] = useState(false)
  const [kodeGabung, setKodeGabung] = useState('')
  const [gabungLoading, setGabungLoading] = useState(false)
  const [gabungPesan, setGabungPesan] = useState('')
  const [pushState, setPushState] = useState({ supported: false, permission: 'default', subscribed: false })
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMessage, setPushMessage] = useState('')

  useEffect(() => {
    muatAnggota()
    muatKeluarga()
    getPushState().then(setPushState).catch(() => setPushState({ supported: false, permission: 'unsupported', subscribed: false }))
  }, [])

  async function muatKeluarga() {
    const { data } = await supabase.from('keluarga').select('*').single()
    setKeluarga(data)
    if (data) setNamaKeluargaDraft(data.nama)
  }

  async function simpanNamaKeluarga() {
    if (!namaKeluargaDraft.trim()) return
    setSavingKeluarga(true)
    setPesan('')
    const { error } = await supabase
      .from('keluarga')
      .update({ nama: namaKeluargaDraft.trim() })
      .eq('id', keluarga.id)
    setSavingKeluarga(false)
    if (error) {
      setPesan('Gagal mengubah nama keluarga: ' + error.message)
      return
    }
    setKeluarga((k) => ({ ...k, nama: namaKeluargaDraft.trim() }))
    setEditNamaKeluarga(false)
    setPesan('Nama keluarga diubah.')
  }

  async function muatAnggota() {
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setAnggota(data || [])
    const initDraft = {}
    ;(data || []).forEach((a) => { initDraft[a.id] = { nama_tampilan: a.nama_tampilan, peran: a.peran } })
    setDraft(initDraft)
  }

  async function simpan(id) {
    setSavingId(id)
    setPesan('')
    const { nama_tampilan, peran } = draft[id]
    const { error } = await supabase.from('profiles').update({ nama_tampilan, peran }).eq('id', id)
    setSavingId(null)
    if (error) {
      setPesan('Gagal menyimpan: ' + error.message)
      return
    }
    if (id === session.user.id) {
      setProfile((p) => ({ ...p, nama_tampilan, peran }))
    }
    setPesan('Perubahan disimpan.')
    muatAnggota()
  }


  async function aktifkanNotifikasi() {
    if (!profile) return
    setPushBusy(true)
    setPushMessage('')
    try {
      await enablePushNotifications(profile)
      setPushState(await getPushState())
      setPushMessage('Notifikasi aktif. Uangku dapat mengirim pengingat tagihan dan target tabungan.')
    } catch (error) {
      setPushMessage(error?.message || 'Gagal mengaktifkan notifikasi.')
    } finally { setPushBusy(false) }
  }

  async function matikanNotifikasi() {
    setPushBusy(true)
    setPushMessage('')
    try {
      await disablePushNotifications()
      setPushState(await getPushState())
      setPushMessage('Notifikasi push dinonaktifkan pada perangkat ini.')
    } catch (error) {
      setPushMessage(error?.message || 'Gagal menonaktifkan notifikasi.')
    } finally { setPushBusy(false) }
  }

  function salinKode() {
    if (!keluarga) return
    navigator.clipboard.writeText(keluarga.kode_undangan)
    setDisalin(true)
    setTimeout(() => setDisalin(false), 1500)
  }

  async function gabungKeluarga() {
    const kode = kodeGabung.trim().toUpperCase()
    if (kode.length < 4) {
      setGabungPesan('Masukkan kode undangan yang valid.')
      return
    }
    if (
      !confirm(
        `Yakin ingin gabung ke keluarga dengan kode "${kode}"? Kamu akan pindah dari keluarga saat ini — anggaran, target tabungan, tagihan, dan pencatatan baru akan mengikuti keluarga tersebut. Riwayat transaksi lamamu tetap tersimpan.`
      )
    )
      return

    setGabungLoading(true)
    setGabungPesan('')
    const { data, error } = await supabase.rpc('gabung_keluarga', { kode_input: kode })
    setGabungLoading(false)

    if (error) {
      setGabungPesan('Gagal gabung: ' + error.message)
      return
    }

    const hasil = Array.isArray(data) ? data[0] : data

    // Muat ulang profil (keluarga_id sudah berubah di database) supaya
    // seluruh aplikasi langsung mengikuti keluarga yang baru.
    const { data: profilBaru } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
    if (profilBaru) setProfile(profilBaru)

    setKodeGabung('')
    setTampilkanGabung(false)
    setGabungPesan(`Berhasil gabung ke keluarga "${hasil?.nama_keluarga || ''}".`)
    await muatKeluarga()
    await muatAnggota()
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '1.4rem' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>Pengaturan</h2>
      <p style={{ color: '#3C554C', marginBottom: '1.4rem' }}>
        Kelola keluarga dan kategori.
      </p>

      {keluarga && (
        <div className="card" style={{ padding: '1.2rem 1.4rem', marginBottom: '1.4rem', background: '#FFFDF7' }}>
          <div style={{ fontSize: '0.8rem', color: '#8A7F68', marginBottom: '0.2rem' }}>Nama keluarga</div>
          {editNamaKeluarga ? (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.9rem', flexWrap: 'wrap' }}>
              <input
                value={namaKeluargaDraft}
                onChange={(e) => setNamaKeluargaDraft(e.target.value)}
                style={{ flex: 1, minWidth: 160, border: '1px solid #DED4BE', borderRadius: 10, padding: '0.5rem 0.7rem' }}
                autoFocus
              />
              <button className="btn btn-primary" onClick={simpanNamaKeluarga} disabled={savingKeluarga}>
                {savingKeluarga ? 'Menyimpan…' : 'Simpan'}
              </button>
              <button className="btn btn-ghost" onClick={() => { setEditNamaKeluarga(false); setNamaKeluargaDraft(keluarga.nama) }}>
                Batal
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
              <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{keluarga.nama}</span>
              <button className="btn btn-ghost" onClick={() => setEditNamaKeluarga(true)} style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}>
                Ubah
              </button>
            </div>
          )}
          <div style={{ fontSize: '0.8rem', color: '#8A7F68', marginBottom: '0.2rem' }}>Kode undangan</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap' }}>
            <span className="mono" style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '0.2em', color: '#C79A3D' }}>
              {keluarga.kode_undangan}
            </span>
            <button className="btn btn-ghost" onClick={salinKode} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
              {disalin ? 'Tersalin!' : 'Salin kode'}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => { setTampilkanGabung((v) => !v); setGabungPesan('') }}
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
            >
              {tampilkanGabung ? 'Batal' : 'Gabung Keluarga Lain'}
            </button>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#3C554C', marginTop: '0.7rem', marginBottom: 0 }}>
            Bagikan kode ini ke anggota keluarga lain. Saat mendaftar, mereka pilih "Gabung pakai kode" lalu masukkan kode di atas.
          </p>

          {tampilkanGabung && (
            <div style={{ marginTop: '0.9rem', padding: '0.9rem', borderRadius: 10, border: '1px dashed #DED4BE', background: '#fff' }}>
              <div style={{ fontSize: '0.8rem', color: '#8A7F68', marginBottom: '0.5rem' }}>
                Lupa memasukkan kode undangan saat daftar? Atau mau pindah ke keluarga lain? Masukkan kodenya di sini.
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  value={kodeGabung}
                  onChange={(e) => setKodeGabung(e.target.value.toUpperCase())}
                  placeholder="mis. AB12CD"
                  maxLength={6}
                  style={{
                    flex: 1,
                    minWidth: 140,
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    fontWeight: 700,
                    border: '1px solid #DED4BE',
                    borderRadius: 10,
                    padding: '0.5rem 0.7rem',
                  }}
                />
                <button className="btn btn-primary" onClick={gabungKeluarga} disabled={gabungLoading}>
                  {gabungLoading ? 'Memproses…' : 'Gabung'}
                </button>
              </div>
              <p style={{ fontSize: '0.74rem', color: '#8A7F68', marginTop: '0.6rem', marginBottom: 0 }}>
                Setelah gabung, kamu akan pindah ke keluarga baru itu — anggaran, target tabungan, tagihan, dan pencatatan baru akan mengikuti keluarga tersebut. Riwayat transaksi lamamu tetap tersimpan dan tidak hilang.
              </p>
            </div>
          )}

          {gabungPesan && (
            <p style={{ fontSize: '0.82rem', marginTop: '0.7rem', marginBottom: 0, color: gabungPesan.startsWith('Gagal') ? '#B1483A' : '#2F7A54' }}>
              {gabungPesan}
            </p>
          )}
        </div>
      )}

      {pesan && <p style={{ color: pesan.startsWith('Gagal') ? '#B1483A' : '#2F7A54', marginBottom: '1rem' }}>{pesan}</p>}

      <div className="card push-settings-card">
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>🔔 Notifikasi Pengingat</h3>
          <p style={{ margin: '.35rem 0 0', color: '#8A7F68', fontSize: '.8rem', lineHeight: 1.5 }}>
            Aktifkan notifikasi browser agar pengingat tagihan dan target tabungan dapat muncul sebagai notifikasi HP. Untuk menerima notifikasi saat browser tertutup, perangkat/browser harus mengizinkan Push dan aplikasi perlu menggunakan HTTPS.
          </p>
        </div>
        <div className="push-settings-actions">
          {!pushState.supported ? (
            <span className="push-status">Browser ini belum mendukung Web Push.</span>
          ) : pushState.subscribed ? (
            <>
              <span className="push-status push-on">● Notifikasi aktif</span>
              <button className="btn btn-ghost" onClick={matikanNotifikasi} disabled={pushBusy}>{pushBusy ? 'Memproses…' : 'Matikan notifikasi'}</button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={aktifkanNotifikasi} disabled={pushBusy}>{pushBusy ? 'Mengaktifkan…' : 'Aktifkan Notifikasi'}</button>
          )}
        </div>
        {pushMessage && <div className="push-message">{pushMessage}</div>}
      </div>

      <KategoriManager />

      <h3 style={{ fontSize: '1.05rem', marginBottom: '0.7rem' }}>Anggota Keluarga</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        {anggota.map((a) => {
          const isSelf = a.id === session.user.id
          const d = draft[a.id] || { nama_tampilan: '', peran: '' }
          return (
            <div key={a.id} className="card" style={{ padding: '1.1rem 1.3rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#8A7F68', marginBottom: '0.6rem' }}>
                Username: <strong>{a.username}</strong>{isSelf && ' (kamu)'}
              </div>
              <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="field" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
                  <label>Nama tampilan</label>
                  <input
                    value={d.nama_tampilan}
                    disabled={!isSelf}
                    onChange={(e) => setDraft((s) => ({ ...s, [a.id]: { ...s[a.id], nama_tampilan: e.target.value } }))}
                  />
                </div>
                <div className="field" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
                  <label>Peran</label>
                  <input
                    value={d.peran}
                    disabled={!isSelf}
                    placeholder="mis. Ayah, Ibu, Anak"
                    onChange={(e) => setDraft((s) => ({ ...s, [a.id]: { ...s[a.id], peran: e.target.value } }))}
                  />
                </div>
                {isSelf && (
                  <button className="btn btn-primary" onClick={() => simpan(a.id)} disabled={savingId === a.id}>
                    {savingId === a.id ? 'Menyimpan…' : 'Simpan'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="card danger-zone logout-zone" style={{ padding: '1.2rem 1.4rem', marginTop: '1.8rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.3rem' }}>Logout</h3>
        <p style={{ fontSize: '0.82rem', color: '#3C554C', marginTop: 0, marginBottom: '1rem', lineHeight: 1.5 }}>
          Kamu akan keluar dari akun di perangkat ini. Kamu bisa masuk kembali kapan saja dengan username dan kata sandi yang sama.
        </p>
        <button className="btn btn-danger" onClick={logout} disabled={loggingOut} style={{ width: '100%' }}>
          {loggingOut ? 'Sedang keluar…' : 'Keluar dari Akun'}
        </button>
      </div>
    </div>
  )
}
