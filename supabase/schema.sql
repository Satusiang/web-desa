-- =====================================================================
-- Skema database Website Desa Karang Bahagia
-- Cara pakai: Supabase Dashboard -> SQL Editor -> New query -> tempel semua -> Run
-- Aman dijalankan ulang (idempotent): tidak menghapus data yang sudah ada.
--
-- CATATAN PRIVASI: database ini di cloud. JANGAN simpan data penduduk (NIK, KK)
-- di sini. Pembuat surat di admin menyimpan datanya di komputer kantor desa saja.
-- =====================================================================

-- ---------- Daftar email admin ----------
create table if not exists public.admin (
  email text primary key
);
alter table public.admin enable row level security;
-- Tanpa policy: tabel admin hanya bisa diubah dari dashboard Supabase.

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- Pengaturan (profil, kontak, statistik, pengumuman, darurat) ----------
create table if not exists public.pengaturan (
  kunci text primary key,
  nilai jsonb not null default '{}'::jsonb,
  diperbarui timestamptz not null default now()
);

-- ---------- Berita ----------
create table if not exists public.berita (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  isi text not null default '',
  kategori text not null default 'Pemerintahan',
  tanggal date not null default current_date,
  foto_url text,
  terbit boolean not null default false,
  dibuat timestamptz not null default now()
);

-- ---------- Agenda ----------
create table if not exists public.agenda (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  tanggal date not null,
  waktu text not null default '',
  tempat text not null default '',
  keterangan text not null default '',
  dibuat timestamptz not null default now()
);

-- ---------- Perangkat desa, BPD, lembaga ----------
create table if not exists public.perangkat (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  jabatan text not null,
  kelompok text not null default 'pemerintah' check (kelompok in ('pemerintah','bpd','lembaga')),
  foto_url text,
  urutan int not null default 0,
  dibuat timestamptz not null default now()
);

-- ---------- Layanan (panduan surat) ----------
create table if not exists public.layanan (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  syarat text not null default '',      -- satu syarat per baris
  keterangan text not null default '',
  lama text not null default '',
  urutan int not null default 0,
  dibuat timestamptz not null default now()
);

-- ---------- APBDes per tahun ----------
create table if not exists public.apbdes (
  tahun int primary key,
  catatan text not null default '',
  pendapatan jsonb not null default '[]'::jsonb,   -- [{"uraian":"Dana Desa","nilai":1000000}]
  belanja jsonb not null default '[]'::jsonb,
  pembiayaan jsonb not null default '[]'::jsonb,
  diperbarui timestamptz not null default now()
);

-- ---------- Kegiatan pembangunan ----------
create table if not exists public.pembangunan (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  lokasi text not null default '',
  tahun int not null default extract(year from now())::int,
  anggaran numeric not null default 0,
  sumber_dana text not null default '',
  progres int not null default 0 check (progres between 0 and 100),
  keterangan text not null default '',
  foto_url text,
  dibuat timestamptz not null default now()
);

-- ---------- Dokumen publik (PPID) ----------
create table if not exists public.dokumen (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  kategori text not null default 'Lainnya',
  keterangan text not null default '',
  file_url text not null,
  urutan int not null default 0,
  dibuat timestamptz not null default now()
);

-- ---------- Katalog UMKM ----------
create table if not exists public.umkm (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  kategori text not null default 'Lainnya',
  deskripsi text not null default '',
  harga text not null default '',
  wa text not null default '',
  alamat text not null default '',
  foto_url text,
  tampil boolean not null default true,
  urutan int not null default 0,
  dibuat timestamptz not null default now()
);

-- ---------- Pengaduan warga ----------
create table if not exists public.pengaduan (
  id uuid primary key default gen_random_uuid(),
  tiket text unique not null,
  nama text not null default '',
  kontak text not null default '',
  kategori text not null,
  isi text not null,
  lokasi text not null default '',
  status text not null default 'Diterima' check (status in ('Diterima','Diproses','Selesai','Ditolak')),
  tanggapan text not null default '',
  tampil boolean not null default false,
  dibuat timestamptz not null default now(),
  diperbarui timestamptz not null default now()
);

