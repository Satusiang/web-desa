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

// ---------- wilayah: dusun, RW, RT (dipakai halaman publik dan admin) ----------
const ROMAWI = { i: 1, v: 5, x: 10, l: 50 };
export function angkaRomawi(s) {
  s = String(s).toLowerCase();
  if (/^\d+$/.test(s)) return Number(s);
  let n = 0;
  for (let i = 0; i < s.length; i++) { const a = ROMAWI[s[i]] || 0, b = ROMAWI[s[i + 1]] || 0; n += a < b ? -a : a; }
  return n;
}
export function romawi(n) {
  const t = [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = ''; for (const [v, r] of t) while (n >= v) { s += r; n -= v; }
  return s || String(n);
}
export const tiga = (n) => String(n).padStart(3, '0');
// "Kepala Dusun I", "Kadus 2" -> nomor dusun; selain itu 0
export function nomorDusun(t) {
  const m = String(t || '').match(/(?:dusun|kadus)\s*\.?\s*([ivxl]+|\d+)\b/i);
  return m ? angkaRomawi(m[1]) : 0;
}
// "Ketua RT 001/RW 002", "KETUA RT.001/002", "Ketua RT 1 RW 2" -> {rt:1, rw:2}; "Ketua RW 002" -> {rw:2}
export function nomorRtRw(t) {
  const s = String(t || '');
  const a = s.match(/\bRT\s*\.?\s*0*(\d+)\s*\/\s*(?:RW\s*\.?\s*)?0*(\d+)/i) || s.match(/\bRT\s*\.?\s*0*(\d+)\b.*?\bRW\s*\.?\s*0*(\d+)/i);
  if (a) return { rt: Number(a[1]), rw: Number(a[2]) };
  const w = s.match(/\bRW\s*\.?\s*0*(\d+)/i);
  return w ? { rw: Number(w[1]) } : null;
}
export const jabatanKadus = (no) => `Kepala Dusun ${romawi(no)}`;
export const jabatanRw = (rw) => `Ketua RW ${tiga(rw)}`;
export const jabatanRt = (rt, rw) => `Ketua RT ${tiga(rt)}/RW ${tiga(rw)}`;
// Struktur wilayah dari pengaturan: [{nama, rw:[{no, rt:jumlahRT}]}].
// Mendukung format lama (teks "Dusun I: 001, 002"); bila kosong pakai contoh bawaan.
export const WILAYAH_BAWAAN = [
  { nama: 'Dusun I', rw: [{ no: 1, rt: 3 }, { no: 2, rt: 3 }] },
  { nama: 'Dusun II', rw: [{ no: 3, rt: 3 }] },
  { nama: 'Dusun III', rw: [{ no: 4, rt: 3 }] },
];
export function strukturWilayah(w) {
  if (w && Array.isArray(w.struktur) && w.struktur.length) {
    return w.struktur.map(d => ({ nama: String(d.nama || ''), rw: (d.rw || []).map(r => ({ no: Number(r.no) || 0, rt: Math.max(0, Number(r.rt) || 0) })).filter(r => r.no) }));
  }
  if (w && w.teks) {
    return w.teks.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const i = l.indexOf(':');
      return { nama: (i > 0 ? l.slice(0, i) : l).trim(), rw: (i > 0 ? (l.slice(i + 1).match(/\d+/g) || []) : []).map(n => ({ no: Number(n), rt: 3 })) };
    });
  }
  return JSON.parse(JSON.stringify(WILAYAH_BAWAAN));
}
