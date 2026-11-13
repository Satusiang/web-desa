// Header, menu, footer, dan tombol WhatsApp yang sama di semua halaman.
(function () {
  // Item ketiga (opsional) = sub-menu: tampil sebagai menu tarik-turun.
  const MENU = [
    ['profil.html', 'Profil', [
      ['sejarah.html', 'Sejarah Desa'],
      ['profil.html', 'Profil Desa'],
      ['perangkat.html', 'Perangkat Desa'],
      ['lembaga.html', 'Lembaga Desa'],
    ]],
    ['layanan.html', 'Layanan'],
    ['transparansi.html', 'Transparansi'],
    ['berita.html', 'Berita'],
    ['ekonomi.html', 'Ekonomi', [
      ['bumdes.html', 'BUMDes'],
      ['kdmp.html', 'KDMP (Koperasi Desa Merah Putih)'],
      ['umkm.html', 'UMKM'],
    ]],
    ['lapor.html', 'Lapor'],
    ['kontak.html', 'Kontak'],
  ];
  const page = document.body.dataset.page || '';
  const aktif = (h) => h.startsWith(page + '.');
  const panah = '<svg class="panah" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg>';
  function itemMenu([h, t, sub], i) {
    if (!sub) return `<li><a href="${h}" class="${aktif(h) ? 'active' : ''}"${aktif(h) ? ' aria-current="page"' : ''}>${t}</a></li>`;
    const id = 'sub-' + i, adaAktif = aktif(h) || sub.some(([sh]) => aktif(sh));
    return `<li class="ada-sub${i >= MENU.length / 2 ? ' ke-kiri' : ''}"><button type="button" class="sub-btn${adaAktif ? ' active' : ''}" aria-expanded="false" aria-controls="${id}">${t}${panah}</button>
      <ul class="sub" id="${id}">${sub.map(([sh, st]) => `<li><a href="${sh}" class="${aktif(sh) ? 'active' : ''}"${aktif(sh) ? ' aria-current="page"' : ''}>${st}</a></li>`).join('')}</ul></li>`;
  }

  const hdr = document.createElement('div');
  hdr.innerHTML = `
  <div class="pengumuman" id="pengumuman" hidden><div class="wrap"><b>Pengumuman:</b><span id="pengumuman-teks"></span></div></div>
  <header class="site">
    <div class="wrap nav">
      <a class="brand" href="index.html"><img src="assets/logo-bekasi.png" alt="Logo Kabupaten Bekasi">
        <span><b>Desa Karang Bahagia</b><small>Kabupaten Bekasi</small></span></a>
      <ul id="menu">${MENU.map(itemMenu).join('')}</ul>
      <button class="menu-btn" aria-controls="menu">Menu</button>
    </div>
  </header>`;
  document.body.prepend(...hdr.children);
  const mainEl = document.querySelector('main'); if (mainEl) mainEl.id = 'isi';
  const skip = document.createElement('a'); skip.href = '#isi'; skip.className = 'lompat'; skip.textContent = 'Langsung ke isi';
  document.body.prepend(skip);

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
        <li><a href="ekonomi.html">BUM Desa, Koperasi &amp; UMKM</a></li>
        <li><a href="kontak.html">Kontak &amp; nomor darurat</a></li>
        <li><a href="privasi.html">Kebijakan privasi</a></li>
        <li><a href="admin/">Masuk petugas</a></li></ul></div>
    </div>
    <div class="copy">© ${new Date().getFullYear()} Pemerintah Desa Karang Bahagia. Alamat website ini sementara sampai domain resmi .desa.id aktif.</div>
  </div>`;
  document.body.appendChild(ftr);

  const wa = document.createElement('a');
  wa.className = 'wa-float'; wa.href = '#'; wa.hidden = true; wa.id = 'wa-float';
  wa.setAttribute('aria-label', 'WhatsApp kantor desa');
  wa.dataset.wa = 'Halo Pemerintah Desa Karang Bahagia, saya ingin bertanya.';
  wa.innerHTML = '<span>Tanya petugas</span><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z"/></svg>';
  wa.prepend(wa.querySelector('svg'));
  document.body.appendChild(wa);

  const toast = document.createElement('div');
  toast.id = 'toast';
  document.body.appendChild(toast);
  window.toast = (msg) => {
    toast.textContent = msg; toast.style.display = 'block';
    clearTimeout(toast._h); toast._h = setTimeout(() => (toast.style.display = 'none'), 4000);
  };

  const mb = document.querySelector('.menu-btn');
  mb.setAttribute('aria-expanded', 'false');
  mb.addEventListener('click', () => { const o = document.getElementById('menu').classList.toggle('open'); mb.setAttribute('aria-expanded', String(o)); });

  // Sub-menu: buka/tutup dengan klik atau Enter; tutup dengan Esc atau klik di luar.
  const tutupSub = (kecuali) => document.querySelectorAll('.ada-sub.open').forEach(li => {
    if (li === kecuali) return;
    li.classList.remove('open'); li.querySelector('.sub-btn').setAttribute('aria-expanded', 'false');
  });
  document.querySelectorAll('.sub-btn').forEach(b => b.addEventListener('click', () => {
    const li = b.parentElement, buka = !li.classList.contains('open');
    tutupSub(li); li.classList.toggle('open', buka); b.setAttribute('aria-expanded', String(buka));
  }));
  document.addEventListener('click', e => { if (!e.target.closest('.ada-sub')) tutupSub(); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const li = document.querySelector('.ada-sub.open');
    if (li) { tutupSub(); li.querySelector('.sub-btn').focus(); }
  });

  // Elemen dengan data-wa="pesan" membuka WhatsApp kantor desa (nomor dari pengaturan admin)
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-wa]');
    if (!el) return;
    e.preventDefault();
    let simpanan = '';
    try { simpanan = localStorage.getItem('desa_wa') || ''; } catch { /* boleh gagal */ }
    // Nomor terakhir yang berhasil dimuat dipakai bila server desa sedang tidak bisa dihubungi.
    const nomor = el.dataset.waNo || window.WA_DESA || (window.DESA_GAGAL ? simpanan : '');
    if (!nomor) {
      window.toast(window.DESA_GAGAL
        ? 'Nomor WhatsApp kantor desa belum bisa dimuat. Periksa koneksi internet lalu muat ulang halaman.'
        : 'Nomor WhatsApp kantor desa belum diisi.');
      return;
    }
    const a = document.createElement('a');
    a.href = `https://wa.me/${nomor}?text=${encodeURIComponent(el.dataset.wa || '')}`;
    a.target = '_blank'; a.rel = 'noopener'; a.click();
  });
})();