create index if not exists pengaduan_dibuat_idx on public.pengaduan (dibuat desc);

-- Sidik pengirim: kode acak dari alamat internet (IP) pengirim, untuk membatasi spam per pengirim.
-- Alamat IP aslinya tidak disimpan, dan sidik tidak pernah ditampilkan di website.
alter table public.pengaduan add column if not exists sidik text not null default '';
create index if not exists pengaduan_sidik_idx on public.pengaduan (sidik, dibuat desc);

-- Garam rahasia untuk sidik, dibuat acak sekali. Tidak bisa dibaca dari website.
create table if not exists public.rahasia (
  kunci text primary key,
  nilai text not null
);
alter table public.rahasia enable row level security;
revoke all on public.rahasia from anon, authenticated;
insert into public.rahasia (kunci, nilai)
values ('garam_sidik', md5(random()::text || clock_timestamp()::text) || md5(random()::text))
on conflict (kunci) do nothing;

-- ---------- Hak akses Data API ----------
grant usage on schema public to anon, authenticated;
grant select on public.pengaturan, public.berita, public.agenda, public.perangkat, public.layanan,
  public.apbdes, public.pembangunan, public.dokumen, public.umkm to anon, authenticated;
grant insert, update, delete on public.pengaturan, public.berita, public.agenda, public.perangkat, public.layanan,
  public.apbdes, public.pembangunan, public.dokumen, public.umkm to authenticated;
-- Pengaduan: tamu tidak membaca/menulis tabel langsung, hanya lewat fungsi di bawah.
revoke all on public.pengaduan from anon;
grant select, update, delete on public.pengaduan to authenticated;

