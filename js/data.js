// Mengisi halaman publik dengan data dari Supabase.
// Jika Supabase belum dikonfigurasi atau gagal dihubungi, isi bawaan di HTML tetap tampil.
import { getClient, tanggalWIB, esc, safeUrl, tanggalID, waIntl, waLocal, mapsInfo, ringkas, rupiah, paragraf, pesanGalat,
  nomorDusun, nomorRtRw, romawi, tiga, jabatanKadus, strukturWilayah, linkMaps } from './sb.js';

const $ = (s) => document.querySelector(s);
const page = document.body.dataset.page;
const BLN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function setText(key, value) {
  if (value == null || String(value).trim() === '') return;
  document.querySelectorAll(`[data-bind="${key}"]`).forEach(el => { el.textContent = value; el.classList.remove('belum'); });
}
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const inisial = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// ---------- kartu & daftar ----------
function kartuBerita(b) {
  const foto = safeUrl(b.foto_url);
  return `<article><a href="berita.html?id=${encodeURIComponent(b.id)}">
    <div class="img${foto ? '' : ' kosong'}">${foto ? `<img src="${esc(foto)}" alt="" loading="lazy">` : ''}</div>
    <div><p class="meta"><time datetime="${esc(b.tanggal)}">${esc(tanggalID(b.tanggal))}</time>, ${esc(b.kategori || '')}</p>
    <h3>${esc(b.judul)}</h3><p>${esc(ringkas(b.isi))}</p></div></a></article>`;
}
function kartuAgenda(a) {
  const [, m, d] = String(a.tanggal).split('-').map(Number);
  const info = [a.waktu, a.tempat].filter(Boolean).map(esc).join(', ');
  return `<div class="ag"><div class="tgl"><b>${d}</b><small>${BLN[m - 1]}</small></div>
    <div><h4>${esc(a.judul)}</h4><p>${esc(tanggalID(a.tanggal))}${info ? ', ' + info : ''}</p>${a.keterangan ? `<p>${esc(a.keterangan)}</p>` : ''}</div></div>`;
}
const SILUET = '<svg class="siluet" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="17" r="9"/><path d="M7 44c1.5-10 8.5-15 17-15s15.5 5 17 15z"/></svg>';
function kartuOrang(p) {
  const foto = safeUrl(p.foto_url);
  const kosong = !String(p.nama || '').trim() || /^[\s\-–—.]+$/.test(p.nama);
  const isi = foto ? `<img src="${esc(foto)}" alt="Foto ${esc(kosong ? p.jabatan : p.nama)}" loading="lazy">` : kosong ? SILUET : esc(inisial(p.nama));
  return `<div class="person${kosong ? ' kosong' : ''}"><div class="avatar">${isi}</div>
    <b>${kosong ? 'Belum diisi' : esc(p.nama)}</b><small>${esc(p.jabatan)}</small></div>`;
}

// Bagan susunan perangkat desa: Kepala Desa di atas, Sekretaris Desa di bawahnya,
// lalu jajaran kepala seksi, kepala urusan, dan kepala dusun. Tingkat ditentukan dari kata di jabatan.
const TINGKAT = [
  { k: 'kades',  judul: '',                       cocok: /kepala\s+desa|^kades\b|^kuwu\b|^lurah\b/i },
  { k: 'sekdes', judul: '',                       cocok: /sekretaris|sekertaris|sekdes|carik/i },
  { k: 'kasi',   judul: 'Kepala Seksi',           cocok: /seksi|\bkasi\b/i },
  { k: 'kaur',   judul: 'Kepala Urusan',          cocok: /urusan|\bkaur\b/i },
  { k: 'kadus',  judul: 'Kepala Dusun',           cocok: /dusun|kadus|kewilayahan/i },
  { k: 'lain',   judul: 'Staf dan pelaksana',     cocok: /./ },
];
// Bagan pengurus lembaga. Urutan di bawah = urutan pencocokan jabatan; "urut" = urutan tampil dari atas.
// ("Ketua Pokja I" masuk bidang, bukan ketua, karena bidang dicocokkan lebih dulu.)
const TINGKAT_LEMBAGA = [
  { k: 'pembina', urut: 0, judul: 'Pembina dan penasihat', cocok: /pembina|penasihat|penasehat|pelindung/i },
  { k: 'wakil',   urut: 2, judul: 'Wakil Ketua',             cocok: /wakil/i },
  { k: 'bidang',  urut: 4, judul: 'Bidang, seksi, dan kader', cocok: /seksi|bidang|pokja|koordinator|kader|divisi|departemen/i },
  { k: 'sekben',  urut: 3, judul: 'Sekretaris dan Bendahara', cocok: /sekretaris|sekertaris|bendahara/i },
  { k: 'ketua',   urut: 1, judul: 'Ketua',                   cocok: /ketua|kepala|komandan|kasatlinmas/i },
  { k: 'anggota', urut: 5, judul: 'Anggota',                 cocok: /anggota/i },
  { k: 'lain',    urut: 6, judul: 'Pengurus lainnya',        cocok: /./ },
];
// Organigram lembaga: kotak (pita jabatan + foto + nama) dihubungkan garis.
// Baris: Pembina -> Ketua -> Wakil, Sekretaris, Bendahara -> bidang/Pokja/kader -> Anggota -> lainnya.
function organigram(list) {
  const baris = [['pembina'], ['ketua'], ['wakil', 'sekben'], ['bidang'], ['anggota'], ['lain']];
  const tingkat = (p) => TINGKAT_LEMBAGA.find(t => t.cocok.test(String(p.jabatan || ''))).k;
  const kotak = (p) => {
    const foto = safeUrl(p.foto_url), kosong = !String(p.nama || '').trim() || /^[\s\-–—.]+$/.test(p.nama);
    return `<div class="og-kotak${tingkat(p) === 'ketua' ? ' utama' : ''}"><div class="og-jabatan">${esc(p.jabatan)}</div>
      <div class="og-isi"><span class="og-foto">${foto ? `<img src="${esc(foto)}" alt="" loading="lazy">` : kosong ? SILUET : esc(inisial(p.nama))}</span>
      <b class="${kosong ? 'kosong' : ''}">${kosong ? 'Belum diisi' : esc(p.nama)}</b></div></div>`;
  };
  // urutkan dalam baris: wakil dulu, lalu sekretaris, bendahara; selebihnya menurut angka urutan
  const urutSek = (p) => /wakil/i.test(p.jabatan) ? 0 : /sekretaris|sekertaris/i.test(p.jabatan) ? 1 : /bendahara/i.test(p.jabatan) ? 2 : 3;
  const isi = baris.map(ks => list.filter(p => ks.includes(tingkat(p))).sort((a, b) => urutSek(a) - urutSek(b) || (a.urutan || 0) - (b.urutan || 0))).filter(r => r.length);
  return `<div class="organigram">${isi.map((r, i) => `${i ? '<div class="og-sambung"></div>' : ''}<div class="og-baris${r.length > 1 ? ' banyak' : ''}${r.length === 6 ? ' padat' : ''}${r.length > 6 ? ' panel' : ''}">${r.map(kotak).join('')}</div>`).join('')}</div>`;
}
function baganPerangkat(list, tingkat = TINGKAT) {
  const isi = tingkat.map((t, i) => ({ urut: i, ...t, orang: [] }));
  list.forEach(p => isi.find(t => t.cocok.test(String(p.jabatan || ''))).orang.push(p));
  isi.sort((a, b) => a.urut - b.urut);
  return `<div class="bagan">${isi.filter(t => t.orang.length).map(t => `
    <div class="bagan-tingkat t-${t.k}${t.orang.length > 1 ? ' banyak' : ''}">
      ${t.judul && t.orang.length > 1 ? `<p class="bagan-judul">${esc(t.judul)}</p>` : ''}
      <div class="bagan-isi">${t.orang.map(kartuOrang).join('')}</div>
    </div>`).join('')}</div>`;
}
function totalOf(arr) { return (Array.isArray(arr) ? arr : []).reduce((s, b) => s + (Number(b.nilai) || 0), 0); }

