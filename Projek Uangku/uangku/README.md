# Uangku — Catatan Keuangan Keluarga

Aplikasi web untuk mencatat pemasukan & pengeluaran keluarga, dengan login per anggota,
peran (Ayah/Ibu/dst), histori siapa-mencatat-apa-kapan, laporan grafik, dan data yang
sinkron otomatis di semua perangkat (HP & komputer) karena disimpan di database online gratis
(Supabase).

---

## 1. Yang akan kamu pakai (semuanya gratis)

| Kebutuhan | Layanan | Kenapa |
|---|---|---|
| Database + Login online | **Supabase** (supabase.com) | Free tier, punya Auth, Postgres, dan Realtime sync |
| Hosting website | **Vercel** (vercel.com) | Free tier, otomatis dapat alamat `https://...vercel.app` |
| Kode aplikasi | Folder ini (React + Vite) | Sudah jadi, tinggal dihubungkan ke Supabase |

Alur singkatnya: **Supabase = tempat data disimpan** (jadi bisa diakses dari HP maupun laptop
dan selalu sama), **Vercel = tempat website di-online-kan** supaya bisa dibuka dari browser
mana saja tanpa perlu komputer kamu menyala.

---

## 2. Menjalankan di komputer kamu dulu (opsional, untuk coba-coba)

