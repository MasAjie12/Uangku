import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'

export default function Pengaturan() {
  const { session, profile, setProfile } = useAuth()
  const [anggota, setAnggota] = useState([])
  const [draft, setDraft] = useState({}) // { [id]: { nama_tampilan, peran } }
  const [savingId, setSavingId] = useState(null)
  const [pesan, setPesan] = useState('')

  useEffect(() => {
    muatAnggota()
  }, [])

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

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '1.4rem' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>Pengaturan Peran</h2>
      <p style={{ color: '#3C554C', marginBottom: '1.2rem' }}>
        Atur nama tampilan dan peran setiap anggota keluarga, misalnya <em>user1</em> sebagai "Ayah" dan <em>user2</em> sebagai "Ibu".
        Setiap orang hanya bisa mengubah datanya sendiri.
      </p>

      {pesan && <p style={{ color: pesan.startsWith('Gagal') ? '#B1483A' : '#2F7A54', marginBottom: '1rem' }}>{pesan}</p>}

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
