(async function () {
  const data = JSON.parse(document.getElementById('map-data').textContent);
  const mapEl = document.getElementById('map');
  const panel = document.getElementById('panel');
  const legend = document.getElementById('legend');
  const territories = data.territories || [];
  const OUTSIDE = mapEl.dataset.outside ? mapEl.dataset.outside.split(',').filter(Boolean) : [];

  const byAbbr = {};
  territories.forEach(t => (t.states || []).forEach(s => (byAbbr[s.toUpperCase()] = t)));
  const byId = Object.fromEntries(territories.map(t => [t.id, t]));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  let pinned = null, hovered = null, searchSet = null;
  let deskOn = false, deskLayer = null;   // Desktop Mode (see below)   // searchSet: territories on this map matching the search

  const abbr = d => (data.states[String(d.id).padStart(2, '0')] || {}).abbr;
  const stateName = d => (data.states[String(d.id).padStart(2, '0')] || {}).name || '';
  const tid = d => (byAbbr[abbr(d)] || {}).id || null;

  let us;
  try { us = await d3.json(mapEl.dataset.src); }
  catch (e) { mapEl.textContent = 'Map data failed to load.'; return; }

  const svg = d3.select(mapEl).append('svg').attr('viewBox', '0 0 975 610').attr('role', 'group')
    .attr('aria-label', 'Map of US sales territories. Tab to the map, use the arrow keys to move between states, and Enter to keep a territory selected. The same information is in the list of territories and in the text list.');
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const path = d3.geoPath();
  const features = topojson.feature(us, us.objects.states).features;

  const toggle = id => { if (!id) return; pinned = pinned === id ? null : id; hovered = id; render(); };
  const statesSel = svg.append('g').selectAll('path').data(features).join('path')
    .attr('d', path)
    .attr('class', d => 'state' + (byAbbr[abbr(d)] ? '' : ' unassigned'))
    .attr('data-t', d => tid(d))
    .style('--c', d => (byAbbr[abbr(d)] || {}).color || null)
    .on('mouseenter', (e, d) => { hovered = tid(d); render(); })
    .on('mouseleave', () => { hovered = null; render(); })
    .on('click', (e, d) => { e.stopPropagation(); toggle(tid(d)); });
  statesSel.append('title').text(d => stateName(d));

  // Keyboard: one tab stop for the map; arrow keys move between states (grouped by territory), Enter or Space pins.
  const kb = statesSel.filter(d => !!tid(d)).nodes();
  const tIdx = id => territories.findIndex(t => t.id === id);
  const nameOf = el => stateName(d3.select(el).datum());
  kb.sort((a, b) => tIdx(a.dataset.t) - tIdx(b.dataset.t) || nameOf(a).localeCompare(nameOf(b)));
  const ring = svg.append('path').attr('class', 'focus-ring').attr('d', null);   // keyboard focus outline, drawn above neighbors
  kb.forEach((el, i) => {
    const d = d3.select(el).datum(), t = byId[tid(d)];
    d3.select(el).attr('role', 'button').attr('tabindex', i === 0 ? 0 : -1).attr('aria-pressed', 'false')
      .attr('aria-label', `${stateName(d)}, ${t.name}${t.group ? ' (' + t.group + ')' : ''}`);
    el.addEventListener('focus', () => {
      kb.forEach(k => k.setAttribute('tabindex', k === el ? '0' : '-1'));
      ring.attr('d', el.matches(':focus-visible') ? path(d) : null);
      hovered = tid(d); render();
    });
    el.addEventListener('blur', () => { ring.attr('d', null); hovered = null; render(); });
    el.addEventListener('keydown', e => {
      const move = n => { e.preventDefault(); const nx = kb[(i + n + kb.length) % kb.length]; nx.focus(); };
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(tid(d)); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') move(1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') move(-1);
      else if (e.key === 'Home') { e.preventDefault(); kb[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); kb[kb.length - 1].focus(); }
    });
  });

  svg.append('path').attr('class', 'borders')
    .attr('d', path(topojson.mesh(us, us.objects.states, (a, b) => a !== b)));

  // ---- State abbreviations ----
  // Each label sits at the state's "visual center" (the point farthest from every border in its
  // biggest piece), which is more accurate than the geometric centroid for states like MI, FL, LA.
  const labelPoint = d => {
    const all = []; let cur = null;
    d3.geoPath(null, { moveTo(x, y) { cur = [[x, y]]; all.push(cur); }, lineTo(x, y) { if (cur) cur.push([x, y]); },
      closePath() {}, arc() {}, rect() {}, bezierCurveTo() {}, quadraticCurveTo() {} })(d);
    const area = r => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };
    const ring = all.reduce((m, r) => (area(r) > area(m) ? r : m), all[0]);
    const pts = [ring[0]];
    for (let i = 1; i < ring.length; i++) { const p = pts[pts.length - 1]; if (Math.hypot(ring[i][0] - p[0], ring[i][1] - p[1]) >= 1.5) pts.push(ring[i]); }
    if (pts.length < 3) return path.centroid(d);
    const n = pts.length;
    const dist = (x, y) => {   // signed distance to the outline: positive inside
      let inside = false, min = Infinity;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const [x1, y1] = pts[j], [x2, y2] = pts[i];
        if ((y1 > y) !== (y2 > y) && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) inside = !inside;
        const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy;
        let t = l ? ((x - x1) * dx + (y - y1) * dy) / l : 0; t = Math.max(0, Math.min(1, t));
        const px = x1 + t * dx - x, py = y1 + t * dy - y, dd = px * px + py * py;
        if (dd < min) min = dd;
      }
      return (inside ? 1 : -1) * Math.sqrt(min);
    };
    const [gx, gy] = d3.polygonCentroid(pts);
    // Prefer the deepest point, nudged slightly toward the centroid so long thin shapes center along their length.
    const score = (x, y) => { const v = dist(x, y); return v <= 0 ? -1e9 + v : v - 0.08 * Math.hypot(x - gx, y - gy); };
    let x0 = d3.min(pts, p => p[0]), x1 = d3.max(pts, p => p[0]), y0 = d3.min(pts, p => p[1]), y1 = d3.max(pts, p => p[1]);
    let step = Math.max(x1 - x0, y1 - y0) / 20, best = { x: gx, y: gy, v: score(gx, gy) };
    for (let it = 0; it < 5; it++) {
      for (let x = x0; x <= x1; x += step) for (let y = y0; y <= y1; y += step) { const v = score(x, y); if (v > best.v) best = { x, y, v }; }
      x0 = best.x - step; x1 = best.x + step; y0 = best.y - step; y1 = best.y + step; step /= 4;
    }
    return [best.x, best.y];
  };
  const lblPos = {};
  features.forEach(d => { const a = abbr(d); if (a) lblPos[a] = labelPoint(d); });

  // Text color: "auto" picks whichever of the dark/light colors has more contrast against the state's fill.
  const cs = getComputedStyle(mapEl);
  const cssv = (n, d) => cs.getPropertyValue(n).trim() || d;
  const FORCED = cssv('--lbl-color', 'auto'), DARK = cssv('--lbl-dark', '#111827'), LIGHT = cssv('--lbl-light', '#ffffff');
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const relLum = c => { const k = d3.color(c); return 0.2126 * lin(k.r) + 0.7152 * lin(k.g) + 0.0722 * lin(k.b); };
  const ratio = (a, b) => { const x = relLum(a), y = relLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const textFor = fill => (FORCED !== 'auto' ? FORCED : ratio(fill, LIGHT) >= ratio(fill, DARK) ? LIGHT : DARK);

  // The list of small states labeled offshore (with a leader line) comes from hugo.toml.
  const labelG = svg.append('g').attr('class', 'labels');
  const outside = [];
  features.forEach(d => {
    const a = abbr(d); if (!a) return;
    const [cx, cy] = lblPos[a];
    if (OUTSIDE.includes(a)) { outside.push({ a, cx, cy }); return; }
    const t = byAbbr[a];
    const txt = labelG.append('text').attr('class', 'lbl' + (t ? '' : ' na')).attr('data-t', t ? t.id : null).attr('x', cx).attr('y', cy).attr('dy', '0.35em').text(a);
    if (t) txt.style('fill', textFor(t.color));
    else if (FORCED !== 'auto') txt.style('fill', FORCED);
  });
  outside.sort((p, q) => p.cy - q.cy);
  let lastY = 0; const offY = [];   // offY: rows of the offshore labels (RI, CT, NJ...), kept clear in Desktop Mode
  outside.forEach(o => {
    const y = Math.max(o.cy, lastY + 16); lastY = y; offY.push(y);
    const ot = (byAbbr[o.a] || {}).id || null;   // offshore labels (NJ, NH, MA, VT...) join the highlight/dim too
    labelG.append('line').attr('class', 'leader').attr('data-t', ot).attr('x1', o.cx).attr('y1', o.cy).attr('x2', 936).attr('y2', y);
    labelG.append('text').attr('class', 'lbl out').attr('data-t', ot).attr('x', 942).attr('y', y).attr('dy', '0.35em').text(o.a);
  });

  // Legend: regions (groups) with their territories beneath; a flat list when no groups are defined
  const groups = [], gById = {};
  territories.forEach(t => {
    if (!t.group) return;
    const k = 'g:' + t.group;
    if (!gById[k]) { gById[k] = { id: k, name: t.group, terrs: [] }; groups.push(gById[k]); }
    gById[k].terrs.push(t);
  });
  // Pills are filled with the territory's color (text picks dark or light for contrast); a stroke appears only when selected.
  const pillText = c => (ratio(c, LIGHT) >= ratio(c, DARK) ? LIGHT : DARK);
  const pill = t => `<button type="button" class="lg-pill" data-id="${esc(t.id)}" style="--c:${esc(t.color)};--tc:${esc(pillText(t.color))}">${esc(t.name)}</button>`;
  const addLi = (html, cls) => { const li = document.createElement('li'); if (cls) li.className = cls; li.innerHTML = html; legend.appendChild(li); };
  groups.forEach(g => addLi(
    `<div class="lg-group"><button type="button" class="lg-head" data-id="${esc(g.id)}"><span class="dots">${g.terrs.map(t => `<i style="background:${esc(t.color)}"></i>`).join('')}</span>${esc(g.name)}</button>` +
    `<div class="lg-pills">${g.terrs.map(pill).join('')}</div></div>`, 'lg-li'));
  territories.filter(t => !t.group).forEach(t => addLi(pill(t)));

  legend.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    pinned = pinned === b.dataset.id ? null : b.dataset.id; render();
  });
  legend.addEventListener('mouseover', e => { const b = e.target.closest('button'); if (b) { hovered = b.dataset.id; render(); } });
  legend.addEventListener('mouseleave', () => { hovered = null; render(); });
  document.addEventListener('click', e => { if (!e.target.closest('.panel, .legend, .site-header')) { pinned = null; render(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { pinned = null; render(); } });

  // Open positions show who to contact instead: the territory's regional manager, or a name found in the open position's title.
  const isOpen = p => !!p.open || /^\s*open\b/i.test(p.name || '');
  const coverFor = (p, t) => {
    if (!isOpen(p)) return [];
    if (t && (t.managers || []).length) return t.managers;
    const pool = [].concat(data.national || [], ...territories.map(x => x.managers || []));
    const txt = String(p.title || '').toLowerCase();
    return pool.filter((x, i, a) => x.name && txt.includes(String(x.name).toLowerCase()) && a.findIndex(y => y.name === x.name) === i);
  };
  const vcard = p => [p.name, p.title, p.phone, p.email].filter(Boolean).join('\n');
  const COPY = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const copyBtn = text => `<button type="button" class="copy-btn" data-copy="${esc(text)}" aria-label="Copy contact details">${COPY}<span class="cb-t">Copy</span></button>`;
  const links = c => `${c.phone ? `<a href="tel:${esc(String(c.phone).replace(/[^\d+]/g, ''))}">${esc(c.phone)}</a><br>` : ''}${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}`;
  const person = (c, t) => {
    const cover = coverFor(c, t);
    if (cover.length) return `
    <div class="contact open">
      <strong>${esc(c.name)}</strong>
      ${cover.map(m => `<span>Contact ${esc(m.name)}${m.title ? ', ' + esc(m.title) : ''}</span>${links(m)}`).join('<br>')}
      ${copyBtn(cover.map(vcard).join('\n\n'))}
    </div>`;
    return `
    <div class="contact">
      <strong>${esc(c.name)}</strong>
      ${c.title ? `<span>${esc(c.title)}</span>` : ''}
      ${links(c)}
      ${c.phone || c.email ? copyBtn(vcard(c)) : ''}
    </div>`;
  };
  const pinLine = () => `<p class="pin">${pinned ? '📌 Pinned. Click again or press Esc to release.' : 'Click to pin'}</p>`;

  function render() {
    const id = pinned || hovered;   // pinned wins, so moving the mouse doesn't lose the card
    const t = byId[id], g = gById[id];
    const set = g ? new Set(g.terrs.map(x => x.id)) : t ? new Set([id]) : searchSet;   // a region highlights all its territories
    mapEl.classList.toggle('has-focus', !!set && !deskOn);   // Desktop Mode: the other regions stay at full color
    svg.selectAll('.state').classed('on', function () { return !!set && set.has(this.dataset.t); });
    svg.selectAll('.lbl[data-t], .leader[data-t]').classed('on', function () { return !!set && set.has(this.dataset.t); });
    const pset = pinned ? (gById[pinned] ? new Set(gById[pinned].terrs.map(x => x.id)) : byId[pinned] ? new Set([pinned]) : null) : null;
    kb.forEach(el => el.setAttribute('aria-pressed', String(!!pset && pset.has(el.dataset.t))));
    if (deskLayer) deskLayer.querySelectorAll('.desk-card').forEach(el => el.classList.toggle('on', !!set && set.has(el.dataset.id)));
    legend.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === pinned)));

    if (!g && !t) {
      panel.style.removeProperty('--c');
      panel.innerHTML = searchSet
        ? '<p class="hint">Regions matching your search are highlighted. Hover or click one for details.</p>'
        : '<p class="hint">Hover over a region to see who covers it. Click a region to keep its details on screen.</p>';
      return;
    }
    if (g) {   // region card: every territory in it with its specialists (managers are listed at the bottom of the page)
      panel.style.setProperty('--c', g.terrs[0].color);
      panel.innerHTML = `
        <p class="eyebrow">Region</p>
        <h2>${esc(g.name)}</h2>
        ${pinLine()}
        ${g.terrs.map(x => `<p class="terr"><i style="background:${esc(x.color)}"></i>${esc(x.name)}</p>${(x.contacts || []).map(c => person(c, x)).join('')}`).join('')}`;
      return;
    }
    panel.style.setProperty('--c', t.color);
    panel.innerHTML = `
      ${t.group ? `<p class="eyebrow">${esc(t.group)}</p>` : ''}
      <h2>${esc(t.name)}</h2>
      ${pinLine()}
      ${(t.contacts || []).map(c => person(c, t)).join('')}
      <p class="states">${esc([...new Set((t.states || []).map(a => String(a).toUpperCase()))].sort().join(', '))}</p>`;
  }
  render();

  // Used by the menu search (search.js): pin a territory / region, or highlight a set of territories.
  window.TerritoryMap = {
    pin(id) { if (byId[id] || gById[id]) { pinned = id; hovered = null; render(); mapEl.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'nearest' }); } },
    highlight(ids) { searchSet = ids && ids.size ? ids : null; render(); }
  };

  // Links like  /divisions/water/#t=florida  open with that territory (or "g:West Region") pinned
  const deep = /^#t=(.+)$/.exec(location.hash);
  if (deep) { const id = decodeURIComponent(deep[1]); if (byId[id] || gById[id]) { pinned = id; render(); } }

  // ---- Desktop Mode (button next to Download PDF) ----
  // A bigger map with every territory's contacts in a glass card placed over its general region, so the whole team is visible at once.
  const deskBtn = document.getElementById('desk-btn');
  const SVGW = 975;
  const stArea = {}; features.forEach(d => { const a = abbr(d); if (a) stArea[a] = path.area(d); });
  const anchorFor = t => {   // area-weighted middle of the territory's states (Alaska and Hawaii are tucked in the corner, so they only count when alone)
    const ab = [...new Set((t.states || []).map(x => String(x).toUpperCase()))].filter(a => lblPos[a]);
    let use = ab.filter(a => a !== 'AK' && a !== 'HI'); if (!use.length) use = ab;
    let sx = 0, sy = 0, sw = 0; use.forEach(a => { const w = stArea[a] || 1; sx += lblPos[a][0] * w; sy += lblPos[a][1] * w; sw += w; });
    return sw ? [sx / sw, sy / sw] : null;
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  // Placement: the map is shrunk so there is room all around it. Cards go on the side (left, right, top, bottom) their region faces,
  // in the same order as their regions around the map, each as level with its region as possible, joined to it by a line.
  // Cards are swapped where two lines would cross, so no lines cross.
  const DESK_M = 280;   // px of side margin each side (keep in sync with map.css)
  let lblBase = null, normalW = 0, deskGeom = null;
  // The layout itself, in any units: W x H is the map, lblPx the size of the state abbreviations, cards need {id, ax, ay, w, h}.
  // Sets each card's side/position and its line (dot, end); returns the geometry helpers and how much room is needed above and below.
  const distSeg = (p, a, b) => {   // distance from point p to segment a-b
    const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  };
  const segXY = (p, q, r, u) => { const o = (a, b, d) => (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]); return o(p, q, r) * o(p, q, u) < 0 && o(r, u, p) * o(r, u, q) < 0; };
  const NEAR = 9;   // a dot and somebody else's line must stay at least this far apart
  function layoutOnce(W, H, k, cards, lblPx, M, GAP) {
    cards.forEach(c => { c.lines = null; c.dot = c.end = null; });
    cards.forEach(c => { const a = anchorFor(byId[c.id]); c.ax = a[0] * k; c.ay = a[1] * k; });
    // which side each card faces: by where its region lies relative to the map's centre (the rectangle's diagonals split the sides)
    cards.forEach(c => {
      const dx = (c.ax - W / 2) / W, dy = (c.ay - H / 2) / H;
      c.side = Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 'T' : 'B') : (dx < 0 ? 'L' : 'R');
    });
    const colH = sd => cards.filter(c => c.side === sd).reduce((n, c) => n + c.h + GAP, 0);
    // side columns shouldn't be much taller than the map; spill the most central ones into the top/bottom rows
    ['L', 'R'].forEach(sd => {
      while (colH(sd) > H * 1.1 + 40) {
        const mine = cards.filter(c => c.side === sd); if (mine.length < 2) break;
        const c = mine.sort((p, q) => Math.abs(p.ay - H / 2) - Math.abs(q.ay - H / 2)).pop();   // the one furthest from the middle height
        c.side = c.ay < H / 2 ? 'T' : 'B';
      }
    });
    const rowCap = Math.max(1, Math.floor((W + 2 * M + GAP) / (cards[0].w + GAP)));
    ['T', 'B'].forEach(sd => {   // a row can only hold so many; extras fall to the nearest column
      const mine = cards.filter(c => c.side === sd).sort((p, q) => Math.abs(q.ax - W / 2) - Math.abs(p.ax - W / 2));
      while (mine.length > rowCap) { const c = mine.shift(); c.side = c.ax < W / 2 ? 'L' : 'R'; }
    });
    cards.forEach(c => { if (c.force) c.side = c.force; });   // sides chosen by the retry loop below
    const group = sd => cards.filter(c => c.side === sd);
    const vert = sd => sd === 'L' || sd === 'R';
    const stack = sd => {   // along the side: as close to the region's position as possible, without overlaps
      const col = group(sd), key = vert(sd) ? 'ay' : 'ax', size = vert(sd) ? 'h' : 'w';
      col.sort((p, q) => p[key] - q[key]);
      col.forEach(c => c.pos = c[key]);
      for (let it = 0; it < 80; it++) {
        let moved = false;
        for (let i = 1; i < col.length; i++) {
          const a = col[i - 1], b = col[i], ov = (a.pos + a[size] / 2 + GAP) - (b.pos - b[size] / 2);
          if (ov > 0.5) { moved = true; a.pos -= ov / 2; b.pos += ov / 2; }
        }
        if (col.length) {
          const lo = vert(sd) ? 0 : -M + 0, first = col[0], f = first.pos - first[size] / 2; if (f < lo) { col.forEach(c => c.pos += lo - f); moved = true; }
          if (!vert(sd)) { const last = col[col.length - 1], over = last.pos + last[size] / 2 - (W + M); if (over > 0) { col.forEach(c => c.pos -= over); moved = true; } }
        }
        if (!moved) break;
      }
    };
    // card rectangles, with rows placed first so we know how much room the top and bottom need
    const topH = Math.max(0, ...group('T').map(c => c.h)), botH = Math.max(0, ...group('B').map(c => c.h));
    const VT = topH ? topH + 24 : 0;
    const geom = c => {
      if (c.side === 'L') return { l: -c.w - 10, t: c.pos - c.h / 2 };
      if (c.side === 'R') return { l: W + 10, t: c.pos - c.h / 2 };
      if (c.side === 'T') return { l: c.pos - c.w / 2, t: -10 - c.h };
      return { l: c.pos - c.w / 2, t: c.by };
    };
    const attach = c => {   // where the line meets the card
      const g = geom(c);
      if (c.side === 'L') return [g.l + c.w, clamp(c.ay, g.t + 14, g.t + c.h - 14)];
      if (c.side === 'R') return [g.l, clamp(c.ay, g.t + 14, g.t + c.h - 14)];
      if (c.side === 'T') return [clamp(c.ax, g.l + 14, g.l + c.w - 14), g.t + c.h];
      return [clamp(c.ax, g.l + 14, g.l + c.w - 14), g.t];
    };
    const place = () => {
      ['L', 'R', 'T', 'B'].forEach(stack);
      const colBottom = Math.max(H, ...cards.filter(c => vert(c.side)).map(c => c.pos + c.h / 2));
      group('B').forEach(c => {   // bottom row sits just under the map, or under a side column that reaches there
        let y = H + 10;
        cards.filter(o => vert(o.side) && o.pos + o.h / 2 + GAP > H + 10 && Math.abs((o.side === 'L' ? -o.w / 2 - 10 : W + o.w / 2 + 10) - c.pos) < (c.w + o.w) / 2 + GAP).forEach(o => { y = Math.max(y, o.pos + o.h / 2 + GAP); });
        c.by = y;
      });
      return colBottom;
    };
    const cross = (p, q) => {
      const o = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      const A = attach(p), B = [p.ax, p.ay], C = attach(q), D = [q.ax, q.ay];
      return (o(A, B, C) * o(A, B, D) < 0 && o(C, D, A) * o(C, D, B) < 0) || distSeg(B, C, D) < NEAR || distSeg(D, A, B) < NEAR;   // lines cross, or a dot sits on the other line
    };
    place();
    for (let pass = 0; pass < 40; pass++) {   // uncross: swap two cards' order along a side when their lines cross
      let swapped = false;
      ['L', 'R', 'T', 'B'].forEach(sd => { const col = group(sd), key = vert(sd) ? 'ay' : 'ax';
        for (let i = 0; i < col.length; i++) for (let j = i + 1; j < col.length; j++) if (cross(col[i], col[j])) {
          const t = col[i][key]; col[i][key] = col[j][key]; col[j][key] = t; place(); swapped = true;
        } });
      if (!swapped) break;
    }
    cards.forEach(c => { const a = anchorFor(byId[c.id]); c.ax = a[0] * k; c.ay = a[1] * k; });   // sort keys were swapped around; restore the real anchors
    const colBottom = place();
    const bottomEnd = Math.max(colBottom, ...group('B').map(c => c.by + c.h));
    // Route each line: choose the dot's spot inside the region and the point on the card where the line lands so that neither the dot
    // nor the line touches a state abbreviation, and the line crosses no other line.
    const hw = lblPx * 0.9 + 3, hh = lblPx * 0.6 + 2;
    const rects = [];
    Object.keys(lblPos).forEach(a => { if (!OUTSIDE.includes(a)) rects.push([lblPos[a][0] * k - hw, lblPos[a][1] * k - hh, lblPos[a][0] * k + hw, lblPos[a][1] * k + hh]); });
    outside.forEach(o => rects.push([o.cx * k - 5, o.cy * k - 5, o.cx * k + 5, o.cy * k + 5]));
    offY.forEach(y => rects.push([942 * k - 3, y * k - hh, 942 * k + lblPx * 1.9 + 4, y * k + hh]));
    const hits = (x, y, pad) => rects.some(r => x > r[0] - pad && x < r[2] + pad && y > r[1] - pad && y < r[3] + pad);
    const pc = document.createElement('canvas').getContext('2d');
    const edgePts = c => {   // candidate landing points along the card's inner edge
      const g = geom(c), n = 9, out = [];
      for (let i = 0; i < n; i++) {
        const f = 14 + (i / (n - 1)) * ((vert(c.side) ? c.h : c.w) - 28);
        out.push(c.side === 'L' ? [g.l + c.w, g.t + f] : c.side === 'R' ? [g.l, g.t + f] : c.side === 'T' ? [g.l + f, g.t + c.h] : [g.l + f, g.t + 0]);
      }
      return out;
    };
    cards.forEach(c => {
      const t = byId[c.id], mine = new Set((t.states || []).map(x => String(x).toUpperCase()));
      let use = [...mine].filter(x => x !== 'AK' && x !== 'HI'); if (!use.length) use = [...mine];
      const key = W + '|' + H + '|' + lblPx;
      if (!c._raw || c._raw.key !== key) {   // the spots a dot could go depend only on the map, so they are worked out once
        let cand = [];
        for (const [pad, step] of [[7, 8], [3, 5], [0, 3]]) {   // roomy spots first; in a tiny region settle for closer to the abbreviation
          features.forEach(d => {
            const ab = abbr(d); if (!use.includes(ab)) return;
            const p2 = new Path2D(path(d)), bb = path.bounds(d);
            for (let y = bb[0][1] * k; y <= bb[1][1] * k; y += step) for (let x = bb[0][0] * k; x <= bb[1][0] * k; x += step)
              if (!hits(x, y, pad) && pc.isPointInPath(p2, x / k, y / k)) cand.push([x, y]);
          });
          if (cand.length) break;
        }
        c._raw = { key, list: cand };
      }
      const cand = c._raw.list.map(q => [q[0], q[1]]);
      if (!cand.length) cand.push([c.ax, c.ay]);   // a region too small to leave a clear spot: use its middle
      const g = geom(c), cx = g.l + c.w / 2, cy = g.t + c.h / 2;
      cand.forEach(q => q.pre = Math.hypot(q[0] - c.ax, q[1] - c.ay) + 0.3 * Math.hypot(q[0] - cx, q[1] - cy));
      c.cand = cand.sort((p, q) => p.pre - q.pre).slice(0, 30); c.edges = edgePts(c);
    });
    const segX = (p, q, r, u) => {
      const o = (a, b, d) => (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
      return o(p, q, r) * o(p, q, u) < 0 && o(r, u, p) * o(r, u, q) < 0;
    };
    const rectOf = c => { const g = geom(c); return [g.l - 2, g.t - 2, g.l + c.w + 2, g.t + c.h + 2]; };
    const lineCost = (q, e, others, self) => {
      const boxes = cards.filter(o => o !== self).map(rectOf);
      let v = 0.02 * Math.hypot(q[0] - e[0], q[1] - e[1]), n = Math.max(2, Math.ceil(Math.hypot(q[0] - e[0], q[1] - e[1]) / 3));
      for (let i = 1; i < n; i++) {
        const x = q[0] + (e[0] - q[0]) * i / n, y = q[1] + (e[1] - q[1]) * i / n;
        if (hits(x, y, 2)) v += 60;
        if (boxes.some(r => x > r[0] && x < r[2] && y > r[1] && y < r[3])) v += 4000;   // a line must never run through another card
      }
      others.forEach(o => { if (segX(q, e, o.dot, o.end)) v += 800; if (distSeg(o.dot, q, e) < NEAR || distSeg(q, o.dot, o.end) < NEAR) v += 3000; });
      return v;
    };
    const route = c => {
      const others = cards.filter(o => o !== c && o.lines).flatMap(o => o.lines);
      const mine = [];
      const pick = (cands) => {
        let best = null, bv = Infinity;
        cands.forEach(q => c.edges.forEach(e => {
          const v = q.pre * 0.1 + lineCost(q, e, others.concat(mine), c) + 0.05 * Math.abs(e[vert(c.side) ? 1 : 0] - q[vert(c.side) ? 1 : 0]);
          if (v < bv) { bv = v; best = { dot: q, end: e }; }
        }));
        return best;
      };
      mine.push(pick(c.cand));
      c.lines = mine; c.dot = mine[0].dot; c.end = mine[0].end;
    };
    cards.forEach(route);
    cards.forEach(route); cards.forEach(route);
    return { geom, VT, bottomEnd };
  }
  // Lays everything out; if any line would still run through another card, move the offending card to another side and try again.
  function layoutDesk(W, H, k, cards, lblPx, M, GAP) {
    const through = (R) => {   // cards whose line passes through some other card
      const bad = new Set();
      cards.forEach(c => (c.lines || []).forEach(l => cards.forEach(o => {
        if (o === c || bad.has(c)) return; const g = R.geom(o), r = [g.l - 1, g.t - 1, g.l + o.w + 1, g.t + o.h + 1];
        const n = Math.max(2, Math.ceil(Math.hypot(l.dot[0] - l.end[0], l.dot[1] - l.end[1]) / 3));
        for (let i = 1; i < n; i++) { const x = l.dot[0] + (l.end[0] - l.dot[0]) * i / n, y = l.dot[1] + (l.end[1] - l.dot[1]) * i / n; if (x > r[0] && x < r[2] && y > r[1] && y < r[3]) { bad.add(c); break; } }
      })));
      cards.forEach(c => cards.forEach(o => { if (o !== c) (c.lines || []).forEach(l => (o.lines || []).forEach(m => { if (segXY(l.dot, l.end, m.dot, m.end) || distSeg(l.dot, m.dot, m.end) < NEAR) bad.add(c); })); }));
      return bad;
    };
    const score = r => { const n = through(r).size; let len = 0; cards.forEach(c => (c.lines || []).forEach(l => { len += Math.hypot(l.dot[0] - l.end[0], l.dot[1] - l.end[1]); })); return n * 1e5 + len; };
    cards.forEach(c => { c.force = null; });
    let R = layoutOnce(W, H, k, cards, lblPx, M, GAP), bad = through(R);
    let sides = cards.map(c => c.side), bestScore = score(R);
    const apply = ss => cards.forEach((o, i) => { o.force = ss[i]; });
    for (let it = 0; it < 6 && bad.size; it++) {
      // try moving an offending card to another side, or swapping its side with a neighbouring card's (the two boxes trade places)
      const c = [...bad][0], ci = cards.indexOf(c);
      const near = cards.map((o, i) => ({ i, d: Math.hypot(o.ax - c.ax, o.ay - c.ay) })).filter(x => x.i !== ci).sort((p, q) => p.d - q.d).slice(0, 3);
      const moves = [];
      ['L', 'R', 'T', 'B'].filter(sd => sd !== sides[ci]).forEach(sd => { const ss = sides.slice(); ss[ci] = sd; moves.push(ss); });
      near.forEach(x => { if (sides[x.i] !== sides[ci]) { const ss = sides.slice(); ss[ci] = sides[x.i]; ss[x.i] = sides[ci]; moves.push(ss); } });
      let pick = null, ps = bestScore;
      moves.forEach(ss => { apply(ss); const r2 = layoutOnce(W, H, k, cards, lblPx, M, GAP), sc = score(r2); if (sc < ps - 1) { ps = sc; pick = ss; } });
      if (!pick) break;
      sides = pick; bestScore = ps; apply(sides); R = layoutOnce(W, H, k, cards, lblPx, M, GAP); bad = through(R);
    }
    apply(sides);
    return layoutOnce(W, H, k, cards, lblPx, M, GAP);
  }
  function placeDesk() {
    if (!deskOn || !deskLayer) return;
    const W = mapEl.clientWidth, H = mapEl.clientHeight, k = W / SVGW;
    if (!W || !H) return;
    if (lblBase === null) lblBase = parseFloat(getComputedStyle(mapEl).getPropertyValue('--lbl-size')) || 13;
    if (normalW) mapEl.style.setProperty('--lbl-size', (lblBase * normalW / W) + 'px');   // map text keeps the size it has in the normal view
    const GAP = 10, M = DESK_M;
    const cards = [...deskLayer.querySelectorAll('.desk-card')].map(el => {
      const t = byId[el.dataset.id], a = anchorFor(t); if (!a) { el.style.display = 'none'; return null; }
      return { el, id: t.id, color: t.color, ax: a[0] * k, ay: a[1] * k, w: el.offsetWidth, h: el.offsetHeight };
    }).filter(Boolean);
    const lblPx = lblBase * (normalW || W) / SVGW;
    const { geom, VT, bottomEnd } = layoutDesk(W, H, k, cards, lblPx, M, GAP);
    mapEl.style.marginTop = VT + 'px'; mapEl.style.marginBottom = (Math.max(0, bottomEnd - H) + 44) + 'px';
    const svgl = deskLayer.querySelector('.desk-lines'); let lines = '';
    cards.forEach(c => {
      const g = geom(c);
      c.el.style.left = g.l + 'px'; c.el.style.top = g.t + 'px';
      c.lines.forEach(l => { lines += `<line class="dl-h" x1="${l.dot[0]}" y1="${l.dot[1]}" x2="${l.end[0]}" y2="${l.end[1]}"/><line class="dl" x1="${l.dot[0]}" y1="${l.dot[1]}" x2="${l.end[0]}" y2="${l.end[1]}"/><circle class="dl-dot" cx="${l.dot[0]}" cy="${l.dot[1]}" r="4.5"/>`; });
    });
    const tot = bottomEnd - H > 0 ? bottomEnd - H : 0;
    svgl.style.top = (-VT) + 'px'; svgl.style.height = (H + VT + tot) + 'px';
    svgl.setAttribute('viewBox', `${-M} ${-VT} ${W + 2 * M} ${H + VT + tot}`); svgl.innerHTML = lines;
    deskGeom = {   // what the PDF needs to draw this exact layout
      W, H, lblPx,
      cards: cards.map(c => {
        const g = geom(c), el = c.el, t = byId[c.id];
        const people = [...el.querySelectorAll('.contact')].map(ct => [...ct.querySelectorAll('strong, span, a')].filter(n => !n.closest('.copy-btn')).map(n => ({
          t: n.textContent.trim(), b: n.tagName === 'STRONG', url: n.tagName === 'A' ? n.getAttribute('href') : '' })).filter(l => l.t));
        return { id: c.id, title: t.name, color: t.color, l: g.l, t: g.t, w: c.w, h: c.h, lines: c.lines, people };
      })
    };
  }
  function buildDesk() {
    if (deskLayer) deskLayer.remove();
    deskLayer = document.createElement('div'); deskLayer.className = 'desk-cards';
    deskLayer.innerHTML = '<svg class="desk-lines" aria-hidden="true"></svg>' + territories.filter(t => (t.contacts || []).length).map(t =>
      `<section class="desk-card" data-id="${esc(t.id)}" style="--c:${esc(t.color)}"><p class="dc-t"><i></i>${esc(t.name)}</p>${(t.contacts || []).map(c => person(c, t)).join('')}</section>`).join('');
    mapEl.appendChild(deskLayer);
    deskLayer.querySelectorAll('.desk-card').forEach(el => {   // hovering a card spotlights its territory on the map
      el.addEventListener('mouseenter', () => { hovered = el.dataset.id; render(); });
      el.addEventListener('mouseleave', () => { hovered = null; render(); });
    });
    placeDesk(); render();
  }
  function applyDesk(on) {
    if (on) normalW = mapEl.clientWidth;   // the map's normal width, so its text can keep the same size in Desktop Mode
    deskOn = on; document.body.classList.toggle('desk', on);
    deskBtn.setAttribute('aria-pressed', String(on)); deskBtn.textContent = on ? 'Exit Desktop Mode' : 'Desktop Mode';
    const pb = document.getElementById('pdf-btn'); if (pb && !pb.disabled) pb.textContent = on ? 'Download Landscape PDF' : 'Download PDF';
    if (on) buildDesk();
    else { if (deskLayer) { deskLayer.remove(); deskLayer = null; } mapEl.style.removeProperty('--lbl-size'); mapEl.style.marginTop = mapEl.style.marginBottom = ''; render(); }
  }
  // Switching view: nothing jumps. The map is measured before and after the layout change, then glides from where it was to where it
  // ends up (scale + move), while the cards fade in (or the side panel fades back in). The page is not scrolled and nothing flashes.
  function setDesk(on) {
    if (reduceMotion()) { applyDesk(on); return; }
    const first = mapEl.getBoundingClientRect(), side = document.querySelector('.side');
    // the title, the buttons and the sections below the map also move as the page widens: glide them too
    const head = document.querySelector('.pagehead'), movers = [...(head ? head.querySelectorAll(':scope > div') : []), ...document.querySelectorAll('.national h2, .national .contact, .rev')];   // plus the manager/support sections below the map
    const firstM = movers.map(e => e.getBoundingClientRect());
    const pb = document.getElementById('pdf-btn'), pw0 = pb ? pb.getBoundingClientRect().width : 0;   // the Download button changes label, so it grows or shrinks too
    mapEl.style.transition = 'none'; mapEl.style.transform = '';
    applyDesk(on);
    if (deskLayer) { deskLayer.style.opacity = '0'; deskLayer.style.transition = 'none'; }
    const last = mapEl.getBoundingClientRect();
    if (!last.width || !first.width) { if (deskLayer) { deskLayer.style.opacity = ''; deskLayer.style.transition = ''; } return; }
    mapEl.style.transformOrigin = '0 0';
    mapEl.style.transform = `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${first.width / last.width})`;
    if (!on && side) { side.style.opacity = '0'; side.style.transition = 'none'; }
    void mapEl.offsetWidth;   // commit the starting position
    const EASE = 'transform .5s cubic-bezier(.4,0,.2,1)';
    const lastM = movers.map(e => e.getBoundingClientRect());
    const pw1 = pb ? pb.getBoundingClientRect().width : 0;
    movers.forEach((e, i) => {   // the buttons are right-aligned, so they glide by their right edge (their own width is animated separately)
      const dx = e.classList.contains('pagehead-actions') ? firstM[i].right - lastM[i].right : firstM[i].left - lastM[i].left;
      e.style.transition = 'none'; e.style.transform = `translate(${dx}px, ${firstM[i].top - lastM[i].top}px)`;
    });
    if (pb && Math.abs(pw0 - pw1) > 1) { pb.style.transition = 'none'; pb.style.width = pw0 + 'px'; pb.style.overflow = 'hidden'; }
    void mapEl.offsetWidth;
    movers.forEach(e => { e.style.transition = EASE; e.style.transform = ''; });
    mapEl.style.transition = EASE; mapEl.style.transform = '';
    if (pb && pb.style.width) { void pb.offsetWidth; pb.style.transition = 'width .5s cubic-bezier(.4,0,.2,1), background-color .4s ease, color .4s ease'; pb.style.width = pw1 + 'px'; }
    if (deskLayer) { deskLayer.style.transition = 'opacity .35s ease .2s'; deskLayer.style.opacity = '1'; }
    if (!on && side) { side.style.transition = 'opacity .35s ease .15s'; side.style.opacity = '1'; }
    setTimeout(() => {
      mapEl.style.transition = mapEl.style.transform = mapEl.style.transformOrigin = '';
      movers.forEach(e => { e.style.transition = e.style.transform = ''; });
      if (pb) { pb.style.transition = pb.style.width = pb.style.overflow = ''; }
      if (deskLayer) { deskLayer.style.transition = deskLayer.style.opacity = ''; }
      if (side) { side.style.transition = side.style.opacity = ''; }
    }, 650);
  }
  const noDesk = window.matchMedia('(max-width: 899px), (hover: none) and (pointer: coarse)');   // phones and tablets never get Desktop Mode (the button is hidden in CSS too)
  if (deskBtn) {
    deskBtn.disabled = false;
    deskBtn.addEventListener('click', () => { if (!noDesk.matches) setDesk(!deskOn); });
    noDesk.addEventListener && noDesk.addEventListener('change', () => { if (noDesk.matches && deskOn) setDesk(false); });
    let raf = 0;
    const again = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(placeDesk); };
    if (window.ResizeObserver) new ResizeObserver(again).observe(mapEl); else window.addEventListener('resize', again);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(again);
  }

  // Download PDF (see pdf.js)
  const btn = document.getElementById('pdf-btn');
  if (btn) {
    btn.disabled = false;
    btn.addEventListener('click', async () => {
      const label = btn.textContent;
      btn.disabled = true; btn.textContent = 'Preparing PDF…';
      try { await window.TerritoryPDF({ data, features, path, abbr, byAbbr, OUTSIDE, lblPos, desk: deskOn ? deskGeom : null, layoutDesk: (W, H, cards, lblPx, M) => { const k = W / SVGW; cards.forEach(c => { const a = anchorFor(byId[c.id]); c.ax = a[0] * k; c.ay = a[1] * k; }); return layoutDesk(W, H, k, cards, lblPx, M, 10); } }); }
      catch (err) { alert('Could not create the PDF: ' + err.message); }
      btn.textContent = label; btn.disabled = false;
    });
  }
})();