-- ---------- Row Level Security ----------
do $$
declare t text;
begin
  foreach t in array array['pengaturan','berita','agenda','perangkat','layanan','apbdes','pembangunan','dokumen','umkm','pengaduan'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "admin kelola" on public.%I', t);
    execute format('create policy "admin kelola" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
  foreach t in array array['pengaturan','agenda','perangkat','layanan','apbdes','pembangunan','dokumen'] loop
    execute format('drop policy if exists "baca publik" on public.%I', t);
    execute format('create policy "baca publik" on public.%I for select using (true)', t);
  end loop;
end $$;

drop policy if exists "baca publik" on public.berita;
create policy "baca publik" on public.berita for select using (terbit = true or public.is_admin());
drop policy if exists "baca publik" on public.umkm;
create policy "baca publik" on public.umkm for select using (tampil = true or public.is_admin());

-- ---------- Fungsi pengaduan untuk publik ----------
-- Sidik pengirim dari header permintaan. Supabase berada di belakang Cloudflare,
-- jadi cf-connecting-ip berisi alamat asli pengirim dan tidak bisa dipalsukan.
create or replace function public.sidik_pengirim()
returns text language plpgsql stable security definer set search_path = public as $$
declare h json; ip text;
begin
  begin
    h := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  exception when others then h := '{}'::json;
  end;
  ip := trim(coalesce(nullif(h->>'cf-connecting-ip', ''), nullif(h->>'x-real-ip', ''),
                      nullif(split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1), ''), ''));
  if ip = '' then return ''; end if;
  return md5((select nilai from public.rahasia where kunci = 'garam_sidik') || ':' || ip);
end $$;
revoke all on function public.sidik_pengirim() from public, anon, authenticated;

-- Kirim pengaduan, hasilnya nomor tiket.
-- Anti-spam:
--   * per pengirim: maksimal 3 laporan per 10 menit dan 10 laporan per hari;
--   * seluruh website: maksimal 60 laporan per 10 menit (pengaman terakhir bila banjir spam);
--   * laporan kembar (isi sama, beda huruf besar/kecil atau spasi) ditolak selama 1 hari.
create or replace function public.kirim_pengaduan(p_nama text, p_kontak text, p_kategori text, p_isi text, p_lokasi text)
returns text language plpgsql security definer set search_path = public as $$
declare t text; s text; isi_norm text;
begin
  if coalesce(trim(p_isi), '') = '' or length(p_isi) > 2000 then raise exception 'Isi laporan wajib diisi (maks 2000 karakter)'; end if;
  if length(trim(p_isi)) < 10 then raise exception 'Isi laporan terlalu pendek. Jelaskan masalahnya sedikit lebih lengkap.'; end if;
  if coalesce(trim(p_kategori), '') = '' or length(p_kategori) > 40 then raise exception 'Kategori tidak valid'; end if;
  if length(coalesce(p_nama,'')) > 80 or length(coalesce(p_kontak,'')) > 40 or length(coalesce(p_lokasi,'')) > 200 then
    raise exception 'Isian terlalu panjang';
  end if;

  s := public.sidik_pengirim();
  if s <> '' then
    if (select count(*) from public.pengaduan where sidik = s and dibuat > now() - interval '10 minutes') >= 3 then
      raise exception 'Anda sudah mengirim beberapa laporan dalam waktu singkat. Coba lagi 10 menit lagi.';
    end if;
    if (select count(*) from public.pengaduan where sidik = s and dibuat > now() - interval '1 day') >= 10 then
      raise exception 'Batas laporan hari ini dari perangkat Anda sudah tercapai. Coba lagi besok atau hubungi kantor desa.';
    end if;
  end if;
  if (select count(*) from public.pengaduan where dibuat > now() - interval '10 minutes') >= 60 then
    raise exception 'Terlalu banyak laporan masuk. Coba lagi beberapa menit lagi.';
  end if;

  isi_norm := lower(regexp_replace(trim(p_isi), '\s+', ' ', 'g'));
  if exists (select 1 from public.pengaduan
             where dibuat > now() - interval '1 day'
               and lower(regexp_replace(isi, '\s+', ' ', 'g')) = isi_norm) then
    raise exception 'Laporan yang sama sudah kami terima hari ini.';
  end if;

  loop
    t := 'LP-' || to_char(now() at time zone 'Asia/Jakarta', 'YYMMDD') || '-' || upper(substr(md5(random()::text), 1, 4));
    exit when not exists (select 1 from public.pengaduan where tiket = t);
  end loop;
  insert into public.pengaduan (tiket, nama, kontak, kategori, isi, lokasi, sidik)
  values (t, coalesce(trim(p_nama),''), coalesce(trim(p_kontak),''), trim(p_kategori), trim(p_isi), coalesce(trim(p_lokasi),''), s);
  return t;
end $$;

-- Cek status lewat nomor tiket (tanpa nama/kontak pelapor).
create or replace function public.cek_pengaduan(p_tiket text)
returns table (tiket text, kategori text, status text, tanggapan text, dibuat timestamptz, diperbarui timestamptz)
language sql stable security definer set search_path = public as $$
  select tiket, kategori, status, tanggapan, dibuat, diperbarui
  from public.pengaduan where tiket = upper(trim(p_tiket));
$$;

-- Daftar laporan yang ditampilkan admin (tanpa nama/kontak pelapor).
create or replace function public.laporan_publik()
returns table (tiket text, kategori text, isi text, lokasi text, status text, tanggapan text, dibuat timestamptz)
language sql stable security definer set search_path = public as $$
  select tiket, kategori, isi, lokasi, status, tanggapan, dibuat
  from public.pengaduan where tampil = true order by dibuat desc limit 50;
$$;

revoke all on function public.kirim_pengaduan(text,text,text,text,text) from public;
revoke all on function public.cek_pengaduan(text) from public;
revoke all on function public.laporan_publik() from public;
grant execute on function public.kirim_pengaduan(text,text,text,text,text) to anon, authenticated;
grant execute on function public.cek_pengaduan(text) to anon, authenticated;
grant execute on function public.laporan_publik() to anon, authenticated;

-- ---------- Storage untuk foto & PDF ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 10485760)
on conflict (id) do update set public = true, file_size_limit = 10485760;

