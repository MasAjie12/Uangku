export function formatRupiah(n) {
  const num = Number(n) || 0
  return 'Rp' + num.toLocaleString('id-ID', { maximumFractionDigits: 0 })
}

export function formatTanggalJam(isoString) {
  const d = new Date(isoString)
  const tanggal = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  return `${tanggal}, ${jam} WIB`
}
