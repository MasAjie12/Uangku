import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'

export default function DaftarBelanja({ embedded = false }) {
  const { profile } = useAuth()
  const [groups, setGroups] = useState([])
  const [groupId, setGroupId] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [namaBaru, setNamaBaru] = useState('')
  const [namaGrup, setNamaGrup] = useState('')
  const [membuatGrup, setMembuatGrup] = useState(false)
  const [menambah, setMenambah] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!profile?.keluarga_id) return
    muatGrup()
    const channel = supabase
      .channel(`daftar-belanja-${profile.keluarga_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daftar_belanja' }, () => muatItems(groupId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daftar_belanja_grup' }, () => muatGrup())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [profile?.keluarga_id])

  useEffect(() => {
    if (groupId) muatItems(groupId)
    else setItems([])
  }, [groupId])

  async function muatGrup() {
    const { data, error } = await supabase
      .from('daftar_belanja_grup')
      .select('*')
      .eq('keluarga_id', profile.keluarga_id)
      .order('created_at', { ascending: true })
    if (error) {
      setError('Gagal memuat grup: ' + error.message)
      setLoading(false)
      return
    }
    const list = data || []
    setGroups(list)
    if (!groupId && list[0]) setGroupId(list[0].id)
    else if (groupId && !list.some(g => g.id === groupId)) setGroupId(list[0]?.id || null)
    setLoading(false)
  }

  async function muatItems(id = groupId) {
    if (!id || !profile?.keluarga_id) return
    const { data, error } = await supabase
      .from('daftar_belanja')
      .select('*')
      .eq('keluarga_id', profile.keluarga_id)
      .eq('group_id', id)
      .order('created_at', { ascending: true })
    if (!error) setItems(data || [])
    else setError('Gagal memuat item: ' + error.message)
    setLoading(false)
  }

  async function tambahGrup(e) {
    e.preventDefault()
    const nama = namaGrup.trim()
    if (!nama || !profile?.keluarga_id) return
    setMembuatGrup(true); setError('')
    const { data, error } = await supabase.from('daftar_belanja_grup').insert({
      keluarga_id: profile.keluarga_id, nama, dibuat_oleh: profile.id
    }).select().single()
    setMembuatGrup(false)
    if (error) return setError('Gagal membuat daftar: ' + error.message)
    setNamaGrup('')
    setGroups(prev => [...prev, data])
    setGroupId(data.id)
  }

  async function renameGroup() {
    const current = groups.find(g => g.id === groupId)
    if (!current) return
    const nama = prompt('Nama daftar belanja baru:', current.nama)
    if (!nama?.trim() || nama.trim() === current.nama) return
    const { error } = await supabase.from('daftar_belanja_grup').update({ nama: nama.trim() }).eq('id', groupId)
    if (error) setError('Gagal mengubah nama daftar: ' + error.message)
    else muatGrup()
  }

  async function deleteGroup() {
    const current = groups.find(g => g.id === groupId)
    if (!current) return
    if (groups.length <= 1) return setError('Minimal harus ada satu daftar belanja.')
    if (!confirm(`Hapus daftar "${current.nama}" beserta seluruh item di dalamnya?`)) return
    const { error } = await supabase.from('daftar_belanja_grup').delete().eq('id', groupId)
    if (error) return setError('Gagal menghapus daftar: ' + error.message)
    const next = groups.find(g => g.id !== groupId)
    setGroupId(next?.id || null)
    muatGrup()
  }

  async function tambah(e) {
    e.preventDefault()
    const namaBersih = namaBaru.trim()
    if (!namaBersih || !profile?.keluarga_id || !groupId) return
    setMenambah(true); setError('')
    const { error } = await supabase.from('daftar_belanja').insert({
      keluarga_id: profile.keluarga_id, user_id: profile.id, group_id: groupId,
      nama: namaBersih, sudah_dibeli: false,
    })
    setMenambah(false)
    if (error) return setError('Gagal menambah: ' + error.message)
    setNamaBaru('')
    muatItems()
  }

  async function toggleBeli(item) {
    setItems(list => list.map(it => it.id === item.id ? { ...it, sudah_dibeli: !it.sudah_dibeli } : it))
    const { error } = await supabase.from('daftar_belanja').update({ sudah_dibeli: !item.sudah_dibeli }).eq('id', item.id)
    if (error) muatItems()
  }

  async function hapus(id) {
    setItems(list => list.filter(it => it.id !== id))
    await supabase.from('daftar_belanja').delete().eq('id', id)
  }

  async function hapusYangSudahDibeli() {
    const ids = items.filter(it => it.sudah_dibeli).map(it => it.id)
    if (!ids.length) return
    if (!confirm(`Hapus ${ids.length} item yang sudah dibeli dari daftar "${groups.find(g => g.id === groupId)?.nama || ''}"?`)) return
    setItems(list => list.filter(it => !it.sudah_dibeli))
    await supabase.from('daftar_belanja').delete().in('id', ids)
  }

  const totalItem = items.length
  const belumDibeli = items.filter(it => !it.sudah_dibeli).length
  const semuaSudahDibeli = totalItem > 0 && belumDibeli === 0
  const currentGroup = groups.find(g => g.id === groupId)

  const isi = (
    <>
      <div className="shopping-groups">
        <div className="shopping-group-select">
          <label>Daftar belanja</label>
          <select value={groupId || ''} onChange={e => setGroupId(e.target.value)}>
            {groups.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
          </select>
        </div>
        <form onSubmit={tambahGrup} className="shopping-new-group">
          <input value={namaGrup} onChange={e => setNamaGrup(e.target.value)} placeholder="Nama daftar baru, mis. Bulanan" />
          <button className="btn btn-primary" disabled={membuatGrup || !namaGrup.trim()}>{membuatGrup ? 'Membuat…' : '+ Daftar'}</button>
        </form>
        {currentGroup && (
          <div className="shopping-group-actions">
            <button type="button" className="btn btn-ghost" onClick={renameGroup}>Ubah nama</button>
            <button type="button" className="btn btn-danger" onClick={deleteGroup} disabled={groups.length <= 1}>Hapus daftar</button>
          </div>
        )}
      </div>

      <form onSubmit={tambah} className="inline-form" style={{ marginBottom: '0.9rem' }}>
        <input value={namaBaru} onChange={e => setNamaBaru(e.target.value)} placeholder="mis. Beras 5kg, Minyak goreng…" style={{ flex: 1 }} />
        <button className="btn btn-primary" disabled={menambah || !namaBaru.trim() || !groupId}>{menambah ? 'Menambah…' : '+ Tambah'}</button>
      </form>

      {error && <p style={{ color: 'var(--expense)', fontSize: '0.82rem', marginBottom: '0.7rem' }}>{error}</p>}

      {loading ? <p className="muted-text">Memuat…</p> : totalItem === 0 ? (
        <p className="muted-text">Daftar "{currentGroup?.nama || 'ini'}" masih kosong. Tambahkan barang pertamamu di atas.</p>
      ) : (
        <>
          {semuaSudahDibeli ? <div className="goal-alert">🎉 Daftar belanjamu sudah lengkap.</div> : <div className="bill-alert">⚠️ Oops, ada yang lupa dibeli nih. Cek lagi daftar belanjamu.</div>}
          <div className="shopping-list">
            {items.map(item => (
              <div key={item.id} className={`shopping-item ${item.sudah_dibeli ? 'is-bought' : ''}`}>
                <button type="button" className="shopping-checkbox" onClick={() => toggleBeli(item)} aria-label={item.sudah_dibeli ? 'Tandai belum terbeli' : 'Tandai sudah terbeli'}>{item.sudah_dibeli ? '✓' : ''}</button>
                <div className="shopping-item-body" onClick={() => toggleBeli(item)}>
                  <span className="shopping-item-nama">{item.nama}</span>
                  <span className={`shopping-item-status ${item.sudah_dibeli ? 'status-terbeli' : 'status-belum'}`}>{item.sudah_dibeli ? 'sudah terbeli' : 'belum terbeli'}</span>
                </div>
                <button type="button" className="shopping-hapus" onClick={() => hapus(item.id)} aria-label="Hapus item">✕</button>
              </div>
            ))}
          </div>
          <div className="shopping-footer">
            <span>{totalItem - belumDibeli} dari {totalItem} sudah dibeli</span>
            <button type="button" onClick={hapusYangSudahDibeli} disabled={!items.some(i => i.sudah_dibeli)}>Hapus yang sudah dibeli</button>
          </div>
        </>
      )}
    </>
  )

  if (embedded) return <section className="shopping-embedded">{isi}</section>
  return (
    <div className="card professional-card shopping-card">
      <div className="pro-head"><div><h3>Daftar Belanja</h3><p>Buat beberapa daftar belanja untuk kebutuhan yang berbeda, lalu centang item saat sudah dibeli.</p></div></div>
      {isi}
    </div>
  )
}
