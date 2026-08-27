import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'

export default function Pengaturan() {
  const { session, profile, setProfile } = useAuth()
  const [keluarga, setKeluarga] = useState(null)
  const [anggota, setAnggota] = useState([])
  const [draft, setDraft] = useState({})
  const [savingId, setSavingId] = useState(null)
  const [pesan, setPesan] = useState('')
  const [disalin, setDisalin] = useState(false)

  useEffect(() => {
    muatAnggota()
    muatKeluarga()
  }, [])

  async function muatKeluarga() {
    const { data } = await supabase.from('keluarga').select('*').single()
    setKeluarga(data)
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

  function salinKode() {
    if (!keluarga) return
    navigator.clipboard.writeText(keluarga.kode_undangan)
    setDisalin(true)
    setTimeout(() => setDisalin(false), 1500)
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '1.4rem' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>Pengaturan</h2>
      <p style={{ color: '#3C554C', marginBottom: '1.4rem' }}>
        Kelola keluarga dan peran setiap anggota.
      </p>

      {keluarga && (
        <div className="card" style={{ padding: '1.2rem 1.4rem', marginBottom: '1.4rem', background: '#FFFDF7' }}>
          <div style={{ fontSize: '0.8rem', color: '#8A7F68', marginBottom: '0.2rem' }}>Nama keluarga</div>
          <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.9rem' }}>{keluarga.nama}</div>
          <div style={{ fontSize: '0.8rem', color: '#8A7F68', marginBottom: '0.2rem' }}>Kode undangan</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap' }}>
            <span className="mono" style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '0.2em', color: '#C79A3D' }}>
              {keluarga.kode_undangan}
            </span>
            <button className="btn btn-ghost" onClick={salinKode} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
              {disalin ? 'Tersalin!' : 'Salin kode'}
            </button>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#3C554C', marginTop: '0.7rem', marginBottom: 0 }}>
            Bagikan kode ini ke anggota keluarga lain. Saat mendaftar, mereka pilih "Gabung pakai kode" lalu masukkan kode di atas.
          </p>
        </div>
      )}

      {pesan && <p style={{ color: pesan.startsWith('Gagal') ? '#B1483A' : '#2F7A54', marginBottom: '1rem' }}>{pesan}</p>}

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
    </div>
  )
}
