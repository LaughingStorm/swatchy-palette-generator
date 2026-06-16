'use strict';

// ── STATE ──────────────────────────────────────────────────────────────────
const state = {
  activeTab:    'pylette',
  visibleCount: 5,
  palettes:     { pylette: [], kmeans: [] },
  originals:    { pylette: [], kmeans: [] },
  openIndex:    -1
};

// ── DOM ────────────────────────────────────────────────────────────────────
const swatchesContainer = document.getElementById('swatches-container');
const countDisplay      = document.getElementById('swatch-count');
const imageUpload       = document.getElementById('image-upload');
const imageReplace      = document.getElementById('image-replace');
const imageCanvas       = document.getElementById('image-canvas');
const uploadPlaceholder = document.getElementById('upload-placeholder');
const uploadZone        = document.getElementById('upload-zone');
const copyFlash         = document.getElementById('copy-flash');
const exportMenu        = document.getElementById('export-menu');

const imageCtx = imageCanvas.getContext('2d', { willReadFrequently: true });
let uploadedImage = null;

// drag state
let isDraggingPicker = false;
let isDraggingSlider = false;
let activeSliderType = null;
let activeEditorIndex = -1;

// drag-to-reorder state
let dragSrcIndex = null;

// ── COLOR UTILS ────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const n = parseInt(hex, 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
}

function rgbToHsb(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [Math.round(h * 360), Math.round((max === 0 ? 0 : d / max) * 100), Math.round(max * 100)];
}

function hsbToRgb(h, s, v) {
  s /= 100; v /= 100;
  const k = n => (n + h / 60) % 6;
  const f = n => v - v * s * Math.max(Math.min(k(n), 4 - k(n), 1), 0);
  return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)];
}

function hexToHsb(hex) { return rgbToHsb(...hexToRgb(hex)); }
function hsbToHex(h, s, b) { return rgbToHex(...hsbToRgb(h, s, b)); }

function getContrastColor(hex) {
  const [r, g, b] = hexToRgb(hex);
  return ((r * 299) + (g * 587) + (b * 114)) / 1000 >= 128 ? '#000' : '#fff';
}