// ---------- bagian bersama ----------
function terapkanPengaturan(cfg) {
  const k = cfg.kontak || {}, p = cfg.profil || {}, s = cfg.statistik || {}, pg = cfg.pengumuman || {};
  if (k.wa) {
    window.WA_DESA = waIntl(k.wa);
    try { localStorage.setItem('desa_wa', window.WA_DESA); } catch { /* boleh gagal */ }
    $('#wa-float')?.removeAttribute('hidden');
    document.querySelectorAll('[data-bind="wa"]').forEach(a => { a.textContent = waLocal(k.wa); a.href = `https://wa.me/${window.WA_DESA}`; a.classList.remove('belum'); });
  }
  if (k.telp) document.querySelectorAll('[data-bind="telp"]').forEach(a => { a.textContent = k.telp; a.href = `tel:${k.telp.replace(/[^\d+]/g, '')}`; a.classList.remove('belum'); });
  if (k.email) document.querySelectorAll('[data-bind="email"]').forEach(a => { a.textContent = k.email; a.href = `mailto:${k.email}`; a.classList.remove('belum'); });
  setText('alamat', k.alamat);
  setText('jam', k.jam);

  if (!window.__PITA_BARU && pg.aktif && pg.teks) {
    const t = $('#pengumuman-teks');
    const url = safeUrl(pg.tautan);
    t.innerHTML = esc(pg.teks) + (url ? ` <a href="${esc(url)}">Baca selengkapnya</a>` : '');
    $('#pengumuman').hidden = false;
  }

  const tp = cfg.tampilan || {};
  const fb = safeUrl(tp.foto_beranda);
  if (fb && $('#foto-beranda')) {
    $('#foto-beranda img').src = fb;
    $('#foto-beranda img').alt = tp.keterangan_foto || 'Desa Karang Bahagia';
    $('#foto-beranda figcaption').textContent = tp.keterangan_foto || '';
    $('#foto-beranda').hidden = false; // tampil di atas papan pengumuman
  }
  const fotoKades = safeUrl(tp.foto_kades);
  if (fotoKades && $('#sampul-foto')) {
    $('#sampul-foto source')?.remove();
    $('#sampul-foto img').src = fotoKades;
  }
  if ($('#bagian-sambutan') && p.sambutan) {
    $('#bagian-sambutan').hidden = false;
    const fk = safeUrl(tp.foto_kades);
    if (fk) $('#foto-kades').innerHTML = `<img src="${esc(fk)}" alt="Foto Kepala Desa ${esc(p.kades || '')}">`;
    else { $('#foto-kades').hidden = true; $('#bagian-sambutan .sambutan').classList.add('tanpa-foto'); }
  }
  ['kades', 'sejarah', 'visi', 'sambutan', 'batas_utara', 'batas_selatan', 'batas_timur', 'batas_barat'].forEach(x => setText(x, p[x]));
  if (Array.isArray(p.misi) && p.misi.length) {
    document.querySelectorAll('[data-bind="misi"]').forEach(el => { el.innerHTML = p.misi.map(m => `<li>${esc(m)}</li>`).join(''); });
  }
  const fmt = (v) => (v === '' || v == null) ? '' : (isFinite(Number(String(v).replace(/\./g, ''))) ? Number(String(v).replace(/\./g, '')).toLocaleString('id-ID') : v);
  // Jumlah dusun/RW/RT: dari Statistik; bila kosong, dihitung dari susunan di menu Wilayah
  const wl = cfg.wilayah?.struktur?.length ? strukturWilayah(cfg.wilayah) : null;
  const hitung = wl ? { dusun: wl.length, rw: wl.reduce((n, d) => n + d.rw.length, 0), rt: wl.reduce((n, d) => n + d.rw.reduce((m, r) => m + r.rt, 0), 0) } : {};
  ['penduduk', 'kk', 'laki', 'perempuan', 'dusun', 'rw', 'rt'].forEach(x => setText('st-' + x, fmt(s[x]) || (hitung[x] ? String(hitung[x]) : '')));
  ['luas', 'sawah', 'darat'].forEach(x => setText('st-' + x, s[x]));
  if (s.tahun_data) setText('st-tahun', `Data Pemerintah Desa Karang Bahagia, tahun ${s.tahun_data}.`);

  const dar = (cfg.darurat || {}).daftar;
  if (Array.isArray(dar) && dar.length && $('#darurat')) {
    $('#darurat').innerHTML = dar.map(d => `<a href="tel:${esc(String(d.nomor).replace(/[^\d+]/g, ''))}"><b>${esc(d.nomor)}</b><small>${esc(d.nama)}</small></a>`).join('');
  }
  const kd = cfg.kopdes || {};
  if ($('#kopdes')) {
    setText('kopdes-nama', kd.nama); setText('kopdes-ringkasan', kd.ringkasan); setText('kopdes-alamat', kd.alamat);
    if (kd.wa) document.querySelectorAll('[data-bind="kopdes-wa"]').forEach(a => {
      a.textContent = waLocal(kd.wa) + ' (WhatsApp)'; a.href = '#'; a.classList.remove('belum');
      a.dataset.wa = `Halo pengurus ${kd.nama || 'Koperasi Desa Merah Putih'}, saya ingin bertanya.`; a.dataset.waNo = waIntl(kd.wa);
    });
    const baris = (t) => String(t || '').split('\n').map(x => x.trim()).filter(Boolean);
    const unit = baris(kd.unit);
    if (unit.length) $('#kopdes-unit').innerHTML = unit.map(u => `<li>${esc(u)}</li>`).join('');
    const pengurus = baris(kd.pengurus).map(l => { const i = l.indexOf(':'); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : ['', l]; });
    if (pengurus.length) $('#kopdes-pengurus').innerHTML = pengurus.map(([j, n]) => `<dt>${esc(j || 'Pengurus')}</dt><dd>${esc(n)}</dd>`).join('');
  }
  const bd = cfg.bumdes || {};
  if ($('#bumdes') && (bd.nama || bd.url)) {
    setText('bumdes-nama', bd.nama); setText('bumdes-ringkasan', bd.ringkasan);
    const u = safeUrl(bd.url); if (u) $('#bumdes-link').href = u;
  }
  const peta = $('#peta');
  if (peta) {
    const mp = mapsInfo(k.maps_embed);
    // Link pendek (maps.app.goo.gl) tidak bisa disematkan: tampilkan peta hasil pencarian alamat kantor desa,
    // tombol tetap membuka titik dari link tersebut.
    if (!mp.embed && mp.link) {
      const cari = (k.alamat || '').trim() ? `${k.alamat}, Karang Bahagia, Bekasi` : 'Kantor Desa Karang Bahagia, Karangbahagia, Bekasi';
      mp.embed = `https://www.google.com/maps?q=${encodeURIComponent(cari)}&output=embed`;
    }
    if (mp.embed || mp.link) {
      peta.classList.toggle('has-map', !!mp.embed);
      peta.innerHTML = (mp.embed ? `<iframe src="${esc(mp.embed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Peta lokasi kantor desa"></iframe>` : '')
        + (mp.link ? `<a class="btn map-btn" href="${esc(mp.link)}" target="_blank" rel="noopener">Buka di Google Maps</a>` : '');
    }
  }
}

