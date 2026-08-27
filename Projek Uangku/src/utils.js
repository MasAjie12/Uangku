export function formatRupiah(n) {
  const num = Number(n) || 0
  return 'Rp' + num.toLocaleString('id-ID', { maximumFractionDigits: 0 })
}

// Dipakai untuk input nominal: 50000 -> "50.000"
export function formatNominalInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('id-ID')
}

export function parseNominalInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  return Number(digits || 0)
}

export function formatTanggal(isoDate) {
  if (!isoDate) return '—'
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

export function formatTanggalSingkat(isoDate) {
  if (!isoDate) return '—'
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

export function formatTanggalJam(isoString) {
  const d = new Date(isoString)
  const tanggal = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  return `${tanggal}, ${jam} WIB`
}

export function getWeekRange(dateString) {
  const [y, m, d] = dateString.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const day = date.getDay() || 7 // Senin = 1
  const start = new Date(date)
  start.setDate(date.getDate() - day + 1)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start: toISODateLocal(start), end: toISODateLocal(end) }
}

export function toISODateLocal(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