// ── RENDER ─────────────────────────────────────────────────────────────────
function renderSwatches() {
  swatchesContainer.innerHTML = '';
  countDisplay.textContent = state.visibleCount;
  const mCount = document.getElementById('swatch-count-m'); if (mCount) mCount.textContent = state.visibleCount;

  const pal  = state.palettes[state.activeTab];
  const orig = state.originals[state.activeTab];

  if (!pal.length) {
    swatchesContainer.innerHTML = `
      <div class="empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <span>Upload an image to extract colors</span>
      </div>`;
    return;
  }

  for (let i = 0; i < state.visibleCount; i++) {
    const hex     = pal[i]  || '#111111';
    const origHex = orig[i] || hex;
    const isOpen  = state.openIndex === i;
    const [h, s, b] = hexToHsb(hex);

    const row = document.createElement('div');
    row.className = `swatch-row${isOpen ? ' open' : ''}`;
    row.dataset.index = i;



    // ── STRIP ──
    const strip = document.createElement('div');
    strip.className = 'swatch-strip';

    const origHalf = document.createElement('div');
    origHalf.className = 'swatch-half orig-half';
    origHalf.style.background = origHex;
    origHalf.innerHTML = `<span class="half-label">Original</span><span class="swatch-hex">${origHex}</span>`;

    const newHalf = document.createElement('div');
    newHalf.className = 'swatch-half new-half';
    newHalf.style.background = hex;
    newHalf.id = `new-half-${i}`;
    newHalf.innerHTML = `<span class="half-label right">New</span><span class="swatch-hex" id="new-hex-label-${i}">${hex}</span>`;

    const divider = document.createElement('div');
    divider.className = 'swatch-divider';

    const hint = document.createElement('span');
    hint.className = 'edit-hint';
    hint.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit`;

    const actions = document.createElement('div');
    actions.className = 'swatch-actions';
    const dragIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 8 12 2 6 8"/><polyline points="6 16 12 22 18 16"/></svg>`;    if (isOpen) {
      actions.innerHTML = `
        <button class="swatch-btn apply-btn" data-action="apply" data-i="${i}">Apply</button>
        <button class="swatch-btn" data-action="reset-swatch" data-i="${i}">Reset</button>
        <button class="swatch-btn" data-action="copy" data-i="${i}">Copy</button>
        <button class="swatch-btn drag-handle" data-action="drag" data-i="${i}" title="Drag to reorder">${dragIcon}</button>
        <button class="swatch-btn" data-action="remove" data-i="${i}">✕</button>`;
    } else {
      actions.innerHTML = `
        <button class="swatch-btn" data-action="copy" data-i="${i}">Copy</button>
        <button class="swatch-btn drag-handle" data-action="drag" data-i="${i}" title="Drag to reorder">${dragIcon}</button>
        <button class="swatch-btn" data-action="remove" data-i="${i}">✕</button>`;
    }

    strip.appendChild(origHalf);
    strip.appendChild(divider);
    strip.appendChild(newHalf);
    strip.appendChild(hint);
    strip.appendChild(actions);

    strip.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        e.stopPropagation();
        if (btn.dataset.action === 'drag') return; // handled by mousedown
        handleSwatchAction(btn.dataset.action, parseInt(btn.dataset.i));
        return;
      }
      const newIndex = state.openIndex === i ? -1 : i;
      state.openIndex = newIndex;
      // on small screens open modal instead of inline editor
      if (newIndex !== -1 && window.innerWidth <= 1024) {
        openEditorModal(newIndex);
        state.openIndex = -1;
        renderSwatches();
      } else {
        renderSwatches();
      }
    });

    // drag handle mousedown
    strip.addEventListener('mousedown', e => {
      const btn = e.target.closest('[data-action="drag"]');
      if (btn) {
        e.stopPropagation();
        row.draggable = true;
      }
    });
    strip.addEventListener('mouseup', () => { row.draggable = false; });

    row.appendChild(strip);

    if (isOpen) {
      const editor = buildEditor(i, hex, h, s, b);
      row.appendChild(editor);
    }

    // ── DRAG TO REORDER ──
    row.addEventListener('dragstart', e => {
      dragSrcIndex = i;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    row.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('.swatch-row').forEach(r => r.classList.remove('drag-over'));
      row.classList.add('drag-over');
    });
    row.addEventListener('drop', e => {
      e.preventDefault();
      if (dragSrcIndex === null || dragSrcIndex === i) return;
      reorderSwatch(dragSrcIndex, i);
      dragSrcIndex = null;
    });

    // dragend cleanup
    row.addEventListener('dragend', () => {
      row.draggable = false;
      row.classList.remove('dragging');
      document.querySelectorAll('.swatch-row').forEach(r => r.classList.remove('drag-over'));
    });

    swatchesContainer.appendChild(row);
  }
}

function reorderSwatch(from, to) {
  const pal  = state.palettes[state.activeTab];
  const orig = state.originals[state.activeTab];
  const movePal  = pal.splice(from, 1)[0];
  const moveOrig = orig.splice(from, 1)[0];
  pal.splice(to, 0, movePal);
  orig.splice(to, 0, moveOrig);
  state.openIndex = -1;
  renderSwatches();
}

function handleSwatchAction(action, i) {
  const pal  = state.palettes[state.activeTab];
  const orig = state.originals[state.activeTab];
  switch (action) {
    case 'apply':
      orig[i] = pal[i];
      state.openIndex = -1;
      renderSwatches();
      break;
    case 'reset-swatch':
      pal[i] = orig[i];
      state.openIndex = i;
      renderSwatches();
      break;
    case 'copy':
      navigator.clipboard.writeText(pal[i]);
      flash();
      break;
    case 'remove':
      pal.splice(i, 1);
      orig.splice(i, 1);
      pal.push('#111111');
      orig.push('#111111');
      state.visibleCount = Math.max(1, state.visibleCount - 1);
      state.openIndex = -1;
      renderSwatches();
      break;
  }
}

