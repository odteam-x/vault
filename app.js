/**
 * ============================================================
 * Meritora — app.js
 * Portfolio de Logros: Frontend + Canvas animation + Uploads
 * ============================================================
 */

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz1YTn1QNSlkCPB5xoA54OdNFTrM2rXWeMPePjtt5yMgmBGnjRW0uLqeiB1G_rFLWrdjQ/exec';

const PAGE_SIZE    = 9;
const TOAST_MS     = 3500;
const MAX_IMG_PX   = 800;   // max lado al comprimir imagen
const IMG_QUALITY  = 0.72;  // calidad JPEG

/* ============================================================
   CANVAS ANIMATED BACKGROUND
   ============================================================ */
function initCanvas() {
  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Partículas
  const N = 55;
  const particles = Array.from({ length: N }, () => ({
    x:    Math.random() * canvas.width,
    y:    Math.random() * canvas.height,
    r:    Math.random() * 1.4 + 0.3,
    vx:   (Math.random() - 0.5) * 0.3,
    vy:   (Math.random() - 0.5) * 0.3,
    alpha: Math.random() * 0.5 + 0.1,
    red:  Math.random() < 0.28, // 28% son partículas rojas
  }));

  // Líneas de grid
  const GRID_LINES = 6;

  let t = 0;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    t += 0.008;

    // Fondo radial sutil
    const gr = ctx.createRadialGradient(
      canvas.width * 0.7, canvas.height * 0.3, 0,
      canvas.width * 0.7, canvas.height * 0.3, canvas.width * 0.65
    );
    gr.addColorStop(0, 'rgba(58,122,150,0.08)');
    gr.addColorStop(1, 'transparent');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid diagonal animado
    ctx.save();
    ctx.strokeStyle = 'rgba(168,205,214,0.04)';
    ctx.lineWidth = 1;
    const spacing = canvas.width / GRID_LINES;
    for (let i = 0; i <= GRID_LINES * 2; i++) {
      const offset = (i * spacing + t * 12) % (canvas.width + canvas.height);
      ctx.beginPath();
      ctx.moveTo(offset - canvas.height, 0);
      ctx.lineTo(offset, canvas.height);
      ctx.stroke();
    }
    ctx.restore();

    // Partículas
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.red
        ? `rgba(224,48,58,${p.alpha})`
        : `rgba(168,205,214,${p.alpha * 0.5})`;
      ctx.fill();
    });

    // Líneas entre partículas cercanas
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 110) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          const a = (1 - dist / 110) * 0.07;
          ctx.strokeStyle = (particles[i].red || particles[j].red)
            ? `rgba(224,48,58,${a})`
            : `rgba(168,205,214,${a * 0.6})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    // Orbe azul acero pulsante
    const pulse = Math.sin(t * 1.8) * 0.3 + 0.7;
    const orb = ctx.createRadialGradient(
      canvas.width - 100, 80, 0,
      canvas.width - 100, 80, 180 * pulse
    );
    orb.addColorStop(0, 'rgba(58,122,150,0.07)');
    orb.addColorStop(1, 'transparent');
    ctx.fillStyle = orb;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    requestAnimationFrame(draw);
  }

  draw();
}

/* ============================================================
   ESTADO
   ============================================================ */
const state = {
  section: 'logros',
  records: { logros: [], voluntariados: [], personales: [] },
  filtered: { logros: [], voluntariados: [], personales: [] },
  pages:   { logros: 1, voluntariados: 1, personales: 1 },
  loading: { logros: false, voluntariados: false, personales: false },
  loaded:  { logros: false, voluntariados: false, personales: false },
  editingId: { logros: null, voluntariados: null, personales: null },
  deleteCallback: null,
};

/* ============================================================
   UTILIDADES
   ============================================================ */
function fmt(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function dateRange(start, end, presente) {
  const s = start ? fmt(start) : null;
  const e = presente === 'true' || presente === true
    ? 'Presente'
    : (end ? fmt(end) : null);
  if (s && e) return `${s} — ${e}`;
  if (s) return `${s}`;
  return e || '';
}

function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function tags(str) {
  if (!str) return [];
  return str.split(',').map(t => t.trim()).filter(Boolean);
}

function tagHtml(str) {
  return tags(str).map(t => `<span class="badge badge-tag">${esc(t)}</span>`).join('');
}

/* ============================================================
   COMPRESIÓN DE IMAGEN
   Redimensiona a MAX_IMG_PX y convierte a JPEG base64
   ============================================================ */
function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      resolve('');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('❌ La imagen supera 2MB. Usa una más pequeña.', 'error');
      resolve('');
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Escalar
        if (width > MAX_IMG_PX || height > MAX_IMG_PX) {
          const ratio = Math.min(MAX_IMG_PX / width, MAX_IMG_PX / height);
          width  = Math.round(width  * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', IMG_QUALITY));
      };
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Error leyendo archivo'));
    reader.readAsDataURL(file);
  });
}

/* ============================================================
   UPLOAD ZONES — drag & drop + preview
   ============================================================ */
function initUploadZone(zoneId, inputId, innerId, previewId, imgId, removeId, hiddenId) {
  const zone    = document.getElementById(zoneId);
  const input   = document.getElementById(inputId);
  const inner   = document.getElementById(innerId);
  const preview = document.getElementById(previewId);
  const imgEl   = document.getElementById(imgId);
  const remove  = document.getElementById(removeId);
  const hidden  = document.getElementById(hiddenId);
  if (!zone || !input) return;

  async function handleFile(file) {
    if (!file) return;
    const b64 = await compressImage(file);
    if (!b64) return;
    hidden.value = b64;
    imgEl.src = b64;
    inner.hidden = true;
    preview.hidden = false;
  }

  input.addEventListener('change', () => handleFile(input.files[0]));

  // Drag & drop
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handleFile(e.dataTransfer.files[0]);
  });

  // Keyboard accessibility
  zone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });

  // Remove image
  if (remove) {
    remove.addEventListener('click', e => {
      e.stopPropagation();
      hidden.value = '';
      imgEl.src = '';
      input.value = '';
      inner.hidden = false;
      preview.hidden = true;
    });
  }
}

function resetUploadZone(innerId, previewId, imgId, hiddenId) {
  const inner   = document.getElementById(innerId);
  const preview = document.getElementById(previewId);
  const imgEl   = document.getElementById(imgId);
  const hidden  = document.getElementById(hiddenId);
  if (inner)   inner.hidden   = false;
  if (preview) preview.hidden = true;
  if (imgEl)   imgEl.src      = '';
  if (hidden)  hidden.value   = '';
}

/* ============================================================
   API
   ============================================================ */
async function apiCall(action, type, data = {}) {
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, type, data }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error('Respuesta inválida del servidor'); }
  if (!json.ok) throw new Error(json.message || 'Error del servidor');
  return json;
}

const apiRead   = type       => apiCall('read',   type);
const apiCreate = (type, d)  => apiCall('create', type, d);
const apiUpdate = (type, id, d) => apiCall('update', type, { ...d, id });
const apiDelete = (type, id) => apiCall('delete', type, { id });

/* ============================================================
   CARGAR REGISTROS
   ============================================================ */
async function loadRecords(type) {
  if (state.loading[type]) return;
  state.loading[type] = true;
  renderList(type);

  try {
    const res = await apiRead(type);
    state.records[type] = res.data || [];
    state.loaded[type]  = true;
    state.loading[type] = false;
    applyFilter(type);
    renderStats(type);
  } catch (err) {
    console.error(err);
    showToast('No se pudieron cargar los registros.', 'error');
    state.records[type] = [];
    state.loaded[type]  = true;
    state.loading[type] = false;
    applyFilter(type);
  }
}

/* ============================================================
   FILTRADO
   ============================================================ */
function searchId(type) {
  return type === 'voluntariados' ? 'vol-search'
       : type === 'personales'   ? 'pers-search'
       : 'logros-search';
}

function applyFilter(type) {
  const q = (document.getElementById(searchId(type))?.value || '').toLowerCase().trim();
  state.filtered[type] = q
    ? state.records[type].filter(r =>
        (r.titulo        || '').toLowerCase().includes(q) ||
        (r.etiquetas     || '').toLowerCase().includes(q) ||
        (r.organizacion  || '').toLowerCase().includes(q) ||
        (r.descripcion   || '').toLowerCase().includes(q)
      )
    : [...state.records[type]];
  state.pages[type] = 1;
  renderList(type);
  renderStats(type);
}

/* ============================================================
   STATS
   ============================================================ */
function renderStats(type) {
  const id = type === 'logros' ? 'logros-stats'
           : type === 'voluntariados' ? 'vol-stats' : 'pers-stats';
  const el = document.getElementById(id);
  if (!el) return;

  const total    = state.records[type].length;
  const filtered = state.filtered[type].length;
  let html = `<div class="stat-chip"><strong>${total}</strong>&nbsp;total</div>`;

  if (type === 'voluntariados') {
    const hrs = state.records[type].reduce((s, r) => s + (parseFloat(r.horas) || 0), 0);
    if (hrs > 0) html += `<div class="stat-chip red"><strong>${hrs.toLocaleString()}</strong>&nbsp;hrs acumuladas</div>`;
    const activos = state.records[type].filter(r => r.presente === 'true').length;
    if (activos > 0) html += `<div class="stat-chip"><strong>${activos}</strong>&nbsp;activos</div>`;
  }

  if (filtered < total) html += `<div class="stat-chip"><strong>${filtered}</strong>&nbsp;resultados</div>`;

  el.innerHTML = html;
}

/* ============================================================
   RENDER LIST
   ============================================================ */
function listId(type) {
  return type === 'voluntariados' ? 'vol-list'
       : type === 'personales'   ? 'pers-list'
       : 'logros-list';
}

function renderList(type) {
  const el = document.getElementById(listId(type));
  if (!el) return;

  if (state.loading[type]) {
    el.innerHTML = `<div class="spinner-wrap"><div class="spinner" role="status" aria-label="Cargando"></div></div>`;
    return;
  }

  const items = state.filtered[type];
  if (!items.length) {
    const icon = type === 'logros' ? '🏆' : type === 'voluntariados' ? '❤️' : '⭐';
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${icon}</div>
        <p>Aún no hay registros aquí.<br>¡Agrega el primero!</p>
      </div>`;
    renderPagination(type);
    return;
  }

  const page  = state.pages[type];
  const start = (page - 1) * PAGE_SIZE;
  const slice = items.slice(start, start + PAGE_SIZE);

  el.innerHTML = slice.map((r, i) => buildCard(type, r, i)).join('');
  renderPagination(type);
}

