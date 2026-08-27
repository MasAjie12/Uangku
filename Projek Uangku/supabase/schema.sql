-- ============================================================
-- SKEMA DATABASE UANGKU
-- Jalankan seluruh file ini di Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Tabel profil pengguna (nama panggilan/peran, dibuat otomatis saat register)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  nama_tampilan text not null,
  peran text not null default 'Anggota',
  created_at timestamptz not null default now()
);

-- 2. Tabel transaksi (pemasukan & pengeluaran)
create table if not exists public.transaksi (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tipe text not null check (tipe in ('pemasukan', 'pengeluaran')),
  kategori text not null,
  jumlah numeric(14,2) not null check (jumlah > 0),
  keterangan text,
  sumber_tujuan text,
  tanggal date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists transaksi_created_at_idx on public.transaksi (created_at desc);
create index if not exists transaksi_tanggal_idx on public.transaksi (tanggal);

-- 3. Fungsi untuk membuat profil otomatis setiap ada user baru mendaftar
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, nama_tampilan, peran)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'nama_tampilan', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'peran', 'Anggota')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Aktifkan Row Level Security
alter table public.profiles enable row level security;
alter table public.transaksi enable row level security;

-- Semua anggota keluarga yang sudah login boleh melihat semua profil
-- (supaya nama pencatat bisa ditampilkan di histori & bisa diatur perannya)
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
  on public.profiles for select
  to authenticated
  using (true);

-- Setiap orang hanya boleh mengubah profilnya sendiri (nama/peran)
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Semua anggota yang login boleh melihat SEMUA transaksi keluarga (data bersama)
drop policy if exists "transaksi_select_all" on public.transaksi;
create policy "transaksi_select_all"
  on public.transaksi for select
  to authenticated
  using (true);

-- Setiap orang hanya boleh menambah transaksi atas namanya sendiri
drop policy if exists "transaksi_insert_own" on public.transaksi;
create policy "transaksi_insert_own"
  on public.transaksi for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Setiap orang hanya boleh mengubah/menghapus transaksi yang ia catat sendiri
drop policy if exists "transaksi_update_own" on public.transaksi;
create policy "transaksi_update_own"
  on public.transaksi for update
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "transaksi_delete_own" on public.transaksi;
create policy "transaksi_delete_own"
  on public.transaksi for delete
  to authenticated
  using (auth.uid() = user_id);

-- 5. Aktifkan Realtime supaya data sinkron otomatis di semua perangkat
alter publication supabase_realtime add table public.transaksi;