// ── EDITOR ─────────────────────────────────────────────────────────────────
function buildEditor(index, hex, h, s, b) {
  const editor = document.createElement('div');
  editor.className = 'swatch-editor';
  let cH = h, cS = s, cB = b;

  editor.innerHTML = `
    <div class="sat-bri-picker" id="picker-${index}">
      <canvas class="sat-bri-canvas" id="canvas-${index}"></canvas>
      <div class="sat-bri-marker" id="marker-${index}" style="left:${s}%;top:${100-b}%"></div>
    </div>
    <div class="slider-group">
      <div class="slider-row">
        <span class="slider-label">H</span>
        <div class="slider-track" id="track-h-${index}" style="background:linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)">
          <div class="slider-thumb" id="thumb-h-${index}" style="left:${(h/360)*100}%"></div>
        </div>
        <span class="slider-val" id="val-h-${index}">${h}</span>
      </div>
      <div class="slider-row">
        <span class="slider-label">S</span>
        <div class="slider-track" id="track-s-${index}" style="background:linear-gradient(to right,${hsbToHex(h,0,b)},${hsbToHex(h,100,b)})">
          <div class="slider-thumb" id="thumb-s-${index}" style="left:${s}%"></div>
        </div>
        <span class="slider-val" id="val-s-${index}">${s}</span>
      </div>
      <div class="slider-row">
        <span class="slider-label">B</span>
        <div class="slider-track" id="track-b-${index}" style="background:linear-gradient(to right,#000,${hsbToHex(h,s,100)})">
          <div class="slider-thumb" id="thumb-b-${index}" style="left:${b}%"></div>
        </div>
        <span class="slider-val" id="val-b-${index}">${b}</span>
      </div>
    </div>
    <div class="hex-row">
      <div class="hex-preview" id="hex-preview-${index}" style="background:${hex}"></div>
      <span class="hex-label">Hex</span>
      <input class="hex-input" id="hex-input-${index}" type="text" value="${hex}" maxlength="7" spellcheck="false">
    </div>`;

  requestAnimationFrame(() => {
    const canvas = document.getElementById(`canvas-${index}`);
    if (!canvas) return;
    const resize = () => {
      canvas.width  = canvas.offsetWidth  || canvas.parentElement.offsetWidth;
      canvas.height = canvas.offsetHeight || canvas.parentElement.offsetHeight;
      drawSatCanvas(canvas, cH, cS, cB);
    };
    resize();
    new ResizeObserver(resize).observe(canvas);
  });

  function syncEditor() {
    const newHex = hsbToHex(cH, cS, cB);
    state.palettes[state.activeTab][index] = newHex;

    const els = {
      newHalf:    document.getElementById(`new-half-${index}`),
      newHexLbl:  document.getElementById(`new-hex-label-${index}`),
      hexPreview: document.getElementById(`hex-preview-${index}`),
      hexInput:   document.getElementById(`hex-input-${index}`),
      marker:     document.getElementById(`marker-${index}`),
      canvas:     document.getElementById(`canvas-${index}`),
      tS: document.getElementById(`track-s-${index}`),
      tB: document.getElementById(`track-b-${index}`),
      thH: document.getElementById(`thumb-h-${index}`),
      thS: document.getElementById(`thumb-s-${index}`),
      thB: document.getElementById(`thumb-b-${index}`),
      vH: document.getElementById(`val-h-${index}`),
      vS: document.getElementById(`val-s-${index}`),
      vB: document.getElementById(`val-b-${index}`),
    };

    if (els.newHalf)    els.newHalf.style.background   = newHex;
    if (els.newHexLbl)  els.newHexLbl.textContent       = newHex;
    if (els.hexPreview) els.hexPreview.style.background = newHex;
    if (els.hexInput && document.activeElement !== els.hexInput) els.hexInput.value = newHex;
    if (els.marker)     { els.marker.style.left = `${cS}%`; els.marker.style.top = `${100-cB}%`; }
    if (els.tS) els.tS.style.background = `linear-gradient(to right,${hsbToHex(cH,0,cB)},${hsbToHex(cH,100,cB)})`;
    if (els.tB) els.tB.style.background = `linear-gradient(to right,#000,${hsbToHex(cH,cS,100)})`;
    if (els.thH) els.thH.style.left = `${(cH/360)*100}%`;
    if (els.thS) els.thS.style.left = `${cS}%`;
    if (els.thB) els.thB.style.left = `${cB}%`;
    if (els.vH) els.vH.textContent = cH;
    if (els.vS) els.vS.textContent = cS;
    if (els.vB) els.vB.textContent = cB;
    if (els.canvas) drawSatCanvas(els.canvas, cH, cS, cB);
  }

  // picker drag
  const picker = editor.querySelector('.sat-bri-picker');
  picker.addEventListener('mousedown', e => {
    isDraggingPicker = true;
    activeEditorIndex = index;
    doPickSatBri(e, picker, (ns, nb) => { cS = ns; cB = nb; syncEditor(); });
  });
  picker.addEventListener('touchstart', e => {
    e.preventDefault();
    activeEditorIndex = index;
    doPickSatBri(e.touches[0], picker, (ns, nb) => { cS = ns; cB = nb; syncEditor(); });
  }, { passive: false });
  picker.addEventListener('touchmove', e => {
    e.preventDefault();
    doPickSatBri(e.touches[0], picker, (ns, nb) => { cS = ns; cB = nb; syncEditor(); });
  }, { passive: false });

  // slider drag
  ['h','s','b'].forEach(type => {
    const track = editor.querySelector(`#track-${type}-${index}`);
    track.addEventListener('mousedown', e => {
      isDraggingSlider = true;
      activeSliderType = type;
      activeEditorIndex = index;
      doMoveSlider(e, track, type, (val) => {
        if (type === 'h') cH = val;
        if (type === 's') cS = val;
        if (type === 'b') cB = val;
        syncEditor();
      });
    });
    track.addEventListener('touchstart', e => {
      e.preventDefault();
      doMoveSlider(e.touches[0], track, type, (val) => {
        if (type === 'h') cH = val;
        if (type === 's') cS = val;
        if (type === 'b') cB = val;
        syncEditor();
      });
    }, { passive: false });
    track.addEventListener('touchmove', e => {
      e.preventDefault();
      doMoveSlider(e.touches[0], track, type, (val) => {
        if (type === 'h') cH = val;
        if (type === 's') cS = val;
        if (type === 'b') cB = val;
        syncEditor();
      });
    }, { passive: false });
  });

  // hex input
  editor.querySelector(`#hex-input-${index}`).addEventListener('input', e => {
    let val = e.target.value.trim();
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      [cH, cS, cB] = hexToHsb(val);
      syncEditor();
    }
  });

  // expose for global mousemove
  editor._syncPicker = (ns, nb) => { cS = ns; cB = nb; syncEditor(); };
  editor._moveSlider = (type, val) => {
    if (type === 'h') cH = val;
    if (type === 's') cS = val;
    if (type === 'b') cB = val;
    syncEditor();
  };

  return editor;
}

