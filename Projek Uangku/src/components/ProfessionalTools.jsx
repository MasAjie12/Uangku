import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../App";
import {
  formatRupiah,
  toISODateLocal,
  formatNominalInput,
  parseNominalInput,
} from "../utils";
import DaftarBelanja from "./DaftarBelanja";
import Cicilan from "./Cicilan";

const TABEL = {
  budget: "anggaran",
  repeat: "transaksi_berulang",
  goal: "target_tabungan",
  bill: "tagihan",
};

export default function ProfessionalTools({ transactions = [] }) {
  const { profile } = useAuth();
  const [tab, setTab] = useState("budget");
  const [budget, setBudget] = useState([]),
    [goals, setGoals] = useState([]),
    [bills, setBills] = useState([]),
    [repeat, setRepeat] = useState([]);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    kategori: "",
    batas: "",
    nama: "",
    target: "",
    tenggat: "",
    nominal: "",
    jatuh_tempo: toISODateLocal(new Date()),
    frekuensi: "bulanan",
    tipe: "pengeluaran",
    sumber_tujuan: "",
    keterangan: "",
  });

  // ---- state untuk edit inline ----
  const [editSection, setEditSection] = useState(null); // 'budget' | 'repeat' | 'goal' | 'bill'
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;

  async function load() {
    const [b, g, bi, r, c] = await Promise.all([
      supabase
        .from("anggaran")
        .select("*")
        .order("bulan", { ascending: false }),
      supabase
        .from("target_tabungan")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("tagihan").select("*").order("jatuh_tempo"),
      supabase
        .from("transaksi_berulang")
        .select("*")
        .order("tanggal_berikutnya"),
      supabase
        .from("kategori")
        .select("nama")
        .eq("tipe", "pengeluaran")
        .order("nama"),
    ]);
    setBudget(b.data || []);
    setGoals(g.data || []);
    setBills(bi.data || []);
    setRepeat(r.data || []);
    setCategories(c.data || []);
  }
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const openPending = () => {
      const pending = sessionStorage.getItem("uangku:pending-reminder-tab")
      if (pending) {
        sessionStorage.removeItem("uangku:pending-reminder-tab")
        setTab(pending)
      }
    }
    const handler = (event) => {
      if (event.detail) {
        sessionStorage.removeItem("uangku:pending-reminder-tab")
        setTab(event.detail)
      }
    }
    openPending()
    window.addEventListener("uangku:open-reminder-tab", handler)
    return () => window.removeEventListener("uangku:open-reminder-tab", handler)
  }, [])

  const spentByCategory = useMemo(
    () =>
      transactions
        .filter((t) => t.tipe === "pengeluaran")
        .reduce((a, t) => {
          a[t.kategori] = (a[t.kategori] || 0) + Number(t.jumlah);
          return a;
        }, {}),
    [transactions],
  );
  async function addBudget(e) {
    e.preventDefault();
    setSaving(true);
    const n = Number(form.batas.replace(/\D/g, ""));
    const { error } = await supabase.from("anggaran").upsert(
      {
        keluarga_id: profile.keluarga_id,
        kategori: form.kategori,
        bulan: month,
        batas: n,
        created_by: profile.id,
      },
      { onConflict: "keluarga_id,kategori,bulan" },
    );
    setSaving(false);
    if (error) return alert(error.message);
    setForm({ ...form, kategori: "", batas: "" });
    load();
  }
  async function addGoal(e) {
    e.preventDefault();
    const { error } = await supabase.from("target_tabungan").insert({
      keluarga_id: profile.keluarga_id,
      nama: form.nama,
      target: Number(form.target.replace(/\D/g, "")),
      tenggat: form.tenggat || null,
    });
    if (error) return alert(error.message);
    setForm({ ...form, nama: "", target: "", tenggat: "" });
    load();
  }
  async function addBill(e) {
    e.preventDefault();
    const { error } = await supabase.from("tagihan").insert({
      keluarga_id: profile.keluarga_id,
      nama: form.nama,
      nominal: Number(form.nominal.replace(/\D/g, "")),
      jatuh_tempo: form.jatuh_tempo,
      berulang: form.frekuensi !== "sekali",
    });
    if (error) return alert(error.message);
    setForm({ ...form, nama: "", nominal: "" });
    load();
  }
  async function addRepeat(e) {
    e.preventDefault();
    const { error } = await supabase.from("transaksi_berulang").insert({
      keluarga_id: profile.keluarga_id,
      user_id: profile.id,
      tipe: form.tipe,
      kategori: form.kategori,
      jumlah: Number(form.nominal.replace(/\D/g, "")),
      sumber_tujuan: form.sumber_tujuan || null,
      keterangan: form.keterangan || null,
      frekuensi: form.frekuensi,
      tanggal_berikutnya: form.jatuh_tempo,
    });
    if (error) return alert(error.message);
    setForm({
      ...form,
      kategori: "",
      nominal: "",
      sumber_tujuan: "",
      keterangan: "",
    });
    load();
  }
  async function catatRepeat(r) {
    const { error } = await supabase.from("transaksi").insert({
      user_id: profile.id,
      tipe: r.tipe,
      kategori: r.kategori,
      jumlah: r.jumlah,
      sumber_tujuan: r.sumber_tujuan,
      keterangan: `Transaksi berulang: ${r.keterangan || ""}`.trim(),
      tanggal: toISODateLocal(new Date()),
    });
    if (error) return alert(error.message);
    alert("Transaksi berulang berhasil dicatat hari ini.");
  }
  async function updateGoal(g) {
    const v = prompt(`Tambah tabungan untuk ${g.nama}:`, "0");
    if (v === null) return;
    const add = Number(v.replace(/\D/g, "")) || 0;
    if (!add) return;
    const { error } = await supabase
      .from("target_tabungan")
      .update({ terkumpul: Number(g.terkumpul) + add })
      .eq("id", g.id);
    if (error) return alert(error.message);
    load();
  }
  async function toggleBill(b) {
    const { error } = await supabase
      .from("tagihan")
      .update({ status: b.status === "lunas" ? "belum" : "lunas" })
      .eq("id", b.id);
    if (error) return alert(error.message);
    load();
  }

  // ---- fungsi generik untuk edit & hapus ----
  function startEdit(section, item) {
    setEditSection(section);
    setEditId(item.id);
    if (section === "budget") {
      setEditData({
        kategori: item.kategori,
        batas: formatNominalInput(item.batas),
      });
    } else if (section === "repeat") {
      setEditData({
        tipe: item.tipe,
        kategori: item.kategori,
        jumlah: formatNominalInput(item.jumlah),
        frekuensi: item.frekuensi,
        tanggal_berikutnya: item.tanggal_berikutnya,
        sumber_tujuan: item.sumber_tujuan || "",
        keterangan: item.keterangan || "",
      });
    } else if (section === "goal") {
      setEditData({
        nama: item.nama,
        target: formatNominalInput(item.target),
        terkumpul: formatNominalInput(item.terkumpul),
        tenggat: item.tenggat || "",
      });
    } else if (section === "bill") {
      setEditData({
        nama: item.nama,
        nominal: formatNominalInput(item.nominal),
        jatuh_tempo: item.jatuh_tempo,
      });
    }
  }

  function cancelEdit() {
    setEditSection(null);
    setEditId(null);
    setEditData({});
  }

  async function saveEdit() {
    setSavingEdit(true);
    let error;
    if (editSection === "budget") {
      const batas = parseNominalInput(editData.batas);
      if (!batas) {
        setSavingEdit(false);
        return alert("Batas anggaran harus lebih dari 0.");
      }
      if (!editData.kategori) {
        setSavingEdit(false);
        return alert("Pilih kategori terlebih dahulu.");
      }
      ({ error } = await supabase
        .from("anggaran")
        .update({ kategori: editData.kategori, batas })
        .eq("id", editId));
    } else if (editSection === "repeat") {
      const jumlah = parseNominalInput(editData.jumlah);
      if (!jumlah) {
        setSavingEdit(false);
        return alert("Nominal harus lebih dari 0.");
      }
      if (!editData.kategori.trim()) {
        setSavingEdit(false);
        return alert("Kategori tidak boleh kosong.");
      }
      ({ error } = await supabase
        .from("transaksi_berulang")
        .update({
          tipe: editData.tipe,
          kategori: editData.kategori.trim(),
          jumlah,
          frekuensi: editData.frekuensi,
          tanggal_berikutnya: editData.tanggal_berikutnya,
          sumber_tujuan: editData.sumber_tujuan.trim() || null,
          keterangan: editData.keterangan.trim() || null,
        })
        .eq("id", editId));
    } else if (editSection === "goal") {
      const target = parseNominalInput(editData.target);
      const terkumpul = parseNominalInput(editData.terkumpul);
      if (!target) {
        setSavingEdit(false);
        return alert("Target tabungan harus lebih dari 0.");
      }
      if (!editData.nama.trim()) {
        setSavingEdit(false);
        return alert("Nama target tidak boleh kosong.");
      }
      ({ error } = await supabase
        .from("target_tabungan")
        .update({
          nama: editData.nama.trim(),
          target,
          terkumpul,
          tenggat: editData.tenggat || null,
        })
        .eq("id", editId));
    } else if (editSection === "bill") {
      const nominal = parseNominalInput(editData.nominal);
      if (!nominal) {
        setSavingEdit(false);
        return alert("Nominal tagihan harus lebih dari 0.");
      }
      if (!editData.nama.trim()) {
        setSavingEdit(false);
        return alert("Nama tagihan tidak boleh kosong.");
      }
      ({ error } = await supabase
        .from("tagihan")
        .update({
          nama: editData.nama.trim(),
          nominal,
          jatuh_tempo: editData.jatuh_tempo,
        })
        .eq("id", editId));
    }
    setSavingEdit(false);
    if (error) return alert(error.message);
    cancelEdit();
    load();
  }

  async function hapusItem(section, id, label) {
    if (!confirm(`Hapus ${label} ini? Tindakan ini tidak bisa dibatalkan.`))
      return;
    const { error } = await supabase.from(TABEL[section]).delete().eq("id", id);
    if (error) return alert(error.message);
    if (editId === id) cancelEdit();
    load();
  }

  const tabs = [
    [
      "budget",
      "Anggaran",
      "Mengatur batas pengeluaran per kategori agar keuangan tetap sesuai rencana.",
    ],
    [
      "belanja",
      "Daftar Belanja",
      "Tulis apa saja yang ingin dibeli, lalu centang saat sudah dibeli di toko — supaya tidak ada yang kelupaan. Fitur ini terpisah dari data keuangan, murni untuk checklist belanja.",
    ],
    [
      "cicilan",
      "Cicilan",
      "Catat barang yang sedang dicicil beserta tenornya, lalu tandai kalau sudah lunas. Fitur ini juga terpisah dari data keuangan, murni sebagai pencatat/checklist.",
    ],
    [
      "repeat",
      "Transaksi Berulang",
      "Mencatat pemasukan atau pengeluaran rutin secara terjadwal agar tidak perlu mengisi ulang dari awal.",
    ],
    [
      "goals",
      "Target Tabungan",
      "Menentukan tujuan tabungan, memantau progresnya, dan menambahkan dana sampai target tercapai.",
    ],
    [
      "bills",
      "Tagihan",
      "Mencatat tagihan dan tanggal jatuh tempo supaya kewajiban rutin lebih mudah dipantau.",
    ],
  ];
  const activeTab = tabs.find(([k]) => k === tab) || tabs[0];

  // reset mode edit setiap kali pindah tab
  function gantiTab(k) {
    cancelEdit();
    setTab(k);
  }

  return (
    <div className="card professional-card">
      <div className="pro-head">
        <div>
          <h3>Alat Keuangan</h3>
          <p>
            Kelola anggaran, transaksi rutin, target tabungan, dan tagihan.
          </p>
        </div>
      </div>
      <div className="pro-tabs">
        {tabs.map(([k, l]) => (
          <button
            key={k}
            className={tab === k ? "active" : ""}
            onClick={() => gantiTab(k)}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="pro-tab-info">
        <strong>{activeTab[1]}</strong>
        <span>{activeTab[2]}</span>
      </div>
      {tab === "budget" && (
        <section>
          <form className="inline-form" onSubmit={addBudget}>
            <select
              value={form.kategori}
              onChange={(e) => setForm({ ...form, kategori: e.target.value })}
              required
            >
              <option value="">Kategori</option>
              {categories.map((c) => (
                <option key={c.nama}>{c.nama}</option>
              ))}
            </select>
            <input
              inputMode="numeric"
              placeholder="Batas Rp"
              value={form.batas}
              onChange={(e) =>
                setForm({
                  ...form,
                  batas: formatNominalInput(e.target.value),
                })
              }
              required
            />
            <button className="btn btn-primary" disabled={saving}>
              Simpan anggaran bulan ini
            </button>
          </form>
          {budget
            .filter((b) => b.bulan === month)
            .some(
              (b) =>
                (spentByCategory[b.kategori] || 0) >= Number(b.batas) * 0.8,
            ) && (
            <div className="budget-alert">
              ⚠️ Beberapa anggaran sudah mencapai 80% atau lebih. Periksa
              pengeluaran agar tidak melewati batas.
            </div>
          )}
          <div className="pro-list">
            {budget
              .filter((b) => b.bulan === month)
              .map((b) => {
                const used = spentByCategory[b.kategori] || 0;
                const pct = Math.min(100, (used / Number(b.batas)) * 100);
                const editing = editSection === "budget" && editId === b.id;
                if (editing) {
                  return (
                    <div className="pro-row" key={b.id}>
                      <div className="inline-form" style={{ gridColumn: "1 / -1" }}>
                        <select
                          value={editData.kategori}
                          onChange={(e) =>
                            setEditData({ ...editData, kategori: e.target.value })
                          }
                        >
                          <option value="">Kategori</option>
                          {categories.map((c) => (
                            <option key={c.nama}>{c.nama}</option>
                          ))}
                        </select>
                        <input
                          inputMode="numeric"
                          placeholder="Batas Rp"
                          value={editData.batas}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              batas: formatNominalInput(e.target.value),
                            })
                          }
                        />
                        <button
                          className="btn btn-primary"
                          type="button"
                          disabled={savingEdit}
                          onClick={saveEdit}
                        >
                          {savingEdit ? "Menyimpan…" : "Simpan"}
                        </button>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={cancelEdit}
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="pro-row" key={b.id}>
                    <div>
                      <strong>{b.kategori}</strong>
                      <small>
                        {formatRupiah(used)} dari {formatRupiah(b.batas)}
                      </small>
                    </div>
                    <div className="progress">
                      <span
                        style={{
                          width: `${pct}%`,
                          background:
                            pct >= 100
                              ? "#B1483A"
                              : pct >= 80
                                ? "#C79A3D"
                                : "#2F7A54",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: ".35rem" }}>
                      <b>{Math.round(pct)}%</b>
                      <div style={{ display: "flex", gap: ".35rem" }}>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: ".72rem", padding: ".35rem .55rem" }}
                          onClick={() => startEdit("budget", b)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ fontSize: ".72rem", padding: ".35rem .55rem" }}
                          onClick={() => hapusItem("budget", b.id, "anggaran")}
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}
      {tab === "belanja" && <DaftarBelanja embedded />}
      {tab === "cicilan" && <Cicilan embedded />}
      {tab === "repeat" && (
        <section>
          <form className="inline-form" onSubmit={addRepeat}>
            <select
              value={form.tipe}
              onChange={(e) => setForm({ ...form, tipe: e.target.value })}
            >
              <option value="pengeluaran">Pengeluaran</option>
              <option value="pemasukan">Pemasukan</option>
            </select>
            <input
              placeholder="Kategori"
              value={form.kategori}
              onChange={(e) => setForm({ ...form, kategori: e.target.value })}
              required
            />
            <input
              inputMode="numeric"
              placeholder="Nominal"
              value={form.nominal}
              onChange={(e) =>
                setForm({
                  ...form,
                  nominal: formatNominalInput(e.target.value),
                })
              }
              required
            />
            <select
              value={form.frekuensi}
              onChange={(e) => setForm({ ...form, frekuensi: e.target.value })}
            >
              <option>harian</option>
              <option>mingguan</option>
              <option>bulanan</option>
              <option>tahunan</option>
            </select>
            <input
              type="date"
              value={form.jatuh_tempo}
              onChange={(e) =>
                setForm({ ...form, jatuh_tempo: e.target.value })
              }
            />
            <button className="btn btn-primary">Tambah</button>
          </form>
          <div className="pro-list">
            {repeat.map((r) => {
              const editing = editSection === "repeat" && editId === r.id;
              if (editing) {
                return (
                  <div className="pro-row" key={r.id}>
                    <div className="inline-form" style={{ gridColumn: "1 / -1" }}>
                      <select
                        value={editData.tipe}
                        onChange={(e) =>
                          setEditData({ ...editData, tipe: e.target.value })
                        }
                      >
                        <option value="pengeluaran">Pengeluaran</option>
                        <option value="pemasukan">Pemasukan</option>
                      </select>
                      <input
                        placeholder="Kategori"
                        value={editData.kategori}
                        onChange={(e) =>
                          setEditData({ ...editData, kategori: e.target.value })
                        }
                      />
                      <input
                        inputMode="numeric"
                        placeholder="Nominal"
                        value={editData.jumlah}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            jumlah: formatNominalInput(e.target.value),
                          })
                        }
                      />
                      <select
                        value={editData.frekuensi}
                        onChange={(e) =>
                          setEditData({ ...editData, frekuensi: e.target.value })
                        }
                      >
                        <option>harian</option>
                        <option>mingguan</option>
                        <option>bulanan</option>
                        <option>tahunan</option>
                      </select>
                      <input
                        type="date"
                        value={editData.tanggal_berikutnya}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            tanggal_berikutnya: e.target.value,
                          })
                        }
                      />
                      <input
                        placeholder="Sumber/Tujuan (opsional)"
                        value={editData.sumber_tujuan}
                        onChange={(e) =>
                          setEditData({ ...editData, sumber_tujuan: e.target.value })
                        }
                      />
                      <input
                        placeholder="Keterangan (opsional)"
                        value={editData.keterangan}
                        onChange={(e) =>
                          setEditData({ ...editData, keterangan: e.target.value })
                        }
                      />
                      <button
                        className="btn btn-primary"
                        type="button"
                        disabled={savingEdit}
                        onClick={saveEdit}
                      >
                        {savingEdit ? "Menyimpan…" : "Simpan"}
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={cancelEdit}>
                        Batal
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div className="pro-row" key={r.id}>
                  <div>
                    <strong>
                      {r.kategori} · {formatRupiah(r.jumlah)}
                    </strong>
                    <small>
                      {r.frekuensi} · berikutnya {r.tanggal_berikutnya}
                    </small>
                  </div>
                  <div style={{ display: "flex", gap: ".35rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button className="btn btn-ghost" onClick={() => catatRepeat(r)}>
                      Catat sekarang
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => startEdit("repeat", r)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => hapusItem("repeat", r.id, "transaksi berulang")}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {tab === "goals" && (
        <section>
          <form className="inline-form" onSubmit={addGoal}>
            <input
              placeholder="Nama target"
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              required
            />
            <input
              inputMode="numeric"
              placeholder="Target Rp"
              value={form.target}
              onChange={(e) =>
                setForm({
                  ...form,
                  target: formatNominalInput(e.target.value),
                })
              }
              required
            />
            <input
              type="date"
              value={form.tenggat}
              onChange={(e) => setForm({ ...form, tenggat: e.target.value })}
            />
            <button className="btn btn-primary">Tambah target</button>
          </form>
          {goals.some((g) => { const p = Number(g.target) ? (Number(g.terkumpul || 0) / Number(g.target)) * 100 : 0; return p >= 80 && p < 100 }) && (
            <div className="goal-alert">🎯 Ada target tabungan yang sudah mencapai 80% atau lebih. Sedikit lagi menuju target!
            </div>
          )}
          <div className="pro-list">
            {goals.map((g) => {
              const pct = Math.min(
                100,
                (Number(g.terkumpul) / Number(g.target)) * 100,
              );
              const editing = editSection === "goal" && editId === g.id;
              if (editing) {
                return (
                  <div className="pro-row" key={g.id}>
                    <div className="inline-form" style={{ gridColumn: "1 / -1" }}>
                      <input
                        placeholder="Nama target"
                        value={editData.nama}
                        onChange={(e) =>
                          setEditData({ ...editData, nama: e.target.value })
                        }
                      />
                      <input
                        inputMode="numeric"
                        placeholder="Target Rp"
                        value={editData.target}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            target: formatNominalInput(e.target.value),
                          })
                        }
                      />
                      <input
                        inputMode="numeric"
                        placeholder="Terkumpul Rp"
                        value={editData.terkumpul}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            terkumpul: formatNominalInput(e.target.value),
                          })
                        }
                      />
                      <input
                        type="date"
                        value={editData.tenggat}
                        onChange={(e) =>
                          setEditData({ ...editData, tenggat: e.target.value })
                        }
                      />
                      <button
                        className="btn btn-primary"
                        type="button"
                        disabled={savingEdit}
                        onClick={saveEdit}
                      >
                        {savingEdit ? "Menyimpan…" : "Simpan"}
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={cancelEdit}>
                        Batal
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div className="pro-row" key={g.id}>
                  <div>
                    <strong>{g.nama}</strong>
                    <small>
                      {formatRupiah(g.terkumpul)} / {formatRupiah(g.target)}
                      {g.tenggat ? ` · tenggat ${g.tenggat}` : ""}
                    </small>
                  </div>
                  <div className="progress">
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <div style={{ display: "flex", gap: ".35rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button className="btn btn-ghost" onClick={() => updateGoal(g)}>
                      Tambah
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => startEdit("goal", g)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => hapusItem("goal", g.id, "target tabungan")}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {tab === "bills" && (
        <section>
          <form className="inline-form" onSubmit={addBill}>
            <input
              placeholder="Nama tagihan"
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              required
            />
            <input
              inputMode="numeric"
              placeholder="Nominal Rp"
              value={form.nominal}
              onChange={(e) =>
                setForm({
                  ...form,
                  nominal: formatNominalInput(e.target.value),
                })
              }
              required
            />
            <input
              type="date"
              value={form.jatuh_tempo}
              onChange={(e) =>
                setForm({ ...form, jatuh_tempo: e.target.value })
              }
            />
            <button className="btn btn-primary">Tambah tagihan</button>
          </form>
          {bills.some((b) => {
            if (b.status === "lunas") return false
            const [y, m, d] = String(b.jatuh_tempo).split("-").map(Number)
            const due = new Date(y, (m || 1) - 1, d || 1)
            const today = new Date(); today.setHours(0,0,0,0)
            return Math.ceil((due - today) / 86400000) <= 3
          }) && (
            <div className="bill-alert">🔔 Ada tagihan yang jatuh tempo dalam 3 hari atau sudah terlambat. Periksa dan tandai lunas setelah dibayar.</div>
          )}
          <div className="pro-list">
            {bills.map((b) => {
              const editing = editSection === "bill" && editId === b.id;
              if (editing) {
                return (
                  <div className="pro-row" key={b.id}>
                    <div className="inline-form" style={{ gridColumn: "1 / -1" }}>
                      <input
                        placeholder="Nama tagihan"
                        value={editData.nama}
                        onChange={(e) =>
                          setEditData({ ...editData, nama: e.target.value })
                        }
                      />
                      <input
                        inputMode="numeric"
                        placeholder="Nominal Rp"
                        value={editData.nominal}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            nominal: formatNominalInput(e.target.value),
                          })
                        }
                      />
                      <input
                        type="date"
                        value={editData.jatuh_tempo}
                        onChange={(e) =>
                          setEditData({ ...editData, jatuh_tempo: e.target.value })
                        }
                      />
                      <button
                        className="btn btn-primary"
                        type="button"
                        disabled={savingEdit}
                        onClick={saveEdit}
                      >
                        {savingEdit ? "Menyimpan…" : "Simpan"}
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={cancelEdit}>
                        Batal
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div className="pro-row" key={b.id}>
                  <div>
                    <strong>{b.nama}</strong>
                    <small>
                      {formatRupiah(b.nominal)} · jatuh tempo {b.jatuh_tempo}
                    </small>
                  </div>
                  <div style={{ display: "flex", gap: ".35rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button className="btn btn-ghost" onClick={() => toggleBill(b)}>
                      {b.status === "lunas" ? "Tandai belum lunas" : "Tandai lunas"}
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => startEdit("bill", b)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => hapusItem("bill", b.id, "tagihan")}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
