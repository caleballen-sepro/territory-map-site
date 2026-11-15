/* Downloadable US Letter (8.5 x 11 in, portrait) PDF of the current division map, built in the browser.
   - The map is the same size and position on every division's PDF.
   - Below it: contacts (name, job title, phone, email) with a color bullet per region. Where territories have a regional manager, the manager heads a column and the specialists they oversee are listed beneath. Then the national team.
   - Text is as large as fits, up to `maxFontSize` (12pt). jsPDF is loaded on first click. */
(function () {
  const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  let loading;
  const load = url => loading || (loading = new Promise((res, rej) => {
    if (window.jspdf) return res();
    const s = document.createElement('script');
    s.src = url || JSPDF_CDN; s.onload = res; s.onerror = () => rej(new Error('PDF library failed to load'));
    document.head.appendChild(s);
  }));
  const clean = s => String(s == null ? '' : s).replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"').replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '');
  const lum = hex => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };

  const loadLogo = url => new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => {
      try {
        const nw = im.naturalWidth || 300, nh = im.naturalHeight || 100;
        const sc = Math.min(4, Math.max(1, 1000 / nw));
        const cv = document.createElement('canvas');
        cv.width = Math.round(nw * sc); cv.height = Math.round(nh * sc);
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        res({ data: cv.toDataURL('image/png'), w: nw, h: nh });
      } catch (e) { rej(e); }
    };
    im.onerror = () => rej(new Error('logo failed to load'));
    im.src = url;
  });

  window.TerritoryPDF = async function (c) {
    await load(c.data.jspdfURL);
    const logo = c.data.logo ? await loadLogo(c.data.logo).catch(() => null) : null;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });   // 612 x 792 pt = 8.5 x 11 in
    const PW = 612, PH = 792, M = 24;
    const FMAX = Math.min(12, Number(c.data.pdfMax) || 12);
    const INK = '#0e0906', SUB = '#51544a', MUTED = '#51544a', LIGHT = '#dcdfd7';   // brand: black, dark grey, light grey
    const territories = c.data.territories || [];

    // ---- Fixed frame: identical on every PDF ----
    const MAPW = Math.min(PW - 2 * M, Math.max(300, Number(c.data.pdfMapW) || PW - 2 * M)), MAPX = (PW - MAPW) / 2, MAPY = 76, MAPH = MAPW * 610 / 975;   // same size and spot on every PDF
    const areaTop = MAPY + MAPH + 12, areaBottom = PH - 40, areaH = areaBottom - areaTop;
    const fullW = PW - 2 * M;

    // ---- Header: title left, logo right; revised date in the footer ----
    doc.setFont('helvetica', 'normal').setFontSize(24).setTextColor(INK).text(clean(c.data.title), M, 46);
    doc.setFillColor(c.data.brandColor || '#51544a').rect(M, 70, PW - 2 * M, 2, 'F');   // water blue / land green rule, like the line under each page title
    if (logo) {
      const r = Math.min(170 / logo.w, 38 / logo.h), dw = logo.w * r, dh = logo.h * r;
      doc.addImage(logo.data, 'PNG', PW - M - dw, 28, dw, dh);
    }
    const made = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });   // the day the PDF was created
    doc.setFont('courier', 'normal').setFontSize(7.5).setTextColor(MUTED).text('Generated ' + made, M, PH - 18);
    if (c.data.revised) doc.setFont('courier', 'normal').setFontSize(7.5).setTextColor(MUTED).text('Revised ' + clean(c.data.revised), PW - M, PH - 18, { align: 'right' });   // mono, like the site's detail copy

    // ---- Map (vector) ----
    const rings = d => {
      const out = []; let cur = null;
      d3.geoPath(null, { moveTo(x, y) { cur = [[x, y]]; out.push(cur); }, lineTo(x, y) { if (cur) cur.push([x, y]); },
        closePath() {}, arc() {}, rect() {}, bezierCurveTo() {}, quadraticCurveTo() {} })(d);
      return out;
    };
    const s = MAPW / 975;
    doc.setDrawColor('#ffffff').setLineWidth(1);
    c.features.forEach(d => {
      const t = c.byAbbr[c.abbr(d)];
      doc.setFillColor(t ? t.color : LIGHT);
      rings(d).forEach(r => {
        const pts = [r[0]];
        for (let i = 1; i < r.length; i++) { const p = pts[pts.length - 1]; if (Math.hypot(r[i][0] - p[0], r[i][1] - p[1]) >= 0.8) pts.push(r[i]); }
        if (pts.length < 3) return;
        const segs = [];
        for (let i = 1; i < pts.length; i++) segs.push([(pts[i][0] - pts[i - 1][0]) * s, (pts[i][1] - pts[i - 1][1]) * s]);
        doc.lines(segs, MAPX + pts[0][0] * s, MAPY + pts[0][1] * s, [1, 1], 'FD', true);
      });
    });
    const fs = Math.max(7, 14 * s), outside = [];
    doc.setFont('helvetica', 'bold');
    c.features.forEach(d => {
      const a = c.abbr(d); if (!a) return;
      const [cx, cy] = (c.lblPos && c.lblPos[a]) || c.path.centroid(d);
      if (c.OUTSIDE.includes(a)) { outside.push({ a, cx, cy }); return; }
      const t = c.byAbbr[a];
      doc.setFontSize(fs).setTextColor(!t || lum(t.color) > 0.62 ? '#0e0906' : '#ffffff');
      doc.text(a, MAPX + cx * s, MAPY + cy * s, { align: 'center', baseline: 'middle' });
    });
    outside.sort((p, q) => p.cy - q.cy);
    let lastY = 0;
    outside.forEach(o => {
      const y = Math.max(o.cy, lastY + 16); lastY = y;
      doc.setDrawColor('#51544a').setLineWidth(0.5).line(MAPX + o.cx * s, MAPY + o.cy * s, MAPX + 936 * s, MAPY + y * s);
      doc.setFontSize(fs).setTextColor(INK).text(o.a, MAPX + 942 * s, MAPY + y * s, { baseline: 'middle' });
    });

    // ---- Contact text ----
    const LH = 1.25;
    const setF = (size, bold) => doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size);
    const wrap = (txt, size, bold, w) => { setF(size, bold); return doc.splitTextToSize(clean(txt), w); };
    const width = (txt, size, bold) => { setF(size, bold); return doc.getTextWidth(clean(txt)); };
    // One person: name (bold), job title, phone, email. Phone and email share a line only if they fit.
    const personStack = (p, f, w) => {
      const ops = []; let y = 0;
      const add = (txt, b, col) => { if (txt) wrap(txt, f, b, w).forEach(l => { ops.push({ t: l, y, size: f, b, c: col }); y += f * LH; }); };
      add(p.name, true, INK); add(p.title, false, SUB);
      add(p.phone, false, INK); add(p.email, false, INK);   // name, title, phone and email each on their own line
      return { ops, h: y };
    };
    const drawStack = (st, x, y) => st.ops.forEach(o => { setF(o.size, o.b); doc.setTextColor(o.c).text(o.t, x, y + o.y + o.size * 0.9); });
    const anchorX = t => { const ps = (t.states || []).map(a => c.lblPos && c.lblPos[a]).filter(Boolean); return ps.length ? ps.reduce((a, p) => a + p[0], 0) / ps.length : 0; };
    const sum = (arr, g) => arr.reduce((t, b) => t + b.h, 0) + Math.max(0, arr.length - 1) * g;

    // National team (no color bullet)
    const secs = [];
    if ((c.data.national || []).length) secs.push({ title: c.data.nationalTitle || 'National Team', people: c.data.national });

    const cols = 3, gx = 16, colW = (fullW - (cols - 1) * gx) / cols, PG = 9, IG = 22, HG = 10, PAD = 7, SG = 18, BUL = 1.1;

    // Group territories by the manager(s) they report to. Territories without a manager just flow west to east.
    const sorted = [...territories].sort((a, b) => anchorX(a) - anchorX(b));
    const groups = [], byKey = new Map(), loose = [];
    sorted.forEach(t => {
      const ms = t.managers || [];
      if (ms.length) {
        const k = ms.map(m => m.name).join('|'); let g = byKey.get(k);
        if (!g) { g = { managers: ms, terrs: [], members: [] }; byKey.set(k, g); groups.push(g); }
        g.terrs.push(t); (t.contacts || []).forEach(p => g.members.push({ t, p }));
      } else (t.contacts || []).forEach(p => loose.push({ t, p }));
    });
    const grouped = groups.length > 0;
    if (grouped && loose.length) groups.push({ managers: [], terrs: [], members: loose.splice(0) });

    // Items. Each has H(pg) = height, and draw(x, y, pg).
    const personItem = (it, f) => {
      const d = f * BUL, ind = d + 7, st = personStack(it.p, f, colW - ind);
      return { H: () => st.h, draw: (x, y) => {
        doc.setFillColor(it.t.color).circle(x + d / 2, y + f * 0.6, d / 2, 'F');   // color bullet beside the name
        drawStack(st, x + ind, y);
      } };
    };
    const groupItem = (g, f) => {
      const mem = g.members.map(it => personItem(it, f));
      const hs = g.managers.map(m => personStack(m, f, colW - 2 * PAD));
      const r = f * 0.4;
      const hdrH = g.managers.length ? 2 * PAD + hs.reduce((t, x) => t + x.h + 6, 0) + 2 * r : 0;
      const body = pg => mem.reduce((t, m) => t + m.H(pg), 0) + Math.max(0, mem.length - 1) * pg;
      return {
        H: pg => (hdrH ? hdrH + HG : 0) + body(pg),
        draw: (x, y, pg) => {
          if (hdrH) {
            doc.setFillColor('#edefe9').setDrawColor(LIGHT).setLineWidth(0.5).roundedRect(x, y, colW, hdrH, 4, 4, 'FD');
            let yy = y + PAD;
            g.managers.forEach((m, i) => { drawStack(hs[i], x + PAD, yy); yy += hs[i].h + 6; });
            g.terrs.forEach((t, i) => doc.setFillColor(t.color).circle(x + PAD + r + i * (2 * r + 5), yy + r, r, 'F'));   // one dot per region they cover
            y += hdrH + HG;
          }
          mem.forEach(m => { m.draw(x, y, pg); y += m.H(pg) + pg; });
        } };
    };
    const colH = (arr, gap, pg) => arr.reduce((t, i) => t + i.H(pg), 0) + Math.max(0, arr.length - 1) * gap;
    const split = (items, gap) => {   // cut the ordered list into 3 columns, minimizing the tallest (fill left columns first)
      const n = items.length; let best = { v: Infinity, i: 0, j: 0 };
      for (let i = 0; i <= n; i++) for (let j = i; j <= n; j++) {
        const v = Math.max(colH(items.slice(0, i), gap, PG), colH(items.slice(i, j), gap, PG), colH(items.slice(j), gap, PG))
          + ((i === 0 ? 3 : 0) + (j === i ? 2 : 0) + (j === n ? 1 : 0)) * 1e-3;
        if (v < best.v) best = { v, i, j };
      }
      return best;
    };
    const mkSections = f => {
      const blocks = []; let h = 0;
      secs.forEach((sec, si) => {
        if (si > 0) h += 10;
        blocks.push({ title: sec.title, y: h }); h += f * LH + 8;
        for (let j = 0; j < sec.people.length; j += cols) {
          const row = sec.people.slice(j, j + cols).map(p => personStack(p, f, colW));
          const rh = Math.max(...row.map(r => r.h));
          blocks.push({ row, y: h }); h += rh + PG;
        }
        h -= PG;
      });
      return { h, f, blocks };
    };
    const baseGap = grouped ? IG : PG;
    const build = f => {
      const items = grouped ? groups.map(g => groupItem(g, f)) : loose.map(it => personItem(it, f));
      const sp = split(items, baseGap), S = mkSections(f);
      return { f, items, sp, S, need: sp.v + (S.h ? SG + S.h : 0) };
    };

    // Largest text size (up to 12pt) that fits below the map.
    let plan = null, last = null;
    for (let f = FMAX; f >= 6 && !plan; f -= 0.5) { last = build(f); if (last.need <= areaH) plan = last; }
    plan = plan || last;
    const columns = [plan.items.slice(0, plan.sp.i), plan.items.slice(plan.sp.i, plan.sp.j), plan.items.slice(plan.sp.j)];

    // Spread leftover vertical space evenly.
    const tallest = e => Math.max(...columns.map(g => colH(g, baseGap + e, PG + e)));
    let extra = 24;
    while (extra > 0 && tallest(extra) + (plan.S.h ? SG + plan.S.h : 0) > areaH) extra -= 0.5;
    const pg = PG + extra, gap = baseGap + extra;
    const used = tallest(extra) + (plan.S.h ? SG + plan.S.h : 0);
    const y0 = areaTop + Math.min(10, Math.max(0, (areaH - used) / 2));

    columns.forEach((g, n) => {
      let y = y0; const x = M + n * (colW + gx);
      g.forEach(it => { it.draw(x, y, pg); y += it.H(pg) + gap; });
    });
    if (plan.S.h) {
      const sy = y0 + tallest(extra) + SG;
      plan.S.blocks.forEach(b => {
        if (b.title) {
          setF(plan.f, false); doc.setTextColor(INK).text(clean(b.title), M, sy + b.y + plan.f * 0.9);
          doc.setDrawColor(c.data.brandColor || LIGHT).setLineWidth(1).line(M, sy + b.y + plan.f * LH + 1, M + fullW, sy + b.y + plan.f * LH + 1);
        } else b.row.forEach((st, n) => drawStack(st, M + n * (colW + gx), sy + b.y));
      });
    }

    doc.save(clean(c.data.title).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-Territory-Map.pdf');
  };
})();