function drawSatCanvas(canvas, h, s, b) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, ht = canvas.height;
  if (!w || !ht) return;
  ctx.fillStyle = hsbToHex(h, 100, 100);
  ctx.fillRect(0, 0, w, ht);
  const gW = ctx.createLinearGradient(0,0,w,0);
  gW.addColorStop(0,'rgba(255,255,255,1)'); gW.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = gW; ctx.fillRect(0,0,w,ht);
  const gB = ctx.createLinearGradient(0,0,0,ht);
  gB.addColorStop(0,'rgba(0,0,0,0)'); gB.addColorStop(1,'rgba(0,0,0,1)');
  ctx.fillStyle = gB; ctx.fillRect(0,0,w,ht);
}

function doPickSatBri(e, el, cb) {
  const r = el.getBoundingClientRect();
  cb(
    Math.round(Math.max(0, Math.min(1, (e.clientX - r.left)  / r.width))  * 100),
    Math.round(Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)) * 100)
  );
}

function doMoveSlider(e, track, type, cb) {
  const r   = track.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  cb(type === 'h' ? Math.round(pct * 360) : Math.round(pct * 100));
}

// global mouse events for drag
window.addEventListener('mousemove', e => {
  if (!isDraggingPicker && !isDraggingSlider) return;
  const idx    = activeEditorIndex;
  const editor = document.querySelector(`.swatch-row[data-index="${idx}"] .swatch-editor`);
  if (!editor) return;
  if (isDraggingPicker) {
    const picker = document.getElementById(`picker-${idx}`);
    if (picker) doPickSatBri(e, picker, editor._syncPicker);
  }
  if (isDraggingSlider) {
    const track = document.getElementById(`track-${activeSliderType}-${idx}`);
    if (track) doMoveSlider(e, track, activeSliderType, val => editor._moveSlider(activeSliderType, val));
  }
});

window.addEventListener('mouseup', () => {
  isDraggingPicker = false;
  isDraggingSlider = false;
  activeSliderType = null;
});

