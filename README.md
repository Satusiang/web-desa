# Website Desa Karang Bahagia

Website sementara Pemerintah Desa Karang Bahagia, Kecamatan Karang Bahagia, Kabupaten Bekasi.
Dipakai sampai domain resmi `.desa.id` selesai diurus. Cara kerjanya sama dengan website BUM Desa Bahtera Nusantara.

## Halaman
| Path | Isi |
|---|---|
| `index.html` | Beranda: pengumuman, layanan cepat, berita, agenda, angka desa, ringkasan APBDes |
| `profil.html` | Sejarah, visi-misi, wilayah, data penduduk (agregat), perangkat desa, BPD, lembaga |
| `layanan.html` | Alur dan syarat layanan surat |
| `transparansi.html` | APBDes per tahun (grafik + tabel), kegiatan pembangunan, dokumen publik |
| `berita.html` | Berita (detail: `berita.html?id=...`) dan agenda |
| `ekonomi.html` | BUM Desa dan katalog UMKM |
| `lapor.html` | Pengaduan warga dengan nomor tiket, cek status, laporan yang sudah ditindaklanjuti |
| `kontak.html` | Kontak kantor desa, nomor darurat, peta |
| `privasi.html` | Kebijakan privasi |
| `404.html` | Halaman bila alamat tidak ditemukan |
| `admin/` | Halaman petugas (login) |
| `admin/surat.html` | **Layanan Surat**: pilih jenis surat, isi formulir, nomor otomatis, cetak / simpan PDF |

File pendukung: `css/style.css`, `js/config.js` (alamat & kunci Supabase), `js/main.js` (header, menu, footer),
`js/data.js` (mengisi halaman dari database), `js/sb.js` (penghubung Supabase), `supabase/schema.sql`.
Pustaka Supabase disimpan di `js/vendor/` dengan versi terkunci supaya website tidak bergantung pada CDN luar.
Untuk memperbarui versinya, ganti berkas di `js/vendor/` dan ubah `SUPABASE_VERSI` di `js/sb.js`.

Selama `js/config.js` masih kosong, website menampilkan isi bawaan dan mode admin belum aktif.
Layanan Surat tetap bisa dipakai tanpa database.

## Mengaktifkan database dan mode admin
Gunakan **project Supabase baru** (terpisah dari BUM Desa, karena nama tabelnya sama).
1. Buat project di [supabase.com](https://supabase.com), region Singapore.
2. **SQL Editor → New query**, tempel seluruh isi `supabase/schema.sql`, klik **Run**.
3. Di SQL Editor, daftarkan email admin: `insert into admin (email) values ('email-admin@contoh.com');`
4. **Authentication → Users → Add user → Create new user**: email yang sama, buat password, centang **Auto Confirm User**.
5. **Authentication → Sign In / Providers**: matikan **Allow new users to sign up**.
6. **Project Settings → API**: salin *Project URL* dan *anon / publishable key* ke `js/config.js`.
   Jangan pernah memakai *service_role / secret key* di website.
7. Commit → Cloudflare deploy otomatis. Buka `/admin/` dan login.

`schema.sql` aman dijalankan ulang setiap ada pembaruan; data yang sudah ada tidak terhapus.

## Deploy ke Cloudflare
Header keamanan di `_headers`. Konfigurasi worker dibuat otomatis oleh Cloudflare saat build.
1. Cloudflare Dashboard → **Workers & Pages → Create → Import a repository** → pilih `web-desa`.
2. Build command dikosongkan, output directory `/` (atau kosong). Klik **Deploy**.
3. Setiap push ke branch `main` ter-deploy otomatis.
4. Setelah alamat website diketahui, isi Supabase → **Authentication → URL Configuration**:
   *Site URL* = alamat website, *Redirect URLs* = alamat website + `/admin/` (untuk fitur lupa password).

## Layanan Surat dan privasi data
- Data surat (identitas pemohon, buku agenda, nomor urut) **hanya tersimpan di browser komputer yang dipakai**,
  tidak dikirim ke Supabase. Ini sesuai rencana: data penduduk tidak disimpan di cloud.
- Karena itu pakai **satu komputer kantor** untuk membuat surat supaya nomor urut tidak bentrok.
- Unduh cadangan dari menu **Riwayat → Unduh cadangan** secara rutin dan simpan di flashdisk.
- Isi alamat kantor, kode desa, dan kode klasifikasi surat di menu **Pengaturan** Layanan Surat sebelum dipakai.
- Surat tetap ditandatangani basah oleh Kepala Desa dan distempel.
- Tahap berikutnya: database penduduk dan Layanan Surat dipindah ke server lokal di kantor desa.

## Pengaduan
Anti-spam pengaduan: tiap pengirim maksimal 3 laporan per 10 menit dan 10 laporan per hari (dikenali dari kode acak
alamat IP, alamat aslinya tidak disimpan), seluruh website maksimal 60 laporan per 10 menit, laporan kembar ditolak
selama sehari, dan ada isian jebakan untuk robot spam. Setelah memperbarui `schema.sql`, jalankan ulang di SQL Editor.
Kategori "Permohonan informasi publik" dipakai untuk permintaan informasi sesuai UU KIP.
Warga mengirim laporan tanpa login lewat fungsi `kirim_pengaduan`; nama dan nomor HP hanya terlihat petugas.
Petugas mengubah status, menulis tanggapan, dan memilih laporan mana yang tampil publik di tab **Pengaduan**.
