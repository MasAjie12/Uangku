import React, { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { supabase } from '../supabaseClient'
import { formatRupiah, formatTanggal, formatTanggalSingkat, toISODateLocal } from '../utils'
import SummaryCards from '../components/SummaryCards'

const WARNA_KATEGORI = ['#2F7A54', '#C79A3D', '#B1483A', '#3C6E71', '#8A5A44', '#6B7FD7', '#A3812F', '#4E8098']

function awalBulanIni() { const d = new Date(); return toISODateLocal(new Date(d.getFullYear(), d.getMonth(), 1)) }
function hariIni() { return toISODateLocal(new Date()) }
function mundurHari(n) { const d = new Date(); d.setDate(d.getDate() - (n - 1)); return toISODateLocal(d) }
function formatLabel(key, isBulan) {
  if (isBulan) { const [y, m] = key.split('-'); return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }) }
  const [y, m, d] = key.split('-'); return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

function downloadBlob(content, fileName, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = fileName; a.click()
  URL.revokeObjectURL(url)
}

function exportExcel(rows, tanggalAwal, tanggalAkhir) {
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><h2>Laporan Keuangan Uangku</h2><p>Periode: ${formatTanggal(tanggalAwal)} s/d ${formatTanggal(tanggalAkhir)}</p><table border="1"><thead><tr><th>Tanggal Transaksi</th><th>Jenis</th><th>Kategori</th><th>Nominal</th><th>Sumber/Tujuan</th><th>Keterangan</th><th>Dicatat Oleh</th><th>Waktu Pencatatan</th></tr></thead><tbody>${rows.map(t => `<tr><td>${formatTanggal(t.tanggal)}</td><td>${t.tipe}</td><td>${t.kategori}</td><td>${Number(t.jumlah)}</td><td>${t.sumber_tujuan || ''}</td><td>${t.keterangan || ''}</td><td>${t.profiles?.nama_tampilan || ''}</td><td>${new Date(t.created_at).toLocaleString('id-ID')}</td></tr>`).join('')}</tbody></table></body></html>`
  downloadBlob('\ufeff' + html, `laporan-uangku-${tanggalAwal}-sd-${tanggalAkhir}.xls`, 'application/vnd.ms-excel;charset=utf-8')
}

function exportPdf(rows, tanggalAwal, tanggalAkhir, totalMasuk, totalKeluar) {
  const win = window.open('', '_blank', 'width=1100,height=800')
  if (!win) return alert('Popup diblokir browser. Izinkan popup untuk mencetak laporan.')
  const rowsHtml = rows.map(t => `<tr><td>${formatTanggal(t.tanggal)}</td><td>${t.tipe === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}</td><td>${t.kategori}</td><td class="nominal">${formatRupiah(t.jumlah)}</td><td>${t.sumber_tujuan || '—'}</td><td>${t.keterangan || '—'}</td><td>${t.profiles?.nama_tampilan || '—'} (${t.profiles?.peran || 'Anggota'})</td><td>${new Date(t.created_at).toLocaleString('id-ID')}</td></tr>`).join('')
  win.document.write(`<!doctype html><html><head><title>Laporan Keuangan Uangku</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#222}h1{margin:0 0 6px}p{margin:4px 0 18px} .cards{display:flex;gap:16px;margin-bottom:18px}.card{border:1px solid #ddd;padding:12px;min-width:180px}.card b{display:block;font-size:18px;margin-top:5px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ccc;padding:7px;text-align:left;vertical-align:top}th{background:#f2f2f2}.nominal{text-align:right;white-space:nowrap}@media print{body{padding:0}button{display:none}}</style></head><body><h1>Laporan Keuangan Uangku</h1><p>Periode ${formatTanggal(tanggalAwal)} s/d ${formatTanggal(tanggalAkhir)}</p><div class="cards"><div class="card">Total Pemasukan<b>${formatRupiah(totalMasuk)}</b></div><div class="card">Total Pengeluaran<b>${formatRupiah(totalKeluar)}</b></div><div class="card">Selisih<b>${formatRupiah(totalMasuk-totalKeluar)}</b></div></div><table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Kategori</th><th>Nominal</th><th>Sumber/Tujuan</th><th>Keterangan</th><th>Pencatat</th><th>Waktu Pencatatan</th></tr></thead><tbody>${rowsHtml || '<tr><td colspan="8">Tidak ada transaksi.</td></tr>'}</tbody></table><script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`)
  win.document.close()
}