// ── IMAGE ──────────────────────────────────────────────────────────────────
function loadImage(file) {
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    uploadedImage = img;
    drawImageOnCanvas();
    uploadZone.classList.add('has-image');
    uploadPlaceholder.style.display = 'none';
    imageCanvas.style.display = 'block';
    const imgWrap = document.getElementById('image-wrap');
    if (imgWrap) { imgWrap.classList.remove('hidden'); }
    triggerExtraction(file);
  };
  img.src = URL.createObjectURL(file);
}

function drawImageOnCanvas() {
  if (!uploadedImage) return;
  imageCanvas.width  = uploadZone.offsetWidth;
  imageCanvas.height = uploadZone.offsetHeight;
  const scale = Math.min(imageCanvas.width / uploadedImage.width, imageCanvas.height / uploadedImage.height);
  const w = uploadedImage.width  * scale;
  const h = uploadedImage.height * scale;
  imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
  imageCtx.drawImage(uploadedImage, (imageCanvas.width - w) / 2, (imageCanvas.height - h) / 2, w, h);
}

window.addEventListener('resize', drawImageOnCanvas);

imageUpload.addEventListener('change',  e => loadImage(e.target.files[0]));
imageReplace.addEventListener('change', e => loadImage(e.target.files[0]));

// click-to-sample removed — use eyedropper instead

function addColorToPalette(hex) {
  const pal  = state.palettes[state.activeTab];
  const orig = state.originals[state.activeTab];
  if (state.visibleCount < 10) {
    pal[state.visibleCount]  = hex;
    orig[state.visibleCount] = hex;
    state.visibleCount++;
  } else {
    pal[state.visibleCount - 1]  = hex;
    orig[state.visibleCount - 1] = hex;
  }
  state.openIndex = -1;
  renderSwatches();
}

// ── EXTRACTION ─────────────────────────────────────────────────────────────
async function triggerExtraction(file) {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('num_of_colors', '10');
  try {
    const res    = await fetch('/api/extract-colors', { method: 'POST', body: formData });
    if (!res.ok) throw new Error(res.status);
    const result = await res.json();
    state.palettes.pylette  = result.pylette          || [];
    state.palettes.kmeans   = result.extractor_colors  || [];
    state.originals.pylette = [...state.palettes.pylette];
    state.originals.kmeans  = [...state.palettes.kmeans];
    state.openIndex = -1;
    renderSwatches();
  } catch (err) {
    console.error('Extraction failed:', err);
  }
}

// ── TOPBAR ─────────────────────────────────────────────────────────────────
document.getElementById('btn-pylette').addEventListener('click', () => {
  state.activeTab = 'pylette'; state.openIndex = -1;
  document.getElementById('btn-pylette').classList.add('active');
  document.getElementById('btn-kmeans').classList.remove('active');
  renderSwatches();
});

document.getElementById('btn-kmeans').addEventListener('click', () => {
  state.activeTab = 'kmeans'; state.openIndex = -1;
  document.getElementById('btn-kmeans').classList.add('active');
  document.getElementById('btn-pylette').classList.remove('active');
  renderSwatches();
});

document.getElementById('btn-count-up').addEventListener('click', () => {
  if (state.visibleCount < 10) { state.visibleCount++; state.openIndex = -1; syncCountDisplays(); renderSwatches(); }
});

document.getElementById('btn-count-down').addEventListener('click', () => {
  if (state.visibleCount > 1) { state.visibleCount--; state.openIndex = -1; syncCountDisplays(); renderSwatches(); }
});

document.getElementById('btn-eyedropper').addEventListener('click', async () => {
  if (!window.EyeDropper) { alert('EyeDropper API not supported in this browser.'); return; }
  try { const r = await new EyeDropper().open(); addColorToPalette(r.sRGBHex.toLowerCase()); } catch (e) {}
});



// Export dropdown toggle
document.getElementById('export-toggle-btn').addEventListener('click', e => {
  e.stopPropagation();
  exportMenu.classList.toggle('open');
});

document.addEventListener('click', () => exportMenu.classList.remove('open'));
exportMenu.addEventListener('click', e => e.stopPropagation());

