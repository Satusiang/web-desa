// Penghubung ke Supabase, dipakai halaman publik dan halaman admin.
// Pustaka Supabase disimpan di website sendiri (js/vendor/) dengan versi terkunci,
// jadi website tidak bergantung pada CDN luar. CDN hanya dipakai bila berkas lokal gagal dimuat.
// Untuk memperbarui: ganti berkas di js/vendor/ dan ubah SUPABASE_VERSI di bawah.
const SUPABASE_VERSI = '2.118.0';
const SUPABASE_LOKAL = new URL(`./vendor/supabase-${SUPABASE_VERSI}.js`, import.meta.url).href;
const SUPABASE_CDN = `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@${SUPABASE_VERSI}/dist/umd/supabase.js`;

let clientPromise = null;

export function isConfigured() {
  const c = window.DESA_CONFIG || {};
  return Boolean(window.__SB_MOCK || (c.supabaseUrl && c.supabaseAnonKey));
}

function muatSkrip(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => (window.supabase?.createClient ? resolve(window.supabase) : reject(new Error('Pustaka Supabase tidak lengkap')));
    s.onerror = () => { s.remove(); reject(new Error('Gagal memuat ' + src)); };
    document.head.appendChild(s);
  });
}

function muatPustaka() {
  if (window.supabase?.createClient) return Promise.resolve(window.supabase);
  return muatSkrip(SUPABASE_LOKAL).catch(() => muatSkrip(SUPABASE_CDN));
}

export function getClient() {
  if (window.__SB_MOCK) return Promise.resolve(window.__SB_MOCK); // untuk pengujian
  if (!isConfigured()) return Promise.resolve(null);
  if (!clientPromise) {
    const c = window.DESA_CONFIG;
    clientPromise = muatPustaka()
      .then(({ createClient }) => createClient(c.supabaseUrl, c.supabaseAnonKey))
      .catch(e => { clientPromise = null; throw e; }); // boleh dicoba lagi nanti
  }
  return clientPromise;
}

// Galat jaringan dari Supabase ("Failed to fetch") diganti kalimat yang dimengerti warga.
export function pesanGalat(error) {
  const m = String(error?.message || error || '');
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(m)) {
    return 'Tidak dapat terhubung ke server desa. Periksa koneksi internet, lalu coba lagi.';
  }
  return m || 'Terjadi kesalahan. Coba lagi beberapa saat lagi.';
}

// ---------- utilitas tampilan ----------
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// Hanya izinkan URL http(s) agar tidak bisa disusupi javascript:
export function safeUrl(u) {
  if (!u || typeof u !== 'string') return '';
  try {
    const url = new URL(u, location.href);
    return (url.protocol === 'https:' || url.protocol === 'http:') ? url.href : '';
  } catch { return ''; }
}

const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
// Tanggal dari timestamp (zona WIB), mis. kolom 'dibuat'
export function tanggalWIB(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d)) return tanggalID(ts);
  return d.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' });
}
export function tanggalID(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${d} ${BULAN[m - 1]} ${y}`;
}

// Nomor lokal 08xx -> 628xx untuk link WhatsApp
export function waIntl(n) {
  let d = String(n || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  return d;
}
export function waLocal(n) {
  let d = String(n || '').replace(/\D/g, '');
  if (d.startsWith('62')) d = '0' + d.slice(2);
  return d.replace(/^(\d{4})(\d{4})(\d+)$/, '$1-$2-$3');
}

// Baca isian peta dari admin: kode sematan, link Google Maps, koordinat, atau alamat.
// Hasil: { embed: URL iframe atau '', link: URL untuk tombol "Buka di Google Maps" atau '' }
export function mapsInfo(input) {
  const raw = String(input || '').trim();
  if (!raw) return { embed: '', link: '' };
  const q = (v) => `https://www.google.com/maps?q=${encodeURIComponent(v)}&output=embed`;
  const coord = /(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/;

  // 1) kode sematan <iframe src="...">
  const m = raw.match(/src=["']([^"']+)["']/);
  const text = m ? m[1].replace(/&amp;/g, '&') : raw;

  let u = null;
  try { u = new URL(text); } catch { /* bukan URL */ }

  if (!u) {
    // 2) koordinat "-6.2006, 107.2002" atau alamat biasa
    const c = text.match(coord);
    const target = c ? `${c[1]},${c[2]}` : text;
    return { embed: q(target), link: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target)}` };
  }
  if (u.protocol !== 'https:') return { embed: '', link: '' };
  const host = u.hostname;
  const isGoogle = /(^|\.)google\.[a-z.]+$/.test(host);

  // 3) sudah berupa URL sematan
  if (isGoogle && (u.pathname.startsWith('/maps/embed') || u.searchParams.get('output') === 'embed')) {
    return { embed: u.href, link: '' };
  }
  // 4) link Google Maps biasa: ambil koordinat / kata kunci
  if (isGoogle && u.pathname.startsWith('/maps')) {
    const d = u.href.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);        // titik tempat yang dipilih
    const at = u.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);       // tengah layar peta
    const place = u.pathname.match(/\/maps\/place\/([^/]+)/);
    const qq = u.searchParams.get('q') || u.searchParams.get('query');
    let target = '';
    if (d) target = `${d[1]},${d[2]}`;
    else if (qq) target = qq;
    else if (place) target = decodeURIComponent(place[1].replace(/\+/g, ' '));
    else if (at) target = `${at[1]},${at[2]}`;
    return { embed: target ? q(target) : '', link: u.href };
  }
  // 5) link pendek (maps.app.goo.gl / goo.gl/maps): tidak bisa disematkan, tampilkan tombol saja
  if (host === 'maps.app.goo.gl' || (host === 'goo.gl' && u.pathname.startsWith('/maps'))) {
    return { embed: '', link: u.href };
  }
  return { embed: '', link: '' };
}

export function ringkas(teks, n = 140) {
  const t = String(teks || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t;
}

// Format rupiah: 1500000 -> "Rp 1.500.000"
export function rupiah(n) {
  const v = Number(n);
  if (!isFinite(v)) return '';
  return 'Rp ' + Math.round(v).toLocaleString('id-ID');
}

// Ubah teks admin "Uraian: 1.500.000" (satu per baris) menjadi [{uraian, nilai}]
export function parseBaris(teks) {
  return String(teks || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const i = l.lastIndexOf(':');
    if (i < 0) return { uraian: l, nilai: 0 };
    const angka = l.slice(i + 1).replace(/[^0-9,-]/g, '').replace(',', '.');
    return { uraian: l.slice(0, i).trim(), nilai: Number(angka) || 0 };
  });
}
export function barisKeTeks(arr) {
  return (Array.isArray(arr) ? arr : []).map(b => `${b.uraian}: ${Number(b.nilai || 0).toLocaleString('id-ID')}`).join('\n');
}
export function paragraf(teks) {
  return String(teks || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
}
