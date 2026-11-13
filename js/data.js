// Mengisi halaman publik dengan data dari Supabase.
// Jika Supabase belum dikonfigurasi atau gagal dihubungi, isi bawaan di HTML tetap tampil.
import { getClient, tanggalWIB, esc, safeUrl, tanggalID, waIntl, waLocal, mapsInfo, ringkas, rupiah, paragraf, pesanGalat } from './sb.js';

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
function baganPerangkat(list) {
  const isi = TINGKAT.map(t => ({ ...t, orang: [] }));
  list.forEach(p => isi.find(t => t.cocok.test(String(p.jabatan || ''))).orang.push(p));
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

  if (pg.aktif && pg.teks) {
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
    $('#foto-beranda').hidden = false;
    $('#papan').hidden = true;
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
  ['penduduk', 'kk', 'laki', 'perempuan', 'dusun', 'rw', 'rt'].forEach(x => setText('st-' + x, fmt(s[x])));
  ['luas', 'sawah', 'darat'].forEach(x => setText('st-' + x, s[x]));
  if (s.tahun_data) setText('st-tahun', `Data Pemerintah Desa Karang Bahagia, tahun ${s.tahun_data}.`);

  const dar = (cfg.darurat || {}).daftar;
  if (Array.isArray(dar) && dar.length && $('#darurat')) {
    $('#darurat').innerHTML = dar.map(d => `<a href="tel:${esc(String(d.nomor).replace(/[^\d+]/g, ''))}"><b>${esc(d.nomor)}</b><small>${esc(d.nama)}</small></a>`).join('');
  }
  const bd = cfg.bumdes || {};
  if ($('#bumdes') && (bd.nama || bd.url)) {
    setText('bumdes-nama', bd.nama); setText('bumdes-ringkasan', bd.ringkasan);
    const u = safeUrl(bd.url); if (u) $('#bumdes-link').href = u;
  }
  const peta = $('#peta');
  if (peta) {
    const mp = mapsInfo(k.maps_embed);
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
    sb.from('berita').select('id,judul,isi,kategori,tanggal,foto_url').eq('terbit', true).order('tanggal', { ascending: false }).limit(3),
    sb.from('agenda').select('*').gte('tanggal', today()).order('tanggal').limit(4),
    sb.from('apbdes').select('*').order('tahun', { ascending: false }).limit(1),
  ]);
  if (b.data?.length) $('#berita-terbaru').innerHTML = b.data.map(kartuBerita).join('');
  if (a.data?.length && $('#papan-isi')) {
    $('#papan-isi').insertAdjacentHTML('beforeend', a.data.slice(0, 2).map(x => `<li><b>${esc(x.judul)}</b>${esc(tanggalID(x.tanggal))}${x.tempat ? ', ' + esc(x.tempat) : ''}</li>`).join(''));
  }
  if (a.data) $('#agenda-dekat').innerHTML = a.data.length ? a.data.map(kartuAgenda).join('') : '<p class="empty">Belum ada agenda terdekat.</p>';
  const x = ap.data?.[0];
  if (x) {
    $('#apb-mini').innerHTML = `<p class="muted">APBDes tahun ${x.tahun}</p>
      <div class="apb-ringkas"><div><small>Pendapatan</small><b>${rupiah(totalOf(x.pendapatan))}</b></div>
      <div><small>Belanja</small><b>${rupiah(totalOf(x.belanja))}</b></div>
      <div><small>Pembiayaan</small><b>${rupiah(totalOf(x.pembiayaan))}</b></div></div>`;
  }
}

async function profil(sb) {
  const { data } = await sb.from('perangkat').select('*').order('urutan').order('dibuat');
  if (!data) return;
  const grup = (k) => data.filter(p => p.kelompok === k);
  if (grup('pemerintah').length) $('#perangkat').innerHTML = baganPerangkat(grup('pemerintah'));
  $('#bpd').innerHTML = grup('bpd').length ? grup('bpd').map(kartuOrang).join('') : '<p class="empty">Data BPD menyusul.</p>';
  $('#lembaga').innerHTML = grup('lembaga').length ? grup('lembaga').map(kartuOrang).join('') : '<p class="empty">Data lembaga desa menyusul.</p>';
}

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

let umkmCache = [];
function gambarUMKM(kat) {
  const list = umkmCache.filter(u => kat === 'Semua' || u.kategori === kat);
  $('#umkm').innerHTML = list.length ? list.map(u => {
    const foto = safeUrl(u.foto_url);
    const wa = u.wa ? waIntl(u.wa) : '';
    return `<div class="card"><div class="foto">${foto ? `<img src="${esc(foto)}" alt="" loading="lazy">` : 'Belum ada foto'}</div>
      <div class="body"><span class="kat">${esc(u.kategori)}</span><h3>${esc(u.nama)}</h3><p>${esc(u.deskripsi)}</p>
      ${u.harga ? `<span class="harga">${esc(u.harga)}</span>` : ''}${u.alamat ? `<small class="muted">${esc(u.alamat)}</small>` : ''}
      ${wa ? `<a class="btn" href="#" data-wa="Halo ${esc(u.nama)}, saya lihat di website Desa Karang Bahagia dan ingin bertanya." data-wa-no="${esc(wa)}">Pesan via WhatsApp</a>` : ''}</div></div>`;
  }).join('') : '<p class="empty">Belum ada UMKM yang terdaftar.</p>';
}
async function ekonomi(sb) {
  const { data } = await sb.from('umkm').select('*').eq('tampil', true).order('urutan').order('dibuat');
  if (!data) return;
  umkmCache = data;
  const kats = ['Semua', ...new Set(data.map(u => u.kategori))];
  $('#filter-umkm').innerHTML = kats.length > 2 ? kats.map((k, i) => `<button data-k="${esc(k)}" class="${i ? '' : 'on'}">${esc(k)}</button>`).join('') : '';
  $('#filter-umkm').onclick = e => {
    if (!e.target.dataset.k) return;
    document.querySelectorAll('#filter-umkm button').forEach(b => b.classList.toggle('on', b === e.target));
    gambarUMKM(e.target.dataset.k);
  };
  gambarUMKM('Semua');
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
    if (data) terapkanPengaturan(Object.fromEntries(data.map(r => [r.kunci, r.nilai || {}])));
    const fn = { beranda, profil, layanan, transparansi, berita, ekonomi, lapor }[page];
    if (fn) await fn(sb);
  } catch (e) { console.warn('Gagal memuat data', e); }
})();
