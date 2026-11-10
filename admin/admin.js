import { getClient, isConfigured, tanggalWIB, esc, safeUrl, tanggalID, waLocal, rupiah, parseBaris, barisKeTeks } from '../js/sb.js';

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
function check({ error, data }) {
  if (error) throw new Error(error.message);
  return data;
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
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.tab').forEach(t => { t.hidden = t.id !== 't-' + b.dataset.tab; });
}));

// ---------- CRUD umum ----------
// Satu "modul" = form + daftar untuk satu tabel. cfg: {tabel, form, list, idEl, title, judulBaru, judulEdit,
//   order:[[kolom, asc]], baca(row) -> isi form, tulis() -> row, item(row) -> html, folder, fotoEl, previewEl, nama(row)}
function modul(cfg) {
  let cache = [];
  const form = $(cfg.form);
  const reset = () => {
    form.reset();
    $(cfg.idEl).value = '';
    if (cfg.previewEl) $(cfg.previewEl).innerHTML = '';
    if (cfg.title) $(cfg.title).textContent = cfg.judulBaru;
    cfg.afterReset?.();
  };
  const muat = async () => {
    let q = sb.from(cfg.tabel).select('*');
    for (const [k, asc] of cfg.order) q = q.order(k, { ascending: asc });
    cache = check(await q);
    $(cfg.list).innerHTML = cache.length ? cache.map(r => `<div class="item">${cfg.foto === false ? '' : thumb(r.foto_url)}
      <div class="meta">${cfg.item(r)}</div>
      <div class="acts"><button class="btn alt small" data-edit="${r.id}">Edit</button>
      <button class="btn danger small" data-del="${r.id}">Hapus</button></div></div>`).join('') : '<p class="empty">Belum ada data.</p>';
  };
  $(cfg.list).addEventListener('click', async e => {
    const id = e.target.dataset.edit || e.target.dataset.del;
    const r = cache.find(x => x.id === id);
    if (!r) return;
    if (e.target.dataset.edit) {
      reset();
      $(cfg.idEl).value = r.id;
      cfg.baca(r);
      if (cfg.previewEl && safeUrl(r.foto_url)) $(cfg.previewEl).innerHTML = `<img src="${esc(r.foto_url)}" alt="">`;
      if (cfg.title) $(cfg.title).textContent = cfg.judulEdit;
      form.scrollIntoView({ behavior: 'smooth' });
    } else if (confirm(`Hapus "${cfg.nama(r)}"?`)) {
      await busy(e.target, async () => {
        check(await sb.from(cfg.tabel).delete().eq('id', r.id));
        if (r.foto_url) await hapusFile(r.foto_url);
        toast('Data dihapus');
        await muat();
      });
    }
  });
  if (cfg.resetBtn) $(cfg.resetBtn).addEventListener('click', reset);
  if (cfg.fotoEl) previewFile($(cfg.fotoEl), $(cfg.previewEl));
  form.addEventListener('submit', e => {
    e.preventDefault();
    busy(e.submitter || form.querySelector('button[type=submit]'), async () => {
      const id = $(cfg.idEl).value;
      const lama = cache.find(x => x.id === id);
      const row = cfg.tulis();
      const f = cfg.fotoEl ? $(cfg.fotoEl).files[0] : null;
      if (f) row.foto_url = await unggah(f, cfg.folder);
      if (id) check(await sb.from(cfg.tabel).update(row).eq('id', id));
      else check(await sb.from(cfg.tabel).insert(row));
      if (f && lama?.foto_url) await hapusFile(lama.foto_url);
      toast(id ? 'Perubahan disimpan' : 'Data ditambahkan');
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
  judulBaru: 'Tambah orang', judulEdit: 'Edit data', resetBtn: '#p-reset',
  fotoEl: '#p-foto', previewEl: '#p-preview', folder: 'perangkat',
  order: [['kelompok', false], ['urutan', true]],
  baca: r => { $('#p-nama').value = r.nama; $('#p-jabatan').value = r.jabatan; $('#p-kelompok').value = r.kelompok; $('#p-urutan').value = r.urutan; },
  tulis: () => ({ nama: $('#p-nama').value.trim(), jabatan: $('#p-jabatan').value.trim(), kelompok: $('#p-kelompok').value, urutan: parseInt($('#p-urutan').value, 10) || 0 }),
  item: r => `<b>${esc(r.nama)}</b><small>${esc(r.jabatan)} · ${({ pemerintah: 'Perangkat desa', bpd: 'BPD', lembaga: 'Lembaga' })[r.kelompok]} · urutan ${r.urutan}</small>`,
  nama: r => r.nama,
});

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
  judulBaru: 'Tambah UMKM', judulEdit: 'Edit UMKM', resetBtn: '#u-reset',
  fotoEl: '#u-foto', previewEl: '#u-preview', folder: 'umkm',
  order: [['urutan', true], ['dibuat', true]],
  afterReset: () => { $('#u-tampil').checked = true; },
  baca: r => { $('#u-nama').value = r.nama; $('#u-kat').value = r.kategori; $('#u-urutan').value = r.urutan; $('#u-desk').value = r.deskripsi; $('#u-harga').value = r.harga; $('#u-wa').value = r.wa; $('#u-alamat').value = r.alamat; $('#u-tampil').checked = r.tampil; },
  tulis: () => ({ nama: $('#u-nama').value.trim(), kategori: $('#u-kat').value, urutan: parseInt($('#u-urutan').value, 10) || 0, deskripsi: $('#u-desk').value.trim(), harga: $('#u-harga').value.trim(), wa: $('#u-wa').value.replace(/[^\d+]/g, ''), alamat: $('#u-alamat').value.trim(), tampil: $('#u-tampil').checked }),
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
  if (!d || !confirm(`Hapus dokumen "${d.judul}"?`)) return;
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
  if (!apbList.some(a => a.tahun === tahun) || !confirm(`Hapus APBDes tahun ${tahun}?`)) return;
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
    ${a.lokasi ? `<div class="pelapor">📍 ${esc(a.lokasi)}</div>` : ''}
    <div class="pelapor">Pelapor: ${esc(a.nama || 'tanpa nama')}${a.kontak ? ' · ' + esc(a.kontak) : ''} (hanya terlihat petugas)</div>
    <div class="f"><select data-k="status">${STATUS.map(s => `<option ${s === a.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <textarea data-k="tanggapan" placeholder="Tanggapan / tindak lanjut (tampil ke pelapor)">${esc(a.tanggapan)}</textarea>
      <label class="check" style="font-size:.85rem;white-space:nowrap"><input type="checkbox" data-k="tampil" ${a.tampil ? 'checked' : ''}> Tampil publik</label>
      <button class="btn small" data-save>Simpan</button></div></div>`).join('') : '<p class="empty">Tidak ada pengaduan.</p>';
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
async function muatPengaturan() {
  const rows = check(await sb.from('pengaturan').select('kunci,nilai'));
  const c = Object.fromEntries(rows.map(r => [r.kunci, r.nilai || {}]));
  const k = c.kontak || {}, p = c.profil || {}, s = c.statistik || {}, pg = c.pengumuman || {}, bd = c.bumdes || {};
  $('#s-pg-aktif').checked = !!pg.aktif; $('#s-pg-teks').value = pg.teks || ''; $('#s-pg-link').value = pg.tautan || '';
  $('#s-wa').value = k.wa ? waLocal(k.wa).replace(/-/g, '') : ''; $('#s-telp').value = k.telp || ''; $('#s-email').value = k.email || '';
  $('#s-alamat').value = k.alamat || ''; $('#s-jam').value = k.jam || ''; $('#s-maps').value = k.maps_embed || '';
  $('#s-darurat').value = ((c.darurat || {}).daftar || []).map(d => `${d.nama}: ${d.nomor}`).join('\n');
  $('#s-kades').value = p.kades || ''; $('#s-sejarah').value = p.sejarah || ''; $('#s-visi').value = p.visi || '';
  $('#s-misi').value = Array.isArray(p.misi) ? p.misi.join('\n') : '';
  $('#s-bu').value = p.batas_utara || ''; $('#s-bs').value = p.batas_selatan || ''; $('#s-bt').value = p.batas_timur || ''; $('#s-bb').value = p.batas_barat || '';
  ['penduduk', 'kk', 'laki', 'perempuan', 'dusun', 'rw', 'rt', 'luas'].forEach(x => { $('#s-st-' + x).value = s[x] || ''; });
  $('#s-st-tahun').value = s.tahun_data || '';
  $('#s-bd-nama').value = bd.nama || ''; $('#s-bd-url').value = bd.url || ''; $('#s-bd-ring').value = bd.ringkasan || '';
}
$('#f-pengaturan').addEventListener('submit', e => {
  e.preventDefault();
  busy(e.submitter || $('#f-pengaturan button[type=submit]'), async () => {
    const now = new Date().toISOString();
    const v = (id) => $(id).value.trim();
    const statistik = {};
    ['penduduk', 'kk', 'laki', 'perempuan', 'dusun', 'rw', 'rt', 'luas'].forEach(x => { statistik[x] = v('#s-st-' + x); });
    statistik.tahun_data = v('#s-st-tahun');
    const darurat = $('#s-darurat').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const i = l.lastIndexOf(':');
      return i > 0 ? { nama: l.slice(0, i).trim(), nomor: l.slice(i + 1).trim() } : { nama: l, nomor: '' };
    }).filter(d => d.nomor);
    check(await sb.from('pengaturan').upsert([
      { kunci: 'pengumuman', diperbarui: now, nilai: { aktif: $('#s-pg-aktif').checked, teks: v('#s-pg-teks'), tautan: v('#s-pg-link') } },
      { kunci: 'kontak', diperbarui: now, nilai: { wa: v('#s-wa'), telp: v('#s-telp'), email: v('#s-email'), alamat: v('#s-alamat'), jam: v('#s-jam'), maps_embed: v('#s-maps') } },
      { kunci: 'darurat', diperbarui: now, nilai: { daftar: darurat } },
      { kunci: 'profil', diperbarui: now, nilai: { kades: v('#s-kades'), sejarah: v('#s-sejarah'), visi: v('#s-visi'), misi: $('#s-misi').value.split('\n').map(s => s.trim()).filter(Boolean), batas_utara: v('#s-bu'), batas_selatan: v('#s-bs'), batas_timur: v('#s-bt'), batas_barat: v('#s-bb') } },
      { kunci: 'statistik', diperbarui: now, nilai: statistik },
      { kunci: 'bumdes', diperbarui: now, nilai: { nama: v('#s-bd-nama'), url: v('#s-bd-url'), ringkasan: v('#s-bd-ring') } },
    ]));
    toast('Pengaturan disimpan');
  });
});

// ---------- LOGIN ----------
async function masukDasbor(session) {
  $('#who-email').textContent = session.user.email;
  $('#btn-logout').hidden = false;
  const ok = check(await sb.rpc('is_admin'));
  if (!ok) { show('denied'); return; }
  show('app');
  mBerita.reset(); mPb.reset();
  await Promise.all([muatAduan(), mBerita.muat(), mAgenda.muat(), muatAPB(), mPb.muat(), muatDokumen(), mPerangkat.muat(), mLayanan.muat(), mUmkm.muat(), muatPengaturan()])
    .catch(e => toast('Gagal memuat data: ' + e.message, true));
}
$('#f-login').addEventListener('submit', async e => {
  e.preventDefault();
  $('#l-err').textContent = '';
  const btn = $('#f-login button'); btn.disabled = true;
  const { data, error } = await sb.auth.signInWithPassword({ email: $('#l-email').value.trim(), password: $('#l-pass').value });
  btn.disabled = false;
  if (error) { $('#l-err').textContent = error.message === 'Invalid login credentials' ? 'Email atau password salah.' : error.message; return; }
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
  return err?.message || String(err);
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
  catch (e) { show('noconfig'); $('#v-noconfig p').textContent = 'Gagal memuat Supabase: ' + e.message; return; }
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { modeReset = true; $('#rs-who').textContent = session?.user?.email || ''; show('reset'); }
  });
  const { data } = await sb.auth.getSession();
  if (location.hash || query.has('code')) history.replaceState(null, '', location.pathname);
  if (errDesc) { show('login'); $('#l-err').textContent = PESAN_ERROR[errCode] || decodeURIComponent(errDesc.replace(/\+/g, ' ')); return; }
  if (modeReset && data.session) { $('#rs-who').textContent = data.session.user.email; show('reset'); return; }
  if (data.session) await masukDasbor(data.session);
  else show('login');
})();