drop policy if exists "media admin tambah" on storage.objects;
drop policy if exists "media admin ubah"   on storage.objects;
drop policy if exists "media admin hapus"  on storage.objects;
create policy "media admin tambah" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());
create policy "media admin ubah" on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_admin());
create policy "media admin hapus" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());

-- ---------- Data awal ----------
insert into public.pengaturan (kunci, nilai) values
  ('kontak', jsonb_build_object('wa','','telp','','email','','alamat','','jam','Senin–Jumat, 08.00–15.00 WIB','maps_embed','')),
  ('profil', jsonb_build_object(
      'sejarah', '',
      'visi', '',
      'misi', '[]'::jsonb,
      'kades', 'Caum',
      'sambutan', '',
      'batas_utara','', 'batas_selatan','', 'batas_timur','', 'batas_barat','')),
  ('statistik', jsonb_build_object('penduduk','6786','kk','1929','laki','','perempuan','','dusun','','rw','','rt','','luas','388 ha','sawah','329 ha','darat','59 ha','tahun_data','')),
  ('pengumuman', jsonb_build_object('aktif', false, 'teks', '', 'tautan', '')),
  ('darurat', jsonb_build_object('daftar', jsonb_build_array(
      jsonb_build_object('nama','Panggilan darurat','nomor','112'),
      jsonb_build_object('nama','Polisi','nomor','110'),
      jsonb_build_object('nama','Pemadam kebakaran','nomor','113'),
      jsonb_build_object('nama','Ambulans','nomor','119')))),
  ('bumdes', jsonb_build_object('nama','BUM Desa Bahtera Nusantara','url','https://bahtera-nusantara.bumdes-karangbahagia.workers.dev/','ringkasan','Badan Usaha Milik Desa Karang Bahagia yang mengelola usaha pangan desa.'))
on conflict (kunci) do nothing;

insert into public.perangkat (nama, jabatan, kelompok, urutan)
select 'Caum', 'Kepala Desa', 'pemerintah', 1
where not exists (select 1 from public.perangkat);

insert into public.layanan (nama, syarat, keterangan, urutan)
select * from (values
  ('Surat Keterangan Tidak Mampu (SKTM)', E'KTP dan Kartu Keluarga\nSurat pengantar RT/RW', 'Kelayakan diperiksa berdasarkan pengantar RT/RW.', 1),
  ('Surat Keterangan Domisili', E'KTP dan Kartu Keluarga\nSurat pengantar RT/RW', '', 2),
  ('Surat Keterangan Usaha', E'KTP dan Kartu Keluarga\nSurat pengantar RT/RW\nKeterangan nama dan alamat usaha', '', 3),
  ('Surat Pengantar SKCK', E'KTP dan Kartu Keluarga\nSurat pengantar RT/RW', 'Dilanjutkan ke kepolisian.', 4),
  ('Surat Keterangan Kelahiran', E'KTP dan Kartu Keluarga orang tua\nSurat keterangan lahir dari bidan/rumah sakit', 'Untuk pengurusan akta kelahiran.', 5),
  ('Surat Keterangan Kematian', E'KTP dan Kartu Keluarga almarhum\nKTP pelapor', '', 6)
) v(nama, syarat, keterangan, urutan)
where not exists (select 1 from public.layanan);

-- ---------- Admin ----------
-- Ganti dengan email admin desa. Akun dengan email ini dibuat juga di
-- Authentication -> Users -> Add user (centang Auto Confirm User).
-- insert into public.admin (email) values ('email-admin@contoh.com') on conflict do nothing;

notify pgrst, 'reload schema';