// Perbarui ringkasan dan data terstruktur halaman berita agar benar di hasil pencarian
// dan saat tautannya dibagikan ke WhatsApp atau Facebook.
const foto0 = (b) => safeUrl(b.foto_url) || '';
function metaSet(sel, isi) {
  const el = document.head.querySelector(sel);
  if (el && isi) el.setAttribute('content', isi);
}
function seoArtikel(b, foto) {
  const ringkasan = ringkas(b.isi, 160) || `Berita Desa Karang Bahagia: ${b.judul}`;
  metaSet('meta[name="description"]', ringkasan);
  metaSet('meta[property="og:title"]', b.judul);
  metaSet('meta[property="og:description"]', ringkasan);
  metaSet('meta[property="og:url"]', location.href);
  metaSet('meta[property="og:type"]', 'article');
  if (foto) metaSet('meta[property="og:image"]', foto);
  const kanon = document.head.querySelector('link[rel="canonical"]');
  if (kanon) kanon.href = location.href;
  const ld = document.createElement('script');
  ld.type = 'application/ld+json';
  ld.textContent = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'NewsArticle',
    headline: b.judul, datePublished: b.tanggal, dateModified: b.tanggal,
    inLanguage: 'id-ID', articleSection: b.kategori || undefined,
    image: foto || undefined, mainEntityOfPage: location.href,
    author: { '@type': 'GovernmentOrganization', name: 'Pemerintah Desa Karang Bahagia' },
    publisher: { '@type': 'GovernmentOrganization', name: 'Pemerintah Desa Karang Bahagia' },
  });
  document.head.appendChild(ld);
}

// ---------- per halaman ----------
async function beranda(sb) {
  const [b, a, ap] = await Promise.all([
    sb.from('berita').select('id,judul,isi,kategori,tanggal,foto_url').eq('terbit', true).order('tanggal', { ascending: false }).limit(4),
    sb.from('agenda').select('*').gte('tanggal', today()).order('tanggal').limit(4),
    sb.from('apbdes').select('*').order('tahun', { ascending: false }).limit(1),
  ]);
  if (b.data?.length) $('#berita-terbaru').innerHTML = b.data.map(kartuBerita).join('');
  const pgAktif = pengumumanCache.filter(masihBerlaku).slice(0, 3);
  // Papan pengumuman hanya berisi pengumuman dari menu Admin -> Pengumuman
  if (pgAktif.length && $('#papan-isi')) $('#papan-isi').innerHTML = pgAktif.map(itemPengumuman).join('');
  if (a.data) $('#agenda-dekat').innerHTML = a.data.length ? a.data.map(kartuAgenda).join('') : '<p class="empty">Belum ada agenda terdekat.</p>';
  const x = ap.data?.[0];
  if (x) {
    $('#apb-mini').innerHTML = `<p class="muted">APBDes tahun ${x.tahun}</p>
      <div class="apb-ringkas"><div><small>Pendapatan</small><b>${rupiah(totalOf(x.pendapatan))}</b></div>
      <div><small>Belanja</small><b>${rupiah(totalOf(x.belanja))}</b></div>
      <div><small>Pembiayaan</small><b>${rupiah(totalOf(x.pembiayaan))}</b></div></div>`;
  }
}

async function perangkat(sb) {
  const { data } = await sb.from('perangkat').select('*').order('urutan').order('dibuat');
  if (!data) return;
  // Kepala Dusun tampil di bagian Wilayah, bukan di bagan atas, supaya tidak dobel.
  const pemerintah = data.filter(p => p.kelompok === 'pemerintah' && !nomorDusun(p.jabatan));
  if ($('#perangkat') && pemerintah.length) $('#perangkat').innerHTML = baganPerangkat(pemerintah);
  if ($('#wilayah')) $('#wilayah').innerHTML = baganWilayah(data);
}

