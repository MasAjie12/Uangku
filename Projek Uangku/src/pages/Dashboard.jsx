import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../App";
import TransaksiForm from "../components/TransaksiForm";
import TransaksiList from "../components/TransaksiList";
import SummaryCards from "../components/SummaryCards";
import { formatTanggal, getWeekRange, toISODateLocal } from "../utils";

function awalBulanIni() {
  const d = new Date();
  return toISODateLocal(new Date(d.getFullYear(), d.getMonth(), 1));
}

export default function Dashboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [hapusMode, setHapusMode] = useState("hari");
  const [hapusTanggal, setHapusTanggal] = useState(() =>
    toISODateLocal(new Date()),
  );
  const [deleting, setDeleting] = useState(false);
  const [saldoAwal, setSaldoAwal] = useState(0);
  const [semuaRingkasan, setSemuaRingkasan] = useState([]);
  const tanggalAwal = awalBulanIni();
  const tanggalAkhir = toISODateLocal(new Date());
  const { session, profile } = useAuth();

  const muatRingkasan = useCallback(async () => {
    const { data } = await supabase
      .from("transaksi")
      .select("tanggal, tipe, jumlah")
      .order("tanggal", { ascending: true });
    setSemuaRingkasan(data || []);
  }, []);

  const muatData = useCallback(async () => {
    const { data } = await supabase
      .from("transaksi")
      .select("*, profiles(nama_tampilan, peran)")
      .order("created_at", { ascending: false })
      .limit(200);
    setItems(data || []);
    if (profile?.keluarga_id) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("keluarga_id, keluarga(saldo_awal)")
        .eq("id", session?.user?.id || "")
        .maybeSingle();
      setSaldoAwal(Number(prof?.keluarga?.saldo_awal || 0));
    } else {
      setSaldoAwal(0);
    }
    setLoading(false);
  }, [session, profile?.keluarga_id]);

  useEffect(() => {
    muatData();
    muatRingkasan();
    const channel = supabase
      .channel("transaksi-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transaksi" },
        () => {
          muatData();
          muatRingkasan();
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [muatData, muatRingkasan]);

  const periodeRingkasan = useMemo(
    () => semuaRingkasan.filter((t) => t.tanggal >= tanggalAwal && t.tanggal <= tanggalAkhir),
    [semuaRingkasan, tanggalAwal, tanggalAkhir],
  );
  const totalMasukPeriode = periodeRingkasan
    .filter((t) => t.tipe === "pemasukan")
    .reduce((s, t) => s + Number(t.jumlah), 0);
  const totalKeluarPeriode = periodeRingkasan
    .filter((t) => t.tipe === "pengeluaran")
    .reduce((s, t) => s + Number(t.jumlah), 0);

  // Saldo dihitung sebagai saldo kas per akhir tanggal yang dipilih (saldo awal
  // ditambah seluruh riwayat sampai tanggal itu), bukan cuma selisih di periode
  // ini saja — supaya angkanya tetap masuk akal seperti cek saldo di buku kas.
  const kumulatifSampaiAkhir = useMemo(
    () => semuaRingkasan.filter((t) => t.tanggal <= tanggalAkhir),
    [semuaRingkasan, tanggalAkhir],
  );
  const saldoPerTanggal =
    saldoAwal +
    kumulatifSampaiAkhir.filter((t) => t.tipe === "pemasukan").reduce((s, t) => s + Number(t.jumlah), 0) -
    kumulatifSampaiAkhir.filter((t) => t.tipe === "pengeluaran").reduce((s, t) => s + Number(t.jumlah), 0);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((tx) =>
      [
        tx.kategori,
        tx.sumber_tujuan,
        tx.keterangan,
        tx.profiles?.nama_tampilan,
        tx.profiles?.peran,
        tx.tanggal,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [items, search]);

  async function hapusPeriode() {
    if (!hapusTanggal) return alert("Pilih tanggal acuan terlebih dahulu.");
    const range =
      hapusMode === "bulan"
        ? {
            start: `${hapusTanggal.slice(0, 7)}-01`,
            end: toISODateLocal(
              new Date(
                Number(hapusTanggal.slice(0, 4)),
                Number(hapusTanggal.slice(5, 7)),
                0,
              ),
            ),
          }
        : hapusMode === "minggu"
          ? getWeekRange(hapusTanggal)
          : { start: hapusTanggal, end: hapusTanggal };
    const label =
      hapusMode === "bulan"
        ? "bulan"
        : hapusMode === "minggu"
          ? "minggu"
          : "hari";
    if (
      !confirm(
        `Hapus SEMUA transaksi keluarga pada ${label} ${formatTanggal(range.start)}${range.end !== range.start ? ` s/d ${formatTanggal(range.end)}` : ""}? Tindakan ini tidak dapat dibatalkan.`,
      )
    )
      return;
    setDeleting(true);
    const { error } = await supabase.rpc("hapus_histori_keluarga", {
      p_tanggal_awal: range.start,
      p_tanggal_akhir: range.end,
    });
    setDeleting(false);
    if (error) return alert("Gagal menghapus histori: " + error.message);
    await muatData();
    alert("Histori pada periode tersebut berhasil dihapus.");
  }

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "1.4rem" }}>
      <div style={{ marginBottom: "1.2rem" }}>
        <h2 style={{ fontSize: "1.5rem" }}>Catatan Uang Anda</h2>
        <p style={{ color: "#3C554C", marginTop: 4 }}>
          Catat pemasukan dan pengeluaran uang anda dengan tanggal transaksi dan
          waktu pencatatan yang jelas.
        </p>
      </div>

      <div className="card" style={{ padding: "1rem 1.2rem", marginBottom: "0.9rem" }}>
        <p style={{ fontSize: "0.76rem", color: "#8A7F68", margin: 0 }}>
          Total Pemasukan & Pengeluaran menampilkan jumlah bulan ini. Saldo menunjukkan saldo kas per hari ini (termasuk saldo awal & seluruh riwayat sebelumnya).
        </p>
      </div>

      <h3 style={{ fontSize: "1.1rem", margin: "0 0 0.7rem" }}>Keuangan Anda Bulan Ini</h3>

      <div className="professional-dashboard-section" style={{ marginBottom: "1.4rem" }}>
        <SummaryCards
          totalMasuk={totalMasukPeriode}
          totalKeluar={totalKeluarPeriode}
          saldoAwal={saldoAwal}
          saldo={saldoPerTanggal}
        />
      </div>

      <div
        className="dashboard-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 380px) 1fr",
          gap: "1.4rem",
          alignItems: "start",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: "1.05rem", margin: "0 0 0.7rem" }}>Catat Uang Anda</h3>
          <TransaksiForm onSaved={muatData} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "0.8rem",
              alignItems: "center",
              marginBottom: "0.7rem",
              flexWrap: "wrap",
            }}
          >
            <h3 style={{ fontSize: "1.05rem", margin: 0 }}>Histori Terbaru</h3>
            <span style={{ fontSize: "0.76rem", color: "#8A7F68" }}>
              {filteredItems.length} transaksi
            </span>
          </div>

          <div
            className="card"
            style={{ padding: "0.8rem 1rem", marginBottom: "0.9rem" }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari transaksi, kategori, pencatat, tanggal…"
              style={{
                width: "100%",
                border: "1px solid #DED4BE",
                borderRadius: 10,
                padding: "0.65rem 0.75rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          {loading ? (
            <p style={{ color: "#3C554C" }}>Memuat…</p>
          ) : (
            <TransaksiList items={filteredItems} onChanged={muatData} />
          )}

          <div
            className="card danger-zone"
            style={{ padding: "1rem 1.2rem", marginTop: "1rem" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h4 style={{ margin: 0, color: "#B1483A" }}>
                  Hapus histori berdasarkan periode
                </h4>
                <p
                  style={{
                    fontSize: "0.78rem",
                    color: "#8A7F68",
                    margin: "0.35rem 0 0",
                  }}
                >
                  Menghapus seluruh transaksi keluarga pada periode yang
                  dipilih. Gunakan dengan hati-hati.
                </p>
              </div>
              <div
                style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}
              >
                {["hari", "minggu", "bulan"].map((mode) => (
                  <button
                    key={mode}
                    className="btn btn-ghost"
                    onClick={() => setHapusMode(mode)}
                    style={{
                      padding: "0.4rem 0.65rem",
                      fontSize: "0.78rem",
                      background:
                        hapusMode === mode ? "#F5E5E1" : "transparent",
                    }}
                  >
                    {mode[0].toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: "0.7rem",
                alignItems: "flex-end",
                flexWrap: "wrap",
                marginTop: "0.8rem",
              }}
            >
              <div className="field" style={{ margin: 0 }}>
                <label>Tanggal acuan</label>
                <input
                  type="date"
                  value={hapusTanggal}
                  max={toISODateLocal(new Date())}
                  onChange={(e) => setHapusTanggal(e.target.value)}
                />
              </div>
              <button
                className="btn btn-danger"
                onClick={hapusPeriode}
                disabled={deleting}
              >
                {deleting ? "Menghapus…" : `Hapus ${hapusMode}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`@media (max-width: 780px) { .dashboard-grid { grid-template-columns: 1fr !important; } } .danger-zone { border-color: #E8C9C3; }`}</style>
    </div>
  );
}
