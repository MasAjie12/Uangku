import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'
import { useNavigate } from 'react-router-dom'
import { formatRupiah } from '../utils'

function localDate() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function dateOnly(value) {
  const [y, m, d] = String(value).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}
function daysUntil(value) {
  return Math.ceil((dateOnly(value) - localDate()) / 86400000)
}

export function buildReminders({ budgets = [], goals = [], bills = [], transactions = [] }) {
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const spent = transactions.filter((t) => t.tipe === 'pengeluaran').reduce((a, t) => {
    a[t.kategori] = (a[t.kategori] || 0) + Number(t.jumlah || 0)
    return a
  }, {})
  const reminders = []

  budgets.filter((b) => String(b.bulan).startsWith(currentMonth)).forEach((b) => {
    const pct = Number(b.batas) ? (Number(spent[b.kategori] || 0) / Number(b.batas)) * 100 : 0
    if (pct >= 80) reminders.push({
      id: `budget-${b.id}`, type: 'budget', icon: '⚠️', title: `Anggaran ${b.kategori} hampir habis`,
      body: `${Math.round(pct)}% terpakai — ${formatRupiah(spent[b.kategori] || 0)} dari ${formatRupiah(b.batas)}.`, tab: 'budget', priority: pct >= 90 ? 2 : 1,
    })
  })
  goals.forEach((g) => {
    const pct = Number(g.target) ? (Number(g.terkumpul || 0) / Number(g.target)) * 100 : 0
    if (pct >= 80 && pct < 100) reminders.push({
      id: `goal-${g.id}`, type: 'goal', icon: '🎯', title: `Target ${g.nama} hampir tercapai`,
      body: `${Math.round(pct)}% terkumpul — ${formatRupiah(g.terkumpul)} dari ${formatRupiah(g.target)}.`, tab: 'goals', priority: pct >= 90 ? 2 : 1,
    })
  })
  bills.filter((b) => b.status !== 'lunas').forEach((b) => {
    const days = daysUntil(b.jatuh_tempo)
    if (days <= 3) {
      const body = days < 0 ? `Terlambat ${Math.abs(days)} hari.` : days === 0 ? 'Jatuh tempo hari ini.' : `Jatuh tempo H-${days}.`
      reminders.push({ id: `bill-${b.id}`, type: 'bill', icon: '🔔', title: `Tagihan ${b.nama}`, body: `${body} ${formatRupiah(b.nominal)}.`, tab: 'bills', priority: days <= 0 ? 3 : 2 })
    }
  })
  return reminders.sort((a, b) => b.priority - a.priority)
}

export default function ReminderBell() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!profile?.keluarga_id) return
    setLoading(true)
    const [budgets, goals, bills, transactions] = await Promise.all([
      supabase.from('anggaran').select('*').eq('keluarga_id', profile.keluarga_id),
      supabase.from('target_tabungan').select('*').eq('keluarga_id', profile.keluarga_id),
      supabase.from('tagihan').select('*').eq('keluarga_id', profile.keluarga_id),
      supabase.from('transaksi').select('tipe,kategori,jumlah').eq('keluarga_id', profile.keluarga_id),
    ])
    setReminders(buildReminders({ budgets: budgets.data || [], goals: goals.data || [], bills: bills.data || [], transactions: transactions.data || [] }))
    setLoading(false)
  }, [profile?.keluarga_id])

  useEffect(() => {
    load()
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    const timer = setInterval(load, 60000)
    return () => { window.removeEventListener('focus', onFocus); clearInterval(timer) }
  }, [load])

  const count = reminders.length
  const goTo = (tab) => {
    setOpen(false)
    sessionStorage.setItem('uangku:pending-reminder-tab', tab)
    if (window.location.pathname === '/') {
      window.dispatchEvent(new CustomEvent('uangku:open-reminder-tab', { detail: tab }))
    } else {
      navigate('/')
    }
  }

  return (
    <div className="reminder-wrap">
      <button className={`reminder-bell ${count ? 'has-reminders' : ''}`} onClick={() => setOpen((v) => !v)} aria-label={`Pengingat${count ? `, ${count} aktif` : ''}`}>
        <span aria-hidden="true">🔔</span>{count > 0 && <b>{count > 9 ? '9+' : count}</b>}
      </button>
      {open && (
        <>
          <div className="reminder-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="reminder-popover" role="dialog" aria-label="Daftar pengingat">
            <div className="reminder-popover-head">
              <strong>Pengingat</strong>
              <span>{loading ? 'Memuat…' : `${count} aktif`}</span>
              <button className="reminder-close" onClick={() => setOpen(false)} aria-label="Tutup pengingat">✕</button>
            </div>
            <div className="reminder-popover-body">
              {count === 0 ? <p className="reminder-empty">Tidak ada pengingat aktif. Keuangan Anda terlihat aman.</p> : reminders.map((r) => (
                <button className="reminder-item" key={r.id} onClick={() => goTo(r.tab)}>
                  <span className="reminder-icon">{r.icon}</span><span><strong>{r.title}</strong><small>{r.body}</small></span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