// ---------- wilayah: dusun, RW, RT (pohon: Dusun -> RW -> RT) ----------
let pengaturanCache = {};
const kosongNama = (p) => !p || /^[\s\-–—.]*$/.test(p.nama || '');
function baganWilayah(semua) {
  const struktur = strukturWilayah(pengaturanCache.wilayah);
  const kadus = semua.filter(p => p.kelompok === 'pemerintah' && nomorDusun(p.jabatan));
  const rtrw = semua.filter(p => p.lembaga === 'rt-rw' || (p.kelompok === 'lembaga' && nomorRtRw(p.jabatan)));
  const cariRw = (rw) => rtrw.find(p => { const n = nomorRtRw(p.jabatan); return n && n.rw === rw && !n.rt; });
  const cariRt = (rt, rw) => rtrw.find(p => { const n = nomorRtRw(p.jabatan); return n && n.rw === rw && n.rt === rt; });
  const nama = (p) => kosongNama(p) ? '<span class="ph-kosong">Belum diisi</span>' : esc(p.nama);
  const ava = (p, kelas = '') => { const f = safeUrl(p?.foto_url);
    return `<span class="wl-ava ${kelas}">${f ? `<img src="${esc(f)}" alt="" loading="lazy">` : kosongNama(p) ? SILUET : esc(inisial(p.nama))}</span>`; };
  const simpulRt = (rt, rw) => { const p = cariRt(rt, rw);
    return `<div class="ph-rt"><div class="ph-simpul ph-t">${ava(p, 'kecil')}<span class="ph-teks"><span class="ph-label">RT ${tiga(rt)}</span><span class="ph-nama">${nama(p)}</span></span></div></div>`; };
  const simpulRw = (w) => {
    // RT yang tercatat di data tapi melebihi jumlah RT di struktur tetap ditampilkan
    const ekstra = rtrw.map(p => nomorRtRw(p.jabatan)).filter(n => n && n.rw === w.no && n.rt > w.rt).map(n => n.rt);
    const daftar = [...new Set([...Array.from({ length: w.rt }, (_, i) => i + 1), ...ekstra])].sort((a, b) => a - b);
    return `<div class="ph-rw" id="rw-${tiga(w.no)}"><div class="ph-simpul ph-w"><span class="ph-label">RW ${tiga(w.no)}</span><span class="ph-baris">${ava(cariRw(w.no))}<span><span class="ph-nama">${nama(cariRw(w.no))}</span><small>Ketua RW</small></span></span></div>
      ${daftar.length ? `<div class="ph-cabang">${daftar.map(rt => simpulRt(rt, w.no)).join('')}</div>` : ''}</div>`;
  };
  const blok = struktur.map((d, i) => {
    const no = nomorDusun(d.nama) || i + 1;
    const kd = kadus.find(p => nomorDusun(p.jabatan) === no);
    const foto = safeUrl(kd?.foto_url);
    return `<div class="ph-dusun"><div class="ph-simpul ph-d"><span class="ph-label">${esc(d.nama || 'Dusun ' + romawi(no))}</span>
        <span class="wl-ava">${foto ? `<img src="${esc(foto)}" alt="" loading="lazy">` : kosongNama(kd) ? SILUET : esc(inisial(kd.nama))}</span>
        <span class="ph-nama">${nama(kd)}</span><small>${esc(jabatanKadus(no))}</small></div>
      ${d.rw.length ? `<div class="ph-cabang ph-koordinasi">${d.rw.map(simpulRw).join('')}</div>` : ''}</div>`;
  }).join('');
  const dipakai = new Set(struktur.flatMap(d => d.rw.map(r => r.no)));
  const rwSisa = [...new Set(rtrw.map(p => nomorRtRw(p.jabatan)?.rw).filter(n => n && !dipakai.has(n)))].sort((a, b) => a - b);
  const lain = rtrw.filter(p => !nomorRtRw(p.jabatan));
  return `<div class="pohon">${blok}
    ${rwSisa.length ? `<div class="ph-dusun"><div class="ph-simpul ph-d"><span class="ph-label">RW lainnya</span><small>Belum dimasukkan ke dusun</small></div>
      <div class="ph-cabang">${rwSisa.map(no => simpulRw({ no, rt: 0 })).join('')}</div></div>` : ''}</div>
    ${lain.length ? `<div class="team" style="margin-top:24px">${lain.map(kartuOrang).join('')}</div>` : ''}
    <p class="small muted" style="margin-top:14px">Garis putus-putus menandakan koordinasi: Kepala Dusun adalah perangkat desa, sedangkan RT dan RW adalah lembaga kemasyarakatan yang dipilih warga.</p>`;
}

// ---------- lembaga desa: daftar kartu dan halaman rincian (lembaga.html?l=kode) ----------
// Isi bawaan sama dengan data awal di supabase/schema.sql, dipakai bila database belum bisa dihubungi.
const LEMBAGA_BAWAAN = [
  {
  "kode": "bpd",
  "nama": "Badan Permusyawaratan Desa",
  "singkatan": "BPD",
  "ringkasan": "Wakil warga yang membahas peraturan desa bersama Kepala Desa, menampung aspirasi, dan mengawasi kinerja pemerintah desa.",
  "profil": "Badan Permusyawaratan Desa (BPD) adalah lembaga yang anggotanya merupakan wakil penduduk desa berdasarkan keterwakilan wilayah dan dipilih secara demokratis.\n\nFungsi BPD:\n- Membahas dan menyepakati rancangan peraturan desa bersama Kepala Desa\n- Menampung dan menyalurkan aspirasi masyarakat desa\n- Melakukan pengawasan kinerja Kepala Desa",
  "urutan": 1
  },
  {
  "kode": "pkk",
  "nama": "Tim Penggerak Pemberdayaan dan Kesejahteraan Keluarga",
  "singkatan": "TP PKK",
  "ringkasan": "Menggerakkan program kesejahteraan keluarga melalui kelompok kerja (Pokja) PKK.",
  "profil": "Tim Penggerak PKK desa adalah mitra pemerintah desa dalam memberdayakan keluarga. Kegiatannya dijalankan melalui kelompok kerja (Pokja).\n\nKelompok kerja:\n- Pokja I: penghayatan dan pengamalan Pancasila serta gotong royong\n- Pokja II: pendidikan, keterampilan, dan pengembangan kehidupan berkoperasi\n- Pokja III: pangan, sandang, serta perumahan dan tata laksana rumah tangga\n- Pokja IV: kesehatan, kelestarian lingkungan hidup, dan perencanaan sehat",
  "urutan": 2
  },
  {
  "kode": "lpm",
  "nama": "Lembaga Pemberdayaan Masyarakat",
  "singkatan": "LPM",
  "ringkasan": "Mitra pemerintah desa dalam menyusun rencana pembangunan dan menggerakkan swadaya gotong royong warga.",
  "profil": "Lembaga Pemberdayaan Masyarakat (LPM) membantu pemerintah desa dalam pembangunan dan pemberdayaan masyarakat.\n\nTugas LPM:\n- Menampung dan menyalurkan aspirasi warga dalam perencanaan pembangunan\n- Menggerakkan swadaya dan gotong royong masyarakat\n- Ikut melaksanakan dan mengawasi kegiatan pembangunan desa",
  "urutan": 3
  },
  {
  "kode": "karang-taruna",
  "nama": "Karang Taruna",
  "singkatan": "Karang Taruna",
  "ringkasan": "Organisasi kepemudaan desa untuk pengembangan generasi muda dan kesejahteraan sosial.",
  "profil": "Karang Taruna adalah organisasi sosial kemasyarakatan tempat pengembangan generasi muda desa, tumbuh atas dasar kesadaran dan tanggung jawab sosial dari, oleh, dan untuk masyarakat.\n\nKegiatan:\n- Pembinaan dan pengembangan generasi muda\n- Kegiatan sosial, olahraga, seni, dan budaya\n- Usaha ekonomi produktif pemuda",
  "urutan": 4
  },
  {
  "kode": "posyandu",
  "nama": "Pos Pelayanan Terpadu",
  "singkatan": "Posyandu",
  "ringkasan": "Layanan kesehatan dasar untuk ibu, bayi, balita, dan lansia yang dijalankan kader dari dan untuk warga.",
  "profil": "Posyandu adalah lembaga kemasyarakatan yang membantu pemerintah desa memberikan pelayanan dasar kepada warga, terutama di bidang kesehatan.\n\nLayanan:\n- Penimbangan dan pemantauan tumbuh kembang balita\n- Imunisasi dan kesehatan ibu hamil\n- Pemeriksaan kesehatan lansia\n- Penyuluhan gizi dan kesehatan keluarga",
  "urutan": 5
  },
  {
  "kode": "linmas",
  "nama": "Satuan Perlindungan Masyarakat",
  "singkatan": "Satlinmas",
  "ringkasan": "Membantu menjaga ketenteraman, ketertiban, dan penanganan bencana di lingkungan desa.",
  "profil": "Satuan Perlindungan Masyarakat (Satlinmas) desa beranggotakan warga yang dilatih untuk membantu menjaga ketenteraman dan ketertiban masyarakat.\n\nTugas:\n- Membantu pengamanan kegiatan masyarakat dan pemilihan umum\n- Membantu penanganan bencana dan keadaan darurat\n- Ikut menjaga keamanan dan ketertiban lingkungan",
  "urutan": 6
  },
  {
  "kode": "rt-rw",
  "nama": "Rukun Tetangga dan Rukun Warga",
  "singkatan": "RT/RW",
  "ringkasan": "Lembaga terdekat dengan warga: membantu pelayanan pemerintahan, pendataan, dan menjaga kerukunan lingkungan.",
  "profil": "Rukun Tetangga (RT) dan Rukun Warga (RW) adalah lembaga kemasyarakatan yang paling dekat dengan warga.\n\nTugas:\n- Membantu pelayanan pemerintahan, seperti surat pengantar\n- Membantu pendataan penduduk\n- Menjaga kerukunan, keamanan, dan kebersihan lingkungan\n- Menggerakkan gotong royong warga",
  "urutan": 7
  }
  ];
