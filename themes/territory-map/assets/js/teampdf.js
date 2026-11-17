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

  // a logo (SVG) as a PNG the PDF can hold; `crop` (in the logo file's own units) cuts out one piece, e.g. the round mark or the wordmark
  const logo = async (url, crop) => {
    const im = await image(url), nw = im.naturalWidth || 1400, nh = im.naturalHeight || 419, cr = crop || { x: 0, y: 0, w: nw, h: nh }, sc = crop ? 1.5 : Math.min(4, Math.max(1, 1000 / nw));
    const cv = document.createElement('canvas'); cv.width = Math.round(cr.w * sc); cv.height = Math.round(cr.h * sc);
    cv.getContext('2d').drawImage(im, -cr.x * sc, -cr.y * sc, nw * sc, nh * sc);
    return { data: cv.toDataURL('image/png'), w: cr.w, h: cr.h };
  };
  const MARK = { x: 46, y: 44, w: 332, h: 332 }, WORD = { x: 440, y: 90, w: 905, h: 282 };   // the SEPRO Scientific logo: round mark, then the wordmark
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
    const mark = root.dataset.hdrlogo ? await logo(root.dataset.hdrlogo, MARK).catch(() => null) : null;
    const word = root.dataset.hdrlogo ? await logo(root.dataset.hdrlogo, WORD).catch(() => null) : null;

    const doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const made = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const setF = (size, bold) => doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size);
    const footer = () => doc.setFont('courier', 'normal').setFontSize(12).setTextColor(SUB).text('Generated ' + made, M, PH - 22);
    const where = label === state || /, [A-Z]{2}$/.test(label) ? label : label + ', ' + state;   // a state alone is its name; "ZIP 46204" and a city get the state added
    // Header, like the map PDFs: round mark left, the title in line between the mark and the wordmark, wordmark right.
    const TOP = 150;   // where the first section starts (the place pill sits centred between the header and here)
    const pageHead = () => {
      const HT = 28, HH = 46, MID = HT + HH / 2; let tx = M, rx = PW - M;
      if (mark) { const mw = mark.w / mark.h * HH; doc.addImage(mark.data, 'PNG', M, HT, mw, HH); tx = M + mw + 16; }
      if (word) { const wh = 38, ww = word.w / word.h * wh; doc.addImage(word.data, 'PNG', PW - M - ww, MID - wh / 2, ww, wh); rx = PW - M - ww - 16; }
      const title = 'Your SEPRO Team'; let ts = 28; doc.setFont('helvetica', 'normal').setFontSize(ts);
      while (ts > 14 && doc.getTextWidth(title) > rx - tx) { ts -= 0.5; doc.setFontSize(ts); }
      doc.setTextColor(INK); const ty = MID + ts * 0.36; doc.text(title, tx, ty); doc.text(title, tx + ts * 0.012, ty);   // printed twice, a hair apart: a medium weight
      // the place, in a grey pill centred vertically in the space between the header and the first logo
      const PILL = 14, PH2 = 28, ptxt = clean(where); setF(PILL, false); const pw = doc.getTextWidth(ptxt) + 28, py = (HT + HH + TOP) / 2 - PH2 / 2;
      doc.setFillColor('#e4e6e0').roundedRect(M, py, pw, PH2, PH2 / 2, PH2 / 2, 'F');
      doc.setTextColor('#2b2d28'); doc.text(ptxt, M + 14, py + PH2 / 2, { baseline: 'middle' });
      footer();
    };

    // Four equal columns across the page: headshot | details | headshot | details, so two people sit side by side on each row.
    // Text is never smaller than 12 pt (names and job titles go up to 18 pt) unless the page would otherwise need a second page:
    // this PDF is ALWAYS one page, so it first shrinks the headshots, then the spacing and logos, and only as a last resort the whole layout.
    const BOTTOM = PH - 40, G = 10, COLW = (PW - 2 * M - 3 * G) / 4, HALF = 2 * COLW + G;
    const fit = (txt, bold, maxLines, hi, lo, w) => {   // the largest size (hi down to lo) that wraps within w in at most maxLines lines
      for (let f = hi; f >= lo; f -= 0.5) { setF(f, bold); const ls = doc.splitTextToSize(clean(txt), w); if (ls.length <= maxLines && ls.every(l => doc.getTextWidth(l) <= w + 0.5)) return { f, ls }; }
      setF(lo, bold); return { f: lo, ls: doc.splitTextToSize(clean(txt), w) };
    };
    const emailLines = (e, f, w) => {   // an email breaks only after the @ (never mid-word)
      setF(f, false); const t = clean(e); if (doc.getTextWidth(t) <= w) return [t];
      const i = t.indexOf('@'); return i > 0 ? [t.slice(0, i + 1), t.slice(i + 1)] : [t];
    };
    const detail = (x, w, k) => {   // everything for one person's details column, measured at scale k
      const p = x.p, FMIN = 12 * k, FMAX = 18 * k, LHF = 1.18, ops = []; let h = 0;
      const put = (lines, f, bold, col, extra = {}) => lines.forEach(l => { ops.push({ t: l, y: h, f, bold, col, ...extra }); h += f * LHF; });
      if (x.mapTitle) put(doc.splitTextToSize(clean(x.mapTitle).toUpperCase(), w), FMIN, true, INK);   // which map (when a section has more than one)
      put([clean(x.t.name).toUpperCase()], FMIN, false, SUB, { dot: x.t.color || SUB }); h += 3 * k;
      const nm = fit(p.name, true, 2, FMAX, FMIN, w); put(nm.ls, nm.f, true, INK); h += 2 * k;
      if (p.title) { const tt = fit(p.title, false, 3, 14 * k, FMIN, w); put(tt.ls, tt.f, false, SUB); h += 2 * k; }
      if (p.phone) put([clean(p.phone)], FMIN, false, INK, { link: 'tel:' + String(p.phone).replace(/[^0-9+]/g, '') });
      if (p.email) put(emailLines(p.email, FMIN, w), FMIN, false, INK, { link: 'mailto:' + p.email });
      return { ops, h, w };
    };
    const drawDetail = (d, x, y) => d.ops.forEach(o => {
      setF(o.f, o.bold); doc.setTextColor(o.col); const yy = y + o.y + o.f * 0.85;
      if (o.dot) { const r = o.f / 3; doc.setFillColor(o.dot).circle(x + r, yy - o.f * 0.33, r, 'F'); doc.text(o.t, x + 2 * r + 5, yy); }
      else if (o.link) doc.textWithLink(o.t, x, yy, { url: o.link }); else doc.text(o.t, x, yy);
    });
    const headshotAt = (p, tc, x, y, S) => {
      const shot = shots[p.name];
      if (shot) { doc.addImage(shot, 'JPEG', x, y, S, S); return; }
      const n = parseInt(tc.slice(1), 16), tint = v => Math.round(255 - (255 - v) * 0.16), hex = v => ('0' + v.toString(16)).slice(-2);   // no photo yet: initials in a tint of the region color
      doc.setFillColor('#' + hex(tint(n >> 16)) + hex(tint((n >> 8) & 255)) + hex(tint(n & 255))); doc.roundedRect(x, y, S, S, S * 0.12, S * 0.12, 'F');
      doc.setFont('helvetica', 'bold').setFontSize(S * 0.32).setTextColor(lum(tc) > 0.62 ? '#51544a' : tc);
      doc.text(initials(p.name), x + S / 2, y + S / 2, { align: 'center', baseline: 'middle' });
    };
    // Lay everything out top to bottom at headshot scale `hs` and overall scale `k`; returns the height used (and draws when asked).
    const flow = (hs, k, draw) => {
      const S = COLW * hs, GAPX = 12 * k, dw = HALF - S - GAPX; let y = TOP;
      sections.forEach((sec, si) => {
        const lg = logos[si], LH = 30 * k;
        if (draw) { if (lg) doc.addImage(lg.data, 'PNG', M, y, lg.w / lg.h * LH, LH); else { setF(16 * k, true).setTextColor(INK); doc.text(clean(sec.label || ''), M, y + 20 * k); } }
        y += LH + 6 * k; if (draw) doc.setDrawColor(LIGHT).setLineWidth(1).line(M, y, PW - M, y); y += 12 * k;
        const people = sec.maps.flatMap(m => m.people.map(x => ({ ...x, mapTitle: sec.many ? m.title : '' })));   // every person from this section's maps, two to a row
        for (let i = 0; i < people.length; i += 2) {
          const pair = people.slice(i, i + 2), ds = pair.map(x => detail(x, dw, k)), rh = Math.max(S, ...ds.map(d => d.h));
          if (draw) pair.forEach((x, j) => { const cx = M + j * (HALF + G); headshotAt(x.p, x.t.color || SUB, cx, y, S); drawDetail(ds[j], cx + S + GAPX, y + 1); });
          y += rh + 12 * k;
        }
        y += 30 * k;   // room between the Water, EutroPHIX and Land sections
      });
      return y;
    };
    // Headshots start at about 70% of a column (a wider details column); an email stays on ONE line whenever it can, so the headshots shrink a little more
    // (never below 50%) before an email is allowed to wrap after the @. Everything still has to fit on the one page.
    const emails = []; sections.forEach(s => s.maps.forEach(m => m.people.forEach(x => { if (x.p.email) emails.push(clean(x.p.email)); })));
    const oneLine = h => { setF(12, false); return emails.every(e => doc.getTextWidth(e) <= HALF - COLW * h - 12); };
    let hs = 0.72, k = 1;
    while (hs > 0.5 && flow(hs, k, false) > BOTTOM) hs -= 0.02;   // 1) smaller headshots if the page is too full (text stays 12 pt or more)
    while (hs > 0.5 && !oneLine(hs)) hs -= 0.02;   // 2) a little smaller still so every email fits on one line
    while (k > 0.3 && flow(hs, k, false) > BOTTOM) { k -= 0.02; hs = Math.min(hs, 0.5 * (k + 0.5)); }   // 3) last resort: shrink everything, so it is never a second page
    pageHead(); flow(hs, k, true);
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