/* ============================================================
   BUILD CARD
   ============================================================ */
function buildCard(type, r, idx) {
  const dr  = dateRange(r.fechaInicio, r.fechaFin, r.presente);
  const isP = r.presente === 'true' || r.presente === true;
  const delay = Math.min(idx * 60, 400);

  let imgHtml = '';
  if (r.certificado && r.certificado.startsWith('data:image')) {
    imgHtml = `<img class="card-img-banner" src="${r.certificado}" alt="Certificado" loading="lazy" data-cert="${esc(r.certificado)}" />`;
  }

  let meta = '';
  if (dr) meta += `<span class="badge badge-date">📅 ${esc(dr)}</span>`;
  if (isP) meta += `<span class="badge badge-presente">● En curso</span>`;

  if (type === 'logros' || type === 'personales') {
    if (r.puesto) meta += `<span class="badge badge-lugar">🏅 ${esc(r.puesto)}</span>`;
    if (r.beneficios) meta += `<span class="badge badge-tag">🎁 ${esc(r.beneficios)}</span>`;
  }

  if (type === 'voluntariados') {
    if (r.organizacion) meta += `<span class="badge badge-org">🏢 ${esc(r.organizacion)}</span>`;
    if (r.rol)          meta += `<span class="badge badge-tag">👤 ${esc(r.rol)}</span>`;
    if (r.horas)        meta += `<span class="badge badge-horas">⏱ ${esc(r.horas)}h</span>`;
  }

  const footerTags = tagHtml(r.etiquetas);

  return `
    <article class="card" role="listitem" data-id="${esc(r.id)}" data-type="${esc(type)}"
      style="animation-delay:${delay}ms">
      ${imgHtml}
      <div class="card-accent"></div>
      <div class="card-body">
        <div class="card-top">
          <h3 class="card-title">${esc(r.titulo)}</h3>
          <div class="card-actions">
            <button class="ico-btn edit-btn" aria-label="Editar ${esc(r.titulo)}" data-id="${esc(r.id)}" data-type="${esc(type)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="ico-btn del delete-btn" aria-label="Eliminar ${esc(r.titulo)}" data-id="${esc(r.id)}" data-type="${esc(type)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
            </button>
          </div>
        </div>
        ${meta ? `<div class="card-meta">${meta}</div>` : ''}
        ${r.descripcion ? `<p class="card-desc">${esc(r.descripcion)}</p>` : ''}
        ${footerTags ? `<div class="card-footer">${footerTags}</div>` : ''}
      </div>
    </article>`;
}