// Export actions
document.getElementById('btn-export-ase').addEventListener('click', async () => {
  exportMenu.classList.remove('open');
  const colors = state.palettes[state.activeTab].slice(0, state.visibleCount);
  try {
    const res  = await fetch('/api/generate-ase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ colors }) });
    triggerDownload(await res.blob(), 'palette.ase');
  } catch (e) { console.error('ASE export failed:', e); }
});

document.getElementById('btn-export-psd').addEventListener('click', async () => {
  exportMenu.classList.remove('open');
  const colors = state.palettes[state.activeTab].slice(0, state.visibleCount);
  try {
    const res  = await fetch('/api/generate-psd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ colors }) });
    triggerDownload(await res.blob(), 'palette.psd');
  } catch (e) { console.error('PSD export failed:', e); }
});

document.getElementById('btn-copy-hex').addEventListener('click', () => {
  exportMenu.classList.remove('open');
  const hexes = state.palettes[state.activeTab].slice(0, state.visibleCount).join('  ');
  navigator.clipboard.writeText(hexes).then(flash);
});

document.getElementById('btn-copy-css').addEventListener('click', () => {
  exportMenu.classList.remove('open');
  const dColors = state.palettes[state.activeTab].slice(0, state.visibleCount);
  const dVars = ':root {\n' + dColors.map((h, i) => '  --color-' + (i + 1) + ': ' + h + ';').join('\n') + '\n}';
  navigator.clipboard.writeText(dVars).then(flash);
});

document.getElementById('btn-reset').addEventListener('click', () => {
  state.palettes[state.activeTab] = [...state.originals[state.activeTab]];
  state.openIndex = -1;
  renderSwatches();
});

document.getElementById('btn-theme').addEventListener('click', () => {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  document.getElementById('icon-moon').style.display = next === 'dark'  ? 'block' : 'none';
  document.getElementById('icon-sun').style.display  = next === 'light' ? 'block' : 'none';
});

// ── UTILS ──────────────────────────────────────────────────────────────────
function flash() {
  copyFlash.classList.add('show');
  setTimeout(() => copyFlash.classList.remove('show'), 1500);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}


// ── MOBILE PALETTE BAR ─────────────────────────────────────────────────────
function syncCountDisplays() {
  document.getElementById('swatch-count').textContent   = state.visibleCount;
  const mCount = document.getElementById('swatch-count-m');
  if (mCount) mCount.textContent = state.visibleCount;
}

document.getElementById('btn-count-up-m')?.addEventListener('click', () => {
  if (state.visibleCount < 10) { state.visibleCount++; state.openIndex = -1; syncCountDisplays(); renderSwatches(); }
});
document.getElementById('btn-count-down-m')?.addEventListener('click', () => {
  if (state.visibleCount > 1) { state.visibleCount--; state.openIndex = -1; syncCountDisplays(); renderSwatches(); }
});

// mobile export dropdown
const exportMenuM = document.getElementById('export-menu-m');
document.getElementById('export-toggle-btn-m')?.addEventListener('click', e => {
  e.stopPropagation(); exportMenuM?.classList.toggle('open');
});
exportMenuM?.addEventListener('click', e => e.stopPropagation());

document.getElementById('btn-export-ase-m')?.addEventListener('click', async () => {
  exportMenuM?.classList.remove('open');
  const colors = state.palettes[state.activeTab].slice(0, state.visibleCount);
  try { const res = await fetch('/api/generate-ase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ colors }) }); triggerDownload(await res.blob(), 'palette.ase'); } catch(e) {}
});
document.getElementById('btn-export-psd-m')?.addEventListener('click', async () => {
  exportMenuM?.classList.remove('open');
  const colors = state.palettes[state.activeTab].slice(0, state.visibleCount);
  try { const res = await fetch('/api/generate-psd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ colors }) }); triggerDownload(await res.blob(), 'palette.psd'); } catch(e) {}
});
document.getElementById('btn-copy-hex-m')?.addEventListener('click', () => {
  exportMenuM?.classList.remove('open');
  navigator.clipboard.writeText(state.palettes[state.activeTab].slice(0, state.visibleCount).join('  ')).then(flash);
});
document.getElementById('btn-copy-css-m')?.addEventListener('click', () => {
  exportMenuM?.classList.remove('open');
  const mColors = state.palettes[state.activeTab].slice(0, state.visibleCount);
  const mVars = ':root {\n' + mColors.map((h, i) => '  --color-' + (i + 1) + ': ' + h + ';').join('\n') + '\n}';
  navigator.clipboard.writeText(mVars).then(flash);
});


// ── IMAGE PANEL TOGGLE ─────────────────────────────────────────────────────
function updateToggleBtn(isHidden) {
  document.querySelectorAll('.btn-toggle-image').forEach(btn => {
    btn.textContent = isHidden ? 'Show Image' : 'Hide Image';
  });
}

document.querySelectorAll('.btn-toggle-image').forEach(btn => {
  btn.addEventListener('click', () => {
    const panel   = document.getElementById('left-panel');
    const imgWrap = document.getElementById('image-wrap');
    const isHidden = imgWrap.classList.toggle('hidden');
    panel.classList.toggle('image-hidden', isHidden);
    updateToggleBtn(isHidden);
  });
});


// ── COLOR EDITOR MODAL ─────────────────────────────────────────────────────
let modalIndex   = -1;
let modalH = 0, modalS = 0, modalB = 0;
let modalOrigHex = '';
let modalDraggingPicker = false;
let modalDraggingSlider = false;
let modalActiveSlider   = null;

function openEditorModal(index) {
  const hex = state.palettes[state.activeTab][index];
  const orig = state.originals[state.activeTab][index] || hex;
  [modalH, modalS, modalB] = hexToHsb(hex);
  modalIndex   = index;
  modalOrigHex = orig;

  // Safe element updates
  const elOrigHalf = document.getElementById('modal-orig-half');
  if (elOrigHalf) elOrigHalf.style.background = orig;

  const elOrigHex = document.getElementById('modal-orig-hex');
  if (elOrigHex) elOrigHex.textContent = orig;

  const elNewHalf = document.getElementById('modal-new-half');
  if (elNewHalf) elNewHalf.style.background = hex;

  const elNewHex = document.getElementById('modal-new-hex');
  if (elNewHex) elNewHex.textContent = hex;

  const elHexInput = document.getElementById('modal-hex-input');
  if (elHexInput) elHexInput.value = hex;

  const elHexPreview = document.getElementById('modal-hex-preview');
  if (elHexPreview) elHexPreview.style.background = hex;

  const elTitle = document.getElementById('modal-title');
  if (elTitle) elTitle.textContent = 'Edit Color ' + (index + 1);

  const elOverlay = document.getElementById('editor-modal-overlay');
  if (elOverlay) elOverlay.classList.add('open');

  requestAnimationFrame(() => {
    const canvas = document.getElementById('modal-canvas');
    if (canvas) {
      canvas.width  = canvas.offsetWidth || 200;
      canvas.height = canvas.offsetHeight || 150;
      drawSatCanvas(canvas, modalH, modalS, modalB);
    }
    syncModalSliders();
  });
}

function closeEditorModal() {
  const elOverlay = document.getElementById('editor-modal-overlay');
  if (elOverlay) elOverlay.classList.remove('open');
  modalIndex = -1;
}

function syncModal() {
  const hex = hsbToHex(modalH, modalS, modalB);
  if (modalIndex !== -1) state.palettes[state.activeTab][modalIndex] = hex;

  const elNewHalf = document.getElementById('modal-new-half');
  if (elNewHalf) elNewHalf.style.background = hex;

  const elNewHex = document.getElementById('modal-new-hex');
  if (elNewHex) elNewHex.textContent = hex;

  const elHexPreview = document.getElementById('modal-hex-preview');
  if (elHexPreview) elHexPreview.style.background = hex;

  const elHexInput = document.getElementById('modal-hex-input');
  if (elHexInput && document.activeElement !== elHexInput) elHexInput.value = hex;

  const canvas = document.getElementById('modal-canvas');
  if (canvas) drawSatCanvas(canvas, modalH, modalS, modalB);

  syncModalSliders();
  renderSwatches();
}

function syncModalSliders() {
  const thH = document.getElementById('modal-thumb-h');
  if (thH) thH.style.left = (modalH / 360 * 100) + '%';

  const thS = document.getElementById('modal-thumb-s');
  if (thS) thS.style.left = modalS + '%';

  const thB = document.getElementById('modal-thumb-b');
  if (thB) thB.style.left = modalB + '%';

  const valH = document.getElementById('modal-val-h');
  if (valH) valH.textContent = modalH;

  const valS = document.getElementById('modal-val-s');
  if (valS) valS.textContent = modalS;

  const valB = document.getElementById('modal-val-b');
  if (valB) valB.textContent = modalB;

  const trS = document.getElementById('modal-track-s');
  if (trS) trS.style.background = 'linear-gradient(to right,' + hsbToHex(modalH,0,modalB) + ',' + hsbToHex(modalH,100,modalB) + ')';

  const trB = document.getElementById('modal-track-b');
  if (trB) trB.style.background = 'linear-gradient(to right,#000,' + hsbToHex(modalH,modalS,100) + ')';

  const marker = document.getElementById('modal-marker');
  if (marker) {
    marker.style.left = modalS + '%';
    marker.style.top  = (100 - modalB) + '%';
  }
}

// modal picker drag
const modalPicker = document.getElementById('modal-picker');
if (modalPicker) {
  modalPicker.addEventListener('mousedown', e => { modalDraggingPicker = true; doPickSatBri(e, modalPicker, (s,b) => { modalS=s; modalB=b; syncModal(); }); });
  modalPicker.addEventListener('touchstart', e => { e.preventDefault(); doPickSatBri(e.touches[0], modalPicker, (s,b) => { modalS=s; modalB=b; syncModal(); }); }, { passive: false });
  modalPicker.addEventListener('touchmove',  e => { e.preventDefault(); doPickSatBri(e.touches[0], modalPicker, (s,b) => { modalS=s; modalB=b; syncModal(); }); }, { passive: false });
}

// modal slider drag
['h','s','b'].forEach(type => {
  const track = document.getElementById('modal-track-' + type);
  if (track) {
    track.addEventListener('mousedown', e => {
      modalDraggingSlider = true; modalActiveSlider = type;
      doMoveSlider(e, track, type, val => { 
        if(type==='h') modalH=val; 
        if(type==='s') modalS=val; 
        if(type==='b') modalB=val; 
        syncModal(); 
      });
    });
    
    track.addEventListener('touchstart', e => { 
      e.preventDefault(); 
      doMoveSlider(e.touches[0], track, type, val => { 
        if(type==='h') modalH=val; 
        if(type==='s') modalS=val; 
        if(type==='b') modalB=val; 
        syncModal(); 
      }); 
    }, { passive: false });
    
    track.addEventListener('touchmove', e => { 
      e.preventDefault(); 
      doMoveSlider(e.touches[0], track, type, val => { 
        if(type==='h') modalH=val; 
        if(type==='s') modalS=val; 
        if(type==='b') modalB=val; 
        syncModal(); 
      }); 
    }, { passive: false });
  }
});

// global mouse events for modal drag
window.addEventListener('mousemove', e => {
  if (modalDraggingPicker && modalPicker) {
    doPickSatBri(e, modalPicker, (s,b) => { modalS=s; modalB=b; syncModal(); });
  }
  if (modalDraggingSlider) {
    const track = document.getElementById('modal-track-' + modalActiveSlider);
    if (track) {
      doMoveSlider(e, track, modalActiveSlider, val => {
        if(modalActiveSlider==='h') modalH=val;
        if(modalActiveSlider==='s') modalS=val;
        if(modalActiveSlider==='b') modalB=val;
        syncModal();
      });
    }
  }
});

window.addEventListener('mouseup', () => {
  modalDraggingPicker = false;
  modalDraggingSlider = false;
  modalActiveSlider = null;
});

// modal action buttons
const btnClose = document.getElementById('modal-close');
if (btnClose) btnClose.addEventListener('click', closeEditorModal);

const btnReset = document.getElementById('modal-btn-reset');
if (btnReset) {
  btnReset.addEventListener('click', () => {
    [modalH, modalS, modalB] = hexToHsb(modalOrigHex);
    syncModal();
  });
}

const btnApply = document.getElementById('modal-btn-apply');
if (btnApply) {
  btnApply.addEventListener('click', () => {
    state.originals[state.activeTab][modalIndex] = hsbToHex(modalH, modalS, modalB);
    closeEditorModal();
    renderSwatches();
  });
}

// modal hex text input
const modalHexInp = document.getElementById('modal-hex-input');
if (modalHexInp) {
  modalHexInp.addEventListener('input', e => {
    let val = e.target.value.trim();
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      [modalH, modalS, modalB] = hexToHsb(val);
      syncModal();
    }
  });
}