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

// Nama & peran pencatat sebuah transaksi. Kalau akun pencatatnya masih ada,
// pakai data profil terkini (bisa berubah kalau nama_tampilan/peran diedit).
// Kalau akunnya sudah dihapus (user_id jadi null), pakai nama yang dibekukan
// di kolom dicatat_oleh_nama saat akun itu dihapus, supaya riwayat keluarga
// tetap terbaca jelas siapa yang mencatatnya dulu.
export function namaPencatat(tx) {
  if (tx?.profiles?.nama_tampilan) {
    return { nama: tx.profiles.nama_tampilan, peran: tx.profiles.peran || 'Anggota', akunDihapus: false }
  }
  if (tx?.dicatat_oleh_nama) {
    return { nama: tx.dicatat_oleh_nama, peran: 'Akun sudah dihapus', akunDihapus: true }
  }
  return { nama: '—', peran: 'Anggota', akunDihapus: false }
}