/* ============================================================
   PAGINATION
   ============================================================ */
function paginId(type) {
  return type === 'voluntariados' ? 'vol-pagination'
       : type === 'personales'   ? 'pers-pagination'
       : 'logros-pagination';
}

function renderPagination(type) {
  const el = document.getElementById(paginId(type));
  if (!el) return;
  const total = Math.ceil(state.filtered[type].length / PAGE_SIZE);
  if (total <= 1) { el.innerHTML = ''; return; }
  const cur = state.pages[type];
  let html = `<button class="pg-btn" ${cur===1?'disabled':''} data-page="${cur-1}" data-type="${type}" aria-label="Anterior">‹</button>`;
  for (let i = 1; i <= total; i++) {
    html += `<button class="pg-btn ${i===cur?'active':''}" data-page="${i}" data-type="${type}" ${i===cur?'aria-current="page"':''}>${i}</button>`;
  }
  html += `<button class="pg-btn" ${cur===total?'disabled':''} data-page="${cur+1}" data-type="${type}" aria-label="Siguiente">›</button>`;
  el.innerHTML = html;
}

const MODAL = { logros: 'modal-logro', voluntariados: 'modal-voluntariado', personales: 'modal-personal' };

function openModal(type, record = null) {
  const id = MODAL[type];
  const el = document.getElementById(id);
  if (!el) return;
  state.editingId[type] = record?.id || null;
  fillForm(type, record);
  updateModalTitle(type, !!record);
  el.hidden = false;
  el.querySelector('.modal-close')?.focus();

  // Si es un registro NUEVO (no edición), intentar restaurar borrador
  if (!record) {
    const restored = restoreDraft(type);
    if (restored) {
      showToast('📝 Borrador restaurado — continúa donde lo dejaste.', '');
      showDraftIndicator(type);
    }
  } else {
    hideDraftIndicator(type);
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = true;
  clearErrs(id);
}

function updateModalTitle(type, isEdit) {
  const titles = {
    logros:        isEdit ? 'EDITAR LOGRO'        : 'NUEVO LOGRO',
    voluntariados: isEdit ? 'EDITAR VOLUNTARIADO'  : 'NUEVO VOLUNTARIADO',
    personales:    isEdit ? 'EDITAR LOGRO PERSONAL': 'LOGRO PERSONAL',
  };
  const id = MODAL[type];
  const el = document.querySelector(`#${id} .modal-title`);
  if (el) el.textContent = titles[type];
  const btn = document.querySelector(`#${id} .btext`);
  if (btn) btn.textContent = isEdit ? 'Guardar cambios' : (type === 'voluntariados' ? 'Guardar voluntariado' : 'Guardar logro');
}

function fillForm(type, r) {
  const v = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  const c = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

  if (type === 'logros' || type === 'personales') {
    const p = type === 'logros' ? 'logro' : 'pers';
    v(`${p}-id`, r?.id); v(`${p}-titulo`, r?.titulo); v(`${p}-desc`, r?.descripcion);
    v(`${p}-puesto`, r?.puesto); v(`${p}-beneficios`, r?.beneficios);
    v(`${p}-fecha-inicio`, r?.fechaInicio); v(`${p}-fecha-fin`, r?.fechaFin);
    c(`${p}-presente`, r?.presente === 'true');
    v(`${p}-tags`, r?.etiquetas);
    toggleDateFin(`${p}-presente`, `${p}-fecha-fin`);

    // Precargar imagen si existe
    const uppreview = document.getElementById(`${p}-uppreview`);
    const upinner   = document.getElementById(`${p}-upinner`);
    const imgEl     = document.getElementById(`${p}-img-preview`);
    const hidden    = document.getElementById(`${p}-cert-data`);
    if (r?.certificado && r.certificado.startsWith('data:image')) {
      if (hidden)  hidden.value   = r.certificado;
      if (imgEl)   imgEl.src      = r.certificado;
      if (upinner) upinner.hidden = true;
      if (uppreview) uppreview.hidden = false;
    } else {
      resetUploadZone(`${p}-upinner`, `${p}-uppreview`, `${p}-img-preview`, `${p}-cert-data`);
    }
  }

  if (type === 'voluntariados') {
    v('vol-id', r?.id); v('vol-titulo', r?.titulo); v('vol-org', r?.organizacion);
    v('vol-desc', r?.descripcion); v('vol-fecha-inicio', r?.fechaInicio);
    v('vol-fecha-fin', r?.fechaFin); c('vol-presente', r?.presente === 'true');
    v('vol-rol', r?.rol); v('vol-horas', r?.horas);
    toggleDateFin('vol-presente', 'vol-fecha-fin');

    const hidden = document.getElementById('vol-cert-data');
    const imgEl  = document.getElementById('vol-img-preview');
    const uppreview = document.getElementById('vol-uppreview');
    const upinner   = document.getElementById('vol-upinner');
    if (r?.certificado && r.certificado.startsWith('data:image')) {
      if (hidden)  hidden.value = r.certificado;
      if (imgEl)   imgEl.src   = r.certificado;
      if (upinner) upinner.hidden = true;
      if (uppreview) uppreview.hidden = false;
    } else {
      resetUploadZone('vol-upinner', 'vol-uppreview', 'vol-img-preview', 'vol-cert-data');
    }
  }
}

function clearErrs(modalId) {
  document.querySelectorAll(`#${modalId} .fe`).forEach(e => e.textContent = '');
  document.querySelectorAll(`#${modalId} .fi`).forEach(i => i.classList.remove('err'));
}

function toggleDateFin(cbId, inputId) {
  const cb = document.getElementById(cbId);
  const inp = document.getElementById(inputId);
  if (!cb || !inp) return;
  inp.disabled = cb.checked;
  if (cb.checked) inp.value = '';
}

/* ============================================================
   VALIDACIONES
   ============================================================ */
function valTitulo(prefix) {
  const el  = document.getElementById(`${prefix}-titulo`);
  const err = document.getElementById(`${prefix}-titulo-err`);
  if (!el?.value.trim()) {
    if (err) err.textContent = 'El título es obligatorio.';
    el?.classList.add('err');
    el?.focus();
    return false;
  }
  if (err) err.textContent = '';
  el.classList.remove('err');
  return true;
}

function valVoluntariado() {
  let ok = valTitulo('vol');
  const fi  = document.getElementById('vol-fecha-inicio');
  const err = document.getElementById('vol-fecha-inicio-err');
  if (!fi?.value) {
    if (err) err.textContent = 'La fecha de inicio es obligatoria.';
    fi?.classList.add('err');
    if (ok) fi?.focus();
    ok = false;
  } else {
    if (err) err.textContent = '';
    fi?.classList.remove('err');
  }
  return ok;
}

/* ============================================================
   RECOLECTAR DATOS
   ============================================================ */
function gv(id) { return document.getElementById(id)?.value?.trim() || ''; }
function gc(id) { return document.getElementById(id)?.checked ? 'true' : 'false'; }
function gh(id) { return document.getElementById(id)?.value || ''; }

function collectLogro(p) {
  return {
    titulo:      gv(`${p}-titulo`),
    descripcion: gv(`${p}-desc`),
    puesto:      gv(`${p}-puesto`),
    beneficios:  gv(`${p}-beneficios`),
    fechaInicio: gv(`${p}-fecha-inicio`),
    fechaFin:    gv(`${p}-fecha-fin`),
    presente:    gc(`${p}-presente`),
    etiquetas:   gv(`${p}-tags`),
    certificado: gh(`${p}-cert-data`),
  };
}

function collectVol() {
  return {
    titulo:       gv('vol-titulo'),
    organizacion: gv('vol-org'),
    descripcion:  gv('vol-desc'),
    fechaInicio:  gv('vol-fecha-inicio'),
    fechaFin:     gv('vol-fecha-fin'),
    presente:     gc('vol-presente'),
    rol:          gv('vol-rol'),
    horas:        gv('vol-horas'),
    certificado:  gh('vol-cert-data'),
  };
}

/* ============================================================
   BORRADORES — Auto-guardado en localStorage
   Guarda cada campo mientras el usuario escribe.
   Si cierra el navegador y vuelve, el borrador se restaura.
   ============================================================ */

// Campos por tipo de formulario
const DRAFT_FIELDS = {
  logros: [
    { id: 'logro-titulo',       type: 'text' },
    { id: 'logro-desc',         type: 'text' },
    { id: 'logro-puesto',       type: 'text' },
    { id: 'logro-beneficios',   type: 'text' },
    { id: 'logro-fecha-inicio', type: 'text' },
    { id: 'logro-fecha-fin',    type: 'text' },
    { id: 'logro-presente',     type: 'check' },
    { id: 'logro-tags',         type: 'text' },
    { id: 'logro-cert-data',    type: 'hidden' },
  ],
  voluntariados: [
    { id: 'vol-titulo',         type: 'text' },
    { id: 'vol-org',            type: 'text' },
    { id: 'vol-desc',           type: 'text' },
    { id: 'vol-fecha-inicio',   type: 'text' },
    { id: 'vol-fecha-fin',      type: 'text' },
    { id: 'vol-presente',       type: 'check' },
    { id: 'vol-rol',            type: 'text' },
    { id: 'vol-horas',          type: 'text' },
    { id: 'vol-cert-data',      type: 'hidden' },
  ],
  personales: [
    { id: 'pers-titulo',        type: 'text' },
    { id: 'pers-desc',          type: 'text' },
    { id: 'pers-puesto',        type: 'text' },
    { id: 'pers-beneficios',    type: 'text' },
    { id: 'pers-fecha-inicio',  type: 'text' },
    { id: 'pers-fecha-fin',     type: 'text' },
    { id: 'pers-presente',      type: 'check' },
    { id: 'pers-tags',          type: 'text' },
    { id: 'pers-cert-data',     type: 'hidden' },
  ],
};

const DRAFT_KEY = type => `Meritora_draft_${type}`;

/** Guarda el borrador actual del formulario en localStorage */
function saveDraft(type) {
  const fields = DRAFT_FIELDS[type];
  if (!fields) return;

  const draft = {};
  fields.forEach(({ id, type: ftype }) => {
    const el = document.getElementById(id);
    if (!el) return;
    draft[id] = ftype === 'check' ? el.checked : el.value;
  });

  // Solo guardar si hay al menos un campo con contenido
  const hasContent = Object.values(draft).some(v => v && v !== false && v !== '');
  if (hasContent) {
    localStorage.setItem(DRAFT_KEY(type), JSON.stringify(draft));
    showDraftIndicator(type);
  }
}

/** Restaura el borrador en el formulario */
function restoreDraft(type) {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(type));
    if (!raw) return false;
    const draft = JSON.parse(raw);

    let restored = false;
    DRAFT_FIELDS[type].forEach(({ id, type: ftype }) => {
      const el = document.getElementById(id);
      if (!el || draft[id] === undefined) return;

      if (ftype === 'check') {
        el.checked = Boolean(draft[id]);
      } else {
        el.value = draft[id] || '';
      }

      if (draft[id]) restored = true;
    });

    // Restaurar imagen si hay base64 guardado
    const certKey = type === 'logros' ? 'logro-cert-data'
                  : type === 'voluntariados' ? 'vol-cert-data' : 'pers-cert-data';
    const prefix  = type === 'logros' ? 'logro'
                  : type === 'voluntariados' ? 'vol' : 'pers';

    if (draft[certKey] && draft[certKey].startsWith('data:image')) {
      const imgEl     = document.getElementById(`${prefix}-img-preview`);
      const upinner   = document.getElementById(`${prefix}-upinner`);
      const uppreview = document.getElementById(`${prefix}-uppreview`);
      if (imgEl)     imgEl.src        = draft[certKey];
      if (upinner)   upinner.hidden   = true;
      if (uppreview) uppreview.hidden = false;
    }

    // Restaurar estado del checkbox "presente"
    const cbMap = { logros: 'logro-presente', voluntariados: 'vol-presente', personales: 'pers-presente' };
    const inMap = { logros: 'logro-fecha-fin', voluntariados: 'vol-fecha-fin', personales: 'pers-fecha-fin' };
    toggleDateFin(cbMap[type], inMap[type]);

    return restored;
  } catch {
    return false;
  }
}

