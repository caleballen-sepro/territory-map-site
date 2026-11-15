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

  let pinned = null, hovered = null, searchSet = null;   // searchSet: territories on this map matching the search

  const abbr = d => (data.states[String(d.id).padStart(2, '0')] || {}).abbr;
  const stateName = d => (data.states[String(d.id).padStart(2, '0')] || {}).name || '';
  const tid = d => (byAbbr[abbr(d)] || {}).id || null;

  let us;
  try { us = await d3.json(mapEl.dataset.src); }
  catch (e) { mapEl.textContent = 'Map data failed to load.'; return; }

  const svg = d3.select(mapEl).append('svg').attr('viewBox', '0 0 975 610').attr('role', 'img');
  const path = d3.geoPath();
  const features = topojson.feature(us, us.objects.states).features;

  svg.append('g').selectAll('path').data(features).join('path')
    .attr('d', path)
    .attr('class', d => 'state' + (byAbbr[abbr(d)] ? '' : ' unassigned'))
    .attr('data-t', d => tid(d))
    .style('--c', d => (byAbbr[abbr(d)] || {}).color || null)
    .on('mouseenter', (e, d) => { hovered = tid(d); render(); })
    .on('mouseleave', () => { hovered = null; render(); })
    .on('click', (e, d) => {
      e.stopPropagation();
      const id = tid(d); if (!id) return;
      pinned = pinned === id ? null : id;
      hovered = id; render();
    })
    .append('title').text(d => stateName(d));

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
    const txt = labelG.append('text').attr('class', 'lbl' + (t ? '' : ' na')).attr('x', cx).attr('y', cy).attr('dy', '0.35em').text(a);
    if (t) txt.style('fill', textFor(t.color));
    else if (FORCED !== 'auto') txt.style('fill', FORCED);
  });
  outside.sort((p, q) => p.cy - q.cy);
  let lastY = 0;
  outside.forEach(o => {
    const y = Math.max(o.cy, lastY + 16); lastY = y;
    labelG.append('line').attr('class', 'leader').attr('x1', o.cx).attr('y1', o.cy).attr('x2', 936).attr('y2', y);
    labelG.append('text').attr('class', 'lbl out').attr('x', 942).attr('y', y).attr('dy', '0.35em').text(o.a);
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

  const person = c => `
    <div class="contact">
      <strong>${esc(c.name)}</strong>
      ${c.title ? `<span>${esc(c.title)}</span>` : ''}
      ${c.phone ? `<a href="tel:${esc(String(c.phone).replace(/[^\d+]/g, ''))}">${esc(c.phone)}</a><br>` : ''}
      ${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}
    </div>`;
  const pinLine = () => `<p class="pin">${pinned ? '📌 Pinned. Click again or press Esc to release.' : 'Click to pin'}</p>`;

  function render() {
    const id = pinned || hovered;   // pinned wins, so moving the mouse doesn't lose the card
    const t = byId[id], g = gById[id];
    const set = g ? new Set(g.terrs.map(x => x.id)) : t ? new Set([id]) : searchSet;   // a region highlights all its territories
    mapEl.classList.toggle('has-focus', !!set);
    svg.selectAll('.state').classed('on', function () { return !!set && set.has(this.dataset.t); });
    legend.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === pinned)));

    if (!g && !t) {
      panel.style.removeProperty('--c');
      panel.innerHTML = searchSet
        ? '<p class="hint">Regions matching your search are highlighted. Hover or click one for details.</p>'
        : '<p class="hint">Hover over a region to see who covers it. Click a region to keep its details on screen.</p>';
      return;
    }
    if (g) {   // region card: its manager(s), then every territory in it with its specialists
      const seen = new Set(), mgrs = [];
      g.terrs.forEach(x => (x.managers || []).forEach(m => { if (!seen.has(m.name)) { seen.add(m.name); mgrs.push(m); } }));
      panel.style.setProperty('--c', g.terrs[0].color);
      panel.innerHTML = `
        <p class="eyebrow">Region</p>
        <h2>${esc(g.name)}</h2>
        ${pinLine()}
        ${mgrs.map(person).join('')}
        ${g.terrs.map(x => `<p class="terr"><i style="background:${esc(x.color)}"></i>${esc(x.name)}</p>${(x.contacts || []).map(person).join('')}`).join('')}`;
      return;
    }
    panel.style.setProperty('--c', t.color);
    panel.innerHTML = `
      ${t.group ? `<p class="eyebrow">${esc(t.group)}</p>` : ''}
      <h2>${esc(t.name)}</h2>
      ${pinLine()}
      ${(t.contacts || []).map(person).join('')}
      ${(t.managers || []).map(person).join('')}
      <p class="states">${esc([...new Set((t.states || []).map(a => String(a).toUpperCase()))].sort().join(', '))}</p>`;
  }
  render();

  // Used by the menu search (search.js): pin a territory / region, or highlight a set of territories.
  window.TerritoryMap = {
    pin(id) { if (byId[id] || gById[id]) { pinned = id; hovered = null; render(); mapEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } },
    highlight(ids) { searchSet = ids && ids.size ? ids : null; render(); }
  };

  // Links like  /divisions/water/#t=florida  open with that territory (or "g:West Region") pinned
  const deep = /^#t=(.+)$/.exec(location.hash);
  if (deep) { const id = decodeURIComponent(deep[1]); if (byId[id] || gById[id]) { pinned = id; render(); } }

  // Download PDF (see pdf.js)
  const btn = document.getElementById('pdf-btn');
  if (btn) {
    btn.disabled = false;
    btn.addEventListener('click', async () => {
      const label = btn.textContent;
      btn.disabled = true; btn.textContent = 'Preparing PDF…';
      try { await window.TerritoryPDF({ data, features, path, abbr, byAbbr, OUTSIDE, lblPos }); }
      catch (err) { alert('Could not create the PDF: ' + err.message); }
      btn.textContent = label; btn.disabled = false;
    });
  }
})();
