// Header, menu, footer, dan tombol WhatsApp yang sama di semua halaman.
(function () {
  const MENU = [
    ['profil.html', 'Profil'],
    ['layanan.html', 'Layanan'],
    ['transparansi.html', 'Transparansi'],
    ['berita.html', 'Berita'],
    ['ekonomi.html', 'Ekonomi'],
    ['lapor.html', 'Lapor'],
    ['kontak.html', 'Kontak'],
  ];
  const page = document.body.dataset.page || '';

  const hdr = document.createElement('div');
  hdr.innerHTML = `
  <div class="pengumuman" id="pengumuman" hidden><div class="wrap"><span>📢</span><span id="pengumuman-teks"></span></div></div>
  <header class="site">
    <div class="wrap nav">
      <a class="brand" href="index.html"><img src="assets/logo-bekasi.png" alt="Logo Kabupaten Bekasi">
        <span><b>Desa Karang Bahagia</b><small>Kec. Karang Bahagia · Kab. Bekasi</small></span></a>
      <ul id="menu">${MENU.map(([h, t]) => `<li><a href="${h}" class="${h.startsWith(page + '.') ? 'active' : ''}">${t}</a></li>`).join('')}</ul>
      <button class="menu-btn" aria-label="Menu">☰</button>
    </div>
  </header>`;
  document.body.prepend(...hdr.children);

  const ftr = document.createElement('footer');
  ftr.className = 'site';
  ftr.innerHTML = `<div class="wrap">
    <div class="cols">
      <div><h4>Pemerintah Desa Karang Bahagia</h4>
        <p>Kecamatan Karang Bahagia, Kabupaten Bekasi, Jawa Barat</p>
        <p data-bind="alamat"></p>
        <p data-bind="jam"></p></div>
      <div><h4>Layanan</h4><ul>
        <li><a href="layanan.html">Panduan layanan surat</a></li>
        <li><a href="lapor.html">Pengaduan &amp; cek status</a></li>
        <li><a href="transparansi.html">APBDes &amp; dokumen publik</a></li></ul></div>
      <div><h4>Tautan</h4><ul>
        <li><a href="ekonomi.html">BUM Desa &amp; UMKM</a></li>
        <li><a href="kontak.html">Kontak &amp; nomor darurat</a></li>
        <li><a href="admin/">Masuk petugas</a></li></ul></div>
    </div>
    <div class="copy">© ${new Date().getFullYear()} Pemerintah Desa Karang Bahagia. Website sementara, domain resmi .desa.id menyusul.</div>
  </div>`;
  document.body.appendChild(ftr);

  const wa = document.createElement('a');
  wa.className = 'wa-float'; wa.href = '#'; wa.hidden = true; wa.id = 'wa-float';
  wa.setAttribute('aria-label', 'WhatsApp kantor desa');
  wa.dataset.wa = 'Halo Pemerintah Desa Karang Bahagia, saya ingin bertanya.';
  wa.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z"/></svg>';
  document.body.appendChild(wa);

  const toast = document.createElement('div');
  toast.id = 'toast';
  document.body.appendChild(toast);
  window.toast = (msg) => {
    toast.textContent = msg; toast.style.display = 'block';
    clearTimeout(toast._h); toast._h = setTimeout(() => (toast.style.display = 'none'), 4000);
  };

  document.querySelector('.menu-btn').addEventListener('click', () => document.getElementById('menu').classList.toggle('open'));

  // Elemen dengan data-wa="pesan" membuka WhatsApp kantor desa (nomor dari pengaturan admin)
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-wa]');
    if (!el) return;
    e.preventDefault();
    const nomor = el.dataset.waNo || window.WA_DESA;
    if (!nomor) { window.toast('Nomor WhatsApp kantor desa belum diisi.'); return; }
    const a = document.createElement('a');
    a.href = `https://wa.me/${nomor}?text=${encodeURIComponent(el.dataset.wa || '')}`;
    a.target = '_blank'; a.rel = 'noopener'; a.click();
  });
})();