/** Borra el borrador de localStorage */
function clearDraft(type) {
  localStorage.removeItem(DRAFT_KEY(type));
  hideDraftIndicator(type);
}

/** Muestra el indicador "Borrador guardado" en el modal */
function showDraftIndicator(type) {
  const mid = MODAL[type];
  let ind = document.getElementById(`${mid}-draft-ind`);
  if (!ind) {
    ind = document.createElement('span');
    ind.id = `${mid}-draft-ind`;
    ind.className = 'draft-indicator';
    ind.textContent = '● Borrador guardado';
    const head = document.querySelector(`#${mid} .modal-head`);
    if (head) head.appendChild(ind);
  }
  ind.hidden = false;
}

function hideDraftIndicator(type) {
  const ind = document.getElementById(`${MODAL[type]}-draft-ind`);
  if (ind) ind.hidden = true;
}

/** Conecta los listeners de auto-guardado a todos los campos del formulario */
function bindDraftListeners(type) {
  DRAFT_FIELDS[type].forEach(({ id, type: ftype }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const event = ftype === 'check' ? 'change' : 'input';
    el.addEventListener(event, () => saveDraft(type));
  });
}

/* ============================================================
   SUBMIT
   ============================================================ */
async function handleSubmit(type, collectFn, validateFn) {
  if (!validateFn()) return;
  const data   = collectFn();
  const editId = state.editingId[type];
  const mid    = MODAL[type];
  const btn    = document.querySelector(`#${mid} .btn-red`);

  if (btn) { btn.querySelector('.btext').hidden = true; btn.querySelector('.bload').hidden = false; btn.disabled = true; }

  try {
    if (editId) {
      await apiUpdate(type, editId, data);
      showToast('✅ Registro actualizado.', 'success');
    } else {
      await apiCreate(type, data);
      clearDraft(type); // ← borrar borrador solo al guardar con éxito
      showToast('✅ Registro creado.', 'success');
    }
    closeModal(mid);
    await loadRecords(type);
  } catch (err) {
    showToast(`❌ ${err.message}`, 'error');
  } finally {
    if (btn) { btn.querySelector('.btext').hidden = false; btn.querySelector('.bload').hidden = true; btn.disabled = false; }
  }
}

