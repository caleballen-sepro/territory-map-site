/* Home page: "Generate PDF of My Team", next to Use my location once a team is showing. It makes a one-page PDF (US Letter, portrait) with
   the specialist for that place from every map, grouped like the home page: one SEPRO Water logo over the Water and Municipal & Industrial
   maps, one SEPRO Land logo over Turf & Landscape and Ornamental, and EutroPHIX on its own. This is the only PDF with headshots.
   Everything comes from the page itself (the search data, the section logos, the photo list), so no map page has to be loaded. */
(function () {
  const init = () => {
  const root = document.getElementById('myteam'), btn = document.getElementById('team-pdf');
  const dataEl = document.getElementById('search-data'); if (!root || !btn || !dataEl) return;
  const data = JSON.parse(dataEl.textContent), photos = data.photos || {};
  const INK = '#0e0906', SUB = '#51544a', LIGHT = '#dcdfd7', PW = 612, PH = 792, M = 40;
  const clean = s => String(s == null ? '' : s).replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E -ÿ]/g, '');
  const slug = t => String(t).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const initials = n => { const w = String(n).trim().split(/\s+/); return (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase(); };
  const lum = hex => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };

  let loading;
  const loadJsPdf = () => loading || (loading = new Promise((res, rej) => {
    if (window.jspdf) return res();
    const s = document.createElement('script'); s.src = root.dataset.jspdf; s.onload = res;
    s.onerror = () => rej(new Error('PDF library failed to load')); document.head.appendChild(s);
  }));
  const image = url => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('image failed to load')); im.src = url; });

  // a logo (SVG) as a PNG the PDF can hold; `w` x `h` are its natural proportions
  const logo = async url => {
    const im = await image(url), nw = im.naturalWidth || 1400, nh = im.naturalHeight || 419, sc = Math.min(4, Math.max(1, 1000 / nw));
    const cv = document.createElement('canvas'); cv.width = Math.round(nw * sc); cv.height = Math.round(nh * sc);
    cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
    return { data: cv.toDataURL('image/png'), w: nw, h: nh };
  };
  // a headshot: a rounded square, cropped like the site (object-fit: cover, a little above centre); null when the person has no photo yet
  const headshot = async name => {
    const f = photos[name]; if (!f) return null;
    try {
      const im = await image(data.peopleBase + f), S = 240, cv = document.createElement('canvas'); cv.width = cv.height = S;
      const g = cv.getContext('2d'), nw = im.naturalWidth, nh = im.naturalHeight, side = Math.min(nw, nh);
      const sx = (nw - side) / 2, sy = Math.max(0, Math.min(nh - side, (nh - side) * 0.22));
      g.fillStyle = '#fff'; g.fillRect(0, 0, S, S);
      g.beginPath(); g.roundRect ? g.roundRect(0, 0, S, S, S * 0.15) : g.rect(0, 0, S, S); g.clip();
      g.drawImage(im, sx, sy, side, side, 0, 0, S, S);
      return cv.toDataURL('image/jpeg', 0.86);
    } catch (e) { return null; }
  };

  // who covers a state, map by map: the territory's specialists; an open position shows the regional manager to contact instead
  const team = abbr => {
    const sp = window.TerritorySearch.specialists(abbr);   // who covers the place, map by map (search.js)
    const secs = [...document.querySelectorAll('.brand-section')].map(sec => {   // the home page's brand sections (logo, then that group's map cards)
      const img = sec.querySelector('img.bl-light'), links = [...sec.querySelectorAll('a.card')];
      const arts = links.map(a => (data.all.find(d => d.url === new URL(a.href, location.href).pathname) || {}).id);
      const maps = arts.map(id => ({ title: (data.all.find(d => d.id === id) || {}).nav || id, people: sp.filter(x => x.dv.id === id) })).filter(m => m.people.length);
      return { logo: img && img.src, label: (sec.querySelector('.brand-logo') || {}).textContent, many: arts.length > 1, maps };
    });
    return secs.filter(s => s.maps.length);
  };

  async function make(abbr, state, label) {
    const sections = team(abbr);
    if (!sections.length) throw new Error('no contacts cover ' + state);
    await loadJsPdf();
    // load every picture first (logos, headshots), so drawing is one quick pass
    const names = new Set(); sections.forEach(s => s.maps.forEach(m => m.people.forEach(x => names.add(x.p.name))));
    const shots = {}; await Promise.all([...names].map(async n => { shots[n] = await headshot(n); }));
    const logos = await Promise.all(sections.map(s => (s.logo ? logo(s.logo).catch(() => null) : null)));
    const brand = root.dataset.hdrlogo ? await logo(root.dataset.hdrlogo).catch(() => null) : null;

    const doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const made = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const setF = (size, bold) => doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size);
    const footer = () => doc.setFont('courier', 'normal').setFontSize(10).setTextColor(SUB).text('Generated ' + made, M, PH - 22);
    const where = label === state || /, [A-Z]{2}$/.test(label) ? label : label + ', ' + state;   // a state alone is its name; "ZIP 46204" and a city get the state added
    const pageHead = () => {
      if (brand) { const h = 30, w = brand.w / brand.h * h; doc.addImage(brand.data, 'PNG', M, 30, w, h); }
      setF(28, false).setTextColor(INK); doc.text('Your SEPRO Team', M, 112); doc.text('Your SEPRO Team', M + 0.35, 112);
      setF(13, false).setTextColor(SUB); doc.text(clean(where), M, 134);
      doc.setDrawColor(INK).setLineWidth(1).line(M, 150, PW - M, 150);
      footer();
    };
    pageHead();

    // One page, always: the cards sit in a grid, and the grid (columns, then a scale for everything in it) is chosen so all of them fit.
    const CH = 74, HS = 62, GAP = 14, COLG = 20, TOP = 176, AV = PH - 46 - TOP;
    const need = (cols, k) => sections.reduce((h, sec) => h + (34 + 8 + 16 + 14) * k + sec.maps.reduce((t, m) => t + (sec.many ? 26 * k : 0) + Math.ceil(m.people.length / cols) * (CH + GAP) * k, 0), 0);
    let cols = 2, k = 1, best = null;
    for (const c of [2, 3, 4]) {   // fewest columns that keep things readable (scale 0.72 or more); otherwise the largest scale found
      let f = 0; for (let t = 1; t >= 0.3; t -= 0.02) if (need(c, t) <= AV) { f = t; break; }
      if (f >= 0.72) { cols = c; k = f; best = null; break; }
      if (f && (!best || f > best.k)) best = { cols: c, k: f };
    }
    if (best) ({ cols, k } = best);
    if (need(cols, k) > AV) k = Math.max(0.25, k * AV / need(cols, k));   // safety net: shrink to fit
    const CW = (PW - 2 * M - (cols - 1) * COLG) / cols, hs = HS * k, fz = (n, min = 5.5) => Math.max(min, n * k);
    let y = TOP;
    sections.forEach((s, si) => {
      const lg = logos[si], LH = 34 * k;
      if (lg) { const w = lg.w / lg.h * LH; doc.addImage(lg.data, 'PNG', M, y, w, LH); } else { setF(fz(16), true).setTextColor(INK); doc.text(clean(s.label || ''), M, y + 22 * k); }
      y += LH + 8 * k; doc.setDrawColor(LIGHT).setLineWidth(1).line(M, y, PW - M, y); y += 16 * k;
      s.maps.forEach(m => {
        if (s.many) { doc.setFont('courier', 'bold').setFontSize(fz(9, 6)).setTextColor(SUB); doc.text(clean(m.title).toUpperCase(), M, y + 6 * k); y += 26 * k; }
        m.people.forEach((x, i) => {
          const cx = M + (i % cols) * (CW + COLG), cy = y + Math.floor(i / cols) * (CH + GAP) * k, p = x.p, shot = shots[p.name], tc = (x.t.color || SUB);
          if (shot) doc.addImage(shot, 'JPEG', cx, cy, hs, hs);
          else {   // no photo yet: initials in a tint of the region color
            const n = parseInt(tc.slice(1), 16), tint = v => Math.round(255 - (255 - v) * 0.16), hex = v => ('0' + v.toString(16)).slice(-2);
            doc.setFillColor('#' + hex(tint(n >> 16)) + hex(tint((n >> 8) & 255)) + hex(tint(n & 255)));
            doc.roundedRect(cx, cy, hs, hs, 9 * k, 9 * k, 'F');
            doc.setFont('helvetica', 'bold').setFontSize(fz(20, 9)).setTextColor(lum(tc) > 0.62 ? '#51544a' : tc);
            doc.text(initials(p.name), cx + hs / 2, cy + hs / 2, { align: 'center', baseline: 'middle' });
          }
          const tx = cx + hs + 12 * k, tw = CW - hs - 12 * k; let ty = cy + 8 * k;
          doc.setFillColor(tc).circle(tx + 3 * k, ty - 2.5 * k, 3 * k, 'F');
          setF(fz(8), true).setTextColor(SUB); doc.text(clean(x.t.name + (x.open ? ' (open)' : '')).toUpperCase(), tx + 11 * k, ty, { maxWidth: tw - 11 * k }); ty += 14 * k;
          setF(fz(12, 7), true).setTextColor(INK); doc.text(clean(p.name), tx, ty, { maxWidth: tw }); ty += 12 * k;
          setF(fz(9, 6), false).setTextColor(SUB); doc.splitTextToSize(clean(p.title || ''), tw).slice(0, 2).forEach(l => { doc.text(l, tx, ty); ty += 10.5 * k; });
          ty += k;
          setF(fz(10, 6.5), false).setTextColor(INK);
          if (p.phone) { doc.textWithLink(clean(p.phone), tx, ty, { url: 'tel:' + String(p.phone).replace(/[^0-9+]/g, '') }); ty += 12 * k; }
          if (p.email) { let f = fz(10, 6.5); setF(f, false); while (f > 4.5 && doc.getTextWidth(clean(p.email)) > tw) { f -= 0.25; doc.setFontSize(f); } doc.textWithLink(clean(p.email), tx, ty, { url: 'mailto:' + p.email }); }
        });
        y += Math.ceil(m.people.length / cols) * (CH + GAP) * k;
      });
      y += 14 * k;
    });
    doc.save('SEPRO-My-Team-' + slug(where) + '.pdf');
  }

  btn.addEventListener('click', async () => {
    const label = btn.textContent; btn.disabled = true; btn.textContent = 'Generating PDF…';
    try { await make(btn.dataset.abbr, btn.dataset.state, btn.dataset.label); }
    catch (err) { alert('Could not create the PDF: ' + err.message); }
    btn.textContent = label; btn.disabled = false;
  });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();   // the search data is written after the page content, so wait for the whole page
})();
