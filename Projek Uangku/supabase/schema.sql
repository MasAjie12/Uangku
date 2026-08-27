-- ============================================================
-- SKEMA DATABASE UANGKU (dengan fitur GRUP KELUARGA)
-- Aman dijalankan ulang di project yang sudah berjalan sebelumnya —
-- data lama otomatis dipindahkan ke grup keluarga baru bernama
-- "Keluarga Pertama" dengan kode undangan yang dibuatkan otomatis.
-- Jalankan seluruh file ini di Supabase Dashboard > SQL Editor.
-- ============================================================

-- 1. Tabel grup keluarga
create table if not exists public.keluarga (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  kode_undangan text unique not null,
  dibuat_oleh uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- 2. Tabel profil pengguna
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  nama_tampilan text not null,
  peran text not null default 'Anggota',
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists keluarga_id uuid references public.keluarga(id);

-- 3. Tabel transaksi
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
alter table public.transaksi add column if not exists keluarga_id uuid references public.keluarga(id);

create index if not exists transaksi_created_at_idx on public.transaksi (created_at desc);
create index if not exists transaksi_tanggal_idx on public.transaksi (tanggal);
create index if not exists transaksi_keluarga_idx on public.transaksi (keluarga_id);
create index if not exists profiles_keluarga_idx on public.profiles (keluarga_id);

-- 4. Fungsi pembuat kode undangan unik (6 karakter, tanpa huruf/angka yang mirip)
create or replace function public.generate_kode_undangan()
returns text as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  kode text;
  sudah_ada int;
begin
  loop
    kode := '';
    for i in 1..6 loop
      kode := kode || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    select count(*) into sudah_ada from public.keluarga where kode_undangan = kode;
    exit when sudah_ada = 0;
  end loop;
  return kode;
end;
$$ language plpgsql;

-- 5. Migrasi data lama (kalau ada) ke grup keluarga default, supaya tidak hilang
do $$
declare
  v_default_id uuid;
begin
  if exists (select 1 from public.profiles where keluarga_id is null) then
    insert into public.keluarga (nama, kode_undangan)
    values ('Keluarga Pertama', public.generate_kode_undangan())
    returning id into v_default_id;

    update public.profiles set keluarga_id = v_default_id where keluarga_id is null;
    update public.transaksi set keluarga_id = v_default_id where keluarga_id is null;
  end if;
end $$;

alter table public.profiles alter column keluarga_id set not null;
alter table public.transaksi alter column keluarga_id set not null;

-- 6. Trigger: setiap transaksi baru otomatis diberi keluarga_id sesuai pencatatnya
create or replace function public.set_transaksi_keluarga()
returns trigger as $$
begin
  select keluarga_id into new.keluarga_id from public.profiles where id = new.user_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_set_transaksi_keluarga on public.transaksi;
create trigger trg_set_transaksi_keluarga
  before insert on public.transaksi
  for each row execute procedure public.set_transaksi_keluarga();

-- 7. Trigger: setiap kali ada user baru daftar, buatkan/gabungkan ke grup keluarga
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_mode text;
  v_nama_keluarga text;
  v_kode_input text;
  v_keluarga_id uuid;
  v_kode_baru text;
begin
  v_mode := new.raw_user_meta_data->>'mode';
  v_nama_keluarga := new.raw_user_meta_data->>'nama_keluarga';
  v_kode_input := upper(trim(coalesce(new.raw_user_meta_data->>'kode_undangan', '')));

  if v_mode = 'gabung' then
    select id into v_keluarga_id from public.keluarga where kode_undangan = v_kode_input;
    if v_keluarga_id is null then
      raise exception 'Kode undangan tidak ditemukan. Periksa kembali kode yang dimasukkan.';
    end if;
  else
    v_kode_baru := public.generate_kode_undangan();
    insert into public.keluarga (nama, kode_undangan, dibuat_oleh)
    values (coalesce(nullif(v_nama_keluarga, ''), 'Keluarga Baru'), v_kode_baru, new.id)
    returning id into v_keluarga_id;
  end if;

  insert into public.profiles (id, username, nama_tampilan, peran, keluarga_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'nama_tampilan', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'peran', 'Anggota'),
    v_keluarga_id
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 8. Fungsi bantu untuk RLS: mengambil keluarga_id milik user yang sedang login
create or replace function public.my_keluarga_id()
returns uuid as $$
  select keluarga_id from public.profiles where id = auth.uid();
$$ language sql stable security definer;

-- 9. Aktifkan Row Level Security
alter table public.keluarga enable row level security;
alter table public.profiles enable row level security;
alter table public.transaksi enable row level security;

-- Anggota hanya boleh melihat data keluarganya sendiri
drop policy if exists "keluarga_select_own" on public.keluarga;
create policy "keluarga_select_own"
  on public.keluarga for select
  to authenticated
  using (id = public.my_keluarga_id());

-- Profil: hanya sesama anggota satu keluarga yang bisa saling melihat
drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "profiles_select_keluarga" on public.profiles;
create policy "profiles_select_keluarga"
  on public.profiles for select
  to authenticated
  using (keluarga_id = public.my_keluarga_id() or id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Transaksi: hanya terlihat oleh sesama anggota satu keluarga
drop policy if exists "transaksi_select_all" on public.transaksi;
drop policy if exists "transaksi_select_keluarga" on public.transaksi;
create policy "transaksi_select_keluarga"
  on public.transaksi for select
  to authenticated
  using (keluarga_id = public.my_keluarga_id());

drop policy if exists "transaksi_insert_own" on public.transaksi;
create policy "transaksi_insert_own"
  on public.transaksi for insert
  to authenticated
  with check (auth.uid() = user_id);

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

-- 10. Aktifkan Realtime (aman dijalankan ulang)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'transaksi'
  ) then
    alter publication supabase_realtime add table public.transaksi;
  end if;
end $$;

-- 11. Izinkan anggota keluarga mengubah nama keluarganya sendiri
drop policy if exists "keluarga_update_own" on public.keluarga;
create policy "keluarga_update_own"
  on public.keluarga for update
  to authenticated
  using (id = public.my_keluarga_id())
  with check (id = public.my_keluarga_id());

-- ============================================================
-- TAMBAHAN: Kategori bisa dikelola sendiri oleh tiap keluarga
-- ============================================================

-- 12. Tabel kategori (per keluarga, per tipe)
create table if not exists public.kategori (
  id uuid primary key default gen_random_uuid(),
  keluarga_id uuid not null references public.keluarga(id) on delete cascade,
  tipe text not null check (tipe in ('pemasukan', 'pengeluaran')),
  nama text not null,
  created_at timestamptz not null default now(),
  unique (keluarga_id, tipe, nama)
);

create index if not exists kategori_keluarga_idx on public.kategori (keluarga_id, tipe);

-- 13. Trigger: kategori baru otomatis diberi keluarga_id sesuai yang menambahkan
create or replace function public.set_kategori_keluarga()
returns trigger as $$
begin
  if new.keluarga_id is null then
    select keluarga_id into new.keluarga_id from public.profiles where id = auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_set_kategori_keluarga on public.kategori;
create trigger trg_set_kategori_keluarga
  before insert on public.kategori
  for each row execute procedure public.set_kategori_keluarga();

-- 14. Fungsi & trigger: setiap keluarga baru otomatis dapat kategori bawaan
create or replace function public.seed_kategori_default(p_keluarga_id uuid)
returns void as $$
begin
  insert into public.kategori (keluarga_id, tipe, nama)
  values
    (p_keluarga_id, 'pemasukan', 'Gaji'),
    (p_keluarga_id, 'pemasukan', 'Bonus'),
    (p_keluarga_id, 'pemasukan', 'Usaha Sampingan'),
    (p_keluarga_id, 'pemasukan', 'Hadiah'),
    (p_keluarga_id, 'pemasukan', 'Lainnya'),
    (p_keluarga_id, 'pengeluaran', 'Belanja Harian'),
    (p_keluarga_id, 'pengeluaran', 'Listrik & Air'),
    (p_keluarga_id, 'pengeluaran', 'Transportasi'),
    (p_keluarga_id, 'pengeluaran', 'Pendidikan'),
    (p_keluarga_id, 'pengeluaran', 'Kesehatan'),
    (p_keluarga_id, 'pengeluaran', 'Cicilan'),
    (p_keluarga_id, 'pengeluaran', 'Lainnya')
  on conflict (keluarga_id, tipe, nama) do nothing;
end;
$$ language plpgsql security definer;

create or replace function public.handle_new_keluarga()
returns trigger as $$
begin
  perform public.seed_kategori_default(new.id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_keluarga_created on public.keluarga;
create trigger on_keluarga_created
  after insert on public.keluarga
  for each row execute procedure public.handle_new_keluarga();

-- 15. Backfill: kasih kategori default ke keluarga yang sudah ada sebelum fitur ini
do $$
declare
  r record;
begin
  for r in select id from public.keluarga loop
    perform public.seed_kategori_default(r.id);
  end loop;
end $$;

-- 16. Row Level Security untuk tabel kategori
alter table public.kategori enable row level security;

drop policy if exists "kategori_select_keluarga" on public.kategori;
create policy "kategori_select_keluarga"
  on public.kategori for select
  to authenticated
  using (keluarga_id = public.my_keluarga_id());

drop policy if exists "kategori_insert_keluarga" on public.kategori;
create policy "kategori_insert_keluarga"
  on public.kategori for insert
  to authenticated
  with check (keluarga_id = public.my_keluarga_id() or keluarga_id is null);

drop policy if exists "kategori_delete_keluarga" on public.kategori;
create policy "kategori_delete_keluarga"
  on public.kategori for delete
  to authenticated
  using (keluarga_id = public.my_keluarga_id());

-- 17. Hapus histori keluarga berdasarkan rentang tanggal.
-- Fungsi ini dipanggil dari aplikasi setelah konfirmasi eksplisit pengguna.
create or replace function public.hapus_histori_keluarga(p_tanggal_awal date, p_tanggal_akhir date)
returns integer as $$
declare
  v_keluarga_id uuid;
  v_count integer;
begin
  if p_tanggal_awal is null or p_tanggal_akhir is null or p_tanggal_awal > p_tanggal_akhir then
    raise exception 'Rentang tanggal tidak valid.';
  end if;

  select keluarga_id into v_keluarga_id from public.profiles where id = auth.uid();
  if v_keluarga_id is null then
    raise exception 'Profil keluarga tidak ditemukan.';
  end if;

  delete from public.transaksi
  where keluarga_id = v_keluarga_id
    and tanggal between p_tanggal_awal and p_tanggal_akhir;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.hapus_histori_keluarga(date, date) to authenticated;

-- ============================================================
-- FITUR KEUANGAN PROFESIONAL UANGKU
-- Jalankan bagian ini setelah schema utama.
-- ============================================================

alter table public.keluarga add column if not exists saldo_awal numeric(14,2) not null default 0;
alter table public.transaksi add column if not exists updated_at timestamptz not null default now();
alter table public.transaksi add column if not exists updated_by uuid references auth.users(id);
alter table public.transaksi add column if not exists bukti_path text;

create table if not exists public.anggaran (
  id uuid primary key default gen_random_uuid(), keluarga_id uuid not null references public.keluarga(id) on delete cascade,
  kategori text not null, bulan date not null, batas numeric(14,2) not null check (batas > 0), created_by uuid references auth.users(id), created_at timestamptz not null default now(),
  unique(keluarga_id, kategori, bulan)
);
create index if not exists anggaran_keluarga_bulan_idx on public.anggaran(keluarga_id, bulan);

create table if not exists public.transaksi_berulang (
  id uuid primary key default gen_random_uuid(), keluarga_id uuid not null references public.keluarga(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade, tipe text not null check (tipe in ('pemasukan','pengeluaran')), kategori text not null,
  jumlah numeric(14,2) not null check (jumlah > 0), keterangan text, sumber_tujuan text, frekuensi text not null check (frekuensi in ('harian','mingguan','bulanan','tahunan')),
  tanggal_berikutnya date not null, aktif boolean not null default true, created_at timestamptz not null default now()
);
create index if not exists transaksi_berulang_keluarga_idx on public.transaksi_berulang(keluarga_id, aktif, tanggal_berikutnya);

create table if not exists public.target_tabungan (
  id uuid primary key default gen_random_uuid(), keluarga_id uuid not null references public.keluarga(id) on delete cascade,
  nama text not null, target numeric(14,2) not null check (target > 0), terkumpul numeric(14,2) not null default 0 check (terkumpul >= 0), tenggat date,
  created_at timestamptz not null default now()
);
create index if not exists target_tabungan_keluarga_idx on public.target_tabungan(keluarga_id);

create table if not exists public.tagihan (
  id uuid primary key default gen_random_uuid(), keluarga_id uuid not null references public.keluarga(id) on delete cascade,
  nama text not null, nominal numeric(14,2) not null check (nominal > 0), jatuh_tempo date not null, berulang boolean not null default false,
  status text not null default 'belum' check (status in ('belum','lunas')), created_at timestamptz not null default now()
);
create index if not exists tagihan_keluarga_tempo_idx on public.tagihan(keluarga_id, jatuh_tempo, status);

create or replace function public.touch_transaksi_updated_at()
returns trigger as $$ begin new.updated_at = now(); new.updated_by = auth.uid(); return new; end; $$ language plpgsql security definer;
drop trigger if exists trg_touch_transaksi on public.transaksi;
create trigger trg_touch_transaksi before update on public.transaksi for each row execute procedure public.touch_transaksi_updated_at();

alter table public.anggaran enable row level security;
alter table public.transaksi_berulang enable row level security;
alter table public.target_tabungan enable row level security;
alter table public.tagihan enable row level security;

drop policy if exists "anggaran_family_all" on public.anggaran;
create policy "anggaran_family_all" on public.anggaran for all to authenticated using (keluarga_id = public.my_keluarga_id()) with check (keluarga_id = public.my_keluarga_id());
drop policy if exists "berulang_family_all" on public.transaksi_berulang;
create policy "berulang_family_all" on public.transaksi_berulang for all to authenticated using (keluarga_id = public.my_keluarga_id()) with check (keluarga_id = public.my_keluarga_id());
drop policy if exists "target_family_all" on public.target_tabungan;
create policy "target_family_all" on public.target_tabungan for all to authenticated using (keluarga_id = public.my_keluarga_id()) with check (keluarga_id = public.my_keluarga_id());
drop policy if exists "tagihan_family_all" on public.tagihan;
create policy "tagihan_family_all" on public.tagihan for all to authenticated using (keluarga_id = public.my_keluarga_id()) with check (keluarga_id = public.my_keluarga_id());

-- Storage untuk bukti/struk transaksi. Buat bucket private bernama bukti-transaksi.
insert into storage.buckets (id, name, public) values ('bukti-transaksi','bukti-transaksi',false) on conflict (id) do nothing;
drop policy if exists "bukti_upload_family" on storage.objects;
create policy "bukti_upload_family" on storage.objects for insert to authenticated with check (bucket_id='bukti-transaksi');
drop policy if exists "bukti_read_family" on storage.objects;
create policy "bukti_read_family" on storage.objects for select to authenticated using (bucket_id='bukti-transaksi');
drop policy if exists "bukti_delete_own" on storage.objects;
create policy "bukti_delete_own" on storage.objects for delete to authenticated using (bucket_id='bukti-transaksi' and owner_id::uuid = auth.uid());