/* ============================================================
   ELIMINAR
   ============================================================ */
function confirmDelete(type, id, title) {
  document.getElementById('confirm-message').textContent =
    `¿Eliminar "${title}"? Esta acción no se puede deshacer.`;
  state.deleteCallback = async () => {
    try {
      await apiDelete(type, id);
      showToast('🗑️ Registro eliminado.', 'success');
      await loadRecords(type);
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error');
    }
  };
  document.getElementById('modal-confirm').hidden = false;
}

/* ============================================================
   EXPORTAR CSV
   ============================================================ */
function exportCSV() {
  const type  = state.section;
  const items = state.filtered[type];
  if (!items.length) { showToast('No hay registros para exportar.', 'error'); return; }

  const headers = type === 'voluntariados'
    ? ['ID','Título','Organización','Descripción','Fecha Inicio','Fecha Fin','Presente','Rol','Horas','Creado','Actualizado']
    : ['ID','Título','Descripción','Puesto','Beneficios','Fecha Inicio','Fecha Fin','Presente','Etiquetas','Creado','Actualizado'];

  const rows = items.map(r => type === 'voluntariados'
    ? [r.id, r.titulo, r.organizacion, r.descripcion, r.fechaInicio, r.fechaFin, r.presente, r.rol, r.horas, r.createdAt, r.updatedAt]
    : [r.id, r.titulo, r.descripcion, r.puesto, r.beneficios, r.fechaInicio, r.fechaFin, r.presente, r.etiquetas, r.createdAt, r.updatedAt]
  );

  const csv = [headers, ...rows]
    .map(row => row.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${type}_${new Date().toISOString().split('T')[0]}.csv` });
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(`📥 CSV exportado — ${items.length} registros.`, 'success');
}

/* ============================================================
   TOAST
   ============================================================ */
let toastTimer;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  if (!el) return;
  clearTimeout(toastTimer);
  el.textContent = msg;
  el.className   = `toast ${type}`;
  el.hidden      = false;
  toastTimer = setTimeout(() => { el.hidden = true; }, TOAST_MS);
}

/* ============================================================
   NAVEGACIÓN
   ============================================================ */
function switchSection(section) {
  state.section = section;

  document.querySelectorAll('.nav-item').forEach(b => {
    const active = b.dataset.section === section;
    b.classList.toggle('active', active);
    b.setAttribute('aria-current', active ? 'page' : 'false');
  });

  ['logros','voluntariados','personales'].forEach(s => {
    const el = document.getElementById(`section-${s}`);
    if (el) el.hidden = s !== section;
  });

  if (!state.loaded[section] && !state.loading[section]) {
    loadRecords(section);
  }
}

/* ============================================================
   SIDEBAR TOGGLE
   ============================================================ */
function toggleSidebar(force) {
  const sb  = document.getElementById('sidebar');
  const ov  = document.getElementById('overlay');
  const btn = document.getElementById('hamburgerBtn');
  const open = force !== undefined ? force : !sb.classList.contains('open');
  sb.classList.toggle('open', open);
  ov.classList.toggle('show', open);
  btn?.classList.toggle('open', open);
  btn?.setAttribute('aria-expanded', String(open));
}

/* ============================================================
   EVENT LISTENERS
   ============================================================ */
function bindEvents() {
  // Nav
  document.querySelectorAll('.nav-item').forEach(b =>
    b.addEventListener('click', () => { switchSection(b.dataset.section); toggleSidebar(false); })
  );

  // Hamburger / overlay
  document.getElementById('hamburgerBtn')?.addEventListener('click', () => toggleSidebar());
  document.getElementById('overlay')?.addEventListener('click', () => toggleSidebar(false));

  // New buttons
  [['newLogroBtn','logros'],['newVolBtn','voluntariados'],['newPersBtn','personales']].forEach(([id, type]) => {
    document.getElementById(id)?.addEventListener('click', () => openModal(type));
  });

  // Modal close buttons
  document.querySelectorAll('[data-close]').forEach(b =>
    b.addEventListener('click', () => closeModal(b.dataset.close))
  );

  // Close on backdrop click
  ['modal-logro','modal-voluntariado','modal-personal','modal-image'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', e => { if (e.target.id === id) closeModal(id); });
  });

  // ESC key
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    ['modal-logro','modal-voluntariado','modal-personal','modal-confirm','modal-image']
      .forEach(id => { const el = document.getElementById(id); if (el && !el.hidden) closeModal(id); });
  });

  // Checkbox "presente"
  [['logro-presente','logro-fecha-fin'],['vol-presente','vol-fecha-fin'],['pers-presente','pers-fecha-fin']].forEach(([cb, inp]) =>
    document.getElementById(cb)?.addEventListener('change', () => toggleDateFin(cb, inp))
  );

  // Form submits
  document.getElementById('form-logro')?.addEventListener('submit', e => {
    e.preventDefault();
    handleSubmit('logros', () => collectLogro('logro'), () => valTitulo('logro'));
  });
  document.getElementById('form-voluntariado')?.addEventListener('submit', e => {
    e.preventDefault();
    handleSubmit('voluntariados', collectVol, valVoluntariado);
  });
  document.getElementById('form-personal')?.addEventListener('submit', e => {
    e.preventDefault();
    handleSubmit('personales', () => collectLogro('pers'), () => valTitulo('pers'));
  });

  // Search
  document.getElementById('logros-search')?.addEventListener('input', () => applyFilter('logros'));
  document.getElementById('vol-search')?.addEventListener('input', () => applyFilter('voluntariados'));
  document.getElementById('pers-search')?.addEventListener('input', () => applyFilter('personales'));

  // Delegated: pagination, edit, delete, image zoom
  document.getElementById('mainContent')?.addEventListener('click', e => {
    // Pagination
    const pg = e.target.closest('.pg-btn');
    if (pg?.dataset.type) { state.pages[pg.dataset.type] = +pg.dataset.page; renderList(pg.dataset.type); return; }

    // Edit
    const ed = e.target.closest('.edit-btn');
    if (ed) {
      const r = state.records[ed.dataset.type]?.find(x => x.id === ed.dataset.id);
      if (r) openModal(ed.dataset.type, r);
      return;
    }

    // Delete
    const dl = e.target.closest('.delete-btn');
    if (dl) {
      const r = state.records[dl.dataset.type]?.find(x => x.id === dl.dataset.id);
      if (r) confirmDelete(dl.dataset.type, dl.dataset.id, r.titulo);
      return;
    }

    // Image zoom
    const img = e.target.closest('.card-img-banner');
    if (img?.dataset.cert) {
      document.getElementById('modal-img-src').src = img.dataset.cert;
      document.getElementById('modal-image').hidden = false;
      return;
    }
  });

  // Confirm delete
  document.getElementById('confirm-ok')?.addEventListener('click', async () => {
    document.getElementById('modal-confirm').hidden = true;
    if (state.deleteCallback) { await state.deleteCallback(); state.deleteCallback = null; }
  });
  document.getElementById('confirm-cancel')?.addEventListener('click', () => {
    document.getElementById('modal-confirm').hidden = true;
    state.deleteCallback = null;
  });

  // Export CSV
  document.getElementById('exportCsvBtn')?.addEventListener('click', exportCSV);
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initCanvas();

  // Init upload zones
  initUploadZone('logro-upzone','logro-cert','logro-upinner','logro-uppreview','logro-img-preview','logro-remove-img','logro-cert-data');
  initUploadZone('vol-upzone',  'vol-cert',  'vol-upinner',  'vol-uppreview',  'vol-img-preview',  'vol-remove-img',  'vol-cert-data');
  initUploadZone('pers-upzone', 'pers-cert', 'pers-upinner', 'pers-uppreview', 'pers-img-preview', 'pers-remove-img', 'pers-cert-data');

  bindEvents();

  // ── Activar auto-guardado de borradores ──
  bindDraftListeners('logros');
  bindDraftListeners('voluntariados');
  bindDraftListeners('personales');

  showToast('⏳ Cargando registros…', '');
  Promise.all([
    loadRecords('logros'),
    loadRecords('voluntariados'),
    loadRecords('personales'),
  ]).then(() => {
    const total = state.records.logros.length + state.records.voluntariados.length + state.records.personales.length;
    showToast(
      total > 0 ? `✅ ${total} registro(s) cargado(s).` : '📭 Sin registros aún. ¡Agrega el primero!',
      total > 0 ? 'success' : ''
    );
  });
});