export default function Laporan() {
  const [semua, setSemua] = useState([])
  const [tanggalAwal, setTanggalAwal] = useState(awalBulanIni())
  const [tanggalAkhir, setTanggalAkhir] = useState(hariIni())
  const [search, setSearch] = useState('')
  const [tipeFilter, setTipeFilter] = useState('semua')
  const [kategoriFilter, setKategoriFilter] = useState('semua')
  const [kategoriPemasukan, setKategoriPemasukan] = useState('semua')

  async function muatData() {
    const { data } = await supabase.from('transaksi').select('*, profiles(nama_tampilan, peran)').order('tanggal', { ascending: false }).order('created_at', { ascending: false })
    setSemua(data || [])
  }

  useEffect(() => {
    muatData()
    const channel = supabase.channel('laporan-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'transaksi' }, muatData).subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const dataRange = useMemo(() => semua.filter(t => t.tanggal >= tanggalAwal && t.tanggal <= tanggalAkhir), [semua, tanggalAwal, tanggalAkhir])
  const kategoriOptions = useMemo(() => [...new Set(dataRange.map(t => t.kategori))].sort(), [dataRange])
  const dataTersaring = useMemo(() => {
    const q = search.trim().toLowerCase()
    return dataRange.filter(t => {
      const cocokTipe = tipeFilter === 'semua' || t.tipe === tipeFilter
      const cocokKategori = kategoriFilter === 'semua' || t.kategori === kategoriFilter
      const text = [t.kategori, t.sumber_tujuan, t.keterangan, t.profiles?.nama_tampilan, t.profiles?.peran, t.tanggal].filter(Boolean).join(' ').toLowerCase()
      return cocokTipe && cocokKategori && (!q || text.includes(q))
    })
  }, [dataRange, search, tipeFilter, kategoriFilter])

  const totalMasuk = dataRange.filter(t => t.tipe === 'pemasukan').reduce((s,t) => s + Number(t.jumlah), 0)
  const totalKeluar = dataRange.filter(t => t.tipe === 'pengeluaran').reduce((s,t) => s + Number(t.jumlah), 0)
  const jumlahHari = useMemo(() => Math.max(1, Math.round((new Date(tanggalAkhir)-new Date(tanggalAwal))/86400000)+1), [tanggalAwal,tanggalAkhir])
  const pakaiPerBulan = jumlahHari > 62

  const dataGrafik = useMemo(() => {
    const map = {}
    dataRange.filter(t => t.tipe === 'pemasukan' && (kategoriPemasukan === 'semua' || t.kategori === kategoriPemasukan)).forEach(t => {
      const key = pakaiPerBulan ? t.tanggal.slice(0,7) : t.tanggal
      if (!map[key]) map[key] = { key, pemasukan: 0 }
      map[key].pemasukan += Number(t.jumlah)
    })
    return Object.values(map).sort((a,b)=>a.key.localeCompare(b.key)).map(row=>({...row,label:formatLabel(row.key,pakaiPerBulan)}))
  }, [dataRange, pakaiPerBulan, kategoriPemasukan])

  const pengeluaranPerKategori = useMemo(() => {
    const map = {}
    dataRange.filter(t=>t.tipe==='pengeluaran').forEach(t=>map[t.kategori]=(map[t.kategori]||0)+Number(t.jumlah))
    return Object.entries(map).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value)
  }, [dataRange])

  function terapkanPreset(preset) {
    if (preset==='7hari') { setTanggalAwal(mundurHari(7)); setTanggalAkhir(hariIni()) }
    if (preset==='30hari') { setTanggalAwal(mundurHari(30)); setTanggalAkhir(hariIni()) }
    if (preset==='bulanIni') { setTanggalAwal(awalBulanIni()); setTanggalAkhir(hariIni()) }
    if (preset==='semua') { const oldest = semua.length ? semua.reduce((a,b)=>a.tanggal<b.tanggal?a:b).tanggal : hariIni(); setTanggalAwal(oldest); setTanggalAkhir(hariIni()) }
  }

  return <div style={{ maxWidth:1080, margin:'0 auto', padding:'1.4rem' }}>
    <div style={{ marginBottom:'1.2rem' }}><h2 style={{fontSize:'1.5rem'}}>Laporan Keuangan</h2><p style={{color:'#3C554C',marginTop:4}}>Analisis pemasukan, pengeluaran, kategori, pencatat, dan detail transaksi berdasarkan rentang tanggal.</p></div>

    <div className="card" style={{padding:'1rem 1.2rem',marginBottom:'1.4rem'}}>
      <div style={{display:'flex',gap:'.5rem',flexWrap:'wrap',marginBottom:'.9rem'}}>{[['7hari','7 Hari Terakhir'],['30hari','30 Hari Terakhir'],['bulanIni','Bulan Ini'],['semua','Semua']].map(([key,label])=><button key={key} type="button" onClick={()=>terapkanPreset(key)} className="btn btn-ghost" style={{fontSize:'.8rem',padding:'.4rem .8rem'}}>{label}</button>)}</div>
      <div style={{display:'flex',gap:'.9rem',flexWrap:'wrap',alignItems:'flex-end'}}>
        <div className="field" style={{marginBottom:0}}><label>Dari tanggal</label><input type="date" value={tanggalAwal} max={tanggalAkhir} onChange={e=>setTanggalAwal(e.target.value)}/></div>
        <div className="field" style={{marginBottom:0}}><label>Sampai tanggal</label><input type="date" value={tanggalAkhir} min={tanggalAwal} max={hariIni()} onChange={e=>setTanggalAkhir(e.target.value)}/></div>
        <button className="btn btn-primary" onClick={()=>exportPdf(dataTersaring,tanggalAwal,tanggalAkhir,totalMasuk,totalKeluar)}>Cetak / Export PDF</button>
        <button className="btn btn-ghost" onClick={()=>exportExcel(dataTersaring,tanggalAwal,tanggalAkhir)}>Export Excel</button>
      </div>
    </div>

    <div style={{marginBottom:'1.4rem'}}><SummaryCards totalMasuk={totalMasuk} totalKeluar={totalKeluar}/></div>

    <div className="card" style={{padding:'1rem 1.2rem',marginBottom:'1.4rem'}}>
      <div style={{display:'grid',gridTemplateColumns:'1.5fr 1fr 1fr',gap:'.8rem'}} className="report-filters">
        <div className="field" style={{marginBottom:0}}><label>Cari transaksi</label><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Kategori, keterangan, pencatat, tanggal…"/></div>
        <div className="field" style={{marginBottom:0}}><label>Jenis</label><select value={tipeFilter} onChange={e=>setTipeFilter(e.target.value)}><option value="semua">Semua</option><option value="pemasukan">Pemasukan</option><option value="pengeluaran">Pengeluaran</option></select></div>
        <div className="field" style={{marginBottom:0}}><label>Kategori</label><select value={kategoriFilter} onChange={e=>setKategoriFilter(e.target.value)}><option value="semua">Semua kategori</option>{kategoriOptions.map(k=><option key={k}>{k}</option>)}</select></div>
      </div>
      <p style={{fontSize:'.76rem',color:'#8A7F68',marginBottom:0,marginTop:'.6rem'}}>Menampilkan {dataTersaring.length} dari {dataRange.length} transaksi pada periode laporan.</p>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'1.3fr 1fr',gap:'1.4rem'}} className="laporan-grid">
      <div className="card" style={{padding:'1.3rem'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:'.6rem',alignItems:'center',marginBottom:'1rem',flexWrap:'wrap'}}><h3 style={{fontSize:'1rem',margin:0}}>Chart Pemasukan {pakaiPerBulan?'per Bulan':'per Hari'}</h3><select value={kategoriPemasukan} onChange={e=>setKategoriPemasukan(e.target.value)} style={{border:'1px solid #DED4BE',borderRadius:8,padding:'.4rem'}}><option value="semua">Semua kategori</option>{kategoriOptions.filter(k=>dataRange.some(t=>t.tipe==='pemasukan'&&t.kategori===k)).map(k=><option key={k}>{k}</option>)}</select></div>
        {dataGrafik.length===0?<EmptyChart/>:<ResponsiveContainer width="100%" height={280}><BarChart data={dataGrafik}><CartesianGrid strokeDasharray="3 3" stroke="#EFE9D9"/><XAxis dataKey="label" tick={{fontSize:11}} interval="preserveStartEnd"/><YAxis tick={{fontSize:11}} tickFormatter={v=>v>=1000000?`${v/1000000}jt`:`${v/1000}rb`}/><Tooltip formatter={v=>formatRupiah(v)}/><Legend/><Bar dataKey="pemasukan" name="Pemasukan" fill="#2F7A54" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>}
      </div>
      <div className="card" style={{padding:'1.3rem'}}><h3 style={{fontSize:'1rem',marginBottom:'1rem'}}>Pengeluaran per Kategori</h3>{pengeluaranPerKategori.length===0?<EmptyChart/>:<ResponsiveContainer width="100%" height={280}><PieChart><Pie data={pengeluaranPerKategori} dataKey="value" nameKey="name" outerRadius={90} label={(d)=>d.name}>{pengeluaranPerKategori.map((_,i)=><Cell key={i} fill={WARNA_KATEGORI[i%WARNA_KATEGORI.length]}/>)}</Pie><Tooltip formatter={v=>formatRupiah(v)}/><Legend/></PieChart></ResponsiveContainer>}</div>
    </div>

    <div className="card" style={{marginTop:'1.4rem',overflow:'hidden'}}>
      <div style={{padding:'1rem 1.2rem',borderBottom:'1px solid #EFE9D9'}}><h3 style={{fontSize:'1rem',margin:0}}>Detail Transaksi</h3></div>
      <div style={{overflowX:'auto'}}><table className="report-table"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Kategori</th><th>Nominal</th><th>Sumber/Tujuan</th><th>Keterangan</th><th>Dicatat oleh</th><th>Waktu pencatatan</th></tr></thead><tbody>{dataTersaring.length===0?<tr><td colSpan="8" style={{textAlign:'center',padding:'1.5rem',color:'#8A7F68'}}>Tidak ada transaksi.</td></tr>:dataTersaring.map(t=><tr key={t.id}><td>{formatTanggalSingkat(t.tanggal)}</td><td>{t.tipe==='pemasukan'?'Pemasukan':'Pengeluaran'}</td><td>{t.kategori}</td><td className="mono" style={{fontWeight:700,color:t.tipe==='pemasukan'?'#2F7A54':'#B1483A'}}>{formatRupiah(t.jumlah)}</td><td>{t.sumber_tujuan||'—'}</td><td>{t.keterangan||'—'}</td><td>{t.profiles?.nama_tampilan||'—'}<br/><small>{t.profiles?.peran||'Anggota'}</small></td><td>{new Date(t.created_at).toLocaleString('id-ID')}</td></tr>)}</tbody></table></div>
    </div>

    <style>{`.report-table{width:100%;border-collapse:collapse;font-size:.78rem}.report-table th,.report-table td{padding:.7rem .8rem;border-bottom:1px solid #EFE9D9;text-align:left;vertical-align:top;white-space:nowrap}.report-table th{background:#FFFDF7;color:#3C554C}.report-table small{color:#8A7F68}.report-filters{grid-template-columns:1.5fr 1fr 1fr}@media(max-width:780px){.laporan-grid{grid-template-columns:1fr!important}.report-filters{grid-template-columns:1fr!important}}`}</style>
  </div>
}
function EmptyChart(){return <p style={{color:'#8A7F68',textAlign:'center',padding:'2rem 0'}}>Belum ada data pada rentang ini.</p>}
