import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'
import KategoriManager from '../components/KategoriManager'
import PasswordField from '../components/PasswordField'
import { disablePushNotifications, enablePushNotifications, getPushState, isPushSupported } from '../pushNotifications'

export default function Pengaturan() {
  const { session, profile, setProfile } = useAuth()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)
  const [passwordBaru, setPasswordBaru] = useState('')
  const [passwordKonfirmasi, setPasswordKonfirmasi] = useState('')
  const [gantiPasswordLoading, setGantiPasswordLoading] = useState(false)
  const [gantiPasswordPesan, setGantiPasswordPesan] = useState('')

  async function gantiPassword(e) {
    e.preventDefault()
    setGantiPasswordPesan('')
    if (passwordBaru.length < 6) {
      setGantiPasswordPesan('Kata sandi baru minimal 6 karakter.')
      return
    }
    if (passwordBaru !== passwordKonfirmasi) {
      setGantiPasswordPesan('Konfirmasi kata sandi tidak cocok.')
      return
    }
    setGantiPasswordLoading(true)
    const { error } = await supabase.auth.updateUser({ password: passwordBaru })
    setGantiPasswordLoading(false)
    if (error) {
      setGantiPasswordPesan('Gagal mengubah kata sandi: ' + error.message)
      return
    }
    setPasswordBaru('')
    setPasswordKonfirmasi('')
    setGantiPasswordPesan('Kata sandi berhasil diubah.')
  }

  async function logout() {
    if (!confirm('Yakin ingin keluar dari akun ini?')) return
    setLoggingOut(true)
    await supabase.auth.signOut()
    navigate('/login')
  }
  const [keluarga, setKeluarga] = useState(null)
  const [anggota, setAnggota] = useState([])
  const [emailMap, setEmailMap] = useState({})
  const [emailPendingMap, setEmailPendingMap] = useState({})
  const [emailDraft, setEmailDraft] = useState('')
  const [kirimUlangLoading, setKirimUlangLoading] = useState(false)
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
  const [hapusAkunInput, setHapusAkunInput] = useState('')
  const [hapusAkunLoading, setHapusAkunLoading] = useState(false)
  const [hapusAkunPesan, setHapusAkunPesan] = useState('')
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

    const { data: emailRows } = await supabase.rpc('get_keluarga_emails')
    const map = {}
    const pendingMap = {}
    ;(emailRows || []).forEach((r) => {
      map[r.profile_id] = r.email
      if (r.email_pending) pendingMap[r.profile_id] = r.email_pending
    })
    setEmailMap(map)
    setEmailPendingMap(pendingMap)
    setEmailDraft(map[session.user.id] || '')
  }

  async function simpan(id) {
    setSavingId(id)
    setPesan('')
    const { nama_tampilan, peran } = draft[id]
    const { error } = await supabase.from('profiles').update({ nama_tampilan, peran }).eq('id', id)
    if (error) {
      setSavingId(null)
      setPesan('Gagal menyimpan: ' + error.message)
      return
    }
    if (id === session.user.id) {
      setProfile((p) => ({ ...p, nama_tampilan, peran }))

      const emailBersih = emailDraft.trim().toLowerCase()
      const emailSaatIni = emailMap[id] || ''
      if (emailBersih && emailBersih !== emailSaatIni) {
        const polaEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!polaEmail.test(emailBersih)) {
          setSavingId(null)
          setPesan('Format email tidak valid.')
          return
        }
        const { error: emailError } = await supabase.auth.updateUser({ email: emailBersih })
        if (emailError) {
          setSavingId(null)
          setPesan('Nama & peran tersimpan, tapi gagal menambahkan email: ' + emailError.message)
          return
        }
        setSavingId(null)
        setPesan(`Perubahan disimpan. Cek inbox (dan folder spam) di ${emailBersih}, lalu klik link konfirmasinya. Kalau nanti setelah diklik email tetap tidak muncul tersimpan di sini, kemungkinan penyebabnya pengaturan "Secure email change" di Supabase Dashboard yang perlu dimatikan pemilik project.`)
        muatAnggota()
        return
      }
    }
    setSavingId(null)
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

  async function hapusAkun() {
    if (!profile) return
    if (hapusAkunInput.trim().toLowerCase() !== profile.username.toLowerCase()) {
      setHapusAkunPesan('Ketik username kamu persis untuk konfirmasi.')
      return
    }
    if (
      !confirm(
        'Ini permanen dan TIDAK BISA DIBATALKAN. Akunmu (username, kata sandi, profil) akan dihapus sepenuhnya dari database sehingga username-nya bisa dipakai orang lain. Riwayat transaksi yang pernah kamu catat tetap tersimpan di keluarga (tidak ikut terhapus), tapi kamu tidak akan bisa login lagi dengan akun ini. Lanjutkan?'
      )
    )
      return

    setHapusAkunLoading(true)
    setHapusAkunPesan('')
    const { error } = await supabase.rpc('hapus_akun_saya')
    if (error) {
      setHapusAkunLoading(false)
      setHapusAkunPesan('Gagal menghapus akun: ' + error.message)
      return
    }
    await supabase.auth.signOut()
    navigate('/login')
  }

  async function kirimUlangKonfirmasiEmail() {
    const emailTujuan = emailPendingMap[session.user.id] || emailDraft.trim().toLowerCase()
    if (!emailTujuan) return
    setKirimUlangLoading(true)
    setPesan('')
    const { error } = await supabase.auth.updateUser({ email: emailTujuan })
    setKirimUlangLoading(false)
    if (error) {
      setPesan('Gagal mengirim ulang: ' + error.message)
      return
    }
    setPesan(`Link konfirmasi baru sudah dikirim ke ${emailTujuan}. Cek inbox & folder spam, lalu klik link di email itu.`)
    muatAnggota()
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
              <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div className="field" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
                  <label>
                    Email{' '}
                    {isSelf && !emailPendingMap[a.id] && emailMap[a.id] ? (
                      <span style={{ fontWeight: 700, color: '#2F7A54' }}>✓ Terkonfirmasi</span>
                    ) : (
                      <span style={{ fontWeight: 400, color: '#8A7F68' }}>(opsional)</span>
                    )}
                  </label>
                  {isSelf ? (
                    <input
                      type="email"
                      value={emailDraft}
                      placeholder="mis. nama@gmail.com"
                      onChange={(e) => setEmailDraft(e.target.value)}
                    />
                  ) : (
                    <input value={emailMap[a.id] || (emailPendingMap[a.id] ? `${emailPendingMap[a.id]} (menunggu konfirmasi)` : 'Belum ada email')} disabled />
                  )}
                  {isSelf && emailPendingMap[a.id] && (
                    <div style={{ marginTop: '0.4rem', padding: '0.5rem 0.6rem', borderRadius: 8, background: '#FFF8E7', border: '1px solid #E9D6A5', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                      <p style={{ fontSize: '0.74rem', color: '#7A5A16', margin: 0, lineHeight: 1.5, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                        Email <strong style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{emailPendingMap[a.id]}</strong> masih menunggu konfirmasi. Buka inbox (dan folder spam) email itu, lalu klik link konfirmasinya. Kalau sudah pernah klik tapi tetap muncul begini, kemungkinan penyebabnya pengaturan <strong>"Secure email change"</strong> di Supabase — minta pemilik project mematikannya di Dashboard.
                      </p>
                      <button
                        type="button"
                        onClick={kirimUlangKonfirmasiEmail}
                        disabled={kirimUlangLoading}
                        style={{ marginTop: '0.4rem', background: 'none', border: 'none', color: '#C79A3D', fontWeight: 700, fontSize: '0.74rem', padding: 0, textAlign: 'left', whiteSpace: 'normal' }}
                      >
                        {kirimUlangLoading ? 'Mengirim…' : 'Kirim ulang link konfirmasi'}
                      </button>
                    </div>
                  )}
                </div>
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
                  <button className="btn btn-primary" onClick={() => simpan(a.id)} disabled={savingId === a.id} style={{ marginTop: '1.55rem' }}>
                    {savingId === a.id ? 'Menyimpan…' : 'Simpan'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="card" style={{ padding: '1.2rem 1.4rem', marginTop: '1.8rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.3rem' }}>Ganti Password</h3>
        <p style={{ fontSize: '0.82rem', color: '#3C554C', marginTop: 0, marginBottom: '1rem', lineHeight: 1.5 }}>
          Kata sandi baru akan langsung berlaku untuk login berikutnya.
        </p>
        <form onSubmit={gantiPassword}>
          <div className="field">
            <label>Kata sandi baru</label>
            <PasswordField value={passwordBaru} onChange={(e) => { setPasswordBaru(e.target.value); setGantiPasswordPesan('') }} placeholder="minimal 6 karakter" autoComplete="new-password" />
          </div>
          <div className="field">
            <label>Konfirmasi kata sandi baru</label>
            <PasswordField value={passwordKonfirmasi} onChange={(e) => { setPasswordKonfirmasi(e.target.value); setGantiPasswordPesan('') }} placeholder="ulangi kata sandi baru" autoComplete="new-password" />
          </div>
          {gantiPasswordPesan && (
            <p style={{ fontSize: '0.82rem', marginBottom: '0.8rem', color: gantiPasswordPesan.startsWith('Gagal') || gantiPasswordPesan.includes('tidak cocok') || gantiPasswordPesan.includes('minimal') ? '#B1483A' : '#2F7A54' }}>
              {gantiPasswordPesan}
            </p>
          )}
          <button className="btn btn-primary" disabled={gantiPasswordLoading} style={{ width: '100%' }}>
            {gantiPasswordLoading ? 'Menyimpan…' : 'Simpan Kata Sandi Baru'}
          </button>
        </form>
      </div>

      <div className="card danger-zone logout-zone" style={{ padding: '1.2rem 1.4rem', marginTop: '1rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.3rem' }}>Logout</h3>
        <p style={{ fontSize: '0.82rem', color: '#3C554C', marginTop: 0, marginBottom: '1rem', lineHeight: 1.5 }}>
          Kamu akan keluar dari akun di perangkat ini. Kamu bisa masuk kembali kapan saja dengan username dan kata sandi yang sama.
        </p>
        <button className="btn btn-danger" onClick={logout} disabled={loggingOut} style={{ width: '100%' }}>
          {loggingOut ? 'Sedang keluar…' : 'Keluar dari Akun'}
        </button>
      </div>

      <div className="card danger-zone" style={{ padding: '1.2rem 1.4rem', marginTop: '1rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.3rem', color: '#B1483A' }}>Hapus Akun</h3>
        <p style={{ fontSize: '0.82rem', color: '#3C554C', marginTop: 0, marginBottom: '0.9rem', lineHeight: 1.5 }}>
          Akunmu (username, kata sandi, profil) akan dihapus <strong>permanen</strong> dari database, sehingga
          username ini bisa dipakai orang lain untuk mendaftar. Riwayat transaksi yang pernah kamu catat{' '}
          <strong>tetap tersimpan</strong> di riwayat keluarga (tidak ikut terhapus), tapi akan ditandai
          "akun sudah dihapus" karena kamu tidak akan bisa login lagi dengan akun ini. Tindakan ini tidak bisa dibatalkan.
        </p>
        <div className="field" style={{ marginBottom: '0.8rem' }}>
          <label>Ketik username kamu (<strong>{profile?.username}</strong>) untuk konfirmasi</label>
          <input
            value={hapusAkunInput}
            onChange={(e) => { setHapusAkunInput(e.target.value); setHapusAkunPesan('') }}
            placeholder={profile?.username}
          />
        </div>
        {hapusAkunPesan && (
          <p style={{ fontSize: '0.82rem', marginBottom: '0.8rem', color: '#B1483A' }}>{hapusAkunPesan}</p>
        )}
        <button
          className="btn btn-danger"
          onClick={hapusAkun}
          disabled={hapusAkunLoading || hapusAkunInput.trim().toLowerCase() !== (profile?.username || '').toLowerCase()}
          style={{ width: '100%' }}
        >
          {hapusAkunLoading ? 'Menghapus akun…' : 'Hapus Akun Permanen'}
        </button>
      </div>
    </div>
  )
}
