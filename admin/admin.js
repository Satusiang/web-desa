import { getClient, isConfigured, pesanGalat, linkMaps, tanggalWIB, esc, safeUrl, tanggalID, waLocal, rupiah, parseBaris, barisKeTeks,
  nomorDusun, nomorRtRw, romawi, tiga, jabatanKadus, jabatanRw, jabatanRt, strukturWilayah } from '../js/sb.js';

const $ = (s) => document.querySelector(s);
const BUCKET = 'media';
let sb;

// ---------- utilitas ----------
function toast(msg, isErr = false) {
  const t = $('#atoast');
  t.textContent = msg;
  t.className = 'toast' + (isErr ? ' err' : '');
  t.style.display = 'block';
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.style.display = 'none'), isErr ? 6000 : 3000);
}
// Kotak konfirmasi berbahasa Indonesia (pengganti confirm() bawaan browser). Hasil: Promise<boolean>
function konfirmasi(pesan, ya = 'Ya, hapus') {
  const d = $('#dlg-konfirm');
  $('#dlg-konfirm-teks').textContent = pesan;
  $('#dlg-ya').textContent = ya;
  return new Promise(res => {
    const selesai = (v) => { d.close(); $('#dlg-ya').onclick = $('#dlg-batal').onclick = d.oncancel = null; res(v); };
    $('#dlg-ya').onclick = () => selesai(true);
    $('#dlg-batal').onclick = () => selesai(false);
    d.oncancel = (e) => { e.preventDefault(); selesai(false); };
    d.showModal(); $('#dlg-batal').focus();
  });
}
function show(view) {
  ['noconfig', 'login', 'forgot', 'reset', 'denied', 'app'].forEach(v => { $('#v-' + v).hidden = v !== view; });
}
async function busy(btn, fn) {
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Menyimpan…';
  try { await fn(); }
  catch (e) { console.error(e); toast('Gagal: ' + (e.message || e), true); }
  finally { btn.disabled = false; btn.textContent = label; }
}
// Ubah pesan teknis dari database menjadi kalimat yang dimengerti petugas
function terjemahGalat(m) {
  m = String(m || '');
  if (/schema cache/i.test(m)) return 'Database perlu diperbarui. Hubungi pengelola website (jalankan supabase/schema.sql terbaru).';
  if (/row-level security|permission denied|jwt expired|invalid jwt|not authorized|401/i.test(m)) return 'Sesi login sudah berakhir atau akun ini tidak punya izin. Silakan keluar lalu masuk lagi.';
  if (/duplicate key|already exists/i.test(m)) return 'Data yang sama sudah ada.';
  if (/foreign key/i.test(m)) return 'Data ini masih dipakai di bagian lain, jadi belum bisa diubah atau dihapus.';
  if (/check constraint|invalid input syntax/i.test(m)) return 'Ada isian yang tidak sesuai. Periksa kembali isian Anda.';
  if (/payload too large|maximum allowed size|413/i.test(m)) return 'Ukuran file terlalu besar (maksimal 10 MB).';
  return pesanGalat(m);
}
function check({ error, data }) {
  if (error) { const e = new Error(terjemahGalat(error.message)); e.asli = error.message; throw e; }
  return data;
}
let umkmPunyaKolomMaps = false; // true bila baris yang sedang diedit sudah punya kolom maps_url
// Isian link Google Maps di form UMKM. Kosong -> tidak dikirim (aman untuk database lama).
function linkMapsDariForm() {
  const isi = $('#u-maps').value.trim();
  $('#u-maps-err').textContent = '';
  if (!isi) return umkmPunyaKolomMaps ? { maps_url: '' } : {};
  const url = linkMaps(isi);
  if (!url) {
    $('#u-maps-err').textContent = 'Link tidak dikenali. Gunakan link dari Google Maps (menu Bagikan → Salin link).';
    throw new Error('Link Google Maps tidak valid');
  }
  $('#u-maps').value = url;
  return { maps_url: url };
}
async function kompres(file, maxW = 1600, quality = 0.82) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Foto tidak bisa dibaca'));
    i.src = URL.createObjectURL(file);
  });
  const scale = Math.min(1, maxW / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  return await new Promise(res => c.toBlob(b => res(b || file), 'image/jpeg', quality));
}
async function unggah(file, folder, { image = true } = {}) {
  const blob = image ? await kompres(file) : file;
  const ext = image ? 'jpg' : (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  check(await sb.storage.from(BUCKET).upload(path, blob, {
    contentType: image ? 'image/jpeg' : (file.type || 'application/octet-stream'), upsert: false,
  }));
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
async function hapusFile(url) {
  const m = String(url || '').match(/\/object\/public\/media\/(.+)$/);
  if (!m) return;
  try { await sb.storage.from(BUCKET).remove([decodeURIComponent(m[1])]); } catch { /* abaikan */ }
}
function previewFile(input, box) {
  input.addEventListener('change', () => {
    const f = input.files[0];
    box.innerHTML = f ? `<img src="${URL.createObjectURL(f)}" alt="">` : '';
  });
}
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const thumb = (url) => safeUrl(url) ? `<img src="${esc(url)}" alt="">` : '<span class="noimg"></span>';
const angka = (s) => Number(String(s || '').replace(/[^0-9]/g, '')) || 0;

// ---------- tab ----------
// Menu admin: dasbor kartu; bagian dibuka lewat #nama di alamat (bisa dimuat ulang & tombol kembali browser)
const kartuMenu = [...document.querySelectorAll('.kartu-menu[data-tab]')];
function bukaTab(nama) {
  const k = kartuMenu.find(b => b.dataset.tab === nama);
  $('#menu-admin').hidden = !!k; $('#judul-tab').hidden = !k;
  document.querySelectorAll('.tab').forEach(t => { t.hidden = !k || t.id !== 't-' + nama; });
  if (k) { $('#judul-tab-teks').textContent = k.querySelector('b').textContent; $('#judul-tab-ket').textContent = k.querySelector('small').textContent; }
  window.scrollTo(0, 0);
}
kartuMenu.forEach(b => b.addEventListener('click', () => { location.hash = b.dataset.tab; }));
document.addEventListener('click', e => {
  const a = e.target.closest('[data-loncat]'); if (!a) return;
  e.preventDefault(); document.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
window.addEventListener('hashchange', () => bukaTab(location.hash.slice(1)));
$('#kembali-menu').addEventListener('click', () => { history.pushState(null, '', location.pathname); bukaTab(''); });

// ---------- CRUD umum ----------
// Satu "modul" = form + daftar untuk satu tabel. cfg: {tabel, form, list, idEl, title, judulBaru, judulEdit,
//   order:[[kolom, asc]], baca(row) -> isi form, tulis() -> row, item(row) -> html, folder, fotoEl, previewEl, nama(row)}
const LABEL = { berita: 'Berita', pengumuman: 'Pengumuman', agenda: 'Agenda', pembangunan: 'Kegiatan pembangunan', perangkat: 'Data pengurus',
  lembaga: 'Lembaga', layanan: 'Syarat layanan', umkm: 'Toko' };
const KOSONG = { berita: 'Belum ada berita. Isi form di samping untuk menulis berita pertama.', pengumuman: 'Belum ada pengumuman. Isi form di samping untuk membuat pengumuman.',
  agenda: 'Belum ada agenda. Isi form di samping untuk menambah jadwal kegiatan.', pembangunan: 'Belum ada kegiatan pembangunan. Isi form di samping untuk menambahkannya.',
  perangkat: 'Belum ada data pengurus. Isi form di samping, atau isi Kepala Dusun dan RT/RW di menu Wilayah.', lembaga: 'Belum ada lembaga. Isi form di samping untuk menambahkannya.',
  layanan: 'Belum ada syarat layanan. Isi form di samping untuk menambahkannya.', umkm: 'Belum ada toko. Isi form di samping untuk mendaftarkan toko warga.' };
function modul(cfg) {
  let cache = [];
  const form = $(cfg.form);
  const label = LABEL[cfg.tabel] || 'Data';
  const reset = () => {
    form.reset();
    $(cfg.idEl).value = '';
    if (cfg.previewEl) $(cfg.previewEl).innerHTML = '';
    if (cfg.title) $(cfg.title).textContent = cfg.judulBaru;
    if (cfg.resetBtn) $(cfg.resetBtn).textContent = 'Kosongkan form';
    cfg.afterReset?.();
  };
  // Pencarian di daftar (mis. daftar perangkat yang panjang)
  const saring = () => {
    if (!cfg.cari) return;
    const q = $(cfg.cari).value.trim().toLowerCase();
    let judul = null, adaTampil = false;
    const tutup = () => { if (judul) judul.hidden = !adaTampil; };
    [...$(cfg.list).children].forEach(el => {
      if (el.classList.contains('grup-judul')) { tutup(); judul = el; adaTampil = false; return; }
      const cocok = !q || el.textContent.toLowerCase().includes(q);
      el.hidden = !cocok; if (cocok) adaTampil = true;
    });
    tutup();
  };
  if (cfg.cari) $(cfg.cari).addEventListener('input', saring);
  const muat = async () => {
    let q = sb.from(cfg.tabel).select('*');
    for (const [k, asc] of cfg.order) q = q.order(k, { ascending: asc });
    cache = check(await q);
    if (cfg.urut) cache = cfg.urut(cache);
    cfg.setelahMuat?.(cache);
    let grupLalu = null;
    $(cfg.list).innerHTML = cache.length ? cache.map(r => `${cfg.grup && cfg.grup(r) !== grupLalu ? `<p class="grup-judul">${esc(grupLalu = cfg.grup(r))}</p>` : ''}<div class="item">${cfg.foto === false ? '' : thumb(r.foto_url)}
      <div class="meta">${cfg.item(r)}</div>
      <div class="acts"><button class="btn alt small" data-edit="${r.id}">Edit</button>
      <button class="btn danger small" data-del="${r.id}">Hapus</button></div></div>`).join('') : `<p class="empty">${esc(KOSONG[cfg.tabel] || 'Belum ada data.')}</p>`;
    saring();
  };
  $(cfg.list).addEventListener('click', async e => {
    const id = e.target.dataset.edit || e.target.dataset.del;
    const r = cache.find(x => x.id === id);
    if (!r) return;
    if (e.target.dataset.edit) {
      reset();
      $(cfg.idEl).value = r.id;
      cfg.baca(r);
      if (cfg.pratinjau) cfg.pratinjau(r);
      else if (cfg.previewEl && safeUrl(r.foto_url)) $(cfg.previewEl).innerHTML = `<img src="${esc(r.foto_url)}" alt="">`;
      if (cfg.title) $(cfg.title).textContent = cfg.judulEdit;
      if (cfg.resetBtn) $(cfg.resetBtn).textContent = 'Batal edit';
      form.scrollIntoView({ behavior: 'smooth' });
    } else if (await konfirmasi(`Hapus ${label.toLowerCase()} "${cfg.nama(r)}"?\n\nData ini akan hilang dari website dan tidak bisa dikembalikan.`)) {
      await busy(e.target, async () => {
        check(await sb.from(cfg.tabel).delete().eq('id', r.id));
        if (r[cfg.kolomFile || 'foto_url']) await hapusFile(r[cfg.kolomFile || 'foto_url']);
        toast(`${label} dihapus`);
        await muat();
      });
    }
  });
  if (cfg.resetBtn) $(cfg.resetBtn).addEventListener('click', reset);
  if (cfg.fotoEl && !cfg.kolomFile) previewFile($(cfg.fotoEl), $(cfg.previewEl));
  form.addEventListener('submit', e => {
    e.preventDefault();
    busy(e.submitter || form.querySelector('button[type=submit]'), async () => {
      const id = $(cfg.idEl).value;
      const lama = cache.find(x => x.id === id);
      const row = cfg.tulis();
      const f = cfg.fotoEl ? $(cfg.fotoEl).files[0] : null;
      const kol = cfg.kolomFile || 'foto_url';
      const buang = !f && cfg.hapusFileEl && $(cfg.hapusFileEl).checked;
      if (f) {
        // gambar dikecilkan; file lain (mis. PDF surat) diunggah apa adanya
        row[kol] = await unggah(f, cfg.folder, { image: f.type.startsWith('image/') && f.type !== 'image/gif' });
        if (cfg.kolomNamaFile) row[cfg.kolomNamaFile] = f.name;
      } else if (buang) {
        row[kol] = null;
        if (cfg.kolomNamaFile) row[cfg.kolomNamaFile] = '';
      }
      if (id) check(await sb.from(cfg.tabel).update(row).eq('id', id));
      else check(await sb.from(cfg.tabel).insert(row));
      if ((f || buang) && lama?.[kol]) await hapusFile(lama[kol]);
      toast(id ? `Perubahan ${label.toLowerCase()} disimpan` : `${label} ditambahkan`);
      reset();
      await muat();
    });
  });
  return { muat, reset };
}

const mBerita = modul({
  tabel: 'berita', form: '#f-berita', list: '#l-berita', idEl: '#b-id', title: '#berita-title',
  judulBaru: 'Tulis berita baru', judulEdit: 'Edit berita', resetBtn: '#b-reset',
  fotoEl: '#b-foto', previewEl: '#b-preview', folder: 'berita',
  order: [['tanggal', false], ['dibuat', false]],
  afterReset: () => { $('#b-tanggal').value = today(); $('#b-terbit').checked = true; },
  baca: r => { $('#b-judul').value = r.judul; $('#b-tanggal').value = r.tanggal; $('#b-kat').value = r.kategori; $('#b-isi').value = r.isi || ''; $('#b-terbit').checked = r.terbit; },
  tulis: () => ({ judul: $('#b-judul').value.trim(), tanggal: $('#b-tanggal').value, kategori: $('#b-kat').value, isi: $('#b-isi').value, terbit: $('#b-terbit').checked }),
  item: r => `<b>${esc(r.judul)}</b><small>${esc(tanggalID(r.tanggal))} · ${esc(r.kategori)}</small><span class="badge ${r.terbit ? 'on' : 'off'}">${r.terbit ? 'Terbit' : 'Draf'}</span>`,
  nama: r => r.judul,
});

// ---------- pengumuman ----------
const MAKS_LAMPIRAN = 10 * 1024 * 1024;
const jenisLampiran = (nama, url) => /\.pdf($|\?)/i.test(nama || '') || /\.pdf($|\?)/i.test(url || '') ? 'PDF' : 'Foto';
const mPengumuman = modul({
  tabel: 'pengumuman', form: '#f-pengumuman', list: '#l-pengumuman', idEl: '#pg-id', title: '#pengumuman-title',
  judulBaru: 'Buat pengumuman', judulEdit: 'Edit pengumuman', resetBtn: '#pg-reset', foto: false,
  fotoEl: '#pg-file', previewEl: '#pg-lampiran', folder: 'pengumuman', kolomFile: 'file_url', kolomNamaFile: 'file_nama', hapusFileEl: '#pg-hapus-file',
  order: [['tanggal', false], ['dibuat', false]],
  afterReset: () => { $('#pg-tanggal').value = today(); $('#pg-tampil').checked = true; $('#pg-hapus-wrap').hidden = true; $('#pg-lampiran').innerHTML = ''; },
  baca: r => { $('#pg-judul').value = r.judul; $('#pg-isi').value = r.isi || ''; $('#pg-tanggal').value = r.tanggal; $('#pg-sampai').value = r.berlaku_sampai || '';
    $('#pg-penting').checked = r.penting; $('#pg-tampil').checked = r.tampil; },
  pratinjau: r => {
    const ada = safeUrl(r.file_url);
    $('#pg-hapus-wrap').hidden = !ada; $('#pg-hapus-file').checked = false;
    $('#pg-lampiran').innerHTML = ada ? `<p class="small">Lampiran saat ini: <a href="${esc(r.file_url)}" target="_blank" rel="noopener">${esc(r.file_nama || 'lihat lampiran')}</a> (${jenisLampiran(r.file_nama, r.file_url)}). Pilih file baru untuk mengganti.</p>` : '';
  },
  tulis: () => {
    const f = $('#pg-file').files[0];
    if (f && f.size > MAKS_LAMPIRAN) throw new Error('Ukuran lampiran maksimal 10 MB.');
    if (f && !(f.type === 'application/pdf' || f.type.startsWith('image/'))) throw new Error('Lampiran harus berupa PDF atau foto (JPG/PNG).');
    const sampai = $('#pg-sampai').value || null;
    if (sampai && sampai < $('#pg-tanggal').value) throw new Error('Tanggal "berlaku sampai" tidak boleh sebelum tanggal pengumuman.');
    return { judul: $('#pg-judul').value.trim(), isi: $('#pg-isi').value.trim(), tanggal: $('#pg-tanggal').value, berlaku_sampai: sampai,
      penting: $('#pg-penting').checked, tampil: $('#pg-tampil').checked };
  },
  item: r => {
    const lewat = r.berlaku_sampai && r.berlaku_sampai < today();
    return `<b>${esc(r.judul)}</b><small>${esc(tanggalID(r.tanggal))}${r.berlaku_sampai ? ' · sampai ' + esc(tanggalID(r.berlaku_sampai)) : ''}${safeUrl(r.file_url) ? ' · lampiran ' + jenisLampiran(r.file_nama, r.file_url) : ''}</small>`
      + (r.penting ? '<span class="badge on">Penting</span>' : '') + (!r.tampil ? '<span class="badge off">Disembunyikan</span>' : lewat ? '<span class="badge off">Arsip</span>' : '');
  },
  nama: r => r.judul,
});
$('#pg-file').addEventListener('change', e => {
  const f = e.target.files[0];
  $('#pg-lampiran').innerHTML = !f ? '' : f.type.startsWith('image/') ? `<img src="${URL.createObjectURL(f)}" alt="">`
    : `<p class="small">File: ${esc(f.name)} (${f.size < 1048576 ? Math.max(1, Math.round(f.size / 1024)) + ' KB' : (f.size / 1048576).toFixed(1) + ' MB'}) akan diunggah saat disimpan.</p>`;
});

const mAgenda = modul({
  tabel: 'agenda', form: '#f-agenda', list: '#l-agenda', idEl: '#ag-id', title: '#agenda-title',
  judulBaru: 'Tambah agenda', judulEdit: 'Edit agenda', resetBtn: '#ag-reset', foto: false,
  order: [['tanggal', false]],
  baca: r => { $('#ag-judul').value = r.judul; $('#ag-tanggal').value = r.tanggal; $('#ag-waktu').value = r.waktu; $('#ag-tempat').value = r.tempat; $('#ag-ket').value = r.keterangan; },
  tulis: () => ({ judul: $('#ag-judul').value.trim(), tanggal: $('#ag-tanggal').value, waktu: $('#ag-waktu').value.trim(), tempat: $('#ag-tempat').value.trim(), keterangan: $('#ag-ket').value.trim() }),
  item: r => `<b>${esc(r.judul)}</b><small>${esc(tanggalID(r.tanggal))}${r.tempat ? ' · ' + esc(r.tempat) : ''}</small>${r.tanggal < today() ? '<span class="badge off">Lewat</span>' : ''}`,
  nama: r => r.judul,
});

const mPb = modul({
  tabel: 'pembangunan', form: '#f-pb', list: '#l-pb', idEl: '#pb-id', title: '#pb-title',
  judulBaru: 'Tambah kegiatan pembangunan', judulEdit: 'Edit kegiatan', resetBtn: '#pb-reset',
  fotoEl: '#pb-foto', previewEl: '#pb-preview', folder: 'pembangunan',
  order: [['tahun', false], ['dibuat', false]],
  afterReset: () => { $('#pb-tahun').value = new Date().getFullYear(); },
  baca: r => { $('#pb-nama').value = r.nama; $('#pb-lokasi').value = r.lokasi; $('#pb-tahun').value = r.tahun; $('#pb-anggaran').value = Number(r.anggaran || 0).toLocaleString('id-ID'); $('#pb-sumber').value = r.sumber_dana; $('#pb-progres').value = r.progres; $('#pb-ket').value = r.keterangan; },
  tulis: () => ({ nama: $('#pb-nama').value.trim(), lokasi: $('#pb-lokasi').value.trim(), tahun: parseInt($('#pb-tahun').value, 10) || new Date().getFullYear(), anggaran: angka($('#pb-anggaran').value), sumber_dana: $('#pb-sumber').value.trim(), progres: Math.max(0, Math.min(100, parseInt($('#pb-progres').value, 10) || 0)), keterangan: $('#pb-ket').value.trim() }),
  item: r => `<b>${esc(r.nama)}</b><small>${r.tahun} · ${rupiah(r.anggaran)} · progres ${r.progres}%</small>`,
  nama: r => r.nama,
});

const mPerangkat = modul({
  tabel: 'perangkat', form: '#f-perangkat', list: '#l-perangkat', idEl: '#p-id', title: '#perangkat-title',
  judulBaru: 'Tambah orang', judulEdit: 'Edit data', resetBtn: '#p-reset', cari: '#cari-perangkat',
  fotoEl: '#p-foto', previewEl: '#p-preview', folder: 'perangkat',
  order: [['kelompok', false], ['urutan', true]],
  afterReset: () => aturPilihanLembaga(),
  baca: r => { $('#p-nama').value = r.nama; $('#p-jabatan').value = r.jabatan; $('#p-kelompok').value = r.kelompok; $('#p-urutan').value = r.urutan; aturPilihanLembaga(r.lembaga); },
  tulis: () => {
    const kelompok = $('#p-kelompok').value;
    const lembaga = kelompok === 'bpd' ? 'bpd' : kelompok === 'lembaga' ? ($('#p-lembaga').value || null) : null;
    const row = { nama: $('#p-nama').value.trim(), jabatan: $('#p-jabatan').value.trim(), kelompok, urutan: parseInt($('#p-urutan').value, 10) || 0 };
    if (!skemaLama) row.lembaga = lembaga; // kolom lembaga baru ada setelah schema.sql terbaru dijalankan
    return row;
  },
  urut: rows => rows.map(r => [grupPerangkat(r), r]).sort((a, b) => a[0][0] - b[0][0] || a[0][1].localeCompare(b[0][1]) || (a[1].urutan - b[1].urutan)).map(x => x[1]),
  grup: r => grupPerangkat(r)[1],
  setelahMuat: () => { if (!wl.ubah) muatWilayah().catch(e => toast('Gagal memuat wilayah: ' + e.message, true)); },
  item: r => `<b>${esc(r.nama)}</b><small>${esc(r.jabatan)} · ${r.kelompok === 'pemerintah' ? 'Perangkat desa' : esc(namaLembaga(r.lembaga) || ({ bpd: 'BPD', lembaga: 'Lembaga (belum dipilih)' })[r.kelompok])} · urutan ${r.urutan}</small>`,
  nama: r => r.nama,
});

let skemaLama = false; // true bila tabel lembaga belum ada (schema.sql terbaru belum dijalankan)
function grupPerangkat(r) {
  if (r.kelompok === 'pemerintah') return nomorDusun(r.jabatan) ? [2, 'Wilayah: Kepala Dusun'] : [1, 'Perangkat desa'];
  if (r.lembaga === 'rt-rw' || nomorRtRw(r.jabatan)) return [3, 'Wilayah: ketua RW dan RT'];
  if (r.kelompok === 'bpd' || r.lembaga === 'bpd') return [4, 'BPD'];
  return [5, 'Lembaga: ' + (namaLembaga(r.lembaga) || 'belum dipilih')];
}
// ---------- lembaga ----------
let lembagaCache = [];
const namaLembaga = (kode) => { const l = lembagaCache.find(x => x.kode === kode); return l ? (l.singkatan || l.nama) : ''; };
const kodeDari = (t) => String(t || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'lembaga';
function aturPilihanLembaga(pilih) {
  const kel = $('#p-kelompok').value;
  $('#p-lembaga-wrap').hidden = kel !== 'lembaga';
  const sekarang = pilih !== undefined ? pilih : $('#p-lembaga').value;
  const pilihan = lembagaCache.filter(l => l.kode !== 'bpd');
  $('#p-lembaga').innerHTML = pilihan.length ? pilihan.map(l => `<option value="${esc(l.kode)}">${esc(l.singkatan || l.nama)}</option>`).join('')
    : `<option value="" disabled selected>${skemaLama ? 'Jalankan schema.sql terbaru dulu' : 'Belum ada lembaga'}</option>`;
  if (sekarang && lembagaCache.some(l => l.kode === sekarang)) $('#p-lembaga').value = sekarang;
}
$('#p-kelompok').addEventListener('change', () => aturPilihanLembaga());
const mLembaga = modul({
  tabel: 'lembaga', form: '#f-lembaga', list: '#l-lembaga', idEl: '#lb-id', title: '#lembaga-title',
  judulBaru: 'Tambah lembaga', judulEdit: 'Edit lembaga', resetBtn: '#lb-reset',
  fotoEl: '#lb-foto', previewEl: '#lb-preview', folder: 'lembaga',
  order: [['urutan', true], ['nama', true]],
  baca: r => { $('#lb-nama').value = r.nama; $('#lb-singkatan').value = r.singkatan; $('#lb-urutan').value = r.urutan; $('#lb-ringkasan').value = r.ringkasan; $('#lb-profil').value = r.profil; },
  tulis: () => {
    const row = { nama: $('#lb-nama').value.trim(), singkatan: $('#lb-singkatan').value.trim(), urutan: parseInt($('#lb-urutan').value, 10) || 0,
      ringkasan: $('#lb-ringkasan').value.trim(), profil: $('#lb-profil').value.trim() };
    if (!$('#lb-id').value) { // kode alamat dibuat sekali saat lembaga ditambahkan
      let kode = kodeDari(row.singkatan || row.nama), n = 2;
      while (lembagaCache.some(l => l.kode === kode)) kode = `${kodeDari(row.singkatan || row.nama).slice(0, 36)}-${n++}`;
      row.kode = kode;
    }
    return row;
  },
  item: r => `<b>${esc(r.singkatan || r.nama)}</b><small>${esc(r.nama)} · alamat: lembaga?l=${esc(r.kode)} · urutan ${r.urutan}</small>`,
  nama: r => r.nama,
  setelahMuat: (rows) => { lembagaCache = rows; aturPilihanLembaga(); },
});

async function muatLembagaAman() {
  try { await mLembaga.muat(); skemaLama = false; }
  catch (e) {
    if (!/lembaga/i.test(e.asli || e.message || '')) throw e;
    skemaLama = true; lembagaCache = [];
    $('#banner-skema').hidden = false;
    $('#l-lembaga').innerHTML = '<p class="empty">Fitur Lembaga belum aktif. Hubungi pengelola website untuk memperbarui database (lihat peringatan kuning di atas).</p>';
    aturPilihanLembaga();
  }
}

// ---------- wilayah: Dusun -> RW -> RT dalam satu formulir ----------
let wl = { dusun: [], idAwal: new Map(), ubah: false }; // idAwal: id baris perangkat yang dimuat -> data, untuk mendeteksi yang dihapus
const slot = (p) => ({ file: null, preview: '', fotoBaru: '', id: p?.id || null, nama: p && !/^[\s\-–—.]*$/.test(p.nama || '') ? p.nama : '', foto_url: p?.foto_url || null });
async function muatWilayah() {
  const [rows, set] = await Promise.all([
    sb.from('perangkat').select('*').then(check),
    sb.from('pengaturan').select('nilai').eq('kunci', 'wilayah').then(check),
  ]);
  const struktur = strukturWilayah(set[0]?.nilai);
  const kadus = rows.filter(p => p.kelompok === 'pemerintah' && nomorDusun(p.jabatan));
  const rtrw = rows.filter(p => p.kelompok !== 'pemerintah' && nomorRtRw(p.jabatan));
  const n = (p) => nomorRtRw(p.jabatan);
  wl.idAwal = new Map([...kadus, ...rtrw].map(p => [p.id, p]));
  wl.ubah = false;
  const dipakai = new Set();
  wl.dusun = struktur.map((d, i) => {
    const no = nomorDusun(d.nama) || i + 1;
    return {
      nama: d.nama || 'Dusun ' + romawi(no),
      kadus: slot(kadus.find(p => nomorDusun(p.jabatan) === no)),
      rw: d.rw.map(r => {
        dipakai.add(r.no);
        const rts = rtrw.filter(p => n(p).rw === r.no && n(p).rt);
        const jml = Math.max(r.rt, ...rts.map(p => n(p).rt), 0);
        return { no: r.no, ketua: slot(rtrw.find(p => n(p).rw === r.no && !n(p).rt)),
          rt: Array.from({ length: jml }, (_, k) => slot(rts.find(p => n(p).rt === k + 1))) };
      }),
    };
  });
  // RW yang ada di data tapi belum masuk dusun mana pun: ditaruh di dusun terakhir agar tidak hilang
  const sisa = [...new Set(rtrw.map(p => n(p).rw))].filter(no => !dipakai.has(no)).sort((a, b) => a - b);
  if (sisa.length) {
    if (!wl.dusun.length) wl.dusun.push({ nama: 'Dusun I', kadus: slot(null), rw: [] });
    sisa.forEach(no => {
      const rts = rtrw.filter(p => n(p).rw === no && n(p).rt);
      wl.dusun[wl.dusun.length - 1].rw.push({ no, ketua: slot(rtrw.find(p => n(p).rw === no && !n(p).rt)),
        rt: Array.from({ length: Math.max(0, ...rts.map(p => n(p).rt)) }, (_, k) => slot(rts.find(p => n(p).rt === k + 1))) });
    });
  }
  gambarWilayah();
}
function gambarWilayah() {
  const inp = (f, v, ph, extra = '') => `<input data-f="${f}" value="${esc(v)}" placeholder="${esc(ph)}" maxlength="80" ${extra}>`;
  // Tombol foto bulat di samping nama: klik untuk memilih foto (tersimpan saat "Simpan wilayah", bila nama diisi)
  const foto = (s, jenis, extra = '') => {
    const src = s.preview || safeUrl(s.foto_url);
    return `<label class="wle-foto${src ? ' ada' : ''}" title="${src ? 'Ganti foto' : 'Tambah foto'}">${src ? `<img src="${esc(src)}" alt="">` : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg><span class="sr">Tambah foto</span>'}
      <input type="file" accept="image/*" data-foto="${jenis}" ${extra} hidden></label>`;
  };
  $('#wl-editor').innerHTML = wl.dusun.length ? wl.dusun.map((d, i) => `<div class="wle-dusun" data-d="${i}">
    <div class="wle-baris wle-d">
      <label>Nama dusun${inp('dnama', d.nama, 'mis. Dusun ' + romawi(i + 1))}</label>
      ${foto(d.kadus, 'kadus')}<label>Kepala Dusun${inp('kadus', d.kadus.nama, 'Nama Kepala Dusun')}</label>
      <button type="button" class="btn danger mini" data-aksi="hapus-dusun">Hapus dusun</button>
    </div>
    <div class="wle-anak">
      ${d.rw.map((r, j) => `<div class="wle-rw" data-r="${j}">
        <div class="wle-baris">
          <label class="wle-rwno" style="flex:0 0 auto">Nomor RW<input type="number" min="1" max="999" data-f="rwno" value="${r.no}"></label>
          ${foto(r.ketua, 'ketua')}<label>Ketua RW ${tiga(r.no)}${inp('ketua', r.ketua.nama, 'Nama ketua RW')}</label>
          <button type="button" class="btn danger mini" data-aksi="hapus-rw">Hapus RW</button>
        </div>
        <div class="wle-anak">
          ${r.rt.map((t, k) => `<div class="wle-rt"><span class="wle-tag">RT ${tiga(k + 1)}</span>${foto(t, 'rt', `data-k="${k}"`)}${inp('rt', t.nama, 'Nama ketua RT ' + tiga(k + 1) + '/RW ' + tiga(r.no), `data-k="${k}"`)}</div>`).join('')}
          <div class="wle-tombol"><button type="button" class="btn alt mini" data-aksi="tambah-rt">+ Tambah RT</button>
            ${r.rt.length ? '<button type="button" class="btn alt mini" data-aksi="kurangi-rt">− Hapus RT terakhir</button>' : ''}</div>
        </div>
      </div>`).join('')}
      <div class="wle-tombol"><button type="button" class="btn alt mini" data-aksi="tambah-rw">+ Tambah RW di ${esc(d.nama || 'dusun ini')}</button></div>
    </div>
  </div>`).join('') : '<p class="empty">Belum ada dusun. Klik "+ Tambah dusun".</p>';
}
$('#wl-editor').addEventListener('input', e => {
  const f = e.target.dataset.f; if (!f) return;
  wl.ubah = true;
  const d = wl.dusun[e.target.closest('[data-d]').dataset.d];
  const r = e.target.closest('[data-r]') ? d.rw[e.target.closest('[data-r]').dataset.r] : null;
  if (f === 'dnama') d.nama = e.target.value;
  if (f === 'kadus') d.kadus.nama = e.target.value;
  if (f === 'rwno') r.no = parseInt(e.target.value, 10) || 0;
  if (f === 'ketua') r.ketua.nama = e.target.value;
  if (f === 'rt') r.rt[e.target.dataset.k].nama = e.target.value;
});
$('#wl-editor').addEventListener('change', e => {
  if (['rwno', 'dnama'].includes(e.target.dataset.f)) gambarWilayah();
  const jenis = e.target.dataset.foto, f = e.target.files?.[0];
  if (!jenis || !f) return;
  if (!f.type.startsWith('image/')) { toast('Pilih file gambar (JPG/PNG).', true); return; }
  const d = wl.dusun[e.target.closest('[data-d]').dataset.d];
  const r = e.target.closest('[data-r]') ? d.rw[e.target.closest('[data-r]').dataset.r] : null;
  const s = jenis === 'kadus' ? d.kadus : jenis === 'ketua' ? r.ketua : r.rt[e.target.dataset.k];
  if (s.preview) URL.revokeObjectURL(s.preview);
  s.file = f; s.preview = URL.createObjectURL(f); wl.ubah = true;
  gambarWilayah();
});
$('#wl-editor').addEventListener('click', async e => {
  const aksi = e.target.dataset.aksi; if (!aksi) return;
  wl.ubah = true;
  const di = +e.target.closest('[data-d]').dataset.d, d = wl.dusun[di];
  const rj = e.target.closest('[data-r]') ? +e.target.closest('[data-r]').dataset.r : -1, r = d.rw[rj];
  const isi = (s) => s.nama.trim();
  if (aksi === 'hapus-dusun') {
    const terisi = [d.kadus, ...d.rw.flatMap(x => [x.ketua, ...x.rt])].filter(isi).length;
    if (!await konfirmasi(`Hapus ${d.nama}${terisi ? ` beserta ${terisi} nama di dalamnya` : ''}?\n\nPerubahan baru tersimpan setelah Anda klik "Simpan wilayah".`)) return;
    wl.dusun.splice(di, 1);
  }
  if (aksi === 'tambah-rw') {
    const semua = wl.dusun.flatMap(x => x.rw.map(y => y.no));
    d.rw.push({ no: Math.max(0, ...semua) + 1, ketua: slot(null), rt: [slot(null), slot(null), slot(null)] });
  }
  if (aksi === 'hapus-rw') {
    if (!await konfirmasi(`Hapus RW ${tiga(r.no)} beserta semua RT-nya?\n\nPerubahan baru tersimpan setelah Anda klik "Simpan wilayah".`)) return;
    d.rw.splice(rj, 1);
  }
  if (aksi === 'tambah-rt') r.rt.push(slot(null));
  if (aksi === 'kurangi-rt') {
    const t = r.rt[r.rt.length - 1];
    if (isi(t) && !await konfirmasi(`Hapus RT ${tiga(r.rt.length)} (${t.nama})?`)) return;
    r.rt.pop();
  }
  gambarWilayah();
});
$('#wl-tambah-dusun').addEventListener('click', () => {
  const no = Math.max(0, ...wl.dusun.map((d, i) => nomorDusun(d.nama) || i + 1)) + 1;
  wl.dusun.push({ nama: 'Dusun ' + romawi(no), kadus: slot(null), rw: [] });
  wl.ubah = true;
  gambarWilayah();
});
$('#wl-simpan').addEventListener('click', e => busy(e.target, async () => {
  // periksa isian
  const noDusun = wl.dusun.map((d, i) => nomorDusun(d.nama) || i + 1);
  if (new Set(noDusun).size !== noDusun.length) throw new Error('Ada nama dusun dengan nomor yang sama. Pakai nama berbeda, mis. Dusun I, Dusun II.');
  const noRw = wl.dusun.flatMap(d => d.rw.map(r => r.no));
  if (noRw.some(n => !n || n < 1)) throw new Error('Nomor RW harus diisi angka 1 atau lebih.');
  const ganda = noRw.find((n, i) => noRw.indexOf(n) !== i);
  if (ganda) throw new Error(`RW ${tiga(ganda)} tercatat lebih dari sekali.`);
  // susun baris yang diinginkan
  // unggah foto baru (hanya untuk kotak yang namanya diisi)
  const semuaSlot = wl.dusun.flatMap(d => [d.kadus, ...d.rw.flatMap(r => [r.ketua, ...r.rt])]);
  const fotoLama = [];
  for (const s of semuaSlot.filter(s => s.file && s.nama.trim())) {
    s.fotoBaru = await unggah(s.file, 'perangkat');
    if (s.foto_url) fotoLama.push(s.foto_url);
  }
  const target = [];
  const tambah = (s, row) => target.push({ s, row: { ...row, nama: s.nama.trim(), ...(s.fotoBaru ? { foto_url: s.fotoBaru } : {}) } });
  const kelRtRw = skemaLama ? { kelompok: 'lembaga' } : { kelompok: 'lembaga', lembaga: 'rt-rw' };
  wl.dusun.forEach((d, i) => {
    tambah(d.kadus, { jabatan: jabatanKadus(noDusun[i]), kelompok: 'pemerintah', urutan: 900 + noDusun[i] });
    d.rw.forEach(r => {
      tambah(r.ketua, { jabatan: jabatanRw(r.no), ...kelRtRw, urutan: r.no * 100 });
      r.rt.forEach((t, k) => tambah(t, { jabatan: jabatanRt(k + 1, r.no), ...kelRtRw, urutan: r.no * 100 + k + 1 }));
    });
  });
  const dipakai = new Set(target.map(x => x.s.id).filter(Boolean));
  const hapus = [...wl.idAwal.values()].filter(p => !dipakai.has(p.id))
    .concat(target.filter(x => x.s.id && !x.row.nama).map(x => wl.idAwal.get(x.s.id)).filter(Boolean));
  if (hapus.length && !await konfirmasi(`${hapus.length} nama akan dihapus dari website:\n${hapus.map(p => `• ${p.nama} (${p.jabatan})`).join('\n')}\n\nData ini tidak bisa dikembalikan.`, 'Ya, simpan dan hapus')) return;
  const sisip = target.filter(x => !x.s.id && x.row.nama).map(x => x.row);
  const beda = (x) => { const lama = wl.idAwal.get(x.s.id) || {}; return Object.keys(x.row).some(k => (lama[k] ?? null) !== (x.row[k] ?? null)); };
  const ubah = target.filter(x => x.s.id && x.row.nama && beda(x));
  if (sisip.length) check(await sb.from('perangkat').insert(sisip));
  await Promise.all(ubah.map(x => sb.from('perangkat').update(x.row).eq('id', x.s.id).then(check)));
  if (hapus.length) {
    check(await sb.from('perangkat').delete().in('id', hapus.map(p => p.id)));
    await Promise.all(hapus.filter(p => p.foto_url).map(p => hapusFile(p.foto_url)));
  }
  await Promise.all(fotoLama.map(u => hapusFile(u))); // foto lama yang sudah diganti
  const struktur = wl.dusun.map(d => ({ nama: d.nama.trim(), rw: d.rw.map(r => ({ no: r.no, rt: r.rt.length })) }));
  check(await sb.from('pengaturan').upsert({ kunci: 'wilayah', diperbarui: new Date().toISOString(), nilai: { struktur } }));
  toast(`Wilayah disimpan: ${sisip.length} ditambah, ${ubah.length} diperbarui, ${hapus.length} dihapus.`);
  await Promise.all([muatWilayah(), mPerangkat.muat()]);
}));

const mLayanan = modul({
  tabel: 'layanan', form: '#f-layanan', list: '#l-layanan', idEl: '#ly-id', title: '#layanan-title',
  judulBaru: 'Tambah layanan', judulEdit: 'Edit layanan', resetBtn: '#ly-reset', foto: false,
  order: [['urutan', true], ['dibuat', true]],
  baca: r => { $('#ly-nama').value = r.nama; $('#ly-syarat').value = r.syarat; $('#ly-lama').value = r.lama; $('#ly-ket').value = r.keterangan; $('#ly-urutan').value = r.urutan; },
  tulis: () => ({ nama: $('#ly-nama').value.trim(), syarat: $('#ly-syarat').value.trim(), lama: $('#ly-lama').value.trim(), keterangan: $('#ly-ket').value.trim(), urutan: parseInt($('#ly-urutan').value, 10) || 0 }),
  item: r => `<b>${esc(r.nama)}</b><small>${esc(String(r.syarat || '').split('\n').filter(Boolean).length)} syarat · urutan ${r.urutan}</small>`,
  nama: r => r.nama,
});

const mUmkm = modul({
  tabel: 'umkm', form: '#f-umkm', list: '#l-umkm', idEl: '#u-id', title: '#umkm-title',
  judulBaru: 'Tambah toko / usaha', judulEdit: 'Edit toko / usaha', resetBtn: '#u-reset',
  fotoEl: '#u-foto', previewEl: '#u-preview', folder: 'umkm',
  order: [['urutan', true], ['dibuat', true]],
  afterReset: () => { $('#u-tampil').checked = true;  umkmPunyaKolomMaps = false; $('#u-maps-err').textContent = ''; },
  baca: r => { $('#u-nama').value = r.nama; $('#u-kat').value = r.kategori; $('#u-urutan').value = r.urutan; $('#u-desk').value = r.deskripsi; $('#u-harga').value = r.harga; $('#u-wa').value = r.wa; $('#u-alamat').value = r.alamat; $('#u-maps').value = r.maps_url || ''; umkmPunyaKolomMaps = 'maps_url' in r; $('#u-tampil').checked = r.tampil; },
  tulis: () => ({ nama: $('#u-nama').value.trim(), kategori: $('#u-kat').value, urutan: parseInt($('#u-urutan').value, 10) || 0, deskripsi: $('#u-desk').value.trim(), harga: $('#u-harga').value.trim(), wa: $('#u-wa').value.replace(/[^\d+]/g, ''), alamat: $('#u-alamat').value.trim(), tampil: $('#u-tampil').checked, ...linkMapsDariForm() }),
  item: r => `<b>${esc(r.nama)}</b><small>${esc(r.kategori)}${r.wa ? ' · ' + esc(waLocal(r.wa)) : ''}</small><span class="badge ${r.tampil ? 'on' : 'off'}">${r.tampil ? 'Tampil' : 'Disembunyikan'}</span>`,
  nama: r => r.nama,
});

// ---------- DOKUMEN ----------
let dokumenCache = [];
async function muatDokumen() {
  dokumenCache = check(await sb.from('dokumen').select('*').order('urutan').order('dibuat', { ascending: false }));
  $('#l-dokumen').innerHTML = dokumenCache.length ? dokumenCache.map(d => `
    <div class="item"><div class="meta"><b>${esc(d.judul)}</b><small>${esc(d.kategori)}${d.keterangan ? ' · ' + esc(d.keterangan) : ''} · urutan ${d.urutan}</small></div>
      <div class="acts"><a class="btn alt small" href="${esc(safeUrl(d.file_url))}" target="_blank" rel="noopener">Lihat</a>
      <button class="btn danger small" data-del="${d.id}">Hapus</button></div></div>`).join('') : '<p class="empty">Belum ada dokumen.</p>';
}
$('#l-dokumen').addEventListener('click', async e => {
  const d = dokumenCache.find(x => x.id === e.target.dataset.del);
  if (!d || !await konfirmasi(`Hapus dokumen "${d.judul}"?\n\nDokumen akan hilang dari halaman Transparansi dan tidak bisa dikembalikan.`)) return;
  await busy(e.target, async () => {
    check(await sb.from('dokumen').delete().eq('id', d.id));
    await hapusFile(d.file_url);
    toast('Dokumen dihapus');
    await muatDokumen();
  });
});
$('#f-dokumen').addEventListener('submit', e => {
  e.preventDefault();
  busy(e.submitter || $('#f-dokumen button[type=submit]'), async () => {
    const f = $('#d-file').files[0];
    if (f.size > 10 * 1024 * 1024) throw new Error('Ukuran file lebih dari 10 MB');
    const url = await unggah(f, 'dokumen', { image: false });
    check(await sb.from('dokumen').insert({ judul: $('#d-judul').value.trim(), kategori: $('#d-kat').value, keterangan: $('#d-ket').value.trim(), urutan: parseInt($('#d-urutan').value, 10) || 0, file_url: url }));
    $('#f-dokumen').reset();
    toast('Dokumen diunggah');
    await muatDokumen();
  });
});

// ---------- APBDES ----------
let apbList = [];
function hitungTotal() {
  const t = (id) => parseBaris($(id).value).reduce((s, b) => s + b.nilai, 0);
  $('#ap-total').textContent = `Total pendapatan ${rupiah(t('#ap-pendapatan'))} · belanja ${rupiah(t('#ap-belanja'))} · pembiayaan ${rupiah(t('#ap-pembiayaan'))}`;
}
['#ap-pendapatan', '#ap-belanja', '#ap-pembiayaan'].forEach(id => $(id).addEventListener('input', hitungTotal));
function isiAPB(tahun) {
  const x = apbList.find(a => a.tahun === tahun);
  $('#ap-catatan').value = x?.catatan || '';
  $('#ap-pendapatan').value = barisKeTeks(x?.pendapatan);
  $('#ap-belanja').value = barisKeTeks(x?.belanja);
  $('#ap-pembiayaan').value = barisKeTeks(x?.pembiayaan);
  hitungTotal();
}
async function muatAPB() {
  apbList = check(await sb.from('apbdes').select('*').order('tahun', { ascending: false }));
  $('#ap-ada').textContent = apbList.length ? 'Sudah ada: ' + apbList.map(a => a.tahun).join(', ') : 'Belum ada data APBDes.';
  if (!$('#ap-tahun').value) $('#ap-tahun').value = apbList[0]?.tahun || new Date().getFullYear();
  isiAPB(+$('#ap-tahun').value);
}
$('#ap-muat').addEventListener('click', () => isiAPB(+$('#ap-tahun').value));
$('#f-apbdes').addEventListener('submit', e => {
  e.preventDefault();
  busy(e.submitter || $('#f-apbdes button[type=submit]'), async () => {
    const tahun = parseInt($('#ap-tahun').value, 10);
    check(await sb.from('apbdes').upsert([{ tahun, catatan: $('#ap-catatan').value.trim(), pendapatan: parseBaris($('#ap-pendapatan').value), belanja: parseBaris($('#ap-belanja').value), pembiayaan: parseBaris($('#ap-pembiayaan').value), diperbarui: new Date().toISOString() }]));
    toast(`APBDes ${tahun} disimpan`);
    await muatAPB();
  });
});
$('#ap-hapus').addEventListener('click', async e => {
  const tahun = parseInt($('#ap-tahun').value, 10);
  if (!apbList.some(a => a.tahun === tahun) || !await konfirmasi(`Hapus APBDes tahun ${tahun}?\n\nRincian anggaran tahun ini akan hilang dari website dan tidak bisa dikembalikan.`)) return;
  await busy(e.target, async () => {
    check(await sb.from('apbdes').delete().eq('tahun', tahun));
    toast(`APBDes ${tahun} dihapus`);
    $('#ap-tahun').value = '';
    await muatAPB();
  });
});

// ---------- PENGADUAN ----------
let aduanCache = [];
const STATUS = ['Diterima', 'Diproses', 'Selesai', 'Ditolak'];
function gambarAduan() {
  const f = $('#a-filter').value;
  const list = aduanCache.filter(a => f === 'semua' ? true : f === 'aktif' ? (a.status === 'Diterima' || a.status === 'Diproses') : a.status === f);
  $('#l-aduan').innerHTML = list.length ? list.map(a => `<div class="aduan" data-id="${a.id}">
    <div class="hd"><b>${esc(a.tiket)} · ${esc(a.kategori)}</b><span class="muted">${esc(tanggalWIB(a.dibuat))}</span></div>
    <div class="isi">${esc(a.isi)}</div>
    ${a.lokasi ? `<div class="pelapor">Lokasi: ${esc(a.lokasi)}</div>` : ''}
    <div class="pelapor">Pelapor: ${esc(a.nama || 'tanpa nama')}${a.kontak ? ' · ' + esc(a.kontak) : ''} (hanya terlihat petugas)</div>
    <div class="f"><select data-k="status">${STATUS.map(s => `<option ${s === a.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <textarea data-k="tanggapan" placeholder="Tanggapan / tindak lanjut (tampil ke pelapor)">${esc(a.tanggapan)}</textarea>
      <label class="check tampil-lapor"><input type="checkbox" data-k="tampil" ${a.tampil ? 'checked' : ''}> Tampilkan di halaman Lapor (tanpa nama pelapor)</label>
      <button class="btn small" data-save>Simpan</button></div></div>`).join('')
    : `<p class="empty">${f === 'aktif' ? 'Tidak ada pengaduan yang belum selesai. Pilih "Semua" di kotak "Tampilkan" untuk melihat semua pengaduan.' : aduanCache.length ? 'Tidak ada pengaduan dengan status ini.' : 'Belum ada pengaduan dari warga.'}</p>`;
  const aktif = aduanCache.filter(a => a.status === 'Diterima').length;
  $('#cnt-aduan').textContent = aktif ? aktif : '';
}
async function muatAduan() {
  aduanCache = check(await sb.from('pengaduan').select('*').order('dibuat', { ascending: false }).limit(300));
  gambarAduan();
}
$('#a-filter').addEventListener('change', gambarAduan);
$('#l-aduan').addEventListener('click', async e => {
  if (!e.target.hasAttribute('data-save')) return;
  const card = e.target.closest('.aduan');
  await busy(e.target, async () => {
    check(await sb.from('pengaduan').update({
      status: card.querySelector('[data-k=status]').value,
      tanggapan: card.querySelector('[data-k=tanggapan]').value.trim(),
      tampil: card.querySelector('[data-k=tampil]').checked,
      diperbarui: new Date().toISOString(),
    }).eq('id', card.dataset.id));
    toast('Pengaduan diperbarui');
    await muatAduan();
  });
});

// ---------- PENGATURAN ----------
let tampilan = {};
previewFile($('#s-foto-kades'), $('#s-prev-kades'));
previewFile($('#s-foto-beranda'), $('#s-prev-beranda'));
async function muatPengaturan() {
  const rows = check(await sb.from('pengaturan').select('kunci,nilai'));
  const c = Object.fromEntries(rows.map(r => [r.kunci, r.nilai || {}]));
  const k = c.kontak || {}, p = c.profil || {}, s = c.statistik || {}, pg = c.pengumuman || {}, bd = c.bumdes || {}, kd = c.kopdes || {};
  $('#s-wa').value = k.wa ? waLocal(k.wa).replace(/-/g, '') : ''; $('#s-telp').value = k.telp || ''; $('#s-email').value = k.email || '';
  $('#s-alamat').value = k.alamat || ''; $('#s-jam').value = k.jam || ''; $('#s-maps').value = k.maps_embed || '';
  $('#s-darurat').value = ((c.darurat || {}).daftar || []).map(d => `${d.nama}: ${d.nomor}`).join('\n');
  tampilan = c.tampilan || {};
  $('#s-ket-foto').value = tampilan.keterangan_foto || '';
  $('#s-prev-beranda').innerHTML = safeUrl(tampilan.foto_beranda) ? `<img src="${esc(tampilan.foto_beranda)}" alt="">` : '';
  $('#s-prev-kades').innerHTML = safeUrl(tampilan.foto_kades) ? `<img src="${esc(tampilan.foto_kades)}" alt="">` : '';
  $('#s-hapus-beranda-wrap').hidden = !tampilan.foto_beranda; $('#s-hapus-beranda').checked = false;
  $('#s-sambutan').value = p.sambutan || '';
  $('#s-kades').value = p.kades || ''; $('#s-sejarah').value = p.sejarah || ''; $('#s-visi').value = p.visi || '';
  $('#s-misi').value = Array.isArray(p.misi) ? p.misi.join('\n') : '';
  $('#s-bu').value = p.batas_utara || ''; $('#s-bs').value = p.batas_selatan || ''; $('#s-bt').value = p.batas_timur || ''; $('#s-bb').value = p.batas_barat || '';
  ['penduduk', 'kk', 'laki', 'perempuan', 'dusun', 'rw', 'rt', 'luas', 'sawah', 'darat'].forEach(x => { $('#s-st-' + x).value = s[x] || ''; });
  $('#s-st-tahun').value = s.tahun_data || '';
  $('#s-bd-nama').value = bd.nama || ''; $('#s-bd-url').value = bd.url || ''; $('#s-bd-ring').value = bd.ringkasan || '';
  $('#s-kd-nama').value = kd.nama || ''; $('#s-kd-ring').value = kd.ringkasan || ''; $('#s-kd-alamat').value = kd.alamat || '';
  $('#s-kd-wa').value = kd.wa || ''; $('#s-kd-unit').value = kd.unit || ''; $('#s-kd-pengurus').value = kd.pengurus || '';
}
$('#f-pengaturan').addEventListener('submit', e => {
  e.preventDefault();
  busy(e.submitter || $('#f-pengaturan button[type=submit]'), async () => {
    const now = new Date().toISOString();
    const v = (id) => $(id).value.trim();
    const statistik = {};
    ['penduduk', 'kk', 'laki', 'perempuan', 'dusun', 'rw', 'rt', 'luas', 'sawah', 'darat'].forEach(x => { statistik[x] = v('#s-st-' + x); });
    statistik.tahun_data = v('#s-st-tahun');
    const darurat = $('#s-darurat').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const i = l.lastIndexOf(':');
      return i > 0 ? { nama: l.slice(0, i).trim(), nomor: l.slice(i + 1).trim() } : { nama: l, nomor: '' };
    }).filter(d => d.nomor);
    const t = { ...tampilan, keterangan_foto: v('#s-ket-foto') };
    const fBer = $('#s-foto-beranda').files[0], fKad = $('#s-foto-kades').files[0];
    const lamaBer = tampilan.foto_beranda, lamaKad = tampilan.foto_kades;
    if (fBer) t.foto_beranda = await unggah(fBer, 'tampilan');
    else if ($('#s-hapus-beranda').checked) t.foto_beranda = '';
    if (fKad) t.foto_kades = await unggah(fKad, 'tampilan');
    check(await sb.from('pengaturan').upsert([
      { kunci: 'tampilan', diperbarui: now, nilai: t },
      { kunci: 'kontak', diperbarui: now, nilai: { wa: v('#s-wa'), telp: v('#s-telp'), email: v('#s-email'), alamat: v('#s-alamat'), jam: v('#s-jam'), maps_embed: v('#s-maps') } },
      { kunci: 'darurat', diperbarui: now, nilai: { daftar: darurat } },
      { kunci: 'profil', diperbarui: now, nilai: { kades: v('#s-kades'), sambutan: v('#s-sambutan'), sejarah: v('#s-sejarah'), visi: v('#s-visi'), misi: $('#s-misi').value.split('\n').map(s => s.trim()).filter(Boolean), batas_utara: v('#s-bu'), batas_selatan: v('#s-bs'), batas_timur: v('#s-bt'), batas_barat: v('#s-bb') } },
      { kunci: 'statistik', diperbarui: now, nilai: statistik },
      { kunci: 'bumdes', diperbarui: now, nilai: { nama: v('#s-bd-nama'), url: v('#s-bd-url'), ringkasan: v('#s-bd-ring') } },
      { kunci: 'kopdes', diperbarui: now, nilai: { nama: v('#s-kd-nama'), ringkasan: v('#s-kd-ring'), alamat: v('#s-kd-alamat'), wa: v('#s-kd-wa'), unit: v('#s-kd-unit'), pengurus: v('#s-kd-pengurus') } },
    ]));
    if ((fBer || $('#s-hapus-beranda').checked) && lamaBer) await hapusFile(lamaBer);
    if (fKad && lamaKad) await hapusFile(lamaKad);
    $('#s-foto-beranda').value = ''; $('#s-foto-kades').value = '';
    toast('Pengaturan disimpan');
    await muatPengaturan();
  });
});

// ---------- LOGIN ----------
async function masukDasbor(session) {
  $('#who-email').textContent = session.user.email;
  $('#btn-logout').hidden = false;
  const ok = check(await sb.rpc('is_admin'));
  if (!ok) { show('denied'); return; }
  show('app');
  bukaTab(location.hash.slice(1));
  mBerita.reset(); mPb.reset(); mPengumuman.reset();
  await Promise.all([muatAduan(), mPengumuman.muat().catch(e => { if (!/pengumuman/i.test(e.asli || e.message)) throw e; $('#banner-skema').hidden = false; $('#l-pengumuman').innerHTML = '<p class="empty">Fitur Pengumuman belum aktif. Hubungi pengelola website untuk memperbarui database (lihat peringatan kuning di atas).</p>'; }), mBerita.muat(), mAgenda.muat(), muatAPB(), mPb.muat(), muatDokumen(), muatLembagaAman().then(() => mPerangkat.muat()), mLayanan.muat(), mUmkm.muat(), muatPengaturan()])
    .catch(e => toast('Gagal memuat data: ' + e.message, true));
}
$('#f-login').addEventListener('submit', async e => {
  e.preventDefault();
  $('#l-err').textContent = '';
  const btn = $('#f-login button'); btn.disabled = true;
  const { data, error } = await sb.auth.signInWithPassword({ email: $('#l-email').value.trim(), password: $('#l-pass').value });
  btn.disabled = false;
  if (error) { $('#l-err').textContent = error.message === 'Invalid login credentials' ? 'Email atau password salah.' : pesanError(error); return; }
  await masukDasbor(data.session);
});
$('#btn-logout').addEventListener('click', async () => { await sb.auth.signOut(); location.reload(); });

// ---------- LUPA PASSWORD ----------
const PESAN_ERROR = {
  over_email_send_rate_limit: 'Batas kirim email tercapai. Coba lagi sekitar 1 jam lagi.',
  email_address_not_authorized: 'Email ini belum bisa menerima email dari Supabase. Lihat panduan di README.',
  otp_expired: 'Tautan reset sudah kedaluwarsa atau sudah pernah dipakai. Minta tautan baru.',
};
function pesanError(err) {
  const code = err?.code || '';
  if (PESAN_ERROR[code]) return PESAN_ERROR[code];
  if (/rate limit/i.test(err?.message || '')) return PESAN_ERROR.over_email_send_rate_limit;
  return pesanGalat(err);
}
$('#to-forgot').addEventListener('click', e => { e.preventDefault(); $('#fg-email').value = $('#l-email').value; show('forgot'); });
$('#to-login').addEventListener('click', e => { e.preventDefault(); show('login'); });
$('#f-forgot').addEventListener('submit', async e => {
  e.preventDefault();
  $('#fg-err').textContent = ''; $('#fg-ok').textContent = '';
  const { error } = await sb.auth.resetPasswordForEmail($('#fg-email').value.trim(), { redirectTo: location.origin + location.pathname });
  if (error) { $('#fg-err').textContent = pesanError(error); return; }
  $('#fg-ok').textContent = 'Jika email terdaftar, tautan reset sudah dikirim. Cek kotak masuk dan folder spam.';
});
$('#f-reset').addEventListener('submit', async e => {
  e.preventDefault();
  $('#rs-err').textContent = '';
  const p1 = $('#rs-pass').value, p2 = $('#rs-pass2').value;
  if (p1.length < 8) { $('#rs-err').textContent = 'Password minimal 8 karakter.'; return; }
  if (p1 !== p2) { $('#rs-err').textContent = 'Kedua password tidak sama.'; return; }
  const { error } = await sb.auth.updateUser({ password: p1 });
  if (error) { $('#rs-err').textContent = pesanError(error); return; }
  toast('Password baru tersimpan');
  const { data } = await sb.auth.getSession();
  if (data.session) await masukDasbor(data.session); else show('login');
});

(async () => {
  if (!isConfigured()) { show('noconfig'); return; }
  const hash = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  let modeReset = hash.get('type') === 'recovery' || query.get('type') === 'recovery';
  const errDesc = hash.get('error_description') || query.get('error_description');
  const errCode = hash.get('error_code') || query.get('error_code');
  try { sb = await getClient(); }
  catch (e) {
    show('noconfig');
    $('#v-noconfig h1').textContent = 'Tidak dapat terhubung ke server';
    $('#v-noconfig p').textContent = 'Halaman admin gagal memuat penghubung database. Periksa koneksi internet, lalu muat ulang halaman ini.';
    return;
  }
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { modeReset = true; $('#rs-who').textContent = session?.user?.email || ''; show('reset'); }
  });
  const { data } = await sb.auth.getSession();
  if (/[=&]/.test(location.hash) || query.has('code')) history.replaceState(null, '', location.pathname); // hapus token login, biarkan #menu
  if (errDesc) { show('login'); $('#l-err').textContent = PESAN_ERROR[errCode] || decodeURIComponent(errDesc.replace(/\+/g, ' ')); return; }
  if (modeReset && data.session) { $('#rs-who').textContent = data.session.user.email; show('reset'); return; }
  if (data.session) await masukDasbor(data.session);
  else show('login');
})();