// Teks profil: paragraf dipisah baris kosong; baris yang diawali "- " menjadi daftar.
function teksProfil(t) {
  return String(t || '').split(/\n\s*\n/).map(b => b.trim()).filter(Boolean).map(b => {
    const baris = b.split('\n').map(x => x.trim()).filter(Boolean);
    const awal = [], daftar = [];
    baris.forEach(x => (x.startsWith('- ') ? daftar : (daftar.length ? daftar : awal)).push(x.replace(/^- /, '')));
    return (awal.length ? `<p>${awal.map(esc).join('<br>')}</p>` : '') + (daftar.length ? `<ul class="daftar-titik">${daftar.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
  }).join('');
}
const lencana = (l) => {
  const logo = safeUrl(l.foto_url);
  const s = l.singkatan || l.nama;
  // Singkatan huruf besar yang pendek (BPD, PKK, RT/RW) ditampilkan utuh; selain itu inisial.
  const caps = (s.match(/[A-Z][A-Z/]{1,4}/g) || []).sort((a, b) => b.length - a.length)[0];
  return `<span class="lencana">${logo ? `<img src="${esc(logo)}" alt="">` : esc(caps || inisial(s).slice(0, 3))}</span>`;
};
function pengurusLembaga(orang, kode) {
  return orang.filter(p => p.lembaga === kode || (kode === 'bpd' && !p.lembaga && p.kelompok === 'bpd')
    || (kode === 'rt-rw' && !p.lembaga && p.kelompok === 'lembaga' && nomorRtRw(p.jabatan)));
}
function tampilLembaga(daftar, orang, dariDb) {
  const kode = new URLSearchParams(location.search).get('l');
  const l = kode && daftar.find(x => x.kode === kode);
  const jejak = $('.kepala-hal .jejak'), h1 = $('.kepala-hal h1'), sub = $('.kepala-hal h1 + p');
  if (l) {
    const nama = l.singkatan && l.singkatan !== l.nama ? `${l.nama} (${l.singkatan})` : l.nama;
    document.title = `${l.singkatan || l.nama} – Lembaga Desa Karang Bahagia`;
    jejak.innerHTML = `<a href="index.html">Beranda</a> / <a href="profil.html">Profil</a> / <a href="lembaga.html">Lembaga Desa</a> / ${esc(l.singkatan || l.nama)}`;
    h1.textContent = nama; sub.textContent = l.ringkasan || '';
    const pengurus = pengurusLembaga(orang, l.kode);
    $('#isi-lembaga').innerHTML = `<a class="kembali" href="lembaga.html">Semua lembaga desa</a>
      <div class="lembaga-rinci">
        <div class="lembaga-profil">${lencana(l)}<h2>Profil</h2>${teksProfil(l.profil) || '<p class="empty">Profil lembaga belum diisi.</p>'}</div>
        <div class="lembaga-susunan"><h2>Susunan pengurus</h2>
          ${l.kode === 'rt-rw' && dariDb ? baganWilayah(orang) + '<p class="small" style="margin-top:8px"><a href="perangkat.html#wilayah">Lihat juga di halaman Perangkat Desa</a></p>'
            : pengurus.length ? organigram(pengurus) : `<p class="empty">${dariDb ? 'Susunan pengurus belum diisi.' : 'Memuat susunan pengurus…'}</p>`}</div>
      </div>`;
    return;
  }
  if (kode && dariDb) { $('#isi-lembaga').innerHTML = '<a class="kembali" href="lembaga.html">Semua lembaga desa</a><p class="empty">Lembaga ini tidak ditemukan.</p>'; return; }
  const lain = orang.filter(p => p.kelompok === 'lembaga' && !p.lembaga && !nomorRtRw(p.jabatan));
  $('#isi-lembaga').innerHTML = `<div class="lembaga-grid">${daftar.map(x => {
    const n = pengurusLembaga(orang, x.kode).length;
    return `<a class="lembaga-kartu" href="lembaga.html?l=${encodeURIComponent(x.kode)}">${lencana(x)}
      <span class="lk-isi"><b>${esc(x.singkatan || x.nama)}</b>${x.singkatan && x.singkatan !== x.nama ? `<small>${esc(x.nama)}</small>` : ''}
      <span class="lk-ring">${esc(x.ringkasan)}</span>
      <em>${n ? `${n} pengurus · ` : ''}Lihat profil dan susunan &rarr;</em></span></a>`;
  }).join('')}</div>
  ${lain.length ? `<h2 style="margin-top:40px">Pengurus lembaga lainnya</h2><div class="team">${lain.map(kartuOrang).join('')}</div>` : ''}`;
}
async function lembagaHal(sb) {
  const [l, p] = await Promise.all([
    sb.from('lembaga').select('*').order('urutan').order('nama'),
    sb.from('perangkat').select('*').order('urutan').order('dibuat'),
  ]);
  if (l.error && p.error) return;
  tampilLembaga(l.data?.length ? l.data : LEMBAGA_BAWAAN, p.data || [], true);
}
if (page === 'lembaga') tampilLembaga(LEMBAGA_BAWAAN, [], false);

async function layanan(sb) {
  const { data } = await sb.from('layanan').select('*').order('urutan').order('dibuat');
  if (!data?.length) return;
  $('#layanan-list').innerHTML = data.map(l => `<div class="card"><h3>${esc(l.nama)}</h3>
    <b class="small">Syarat:</b><ul>${String(l.syarat || '').split('\n').filter(s => s.trim()).map(s => `<li>${esc(s.trim())}</li>`).join('')}</ul>
    ${l.lama ? `<p class="ket">Lama proses: ${esc(l.lama)}</p>` : ''}${l.keterangan ? `<p class="ket">${esc(l.keterangan)}</p>` : ''}</div>`).join('');
}

let apbCache = [];
function gambarAPB(tahun) {
  const x = apbCache.find(a => a.tahun === tahun);
  document.querySelectorAll('#tahun-apb button').forEach(b => b.classList.toggle('on', +b.dataset.t === tahun));
  if (!x) return;
  const bagian = (judul, arr) => {
    const rows = Array.isArray(arr) ? arr : [];
    if (!rows.length) return '';
    const tot = totalOf(rows), max = Math.max(...rows.map(r => Number(r.nilai) || 0), 1);
    return `<div class="bagian-apb"><h3>${judul}</h3>
      <div class="bars">${rows.map(r => `<div class="bar-row"><span>${esc(r.uraian)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${((Number(r.nilai) || 0) / max * 100).toFixed(1)}%"></div></div>
        <span class="v">${rupiah(r.nilai)}</span></div>`).join('')}</div>
      <div class="table-scroll"><table class="tbl"><thead><tr><th>Uraian</th><th class="num">Jumlah</th></tr></thead><tbody>
        ${rows.map(r => `<tr><td>${esc(r.uraian)}</td><td class="num">${rupiah(r.nilai)}</td></tr>`).join('')}
        <tr class="total"><td>Total ${judul.toLowerCase()}</td><td class="num">${rupiah(tot)}</td></tr></tbody></table></div></div>`;
  };
  $('#apbdes').innerHTML = `${x.catatan ? `<p class="muted">${esc(x.catatan)}</p>` : ''}
    <div class="apb-ringkas"><div><small>Pendapatan</small><b>${rupiah(totalOf(x.pendapatan))}</b></div>
    <div><small>Belanja</small><b>${rupiah(totalOf(x.belanja))}</b></div>
    <div><small>Pembiayaan</small><b>${rupiah(totalOf(x.pembiayaan))}</b></div></div>
    ${bagian('Pendapatan', x.pendapatan)}${bagian('Belanja', x.belanja)}${bagian('Pembiayaan', x.pembiayaan)}`;
}

let dokCache = [];
function gambarDokumen(kat) {
  const list = dokCache.filter(d => kat === 'Semua' || d.kategori === kat);
  $('#dokumen').innerHTML = list.length ? list.map(d => `<div class="doc"><div><b>${esc(d.judul)}</b>
    <small>${esc(d.kategori)}${d.keterangan ? ', ' + esc(d.keterangan) : ''}</small></div>
    <a class="btn alt" href="${esc(safeUrl(d.file_url))}" target="_blank" rel="noopener">Unduh</a></div>`).join('') : '<p class="empty">Belum ada dokumen.</p>';
}

async function transparansi(sb) {
  const [ap, pb, dk] = await Promise.all([
    sb.from('apbdes').select('*').order('tahun', { ascending: false }),
    sb.from('pembangunan').select('*').order('tahun', { ascending: false }).order('dibuat', { ascending: false }),
    sb.from('dokumen').select('*').order('urutan').order('dibuat', { ascending: false }),
  ]);
  if (ap.data) {
    apbCache = ap.data;
    if (apbCache.length) {
      $('#tahun-apb').innerHTML = apbCache.map(a => `<button data-t="${a.tahun}">${a.tahun}</button>`).join('');
      $('#tahun-apb').onclick = e => { if (e.target.dataset.t) gambarAPB(+e.target.dataset.t); };
      gambarAPB(apbCache[0].tahun);
    } else $('#apbdes').innerHTML = '<p class="empty">Data APBDes belum diunggah.</p>';
  }
  if (pb.data) {
    $('#pembangunan').innerHTML = pb.data.length ? pb.data.map(p => {
      const foto = safeUrl(p.foto_url);
      return `<div class="card"><div class="foto">${foto ? `<img src="${esc(foto)}" alt="" loading="lazy">` : ''}</div>
        <div><h3>${esc(p.nama)}</h3><p class="small muted">${[p.lokasi, 'tahun ' + p.tahun, p.sumber_dana].filter(Boolean).map(esc).join(', ')}</p>
        ${Number(p.anggaran) ? `<p class="small"><b>${rupiah(p.anggaran)}</b></p>` : ''}
        <div class="progres"><i style="width:${Math.max(0, Math.min(100, p.progres))}%"></i></div><small class="muted">${p.progres >= 100 ? 'Selesai' : 'Berjalan ' + p.progres + '%'}</small>
        ${p.keterangan ? `<p class="small muted">${esc(p.keterangan)}</p>` : ''}</div></div>`;
    }).join('') : '<p class="empty">Belum ada data kegiatan pembangunan.</p>';
  }
  if (dk.data) {
    dokCache = dk.data;
    const kats = ['Semua', ...new Set(dokCache.map(d => d.kategori))];
    $('#filter-dok').innerHTML = kats.map((k, i) => `<button data-k="${esc(k)}" class="${i ? '' : 'on'}">${esc(k)}</button>`).join('');
    $('#filter-dok').onclick = e => {
      if (!e.target.dataset.k) return;
      document.querySelectorAll('#filter-dok button').forEach(b => b.classList.toggle('on', b === e.target));
      gambarDokumen(e.target.dataset.k);
    };
    gambarDokumen('Semua');
  }
}

async function berita(sb) {
  const id = new URLSearchParams(location.search).get('id');
  if (id) {
    const { data } = await sb.from('berita').select('*').eq('id', id).eq('terbit', true).maybeSingle();
    $('#daftar-berita').hidden = true;
    const box = $('#artikel');
    box.hidden = false;
    if (!data) { box.innerHTML = '<a class="kembali" href="berita.html">Kembali ke semua berita</a><p class="empty">Berita ini tidak ditemukan. Mungkin sudah dihapus atau alamatnya salah.</p>'; return; }
    document.title = `${data.judul} – Desa Karang Bahagia`;
    seoArtikel(data, foto0(data));
    const foto = safeUrl(data.foto_url);
    box.innerHTML = `<a class="kembali" href="berita.html">Kembali ke semua berita</a>
      <p class="kat">${esc(tanggalID(data.tanggal))}, ${esc(data.kategori || '')}</p>
      <h1>${esc(data.judul)}</h1>${foto ? `<img class="cover" src="${esc(foto)}" alt="">` : ''}${paragraf(data.isi)}
      <p class="bagikan"><a class="btn alt" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(data.judul + ' ' + location.href)}">Bagikan lewat WhatsApp</a>
      <button class="btn alt" type="button" id="salin-link">Salin tautan</button></p>`;
    $('#salin-link').onclick = async () => { try { await navigator.clipboard.writeText(location.href); window.toast('Tautan disalin'); } catch { window.toast('Salin alamat dari kolom alamat browser.'); } };
    return;
  }
  const [b, a] = await Promise.all([
    sb.from('berita').select('id,judul,isi,kategori,tanggal,foto_url').eq('terbit', true).order('tanggal', { ascending: false }).limit(60),
    sb.from('agenda').select('*').gte('tanggal', today()).order('tanggal').limit(20),
  ]);
  if (b.data) $('#semua-berita').innerHTML = b.data.length ? b.data.map(kartuBerita).join('') : '<p class="empty">Belum ada berita.</p>';
  if (a.data) $('#agenda-semua').innerHTML = a.data.length ? a.data.map(kartuAgenda).join('') : '<p class="empty">Belum ada agenda.</p>';
}

// Daftar toko dan usaha warga: nama, jenis, alamat, kontak, dengan pencarian dan filter jenis.
let umkmCache = [], umkmKat = 'Semua';
const normal = (t) => String(t || '').toLowerCase();
function gambarUMKM() {
  const q = normal($('#cari-umkm')?.value).trim();
  const list = umkmCache.filter(u => (umkmKat === 'Semua' || u.kategori === umkmKat)
    && (!q || [u.nama, u.alamat, u.deskripsi, u.kategori].some(x => normal(x).includes(q))));
  $('#jumlah-umkm').textContent = umkmCache.length ? `Menampilkan ${list.length} dari ${umkmCache.length} toko dan usaha.` : '';
  $('#umkm').innerHTML = list.length ? list.map(u => {
    const wa = u.wa ? waIntl(u.wa) : '';
    // Petunjuk arah: link Google Maps dari petugas; bila kosong, cari berdasarkan nama dan alamat toko.
    const arah = linkMaps(u.maps_url) || (u.alamat ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${u.nama}, ${u.alamat}, Karang Bahagia, Bekasi`)}` : '');
    const foto = safeUrl(u.foto_url);
    return `<article class="toko">
      ${foto ? `<img class="toko-foto" src="${esc(foto)}" alt="" loading="lazy">` : ''}
      <div class="toko-isi"><span class="kat">${esc(u.kategori)}</span><h3>${esc(u.nama)}</h3>
        ${u.alamat ? `<p class="toko-alamat">${esc(u.alamat)}</p>` : ''}
        ${u.deskripsi ? `<p class="small muted">${esc(u.deskripsi)}</p>` : ''}${u.harga ? `<p class="small"><b>${esc(u.harga)}</b></p>` : ''}</div>
      <div class="toko-aksi">${wa ? `<a class="btn" href="#" data-wa="Halo ${esc(u.nama)}, saya lihat di website Desa Karang Bahagia dan ingin bertanya." data-wa-no="${esc(wa)}">WhatsApp</a>` : ''}
        ${arah ? `<a class="btn alt" href="${esc(arah)}" target="_blank" rel="noopener">Petunjuk arah</a>` : ''}</div>
    </article>`;
  }).join('') : `<p class="empty">${umkmCache.length ? 'Tidak ada toko yang cocok dengan pencarian.' : 'Belum ada toko yang terdaftar.'}</p>`;
}
async function umkm(sb) {
  const { data } = await sb.from('umkm').select('*').eq('tampil', true).order('urutan').order('nama');
  if (!data) return;
  umkmCache = data;
  const kats = ['Semua', ...new Set(data.map(u => u.kategori))];
  $('#filter-umkm').innerHTML = kats.length > 2 ? kats.map((k, i) => `<button data-k="${esc(k)}" class="${i ? '' : 'on'}">${esc(k)}</button>`).join('') : '';
  $('#filter-umkm').onclick = e => {
    if (!e.target.dataset.k) return;
    umkmKat = e.target.dataset.k;
    document.querySelectorAll('#filter-umkm button').forEach(b => b.classList.toggle('on', b === e.target));
    gambarUMKM();
  };
  $('#cari-umkm').addEventListener('input', gambarUMKM);
  gambarUMKM();
}

function kartuLaporan(l, lengkap) {
  return `<div class="card"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
    <span class="kat">${esc(l.kategori)}, ${esc(tanggalWIB(l.dibuat))}${lengkap ? '' : ', tiket ' + esc(l.tiket)}</span>
    <span class="status-b st-${esc(l.status)}">${esc(l.status)}</span></div>
    ${l.isi ? `<p style="margin-top:6px">${esc(l.isi)}</p>` : ''}${l.lokasi ? `<p class="small muted">Lokasi: ${esc(l.lokasi)}</p>` : ''}
    ${l.tanggapan ? `<div class="tg"><b>Tanggapan desa:</b> ${esc(l.tanggapan)}</div>` : ''}</div>`;
}
async function lapor(sb) {
  $('#lapor-off')?.setAttribute('hidden', '');
  $('#f-lapor').hidden = false; $('#f-cek').hidden = false; $('#ck-hasil').innerHTML = '';
  $('#f-lapor').addEventListener('submit', async e => {
    e.preventDefault();
    if ($('#lp-web').value) return; // isian jebakan robot spam
    const btn = e.submitter; btn.disabled = true;
    $('#lp-err').textContent = '';
    const { data, error } = await sb.rpc('kirim_pengaduan', {
      p_nama: $('#lp-nama').value, p_kontak: $('#lp-kontak').value, p_kategori: $('#lp-kat').value,
      p_isi: $('#lp-isi').value, p_lokasi: $('#lp-lokasi').value,
    });
    btn.disabled = false;
    if (error) { $('#lp-err').textContent = 'Gagal mengirim: ' + pesanGalat(error); return; }
    $('#f-lapor').reset();
    $('#lp-hasil').innerHTML = `<div class="tiket">Laporan sudah kami terima. Catat atau foto nomor tiket ini untuk mengecek tindak lanjutnya:<b>${esc(data)}</b></div>`;
    $('#ck-tiket').value = data;
  });
  $('#f-cek').addEventListener('submit', async e => {
    e.preventDefault();
    const { data, error } = await sb.rpc('cek_pengaduan', { p_tiket: $('#ck-tiket').value });
    const r = data?.[0];
    $('#ck-hasil').innerHTML = error ? `<p class="err">${esc(pesanGalat(error))}</p>`
      : r ? kartuLaporan({ ...r, isi: '' }, true) + `<p class="small muted">Terakhir diperbarui ${esc(tanggalWIB(r.diperbarui))}</p>`
      : '<p class="err">Nomor tiket tidak ditemukan. Periksa penulisannya.</p>';
  });
  const { data, error } = await sb.rpc('laporan_publik');
  if (error) $('#laporan-publik').innerHTML = `<p class="err">Daftar laporan gagal dimuat. ${esc(pesanGalat(error))}</p>`;
  if (data) $('#laporan-publik').innerHTML = data.length ? data.map(l => kartuLaporan(l, false)).join('') : '<p class="empty">Belum ada laporan yang ditampilkan.</p>';
}

// ---------- pengumuman ----------
let pengumumanCache = [];
const masihBerlaku = (p) => !p.berlaku_sampai || p.berlaku_sampai >= today();
const lampiranPdf = (p) => /\.pdf($|\?)/i.test(p.file_nama || '') || /\.pdf($|\?)/i.test(p.file_url || '');
function pasangPita() {
  const p = pengumumanCache.find(x => x.penting && masihBerlaku(x));
  if (!p) return;
  $('#pengumuman-teks').innerHTML = `${esc(p.judul)} <a href="pengumuman.html?id=${encodeURIComponent(p.id)}">Baca selengkapnya</a>`;
  $('#pengumuman').hidden = false;
}
function itemPengumuman(p) {
  return `<li class="pg-item"><a href="pengumuman.html?id=${encodeURIComponent(p.id)}"><b>${esc(p.judul)}</b>
    <span>${esc(tanggalID(p.tanggal))}${safeUrl(p.file_url) ? ` · <span class="pg-lampir">📎 ${lampiranPdf(p) ? 'Surat (PDF)' : 'Lampiran foto'}</span>` : ''}</span></a></li>`;
}
function kartuPengumuman(p) {
  return `<article class="pg-kartu"><a href="pengumuman.html?id=${encodeURIComponent(p.id)}">
    <p class="meta"><time datetime="${esc(p.tanggal)}">${esc(tanggalID(p.tanggal))}</time>${p.penting ? ' · <span class="pg-penting">Penting</span>' : ''}${safeUrl(p.file_url) ? ` · 📎 ${lampiranPdf(p) ? 'Surat (PDF)' : 'Lampiran foto'}` : ''}</p>
    <h3>${esc(p.judul)}</h3>${p.isi ? `<p>${esc(ringkas(p.isi, 180))}</p>` : ''}</a></article>`;
}
function lampiranHtml(p) {
  const url = safeUrl(p.file_url);
  if (!url) return '';
  const nama = p.file_nama || (lampiranPdf(p) ? 'surat.pdf' : 'lampiran');
  if (lampiranPdf(p)) {
    return `<div class="lampiran"><h2>Lampiran surat</h2>
      <iframe class="pdf-view" src="${esc(url)}#view=FitH" title="Lampiran: ${esc(nama)}" loading="lazy"></iframe>
      <p class="small muted">Surat tidak tampil di atas? Sebagian HP tidak bisa menampilkan PDF langsung. Gunakan tombol di bawah.</p>
      <a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Buka / unduh surat (PDF)</a></div>`;
  }
  return `<div class="lampiran"><h2>Lampiran</h2><a href="${esc(url)}" target="_blank" rel="noopener"><img class="lampiran-foto" src="${esc(url)}" alt="Lampiran: ${esc(p.judul)}" loading="lazy"></a>
    <a class="btn alt" href="${esc(url)}" target="_blank" rel="noopener">Buka foto ukuran penuh</a></div>`;
}
function pengumumanHal() {
  const id = new URLSearchParams(location.search).get('id');
  const box = $('#isi-pengumuman');
  if (id) {
    const p = pengumumanCache.find(x => x.id === id);
    if (!p) { box.innerHTML = '<a class="kembali" href="pengumuman.html">Semua pengumuman</a><p class="empty">Pengumuman ini tidak ditemukan. Mungkin sudah dihapus atau alamatnya salah.</p>'; return; }
    document.title = `${p.judul} – Pengumuman Desa Karang Bahagia`;
    $('.kepala-hal .jejak').innerHTML = '<a href="index.html">Beranda</a> / <a href="pengumuman.html">Pengumuman</a>';
    $('.kepala-hal h1').textContent = p.judul;
    $('.kepala-hal h1 + p').textContent = `Diumumkan ${tanggalID(p.tanggal)}${p.berlaku_sampai ? `, berlaku sampai ${tanggalID(p.berlaku_sampai)}` : ''}.`;
    box.innerHTML = `<a class="kembali" href="pengumuman.html">Semua pengumuman</a>
      ${!masihBerlaku(p) ? '<p class="pg-arsip-tanda">Pengumuman ini sudah lewat masa berlakunya.</p>' : ''}
      <div class="pg-isi">${paragraf(p.isi) || ''}</div>${lampiranHtml(p)}`;
    return;
  }
  const aktif = pengumumanCache.filter(masihBerlaku), arsip = pengumumanCache.filter(p => !masihBerlaku(p));
  box.innerHTML = `<div class="pg-daftar">${aktif.length ? aktif.map(kartuPengumuman).join('') : '<p class="empty">Belum ada pengumuman yang berlaku saat ini.</p>'}</div>
    ${arsip.length ? `<details class="pg-arsip"><summary>Arsip pengumuman (${arsip.length})</summary><div class="pg-daftar">${arsip.map(kartuPengumuman).join('')}</div></details>` : ''}`;
}

// ---------- bila database tidak bisa dihubungi ----------
// Isi bawaan di HTML tetap tampil; bagian yang butuh database diberi penjelasan yang benar
// (bukan "database belum tersambung") dan tombol untuk memuat ulang.
function gagalMuat() {
  window.DESA_GAGAL = true;
  const ulang = '<button type="button" class="btn alt" data-muat-ulang style="margin-top:10px">Muat ulang halaman</button>';
  const off = $('#lapor-off');
  if (off) off.innerHTML = 'Formulir pengaduan gagal dimuat karena website tidak dapat terhubung ke server desa. '
    + 'Periksa koneksi internet lalu muat ulang halaman. Bisa juga menyampaikan laporan lewat '
    + '<a href="#" data-wa="Halo petugas Desa Karang Bahagia, saya ingin menyampaikan laporan:">WhatsApp kantor desa</a>.<br>' + ulang;
  const ck = $('#ck-hasil');
  if (ck) ck.innerHTML = '<p class="muted">Cek status belum bisa dipakai karena website tidak dapat terhubung ke server desa. '
    + 'Muat ulang halaman setelah koneksi internet normal.</p>';
  document.querySelectorAll('[data-muat-ulang]').forEach(b => b.addEventListener('click', () => location.reload()));
}

// ---------- jalankan ----------
(async () => {
  let sb;
  try { sb = await getClient(); } catch (e) { console.warn('Supabase gagal dimuat', e); gagalMuat(); return; }
  if (!sb) { // database belum dikonfigurasi di js/config.js
    const off = $('#lapor-off');
    if (off) off.innerHTML = 'Formulir pengaduan aktif setelah database website tersambung. Sementara itu, sampaikan laporan lewat '
      + '<a href="#" data-wa="Halo petugas Desa Karang Bahagia, saya ingin menyampaikan laporan:">WhatsApp kantor desa</a>.';
    if ($('#ck-hasil')) $('#ck-hasil').innerHTML = '';
    return;
  }
  try {
    const { data, error } = await sb.from('pengaturan').select('kunci,nilai');
    if (error) { console.warn('Gagal menghubungi database', error); gagalMuat(); return; }
    // pengumuman aktif: pita kuning (yang penting) dan papan/halaman pengumuman
    const pgm = await sb.from('pengumuman').select('id,judul,isi,tanggal,berlaku_sampai,file_url,file_nama,penting').order('tanggal', { ascending: false }).order('dibuat', { ascending: false });
    if (!pgm.error) { window.__PITA_BARU = true; pengumumanCache = pgm.data || []; pasangPita(); }
    if (data) { pengaturanCache = Object.fromEntries(data.map(r => [r.kunci, r.nilai || {}])); terapkanPengaturan(pengaturanCache); }
    const fn = { beranda, pengumuman: pengumumanHal, perangkat, lembaga: lembagaHal, layanan, transparansi, berita, umkm, lapor }[page];
    if (fn) await fn(sb);
  } catch (e) { console.warn('Gagal memuat data', e); }
})();