1. Install [Node.js](https://nodejs.org) versi 18 ke atas.
2. Buka folder ini di terminal, lalu jalankan:
   ```bash
   npm install
   ```
3. Salin `.env.example` menjadi `.env`, isinya akan diisi setelah kamu membuat project
   Supabase di Langkah 3 di bawah.
4. Jalankan aplikasi secara lokal:
   ```bash
   npm run dev
   ```
5. Buka `http://localhost:5173` di browser.

---

## 3. Membuat database online (Supabase) — GRATIS

1. Buka [supabase.com](https://supabase.com) → **Start your project** → daftar/masuk pakai
   akun Google/GitHub.
2. Klik **New project**.
   - Isi nama project, misalnya `uangku`.
   - Buat password database (simpan baik-baik, jarang dipakai lagi setelah ini).
   - Pilih region terdekat, misalnya **Southeast Asia (Singapore)**.
   - Klik **Create new project** dan tunggu ± 1-2 menit sampai selesai disiapkan.
3. Setelah project siap, buka menu **SQL Editor** di sidebar kiri.
4. Buka file `supabase/schema.sql` yang ada di folder proyek ini, salin **seluruh isinya**,
   tempel ke SQL Editor, lalu klik **Run**. Ini akan otomatis membuat:
   - Tabel `profiles` (data anggota keluarga & peran)
   - Tabel `transaksi` (catatan pemasukan/pengeluaran)
   - Aturan keamanan (Row Level Security) supaya setiap orang hanya bisa mengedit catatannya
     sendiri, tapi semua anggota keluarga bisa **melihat** semua catatan.
   - Sinkronisasi realtime.
5. Matikan verifikasi email supaya pendaftaran username langsung bisa dipakai:
   - Buka **Authentication → Providers → Email**.
   - Matikan opsi **Confirm email**.
   - Klik **Save**.
6. Ambil kunci koneksi:
   - Buka **Project Settings (ikon gerigi) → Data API**.
   - Catat **Project URL** (mis. `https://xxxxx.supabase.co`).
   - Buka tab **API Keys**, catat kunci **anon public**.
7. Masukkan dua nilai itu ke file `.env` di komputer kamu (untuk coba lokal):
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=isi-anon-key-di-sini
   ```

> Kenapa pakai "username" padahal Supabase Auth minta email? Aplikasi ini otomatis mengubah
> username menjadi email palsu seperti `ayah@uangku.local` di belakang layar, jadi user cukup
> mengisi username & password seperti biasa di halaman login/daftar.

---

## 4. Deploy online gratis dengan Vercel

1. Buat akun gratis di [vercel.com](https://vercel.com) (bisa langsung pakai akun GitHub).
2. Unggah folder proyek ini ke GitHub:
   - Buat repository baru di [github.com/new](https://github.com/new), misalnya `uangku`.
   - Di terminal, dalam folder proyek ini, jalankan:
     ```bash
     git init
     git add .
     git commit -m "Uangku pertama kali"
     git branch -M main
     git remote add origin https://github.com/USERNAME-GITHUB-KAMU/uangku.git
     git push -u origin main
     ```
3. Di dashboard Vercel, klik **Add New → Project**, pilih repository `uangku` tadi.
4. Saat diminta **Environment Variables**, tambahkan dua baris (nilai sama seperti di `.env`):
   - `VITE_SUPABASE_URL` = Project URL dari Supabase
   - `VITE_SUPABASE_ANON_KEY` = anon key dari Supabase
5. Klik **Deploy**. Tunggu 1-2 menit.
6. Setelah selesai, Vercel memberi alamat seperti `https://uangku-kamu.vercel.app`.
   Alamat ini bisa dibuka dari HP maupun komputer mana saja, dan datanya akan selalu sama
   karena semuanya membaca/menulis ke database Supabase yang sama.

Setiap kali kamu mengubah kode dan menjalankan `git push`, Vercel akan otomatis
mem-build ulang dan memperbarui website secara otomatis.

---

## 5. Menambahkan anggota keluarga

1. Buka alamat website Uangku kamu (dari HP atau komputer siapa pun).
2. Klik **Daftar**, buat akun untuk tiap anggota keluarga, misalnya:
   - Username `ayah`, Nama tampilan "Pak Budi", Peran "Ayah"
   - Username `ibu`, Nama tampilan "Bu Sari", Peran "Ibu"
3. Semua akun yang terdaftar akan otomatis bisa saling melihat catatan keuangan (karena ini
   buku kas bersama satu keluarga), tapi hanya bisa mengedit/menghapus catatannya sendiri.
4. Peran bisa diubah kapan saja lewat menu **Pengaturan** di aplikasi.

---

## 6. Cara kerja sinkronisasi antar perangkat

Karena semua data (transaksi & profil) disimpan di Supabase — bukan di HP atau komputer
tertentu — maka:
- Buka dari HP → data yang sama akan muncul.
- Buka dari laptop → data yang sama juga muncul.
- Aplikasi juga memakai fitur **Realtime** dari Supabase: begitu satu anggota keluarga
  mencatat transaksi baru, layar anggota lain yang sedang membuka aplikasi akan otomatis
  ter-update tanpa perlu refresh.

---

## 7. Struktur proyek singkat

```
uangku/
├─ src/
│  ├─ pages/        → Login, Register, Dashboard, Laporan, Pengaturan
│  ├─ components/   → Form catat transaksi, daftar histori, kartu ringkasan
│  ├─ supabaseClient.js
│  └─ utils.js      → format Rupiah & tanggal
├─ supabase/schema.sql → skema database + aturan keamanan
├─ .env.example
└─ README.md (file ini)
```

---

## 8. Fitur Grup Keluarga (multi-keluarga dalam satu website)

Sejak update ini, satu website Uangku bisa dipakai oleh **banyak keluarga sekaligus** tanpa
data mereka saling tercampur.

- Saat mendaftar, orang pertama di sebuah keluarga memilih **"Buat keluarga baru"** dan akan
  mendapat **kode undangan** unik (6 karakter, terlihat di halaman Pengaturan).
- Anggota keluarga lainnya memilih **"Gabung pakai kode"** lalu memasukkan kode tersebut.
- Semua transaksi, histori, dan laporan hanya terlihat oleh sesama anggota yang tergabung di
  kode undangan yang sama. Keluarga lain yang mendaftar di website yang sama tidak akan
  melihat data satu sama lain.

### Kalau kamu sudah punya data sebelum fitur ini ada

Jalankan ulang isi file `supabase/schema.sql` yang baru di **SQL Editor** Supabase (sama
seperti langkah 3 di atas). Skrip ini aman dijalankan ulang — dia akan otomatis:
1. Membuat grup keluarga baru bernama **"Keluarga Pertama"**.
2. Memasukkan semua akun & transaksi yang sudah ada ke grup itu, supaya tidak ada data hilang.

Setelah itu, buka halaman **Pengaturan** di aplikasi untuk melihat kode undangan grup
tersebut, lalu bagikan ke anggota keluarga lain yang ingin bergabung.

---

## 9. Pertanyaan umum

**Apakah gratis selamanya?**
Supabase dan Vercel free tier cukup untuk pemakaian keluarga (jauh di bawah batas gratis
keduanya). Jika suatu saat traffic sangat besar, keduanya punya paket berbayar opsional.

**Bagaimana kalau lupa password?**
Untuk versi sederhana ini belum ada fitur "lupa password" otomatis. Kamu bisa mereset
password lewat **Supabase Dashboard → Authentication → Users → pilih user → Reset password**.

**Bisa dipakai lebih dari 2 orang?**
Bisa. Tidak ada batas jumlah akun/peran — tambahkan sebanyak anggota keluarga yang perlu.
