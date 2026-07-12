(function(){
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const previewWrap = document.getElementById('previewWrap');
  const previewImg = document.getElementById('previewImg');
  const resetBtn = document.getElementById('resetBtn');
  const paletteList = document.getElementById('paletteList');
  const paletteEmpty = document.getElementById('paletteEmpty');
  const wheelPlaceholder = document.getElementById('wheelPlaceholder');
  const dotsLayer = document.getElementById('dotsLayer');
  const wheelSvg = document.getElementById('wheelSvg');
  const wheelWedges = document.getElementById('wheelWedges');
  const legend = document.getElementById('legend');
  const readoutPanel = document.getElementById('readoutPanel');
  const fitNum = document.getElementById('fitNum');
  const harmonyName = document.getElementById('harmonyName');
  const harmonyDesc = document.getElementById('harmonyDesc');
  const workCanvas = document.getElementById('workCanvas');
  const schemeSelect = document.getElementById('schemeSelect');
  const compPanel = document.getElementById('compPanel');
  const tempValue = document.getElementById('tempValue');
  const tempMarker = document.getElementById('tempMarker');
  const tempSub = document.getElementById('tempSub');
  const moodValue = document.getElementById('moodValue');
  const moodSub = document.getElementById('moodSub');
  const proportionList = document.getElementById('proportionList');

  let currentPalette = null;

  // ---------- Upload wiring ----------
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault(); dropzone.classList.remove('drag');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', e => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
  });
  resetBtn.addEventListener('click', resetAll);

  function resetAll(){
    fileInput.value = '';
    previewWrap.classList.remove('active');
    dropzone.style.display = 'block';
    paletteList.innerHTML = '';
    paletteEmpty.style.display = 'block';
    dotsLayer.innerHTML = '';
    wheelSvg.innerHTML = '';
    wheelPlaceholder.style.display = 'flex';
    legend.style.display = 'none';
    readoutPanel.style.display = 'none';
    compPanel.style.display = 'none';
    schemeSelect.value = 'auto';
    currentPalette = null;
    highlightWedges([]);
  }

  schemeSelect.addEventListener('change', () => {
    if (currentPalette) refreshWheelAndHarmony();
  });

  function handleFile(file){
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      previewImg.src = url;
      previewWrap.classList.add('active');
      dropzone.style.display = 'none';
      analyzeImage(img);
    };
    img.src = url;
  }

  // ---------- Image analysis ----------
  function analyzeImage(img){
    const maxDim = 160;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    workCanvas.width = w; workCanvas.height = h;
    const ctx = workCanvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    let imageData;
    try {
      imageData = ctx.getImageData(0, 0, w, h);
    } catch (err) {
      wheelPlaceholder.textContent = "Couldn't read this image (it may be cross-origin protected).";
      return;
    }
    const palette = extractPalette(imageData, 5, 8);
    currentPalette = palette;
    renderPalette(palette);
    renderComposition(palette);
    refreshWheelAndHarmony();
  }

  function refreshWheelAndHarmony(){
    if (!currentPalette) return;
    renderWheel(currentPalette);
    const forced = schemeSelect.value;
    const harmony = detectHarmony(currentPalette, forced === 'auto' ? null : forced);
    renderReadout(harmony);
  }

  // ---------- K-means color extraction ----------
  function extractPalette(imageData, k, iterations){
    const data = imageData.data;
    const totalPixels = data.length / 4;
    const targetSamples = 4000;
    const step = Math.max(1, Math.floor(totalPixels / targetSamples));
    const pixels = [];
    for (let i = 0; i < data.length; i += 4 * step) {
      if (data[i+3] < 125) continue;
      pixels.push([data[i], data[i+1], data[i+2]]);
    }
    if (pixels.length === 0) return [];
    k = Math.min(k, pixels.length);

    // k-means++ init
    let centroids = [pixels[Math.floor(Math.random()*pixels.length)]];
    while (centroids.length < k) {
      const dists = pixels.map(p => Math.min(...centroids.map(c => dist2(p,c))));
      const sum = dists.reduce((a,b)=>a+b, 0);
      if (sum === 0) { centroids.push(pixels[Math.floor(Math.random()*pixels.length)]); continue; }
      let r = Math.random() * sum;
      let idx = 0;
      for (; idx < dists.length; idx++) { r -= dists[idx]; if (r <= 0) break; }
      centroids.push(pixels[Math.min(idx, pixels.length-1)]);
    }

    let assignments = new Array(pixels.length).fill(0);
    for (let iter = 0; iter < iterations; iter++) {
      for (let p = 0; p < pixels.length; p++) {
        let best = 0, bestD = Infinity;
        for (let c = 0; c < centroids.length; c++) {
          const d = dist2(pixels[p], centroids[c]);
          if (d < bestD) { bestD = d; best = c; }
        }
        assignments[p] = best;
      }
      const sums = Array.from({length:centroids.length}, () => [0,0,0,0]);
      for (let p = 0; p < pixels.length; p++) {
        const c = assignments[p];
        sums[c][0] += pixels[p][0]; sums[c][1] += pixels[p][1];
        sums[c][2] += pixels[p][2]; sums[c][3] += 1;
      }
      for (let c = 0; c < centroids.length; c++) {
        if (sums[c][3] > 0) {
          centroids[c] = [sums[c][0]/sums[c][3], sums[c][1]/sums[c][3], sums[c][2]/sums[c][3]];
        }
      }
    }

    const counts = new Array(centroids.length).fill(0);
    assignments.forEach(a => counts[a]++);

    return centroids.map((c, i) => {
      const rgb = c.map(v => Math.round(Math.max(0, Math.min(255, v))));
      const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
      return {
        rgb, hsl,
        hex: rgbToHex(rgb),
        weight: counts[i] / pixels.length
      };
    })
    .filter(c => c.weight > 0.025)
    .sort((a,b) => b.weight - a.weight);
  }

  function dist2(a,b){
    const dr=a[0]-b[0], dg=a[1]-b[1], db=a[2]-b[2];
    return dr*dr+dg*dg+db*db;
  }

  function rgbToHex(rgb){
    return '#' + rgb.map(v => v.toString(16).padStart(2,'0')).join('').toUpperCase();
  }

  function rgbToHsl(r,g,b){
    r/=255; g/=255; b/=255;
    const max=Math.max(r,g,b), min=Math.min(r,g,b);
    let h=0, s=0; const l=(max+min)/2;
    const d=max-min;
    if (d !== 0){
      s = l > 0.5 ? d/(2-max-min) : d/(max+min);
      switch(max){
        case r: h=(g-b)/d + (g<b?6:0); break;
        case g: h=(b-r)/d + 2; break;
        case b: h=(r-g)/d + 4; break;
      }
      h *= 60;
    }
    return { h: Math.round(h), s: Math.round(s*100), l: Math.round(l*100) };
  }

  // ---------- Proportion roles (dominant / subordinate / accent) ----------
  function computeRoles(palette){
    return palette.map((c, i) => {
      if (i === 0) return 'Dominant';
      if (c.weight >= 0.15) return 'Subordinate';
      return 'Accent';
    });
  }

  // ---------- Render palette list ----------
  function renderPalette(palette){
    paletteList.innerHTML = '';
    if (palette.length === 0) { paletteEmpty.style.display = 'block'; return; }
    paletteEmpty.style.display = 'none';
    const roles = computeRoles(palette);
    palette.forEach((c, i) => {
      const li = document.createElement('li');
      const pct = Math.round(c.weight * 100);
      const role = roles[i];
      li.innerHTML = `
        <div class="swatch" style="background:${c.hex}"></div>
        <div class="swatch-info">
          <div class="swatch-hex mono">${c.hex}<span class="role-tag ${role.toLowerCase()}">${role}</span></div>
          <div class="swatch-hsl mono">H ${c.hsl.h}° &nbsp;S ${c.hsl.s}% &nbsp;L ${c.hsl.l}% &nbsp;· ${pct}%</div>
          <div class="weight-track"><div class="weight-fill" style="width:${pct}%"></div></div>
        </div>`;
      paletteList.appendChild(li);
    });
  }

  // ---------- Composition notes: temperature, mood, proportion ----------
  function computeTemperature(palette){
    let num = 0, den = 0;
    palette.forEach(c => {
      const satFrac = c.hsl.s / 100;
      const warmth = Math.cos((c.hsl.h - 30) * Math.PI / 180); // +1 near orange, -1 near cyan-blue
      num += c.weight * satFrac * warmth;
      den += c.weight * satFrac;
    });
    if (den < 0.05){
      return { score: 0, label: 'Neutral', sub: 'Too little saturation for a clear temperature — this palette reads as neutral.' };
    }
    const score = num / den;
    if (score > 0.25) return { score, label: 'Warm', sub: 'Reds, oranges, and yellows dominate the saturated colors — an energetic, advancing palette.' };
    if (score < -0.25) return { score, label: 'Cool', sub: 'Blues, greens, and violets dominate the saturated colors — a calm, receding palette.' };
    return { score, label: 'Balanced', sub: 'Warm and cool hues offset each other, so no temperature dominates.' };
  }

  const MOODS = {
    'vivid|Warm': ['Playful & Energetic', 'High-saturation warm tones read as lively and attention-seeking.'],
    'vivid|Cool': ['Bold & Vibrant', 'High-saturation cool tones feel striking and confident rather than calming.'],
    'vivid|Balanced': ['Dynamic', 'Strong saturation with no single temperature dominating gives a spirited, varied feel.'],
    'vivid|Neutral': ['Dynamic', 'Strong saturation with no single temperature dominating gives a spirited, varied feel.'],
    'muted|Warm': ['Earthy & Casual', 'Softened warm tones feel grounded, natural, and approachable.'],
    'muted|Cool': ['Soothing & Reserved', 'Softened cool tones feel calm, quiet, and easy to sit with.'],
    'muted|Balanced': ['Natural', 'Moderate saturation across temperatures gives a relaxed, unforced feel.'],
    'muted|Neutral': ['Natural', 'Moderate saturation across temperatures gives a relaxed, unforced feel.'],
    'neutral|Warm': ['Understated & Warm', 'Low saturation with a warm lean feels quiet but inviting.'],
    'neutral|Cool': ['Sophisticated & Cool', 'Low saturation with a cool lean feels composed and refined.'],
    'neutral|Balanced': ['Minimal', 'Very little saturation gives a restrained, architectural feel.'],
    'neutral|Neutral': ['Minimal & Neutral', 'Both saturation and temperature are muted — a quiet, near-monochrome palette.']
  };

  function computeMood(palette, temp){
    let sSum = 0, wSum = 0;
    palette.forEach(c => { sSum += c.hsl.s * c.weight; wSum += c.weight; });
    const avgS = wSum ? sSum / wSum : 0;
    const satCat = avgS > 55 ? 'vivid' : avgS > 25 ? 'muted' : 'neutral';
    const entry = MOODS[satCat + '|' + temp.label] || MOODS['muted|Balanced'];
    return { name: entry[0], sub: entry[1] };
  }

  function renderComposition(palette){
    if (palette.length === 0){ compPanel.style.display = 'none'; return; }
    compPanel.style.display = 'block';

    const temp = computeTemperature(palette);
    tempValue.textContent = temp.label;
    tempSub.textContent = temp.sub;
    tempMarker.style.left = (((temp.score + 1) / 2) * 100).toFixed(0) + '%';

    const mood = computeMood(palette, temp);
    moodValue.textContent = mood.name;
    moodSub.textContent = mood.sub;

    const roles = computeRoles(palette);
    const grouped = { Dominant: [], Subordinate: [], Accent: [] };
    palette.forEach((c, i) => grouped[roles[i]].push(c.hex));
    const chips = hexes => hexes.map(hex =>
      `<span class="prop-chip" style="background:${hex}" data-tip="${hex}" tabindex="0"></span>`
    ).join('');
    const lines = [];
    if (grouped.Dominant.length) lines.push(`<li><b>Dominant</b> — ${chips(grouped.Dominant)} covers the most area and sets the overall mood.</li>`);
    if (grouped.Subordinate.length) lines.push(`<li><b>Subordinate</b> — ${chips(grouped.Subordinate)} supports the dominant color without competing with it.</li>`);
    if (grouped.Accent.length) lines.push(`<li><b>Accent</b> — ${chips(grouped.Accent)} appears in small amounts to add contrast or focus.</li>`);
    proportionList.innerHTML = lines.join('');
  }

  // ---------- Wheel plotting ----------
  const MAX_R = 46;
  const WEDGE_COUNT = 12;
  const WEDGE_ANGLE = 360 / WEDGE_COUNT;
  const WEDGE_BASE_FRAC = 0.82;   // resting radius for unmatched segments
  const WEDGE_ACTIVE_FRAC = 1.0;  // popped-out radius for segments with a detected color

  function polarToPct(angleDeg, radiusFrac){
    const rad = angleDeg * Math.PI / 180;
    const x = 50 + MAX_R * radiusFrac * Math.sin(rad);
    const y = 50 - MAX_R * radiusFrac * Math.cos(rad);
    return {x, y};
  }

  function wedgePathD(startAngle, endAngle, radiusFrac){
    const p1 = polarToPct(startAngle, radiusFrac);
    const p2 = polarToPct(endAngle, radiusFrac);
    const r = (MAX_R * radiusFrac).toFixed(2);
    const largeArc = (endAngle - startAngle) > 180 ? 1 : 0;
    return `M50,50 L${p1.x.toFixed(2)},${p1.y.toFixed(2)} A${r},${r} 0 ${largeArc} 1 ${p2.x.toFixed(2)},${p2.y.toFixed(2)} Z`;
  }

  function hueToWedgeIndex(hue){
    return Math.floor((((hue % 360) + 360) % 360) / WEDGE_ANGLE);
  }

  function buildWedges(){
    const ns = 'http://www.w3.org/2000/svg';
    wheelWedges.innerHTML = '';
    for (let i = 0; i < WEDGE_COUNT; i++){
      const start = i * WEDGE_ANGLE;
      const end = start + WEDGE_ANGLE;
      const midHue = start + WEDGE_ANGLE / 2;
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', wedgePathD(start, end, WEDGE_BASE_FRAC));
      path.setAttribute('fill', `hsl(${midHue},68%,44%)`);
      path.setAttribute('class', 'wedge');
      path.dataset.wedge = i;
      path.dataset.hue = midHue;
      wheelWedges.appendChild(path);
    }
  }

  function highlightWedges(hues){
    const activeIdx = new Set(hues.map(hueToWedgeIndex));
    wheelWedges.querySelectorAll('.wedge').forEach(w => {
      const i = +w.dataset.wedge;
      const start = i * WEDGE_ANGLE;
      const end = start + WEDGE_ANGLE;
      const active = activeIdx.has(i);
      w.setAttribute('d', wedgePathD(start, end, active ? WEDGE_ACTIVE_FRAC : WEDGE_BASE_FRAC));
      w.setAttribute('fill', active ? `hsl(${w.dataset.hue},94%,54%)` : `hsl(${w.dataset.hue},68%,44%)`);
      w.classList.toggle('wedge-active', active);
    });
  }

  function renderWheel(palette){
    dotsLayer.innerHTML = '';
    wheelSvg.innerHTML = '';
    if (palette.length === 0){
      wheelPlaceholder.style.display = 'flex';
      legend.style.display = 'none';
      highlightWedges([]);
      return;
    }
    wheelPlaceholder.style.display = 'none';
    legend.style.display = 'flex';

    highlightWedges(palette.map(c => c.hsl.h));

    const points = palette.map(c => polarToPct(c.hsl.h, c.hsl.s / 100));

    // connecting polygon for real colors (weighted by top ones)
    if (points.length > 1){
      const poly = document.createElementNS('http://www.w3.org/2000/svg','polygon');
      poly.setAttribute('points', points.map(p => `${p.x},${p.y}`).join(' '));
      poly.setAttribute('fill', 'none');
      poly.setAttribute('stroke', 'rgba(237,234,226,0.35)');
      poly.setAttribute('stroke-width', '0.4');
      wheelSvg.appendChild(poly);
    }

    palette.forEach((c, i) => {
      const p = points[i];
      const dot = document.createElement('div');
      dot.className = 'dot' + (i === 0 ? ' primary' : '');
      dot.style.left = p.x + '%';
      dot.style.top = p.y + '%';
      dot.style.background = c.hex;
      dot.title = `${c.hex} · H${c.hsl.h}°`;
      dotsLayer.appendChild(dot);
    });

    const center = document.createElement('div');
    center.className = 'center-dot';
    dotsLayer.appendChild(center);
  }

  buildWedges();

  function renderTargetGuides(templateAngles){
    templateAngles.forEach(angle => {
      const p = polarToPct(angle, 0.92);
      const dot = document.createElement('div');
      dot.style.position = 'absolute';
      dot.style.left = p.x + '%';
      dot.style.top = p.y + '%';
      dot.style.width = '10px';
      dot.style.height = '10px';
      dot.style.border = '1.5px dashed rgba(139,141,149,0.9)';
      dot.style.borderRadius = '50%';
      dot.style.transform = 'translate(-50%,-50%)';
      dotsLayer.appendChild(dot);
    });
  }

  // ---------- Harmony detection ----------
  const TEMPLATES = {
    'Monochromatic': [0],
    'Complementary': [0, 180],
    'Analogous': [0, 30, 60],
    'Triadic': [0, 120, 240],
    'Split-Complementary': [0, 150, 210],
    'Square (Tetradic)': [0, 90, 180, 270],
    'Rectangle (Tetradic)': [0, 60, 180, 240],
    'Discordant (Clash)': [0, 150]
  };

  const DESCRIPTIONS = {
    'Monochromatic': 'The palette leans on one hue, varied by saturation and lightness rather than by contrasting colors.',
    'Complementary': 'Two hues sit roughly opposite each other on the wheel, giving the image high contrast and vibrancy.',
    'Analogous': 'The dominant hues sit close together on the wheel, giving the image a calm, cohesive feel.',
    'Triadic': 'Three hues are spaced evenly around the wheel, balancing contrast with harmony.',
    'Split-Complementary': 'One hue is paired with the two neighbors of its complement — the contrast of an opposite pair, softened.',
    'Square (Tetradic)': 'Four hues are spaced evenly around the wheel, giving a rich, varied palette.',
    'Rectangle (Tetradic)': 'Two complementary pairs form a rectangle on the wheel, mixing variety with built-in balance.',
    'Discordant (Clash)': 'A hue is paired with one just off from its true complement, rather than dead opposite — a jarring, "clashing" pairing sometimes used deliberately for energy or shock.',
    'Achromatic': 'This image reads as neutral tones — grays, near-blacks, or near-whites — with too little saturation for a clear hue relationship.'
  };

  // Populate the scheme selector once, right after the template list exists.
  Object.keys(TEMPLATES).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    schemeSelect.appendChild(opt);
  });

  function angDist(a,b){
    let d = Math.abs(a-b) % 360;
    return d > 180 ? 360 - d : d;
  }

  function scoreTemplate(hues, template){
    let best = { rotation: 0, error: Infinity };
    for (let rot = 0; rot < 360; rot += 2){
      const templateAngles = template.map(t => (t + rot) % 360);
      let totalErr = 0, totalW = 0;
      hues.forEach(h => {
        const minD = Math.min(...templateAngles.map(t => angDist(h.angle, t)));
        totalErr += minD * h.weight;
        totalW += h.weight;
      });
      const err = totalW > 0 ? totalErr / totalW : 999;
      if (err < best.error) best = { rotation: rot, error: err };
    }
    return best;
  }

  function detectHarmony(palette, forced){
    const hued = palette.filter(c => c.hsl.s > 12).slice(0, 5)
      .map(c => ({ angle: c.hsl.h, weight: c.weight }));

    if (hued.length === 0){
      return { name: 'Achromatic', fit: 100, angles: [] };
    }

    // Auto mode with a single meaningful hue: it's trivially monochromatic.
    if (!forced && hued.length === 1){
      return { name: 'Monochromatic', fit: 100, angles: [hued[0].angle] };
    }

    // Forced mode: score the palette against exactly the scheme the user picked.
    if (forced && TEMPLATES[forced]){
      const template = TEMPLATES[forced];
      const res = scoreTemplate(hued, template);
      const fit = Math.max(0, Math.round(100 - (res.error / 60) * 100));
      const angles = template.map(t => (t + res.rotation) % 360);
      return { name: forced, fit, angles };
    }

    // Auto mode: find whichever scheme fits best (skip Monochromatic here,
    // since with 2+ distinct hues it's rarely the most informative label).
    let bestName = null, bestScore = Infinity, bestRot = 0, bestTemplate = null;
    for (const [name, template] of Object.entries(TEMPLATES)){
      if (name === 'Monochromatic') continue;
      const res = scoreTemplate(hued, template);
      if (res.error < bestScore){
        bestScore = res.error; bestName = name; bestRot = res.rotation; bestTemplate = template;
      }
    }
    const fit = Math.max(0, Math.round(100 - (bestScore / 60) * 100));
    const angles = bestTemplate.map(t => (t + bestRot) % 360);
    return { name: bestName, fit, angles };
  }

  function renderReadout(result){
    readoutPanel.style.display = 'block';
    fitNum.textContent = result.fit + '%';
    harmonyName.textContent = result.name;
    harmonyDesc.textContent = DESCRIPTIONS[result.name] || '';
    if (result.angles && result.angles.length > 1){
      renderTargetGuides(result.angles);
    }
  }
})();
