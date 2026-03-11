/**
 * ============================================================
 * Meritora — app.js  v2.0
 * Módulos: Logros · Voluntariados · Personales · Estudios
 * Nuevo:   Materias, Tareas, Apuntes + corrección de fechas
 * ============================================================
 */

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxn_ryDyrXkBSa5qoY1b0Key-7GOzS9kZ1k9stZDZ2vMT6h74qmrsWkGWn7xPy8ej_P7g/exec';

const PAGE_SIZE  = 9;
const TOAST_MS   = 3500;
const MAX_IMG_PX = 800;
const IMG_QUALITY = 0.72;

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

  const N = 60;
  const particles = Array.from({ length: N }, () => ({
    x:    Math.random() * canvas.width,
    y:    Math.random() * canvas.height,
    r:    Math.random() * 1.6 + 0.3,
    vx:   (Math.random() - 0.5) * 0.35,
    vy:   (Math.random() - 0.5) * 0.35,
    alpha: Math.random() * 0.5 + 0.1,
    red:  Math.random() < 0.22,
    steel: Math.random() < 0.5,
  }));

  const GRID_LINES = 7;
  let t = 0;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    t += 0.007;

    // Radial glow top-right
    const gr1 = ctx.createRadialGradient(
      canvas.width * 0.85, canvas.height * 0.1, 0,
      canvas.width * 0.85, canvas.height * 0.1, canvas.width * 0.55
    );
    gr1.addColorStop(0, 'rgba(58,122,150,0.12)');
    gr1.addColorStop(1, 'transparent');
    ctx.fillStyle = gr1;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Radial glow bottom-left
    const gr2 = ctx.createRadialGradient(
      canvas.width * 0.1, canvas.height * 0.9, 0,
      canvas.width * 0.1, canvas.height * 0.9, canvas.width * 0.4
    );
    gr2.addColorStop(0, 'rgba(28,51,82,0.08)');
    gr2.addColorStop(1, 'transparent');
    ctx.fillStyle = gr2;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid diagonal animado
    ctx.save();
    ctx.strokeStyle = 'rgba(168,205,214,0.035)';
    ctx.lineWidth = 1;
    const spacing = canvas.width / GRID_LINES;
    for (let i = 0; i <= GRID_LINES * 2; i++) {
      const offset = (i * spacing + t * 10) % (canvas.width + canvas.height);
      ctx.beginPath();
      ctx.moveTo(offset - canvas.height, 0);
      ctx.lineTo(offset, canvas.height);
      ctx.stroke();
    }
    ctx.restore();

    // Partículas
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width)  p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.red
        ? `rgba(224,48,58,${p.alpha})`
        : p.steel
          ? `rgba(58,122,150,${p.alpha * 0.7})`
          : `rgba(168,205,214,${p.alpha * 0.5})`;
      ctx.fill();
    });

    // Líneas entre partículas cercanas
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          const a = (1 - dist / 120) * 0.06;
          ctx.strokeStyle = (particles[i].red || particles[j].red)
            ? `rgba(224,48,58,${a})`
            : `rgba(168,205,214,${a * 0.6})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }
    }

    // Orbe pulsante principal
    const pulse = Math.sin(t * 1.6) * 0.25 + 0.75;
    const orb = ctx.createRadialGradient(
      canvas.width - 80, 60, 0,
      canvas.width - 80, 60, 200 * pulse
    );
    orb.addColorStop(0, 'rgba(58,122,150,0.06)');
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
  estudiosTab: 'materias',
  records:  { logros: [], voluntariados: [], personales: [], materias: [], tareas: [], apuntes: [] },
  filtered: { logros: [], voluntariados: [], personales: [], materias: [], tareas: [], apuntes: [] },
  pages:    { logros: 1,  voluntariados: 1,  personales: 1,  materias: 1, tareas: 1, apuntes: 1 },
  loading:  { logros: false, voluntariados: false, personales: false, materias: false, tareas: false, apuntes: false },
  loaded:   { logros: false, voluntariados: false, personales: false, materias: false, tareas: false, apuntes: false },
  editingId: { logros: null, voluntariados: null, personales: null, materias: null, tareas: null, apuntes: null },
  deleteCallback: null,
};

/* ============================================================
   UTILIDADES — FORMATO DE FECHAS (CORREGIDO)

   El backend ahora devuelve fechas como "2025-03-05" (ISO),
   nunca como "Tue Mar 05 2025 00:00:00 GMT-0400...".
   Las funciones fmt() y dateRange() esperan formato "yyyy-MM-dd".
   ============================================================ */

/**
 * fmt — Convierte "2025-03-05" en "05/03/2025"
 * También acepta "2025-03-05T00:00:00.000Z" (ISO completo)
 */
function fmt(iso) {
  if (!iso || typeof iso !== 'string') return '';
  // Tomar solo la parte de fecha si viene ISO completo
  const datePart = iso.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length !== 3) return iso; // devolver tal cual si formato inesperado
  const [y, m, d] = parts;
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

/**
 * fmtLong — Convierte "2025-03-05" en "5 de marzo de 2025"
 */
function fmtLong(iso) {
  if (!iso) return '';
  const datePart = iso.split('T')[0];
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return fmt(iso);
  const meses = ['enero','febrero','marzo','abril','mayo','junio',
                  'julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${d} de ${meses[m - 1]} de ${y}`;
}

function dateRange(start, end, presente) {
  const s = start ? fmt(start) : null;
  const e = (presente === 'true' || presente === true) ? 'Presente' : (end ? fmt(end) : null);
  if (s && e) return `${s} — ${e}`;
  if (s) return s;
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
   ============================================================ */
function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) { resolve(''); return; }
    if (file.size > 2 * 1024 * 1024) {
      showToast('❌ La imagen supera 2MB. Usa una más pequeña.', 'error');
      resolve(''); return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > MAX_IMG_PX || height > MAX_IMG_PX) {
          const ratio = Math.min(MAX_IMG_PX / width, MAX_IMG_PX / height);
          width  = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
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
   UPLOAD ZONES
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
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    handleFile(e.dataTransfer.files[0]);
  });
  zone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
  if (remove) {
    remove.addEventListener('click', e => {
      e.stopPropagation();
      hidden.value = ''; imgEl.src = ''; input.value = '';
      inner.hidden = false; preview.hidden = true;
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
  try { json = JSON.parse(text); } catch { throw new Error('Respuesta inválida del servidor'); }
  if (!json.ok) throw new Error(json.message || 'Error del servidor');
  return json;
}

const apiRead   = type          => apiCall('read',   type);
const apiCreate = (type, d)     => apiCall('create', type, d);
const apiUpdate = (type, id, d) => apiCall('update', type, { ...d, id });
const apiDelete = (type, id)    => apiCall('delete', type, { id });

/* ============================================================
   CARGAR REGISTROS
   ============================================================ */
async function loadRecords(type) {
  if (state.loading[type]) return;
  state.loading[type] = true;

  if (['logros','voluntariados','personales'].includes(type)) renderList(type);
  else renderEstudiosList(type);

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
  const map = {
    logros: 'logros-search', voluntariados: 'vol-search', personales: 'pers-search',
    materias: 'mat-search', tareas: 'tar-search', apuntes: 'apu-search',
  };
  return map[type] || '';
}

function applyFilter(type) {
  const q = (document.getElementById(searchId(type))?.value || '').toLowerCase().trim();
  state.filtered[type] = q
    ? state.records[type].filter(r =>
        (r.titulo || r.nombre || '').toLowerCase().includes(q) ||
        (r.etiquetas     || '').toLowerCase().includes(q) ||
        (r.organizacion  || '').toLowerCase().includes(q) ||
        (r.descripcion   || '').toLowerCase().includes(q) ||
        (r.contenido     || '').toLowerCase().includes(q) ||
        (r.profesor      || '').toLowerCase().includes(q) ||
        (r.periodo       || '').toLowerCase().includes(q)
      )
    : [...state.records[type]];
  state.pages[type] = 1;

  if (['logros','voluntariados','personales'].includes(type)) renderList(type);
  else renderEstudiosList(type);
  renderStats(type);
}

/* ============================================================
   STATS
   ============================================================ */
function renderStats(type) {
  const idMap = {
    logros: 'logros-stats', voluntariados: 'vol-stats', personales: 'pers-stats',
    materias: 'mat-stats', tareas: 'tar-stats', apuntes: 'apu-stats',
  };
  const el = document.getElementById(idMap[type]);
  if (!el) return;

  const total    = state.records[type].length;
  const filtered = state.filtered[type].length;
  let html = `<div class="stat-chip"><strong>${total}</strong>&nbsp;total</div>`;

  if (type === 'voluntariados') {
    const hrs = state.records[type].reduce((s, r) => s + (parseFloat(r.horas) || 0), 0);
    if (hrs > 0) html += `<div class="stat-chip red"><strong>${hrs.toLocaleString()}</strong>&nbsp;hrs acumuladas</div>`;
    const activos = state.records[type].filter(r => r.presente === 'true').length;
    if (activos) html += `<div class="stat-chip"><strong>${activos}</strong>&nbsp;activos</div>`;
  }

  if (type === 'materias') {
    const enCurso   = state.records[type].filter(r => r.estado === 'en_curso').length;
    const finalizadas = state.records[type].filter(r => r.estado === 'finalizada').length;
    if (enCurso)    html += `<div class="stat-chip blue"><strong>${enCurso}</strong>&nbsp;en curso</div>`;
    if (finalizadas) html += `<div class="stat-chip"><strong>${finalizadas}</strong>&nbsp;finalizadas</div>`;
  }

  if (type === 'tareas') {
    const pend  = state.records[type].filter(r => r.estado === 'pendiente').length;
    const prog  = state.records[type].filter(r => r.estado === 'en_progreso').length;
    const comp  = state.records[type].filter(r => r.estado === 'completada').length;
    if (pend) html += `<div class="stat-chip red"><strong>${pend}</strong>&nbsp;pendientes</div>`;
    if (prog) html += `<div class="stat-chip blue"><strong>${prog}</strong>&nbsp;en progreso</div>`;
    if (comp) html += `<div class="stat-chip"><strong>${comp}</strong>&nbsp;completadas</div>`;
  }

  if (filtered < total) html += `<div class="stat-chip"><strong>${filtered}</strong>&nbsp;resultados</div>`;
  el.innerHTML = html;
}

/* ============================================================
   RENDER LIST (Logros / Voluntariados / Personales)
   ============================================================ */
function listId(type) {
  return type === 'voluntariados' ? 'vol-list' : type === 'personales' ? 'pers-list' : 'logros-list';
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
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon}</div><p>Aún no hay registros aquí.<br>¡Agrega el primero!</p></div>`;
    renderPagination(type); return;
  }

  const page  = state.pages[type];
  const start = (page - 1) * PAGE_SIZE;
  const slice = items.slice(start, start + PAGE_SIZE);
  el.innerHTML = slice.map((r, i) => buildCard(type, r, i)).join('');
  renderPagination(type);
}

/* ============================================================
   BUILD CARD (Logros / Voluntariados / Personales)
   ============================================================ */
function buildCard(type, r, idx) {
  const dr    = dateRange(r.fechaInicio, r.fechaFin, r.presente);
  const isP   = r.presente === 'true' || r.presente === true;
  const delay = Math.min(idx * 55, 400);

  let imgHtml = '';
  const cert = r.certificado || r.imagen;
  if (cert && cert.startsWith('data:image')) {
    imgHtml = `<img class="card-img-banner" src="${cert}" alt="Certificado" loading="lazy" data-cert="${esc(cert)}" />`;
  }

  let meta = '';
  if (dr)  meta += `<span class="badge badge-date">📅 ${esc(dr)}</span>`;
  if (isP) meta += `<span class="badge badge-presente">● En curso</span>`;

  if (type === 'logros' || type === 'personales') {
    if (r.puesto)      meta += `<span class="badge badge-lugar">🏅 ${esc(r.puesto)}</span>`;
    if (r.beneficios)  meta += `<span class="badge badge-tag">🎁 ${esc(r.beneficios)}</span>`;
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
            <button class="ico-btn edit-btn" aria-label="Editar" data-id="${esc(r.id)}" data-type="${esc(type)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="ico-btn del delete-btn" aria-label="Eliminar" data-id="${esc(r.id)}" data-type="${esc(type)}">
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
  const map = {
    logros: 'logros-pagination', voluntariados: 'vol-pagination', personales: 'pers-pagination',
    materias: 'mat-pagination', tareas: 'tar-pagination', apuntes: 'apu-pagination',
  };
  return map[type] || '';
}

function renderPagination(type) {
  const el = document.getElementById(paginId(type));
  if (!el) return;
  const total = Math.ceil(state.filtered[type].length / PAGE_SIZE);
  if (total <= 1) { el.innerHTML = ''; return; }
  const cur = state.pages[type];
  let html = `<button class="pg-btn" ${cur===1?'disabled':''} data-page="${cur-1}" data-type="${type}">‹</button>`;
  for (let i = 1; i <= total; i++) {
    html += `<button class="pg-btn ${i===cur?'active':''}" data-page="${i}" data-type="${type}" ${i===cur?'aria-current="page"':''}>${i}</button>`;
  }
  html += `<button class="pg-btn" ${cur===total?'disabled':''} data-page="${cur+1}" data-type="${type}">›</button>`;
  el.innerHTML = html;
}

/* ============================================================
   MODAL LOGROS / VOLUNTARIADOS / PERSONALES
   ============================================================ */
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
  if (!record) {
    const restored = restoreDraft(type);
    if (restored) {
      showToast('📝 Borrador restaurado.', '');
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
    logros:        isEdit ? 'EDITAR LOGRO'         : 'NUEVO LOGRO',
    voluntariados: isEdit ? 'EDITAR VOLUNTARIADO'  : 'NUEVO VOLUNTARIADO',
    personales:    isEdit ? 'EDITAR LOGRO PERSONAL': 'LOGRO PERSONAL',
  };
  const id = MODAL[type];
  const titleEl = document.querySelector(`#${id} .modal-title`);
  if (titleEl) titleEl.textContent = titles[type];
  const btnEl = document.querySelector(`#${id} .btext`);
  if (btnEl) btnEl.textContent = isEdit ? 'Guardar cambios' : (type === 'voluntariados' ? 'Guardar voluntariado' : 'Guardar logro');
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
    const cert = r?.certificado || r?.imagen;
    if (cert && cert.startsWith('data:image')) {
      document.getElementById(`${p}-cert-data`).value   = cert;
      document.getElementById(`${p}-img-preview`).src   = cert;
      document.getElementById(`${p}-upinner`).hidden    = true;
      document.getElementById(`${p}-uppreview`).hidden  = false;
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
    const cert = r?.certificado || r?.imagen;
    if (cert && cert.startsWith('data:image')) {
      document.getElementById('vol-cert-data').value    = cert;
      document.getElementById('vol-img-preview').src    = cert;
      document.getElementById('vol-upinner').hidden     = true;
      document.getElementById('vol-uppreview').hidden   = false;
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
  const cb  = document.getElementById(cbId);
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
    el?.classList.add('err'); el?.focus();
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
    fi?.classList.add('err'); if (ok) fi?.focus();
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
const gv = id => document.getElementById(id)?.value?.trim() || '';
const gc = id => document.getElementById(id)?.checked ? 'true' : 'false';
const gh = id => document.getElementById(id)?.value || '';

function collectLogro(p) {
  return {
    titulo: gv(`${p}-titulo`), descripcion: gv(`${p}-desc`),
    puesto: gv(`${p}-puesto`), beneficios: gv(`${p}-beneficios`),
    fechaInicio: gv(`${p}-fecha-inicio`), fechaFin: gv(`${p}-fecha-fin`),
    presente: gc(`${p}-presente`), etiquetas: gv(`${p}-tags`),
    imagen: gh(`${p}-cert-data`),
  };
}

function collectVol() {
  return {
    titulo: gv('vol-titulo'), organizacion: gv('vol-org'),
    descripcion: gv('vol-desc'), fechaInicio: gv('vol-fecha-inicio'),
    fechaFin: gv('vol-fecha-fin'), presente: gc('vol-presente'),
    rol: gv('vol-rol'), horas: gv('vol-horas'), imagen: gh('vol-cert-data'),
  };
}

/* ============================================================
   BORRADORES
   ============================================================ */
const DRAFT_FIELDS = {
  logros: [
    { id: 'logro-titulo', type: 'text' }, { id: 'logro-desc', type: 'text' },
    { id: 'logro-puesto', type: 'text' }, { id: 'logro-beneficios', type: 'text' },
    { id: 'logro-fecha-inicio', type: 'text' }, { id: 'logro-fecha-fin', type: 'text' },
    { id: 'logro-presente', type: 'check' }, { id: 'logro-tags', type: 'text' },
    { id: 'logro-cert-data', type: 'hidden' },
  ],
  voluntariados: [
    { id: 'vol-titulo', type: 'text' }, { id: 'vol-org', type: 'text' },
    { id: 'vol-desc', type: 'text' }, { id: 'vol-fecha-inicio', type: 'text' },
    { id: 'vol-fecha-fin', type: 'text' }, { id: 'vol-presente', type: 'check' },
    { id: 'vol-rol', type: 'text' }, { id: 'vol-horas', type: 'text' },
    { id: 'vol-cert-data', type: 'hidden' },
  ],
  personales: [
    { id: 'pers-titulo', type: 'text' }, { id: 'pers-desc', type: 'text' },
    { id: 'pers-puesto', type: 'text' }, { id: 'pers-beneficios', type: 'text' },
    { id: 'pers-fecha-inicio', type: 'text' }, { id: 'pers-fecha-fin', type: 'text' },
    { id: 'pers-presente', type: 'check' }, { id: 'pers-tags', type: 'text' },
    { id: 'pers-cert-data', type: 'hidden' },
  ],
};

const DRAFT_KEY = type => `Meritora_draft_${type}`;

function saveDraft(type) {
  const fields = DRAFT_FIELDS[type];
  if (!fields) return;
  const draft = {};
  fields.forEach(({ id, type: ftype }) => {
    const el = document.getElementById(id);
    if (!el) return;
    draft[id] = ftype === 'check' ? el.checked : el.value;
  });
  if (Object.values(draft).some(v => v && v !== false && v !== '')) {
    localStorage.setItem(DRAFT_KEY(type), JSON.stringify(draft));
    showDraftIndicator(type);
  }
}

function restoreDraft(type) {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(type));
    if (!raw) return false;
    const draft = JSON.parse(raw);
    let restored = false;
    DRAFT_FIELDS[type].forEach(({ id, type: ftype }) => {
      const el = document.getElementById(id);
      if (!el || draft[id] === undefined) return;
      ftype === 'check' ? (el.checked = Boolean(draft[id])) : (el.value = draft[id] || '');
      if (draft[id]) restored = true;
    });
    const prefixes = { logros: 'logro', voluntariados: 'vol', personales: 'pers' };
    const p = prefixes[type];
    const certKey = `${p}-cert-data`;
    if (draft[certKey]?.startsWith('data:image')) {
      document.getElementById(`${p}-img-preview`).src   = draft[certKey];
      document.getElementById(`${p}-upinner`).hidden    = true;
      document.getElementById(`${p}-uppreview`).hidden  = false;
    }
    const cbMap = { logros: 'logro-presente', voluntariados: 'vol-presente', personales: 'pers-presente' };
    const inMap = { logros: 'logro-fecha-fin', voluntariados: 'vol-fecha-fin', personales: 'pers-fecha-fin' };
    toggleDateFin(cbMap[type], inMap[type]);
    return restored;
  } catch { return false; }
}

function clearDraft(type) {
  localStorage.removeItem(DRAFT_KEY(type));
  hideDraftIndicator(type);
}

function showDraftIndicator(type) {
  const mid = MODAL[type]; if (!mid) return;
  let ind = document.getElementById(`${mid}-draft-ind`);
  if (!ind) {
    ind = document.createElement('span');
    ind.id = `${mid}-draft-ind`;
    ind.className = 'draft-indicator';
    ind.textContent = '● Borrador guardado';
    document.querySelector(`#${mid} .modal-head`)?.appendChild(ind);
  }
  ind.hidden = false;
}
function hideDraftIndicator(type) {
  const ind = document.getElementById(`${MODAL[type]}-draft-ind`);
  if (ind) ind.hidden = true;
}
function bindDraftListeners(type) {
  (DRAFT_FIELDS[type] || []).forEach(({ id, type: ftype }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(ftype === 'check' ? 'change' : 'input', () => saveDraft(type));
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
      clearDraft(type);
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
  const msg = type === 'materias'
    ? `¿Eliminar la materia "${title}"? También se eliminarán todas sus tareas y apuntes. Esta acción no se puede deshacer.`
    : `¿Eliminar "${title}"? Esta acción no se puede deshacer.`;
  document.getElementById('confirm-message').textContent = msg;
  state.deleteCallback = async () => {
    try {
      await apiDelete(type, id);
      showToast('🗑️ Registro eliminado.', 'success');
      await loadRecords(type);
      if (type === 'materias') {
        // Recargar tareas y apuntes ya que hubo cascade
        state.loaded.tareas  = false;
        state.loaded.apuntes = false;
        if (state.estudiosTab === 'tareas')  loadRecords('tareas');
        if (state.estudiosTab === 'apuntes') loadRecords('apuntes');
      }
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
  const type  = state.section === 'estudios' ? state.estudiosTab : state.section;
  const items = state.filtered[type];
  if (!items.length) { showToast('No hay registros para exportar.', 'error'); return; }

  const headers = Object.keys(items[0]);
  const rows    = items.map(r => headers.map(h => r[h] || ''));

  const csv = [headers, ...rows]
    .map(row => row.map(c => `"${String(c).replace(/"/g,'""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `${type}_${new Date().toISOString().split('T')[0]}.csv`,
  });
  a.click(); URL.revokeObjectURL(a.href);
  showToast(`📥 CSV exportado — ${items.length} registros.`, 'success');
}

/* ============================================================
   ╔════════════════════════════════════╗
   ║      MÓDULO ESTUDIOS               ║
   ╚════════════════════════════════════╝
   ============================================================ */

/* ── Sub-tabs ── */
function switchEstudiosTab(tab) {
  state.estudiosTab = tab;
  document.querySelectorAll('.estudios-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  ['materias','tareas','apuntes'].forEach(t => {
    const sec = document.getElementById(`est-section-${t}`);
    if (sec) sec.hidden = t !== tab;
  });
  if (!state.loaded[tab] && !state.loading[tab]) {
    loadRecords(tab);
  } else {
    renderEstudiosList(tab);
    renderStats(tab);
  }
}

/* ── Render listas ── */
function renderEstudiosList(type) {
  const listIds = { materias: 'mat-list', tareas: 'tar-list', apuntes: 'apu-list' };
  const el = document.getElementById(listIds[type]);
  if (!el) return;

  if (state.loading[type]) {
    el.innerHTML = `<div class="spinner-wrap"><div class="spinner" role="status" aria-label="Cargando"></div></div>`;
    return;
  }

  const items = state.filtered[type];
  if (!items.length) {
    const icons = { materias: '📚', tareas: '📝', apuntes: '📒' };
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">${icons[type]}</div><p>Sin registros aún.<br>¡Agrega el primero!</p></div>`;
    renderPagination(type); return;
  }

  const page  = state.pages[type];
  const start = (page - 1) * PAGE_SIZE;
  const slice = items.slice(start, start + PAGE_SIZE);

  if (type === 'materias')  el.innerHTML = slice.map((r, i) => buildMateriaCard(r, i)).join('');
  if (type === 'tareas')    el.innerHTML = slice.map((r, i) => buildTareaCard(r, i)).join('');
  if (type === 'apuntes')   el.innerHTML = slice.map((r, i) => buildApunteCard(r, i)).join('');

  renderPagination(type);
}

/* ── Cards de Materias ── */
function buildMateriaCard(r, idx) {
  const dr    = dateRange(r.fechaInicio, r.fechaFin, r.estado === 'en_curso' ? 'true' : 'false');
  const delay = Math.min(idx * 55, 400);
  const color = r.color || '#3A7A96';
  const estadoBadge = r.estado === 'en_curso'
    ? `<span class="badge badge-presente">● En curso</span>`
    : `<span class="badge badge-org">✓ Finalizada</span>`;
  // Contar tareas y apuntes de esta materia
  const numTareas  = state.records.tareas.filter(t => t.materiaId === r.id).length;
  const numApuntes = state.records.apuntes.filter(a => a.materiaId === r.id).length;

  return `
    <article class="card materia-card" role="listitem" data-id="${esc(r.id)}" data-type="materias"
      style="animation-delay:${delay}ms; --mat-color:${color}">
      <div class="materia-color-bar" style="background:${color}"></div>
      <div class="card-body">
        <div class="card-top">
          <div>
            <h3 class="card-title">${esc(r.nombre)}</h3>
            ${r.periodo ? `<span class="badge badge-date">🗓 ${esc(r.periodo)}</span>` : ''}
          </div>
          <div class="card-actions">
            <button class="ico-btn edit-btn" aria-label="Editar" data-id="${esc(r.id)}" data-type="materias">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="ico-btn del delete-btn" aria-label="Eliminar" data-id="${esc(r.id)}" data-type="materias">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
            </button>
          </div>
        </div>
        <div class="card-meta">
          ${estadoBadge}
          ${r.profesor ? `<span class="badge badge-tag">👨‍🏫 ${esc(r.profesor)}</span>` : ''}
          ${dr ? `<span class="badge badge-date">📅 ${esc(dr)}</span>` : ''}
        </div>
        ${r.descripcion ? `<p class="card-desc">${esc(r.descripcion)}</p>` : ''}
        <div class="materia-counts">
          <span class="mat-count" data-tab="tareas" data-materia-id="${esc(r.id)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
            ${numTareas} tarea${numTareas !== 1 ? 's' : ''}
          </span>
          <span class="mat-count" data-tab="apuntes" data-materia-id="${esc(r.id)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            ${numApuntes} apunte${numApuntes !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </article>`;
}

/* ── Cards de Tareas ── */
function buildTareaCard(r, idx) {
  const delay = Math.min(idx * 55, 400);
  const materia = state.records.materias.find(m => m.id === r.materiaId);
  const color = materia?.color || '#3A7A96';

  const estadoClass = { pendiente: 'badge-red', en_progreso: 'badge-blue', completada: 'badge-green' };
  const estadoLabel = { pendiente: '⏳ Pendiente', en_progreso: '🔄 En progreso', completada: '✅ Completada' };
  const priorClass  = { baja: 'badge-tag', media: 'badge-date', alta: 'badge-red' };
  const priorLabel  = { baja: '🟢 Baja', media: '🟡 Media', alta: '🔴 Alta' };

  const entrega = r.fechaEntrega ? `<span class="badge badge-date">📅 Entrega: ${fmt(r.fechaEntrega)}</span>` : '';
  const asig    = r.fechaAsig    ? `<span class="badge badge-date">📋 Asignada: ${fmt(r.fechaAsig)}</span>` : '';

  return `
    <article class="card tarea-card" role="listitem" data-id="${esc(r.id)}" data-type="tareas"
      style="animation-delay:${delay}ms; --mat-color:${color}">
      <div class="materia-color-bar" style="background:${color}"></div>
      <div class="card-body">
        <div class="card-top">
          <div>
            <h3 class="card-title">${esc(r.titulo)}</h3>
            ${materia ? `<span class="materia-ref" style="color:${color}">📚 ${esc(materia.nombre)}</span>` : ''}
          </div>
          <div class="card-actions">
            <button class="ico-btn edit-btn" aria-label="Editar" data-id="${esc(r.id)}" data-type="tareas">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="ico-btn del delete-btn" aria-label="Eliminar" data-id="${esc(r.id)}" data-type="tareas">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
            </button>
          </div>
        </div>
        <div class="card-meta">
          ${r.estado    ? `<span class="badge ${estadoClass[r.estado]||'badge-tag'}">${estadoLabel[r.estado]||r.estado}</span>` : ''}
          ${r.prioridad ? `<span class="badge ${priorClass[r.prioridad]||'badge-tag'}">${priorLabel[r.prioridad]||r.prioridad}</span>` : ''}
          ${asig}${entrega}
        </div>
        ${r.descripcion ? `<p class="card-desc">${esc(r.descripcion)}</p>` : ''}
        ${r.enlace ? `<a href="${esc(r.enlace)}" class="card-link" target="_blank" rel="noopener">🔗 Ver recurso</a>` : ''}
      </div>
    </article>`;
}

/* ── Cards de Apuntes ── */
function buildApunteCard(r, idx) {
  const delay = Math.min(idx * 55, 400);
  const materia = state.records.materias.find(m => m.id === r.materiaId);
  const color = materia?.color || '#3A7A96';

  return `
    <article class="card apunte-card" role="listitem" data-id="${esc(r.id)}" data-type="apuntes"
      style="animation-delay:${delay}ms; --mat-color:${color}">
      <div class="materia-color-bar" style="background:${color}"></div>
      <div class="card-body">
        <div class="card-top">
          <div>
            <h3 class="card-title">${esc(r.titulo)}</h3>
            ${materia ? `<span class="materia-ref" style="color:${color}">📚 ${esc(materia.nombre)}</span>` : ''}
          </div>
          <div class="card-actions">
            <button class="ico-btn edit-btn" aria-label="Editar" data-id="${esc(r.id)}" data-type="apuntes">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="ico-btn del delete-btn" aria-label="Eliminar" data-id="${esc(r.id)}" data-type="apuntes">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
            </button>
          </div>
        </div>
        <div class="card-meta">
          ${r.fecha ? `<span class="badge badge-date">📅 ${fmt(r.fecha)}</span>` : ''}
        </div>
        ${r.contenido ? `<p class="card-desc apunte-contenido">${esc(r.contenido)}</p>` : ''}
        ${r.enlace ? `<a href="${esc(r.enlace)}" class="card-link" target="_blank" rel="noopener">🔗 Ver recurso</a>` : ''}
      </div>
    </article>`;
}

/* ── Modales Estudios ── */
function openEstudiosModal(type, record = null) {
  const modalIds = { materias: 'modal-materia', tareas: 'modal-tarea', apuntes: 'modal-apunte' };
  const id = modalIds[type];
  const el = document.getElementById(id);
  if (!el) return;

  state.editingId[type] = record?.id || null;
  fillEstudiosForm(type, record);

  const title = document.querySelector(`#${id} .modal-title`);
  const btn   = document.querySelector(`#${id} .btext`);
  const isEdit = !!record;
  const labels = {
    materias: isEdit ? 'EDITAR MATERIA'   : 'NUEVA MATERIA',
    tareas:   isEdit ? 'EDITAR TAREA'     : 'NUEVA TAREA',
    apuntes:  isEdit ? 'EDITAR APUNTE'    : 'NUEVO APUNTE',
  };
  const btnLabels = {
    materias: isEdit ? 'Guardar cambios' : 'Guardar materia',
    tareas:   isEdit ? 'Guardar cambios' : 'Guardar tarea',
    apuntes:  isEdit ? 'Guardar cambios' : 'Guardar apunte',
  };
  if (title) title.textContent = labels[type];
  if (btn)   btn.textContent   = btnLabels[type];

  el.hidden = false;
  el.querySelector('.modal-close')?.focus();
}

function fillEstudiosForm(type, r) {
  const v = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  const c = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

  if (type === 'materias') {
    v('mat-id', r?.id); v('mat-nombre', r?.nombre); v('mat-profesor', r?.profesor);
    v('mat-desc', r?.descripcion); v('mat-periodo', r?.periodo);
    v('mat-inicio', r?.fechaInicio); v('mat-fin', r?.fechaFin);
    v('mat-estado', r?.estado || 'en_curso');
  }

  if (type === 'tareas') {
    v('tar-id', r?.id); v('tar-titulo', r?.titulo); v('tar-desc', r?.descripcion);
    v('tar-asig', r?.fechaAsig); v('tar-entrega', r?.fechaEntrega);
    v('tar-estado', r?.estado || 'pendiente'); v('tar-prioridad', r?.prioridad || 'media');
    v('tar-enlace', r?.enlace);
    // Rellenar selector de materias
    populateMateriaSelect('tar-materia', r?.materiaId);
  }

  if (type === 'apuntes') {
    v('apu-id', r?.id); v('apu-titulo', r?.titulo); v('apu-contenido', r?.contenido);
    v('apu-fecha', r?.fecha); v('apu-enlace', r?.enlace);
    populateMateriaSelect('apu-materia', r?.materiaId);
  }
}

/** Rellena un <select> con las materias disponibles */
function populateMateriaSelect(selectId, selectedId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const materias = state.records.materias;
  sel.innerHTML = `<option value="">— Selecciona una materia —</option>` +
    materias.map(m =>
      `<option value="${esc(m.id)}" ${m.id === selectedId ? 'selected' : ''}>${esc(m.nombre)}${m.periodo ? ` (${esc(m.periodo)})` : ''}</option>`
    ).join('');
}

function collectMateria() {
  return {
    nombre: gv('mat-nombre'), profesor: gv('mat-profesor'),
    descripcion: gv('mat-desc'), periodo: gv('mat-periodo'),
    fechaInicio: gv('mat-inicio'), fechaFin: gv('mat-fin'),
    estado: gv('mat-estado'),
  };
}

function collectTarea() {
  return {
    materiaId: gv('tar-materia'), titulo: gv('tar-titulo'),
    descripcion: gv('tar-desc'), fechaAsig: gv('tar-asig'),
    fechaEntrega: gv('tar-entrega'), estado: gv('tar-estado'),
    prioridad: gv('tar-prioridad'), enlace: gv('tar-enlace'),
  };
}

function collectApunte() {
  return {
    materiaId: gv('apu-materia'), titulo: gv('apu-titulo'),
    contenido: gv('apu-contenido'), fecha: gv('apu-fecha'),
    enlace: gv('apu-enlace'),
  };
}

function valMateria() {
  const el  = document.getElementById('mat-nombre');
  const err = document.getElementById('mat-nombre-err');
  if (!el?.value.trim()) {
    if (err) err.textContent = 'El nombre de la materia es obligatorio.';
    el?.classList.add('err'); el?.focus();
    return false;
  }
  if (err) err.textContent = ''; el.classList.remove('err');
  return true;
}

function valTarea() {
  const el  = document.getElementById('tar-titulo');
  const err = document.getElementById('tar-titulo-err');
  if (!el?.value.trim()) {
    if (err) err.textContent = 'El título de la tarea es obligatorio.';
    el?.classList.add('err'); el?.focus();
    return false;
  }
  if (err) err.textContent = ''; el.classList.remove('err');
  return true;
}

function valApunte() {
  const el  = document.getElementById('apu-titulo');
  const err = document.getElementById('apu-titulo-err');
  if (!el?.value.trim()) {
    if (err) err.textContent = 'El título del apunte es obligatorio.';
    el?.classList.add('err'); el?.focus();
    return false;
  }
  if (err) err.textContent = ''; el.classList.remove('err');
  return true;
}

async function handleEstudiosSubmit(type, collectFn, validateFn) {
  if (!validateFn()) return;
  const data   = collectFn();
  const editId = state.editingId[type];
  const modalIds = { materias: 'modal-materia', tareas: 'modal-tarea', apuntes: 'modal-apunte' };
  const mid    = modalIds[type];
  const btn    = document.querySelector(`#${mid} .btn-red`);

  if (btn) { btn.querySelector('.btext').hidden = true; btn.querySelector('.bload').hidden = false; btn.disabled = true; }

  try {
    if (editId) {
      await apiUpdate(type, editId, data);
      showToast('✅ Registro actualizado.', 'success');
    } else {
      await apiCreate(type, data);
      showToast('✅ Registro creado.', 'success');
    }
    closeModal(mid);
    await loadRecords(type);
    // Si es materia, también recargar tareas/apuntes para actualizar contadores
    if (type === 'materias') {
      await Promise.all([loadRecords('tareas'), loadRecords('apuntes')]);
      renderEstudiosList('materias');
    }
  } catch (err) {
    showToast(`❌ ${err.message}`, 'error');
  } finally {
    if (btn) { btn.querySelector('.btext').hidden = false; btn.querySelector('.bload').hidden = true; btn.disabled = false; }
  }
}

/* ============================================================
   TOAST
   ============================================================ */
let toastTimer;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  if (!el) return;
  clearTimeout(toastTimer);
  el.textContent = msg; el.className = `toast ${type}`;
  el.hidden = false;
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

  ['logros','voluntariados','personales','estudios'].forEach(s => {
    const el = document.getElementById(`section-${s}`);
    if (el) el.hidden = s !== section;
  });

  if (section === 'estudios') {
    // Cargar todas las sub-secciones si no están cargadas
    ['materias','tareas','apuntes'].forEach(t => {
      if (!state.loaded[t] && !state.loading[t]) loadRecords(t);
    });
    switchEstudiosTab(state.estudiosTab);
  } else if (!state.loaded[section] && !state.loading[section]) {
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

  // New buttons (logros/vol/pers)
  [['newLogroBtn','logros'],['newVolBtn','voluntariados'],['newPersBtn','personales']].forEach(([id, type]) =>
    document.getElementById(id)?.addEventListener('click', () => openModal(type))
  );

  // New buttons (estudios)
  document.getElementById('newMateriaBtn')?.addEventListener('click', () => openEstudiosModal('materias'));
  document.getElementById('newTareaBtn')?.addEventListener('click',   () => { populateMateriaSelect('tar-materia', null); openEstudiosModal('tareas'); });
  document.getElementById('newApunteBtn')?.addEventListener('click',  () => { populateMateriaSelect('apu-materia', null); openEstudiosModal('apuntes'); });

  // Estudios sub-tabs
  document.querySelectorAll('.estudios-tab').forEach(btn =>
    btn.addEventListener('click', () => switchEstudiosTab(btn.dataset.tab))
  );

  // Modal close buttons
  document.querySelectorAll('[data-close]').forEach(b =>
    b.addEventListener('click', () => closeModal(b.dataset.close))
  );

  // Backdrop click to close modals
  ['modal-logro','modal-voluntariado','modal-personal','modal-materia','modal-tarea','modal-apunte','modal-image'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', e => { if (e.target.id === id) closeModal(id); });
  });

  // ESC key
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    ['modal-logro','modal-voluntariado','modal-personal','modal-materia','modal-tarea','modal-apunte','modal-confirm','modal-image']
      .forEach(id => { const el = document.getElementById(id); if (el && !el.hidden) closeModal(id); });
  });

  // Checkboxes "presente"
  [['logro-presente','logro-fecha-fin'],['vol-presente','vol-fecha-fin'],['pers-presente','pers-fecha-fin']].forEach(([cb, inp]) =>
    document.getElementById(cb)?.addEventListener('change', () => toggleDateFin(cb, inp))
  );

  // Form submits — existentes
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

  // Form submits — estudios
  document.getElementById('form-materia')?.addEventListener('submit', e => {
    e.preventDefault();
    handleEstudiosSubmit('materias', collectMateria, valMateria);
  });
  document.getElementById('form-tarea')?.addEventListener('submit', e => {
    e.preventDefault();
    handleEstudiosSubmit('tareas', collectTarea, valTarea);
  });
  document.getElementById('form-apunte')?.addEventListener('submit', e => {
    e.preventDefault();
    handleEstudiosSubmit('apuntes', collectApunte, valApunte);
  });

  // Búsquedas
  document.getElementById('logros-search')?.addEventListener('input', () => applyFilter('logros'));
  document.getElementById('vol-search')?.addEventListener('input',    () => applyFilter('voluntariados'));
  document.getElementById('pers-search')?.addEventListener('input',   () => applyFilter('personales'));
  document.getElementById('mat-search')?.addEventListener('input',    () => applyFilter('materias'));
  document.getElementById('tar-search')?.addEventListener('input',    () => applyFilter('tareas'));
  document.getElementById('apu-search')?.addEventListener('input',    () => applyFilter('apuntes'));

  // Delegated en mainContent
  document.getElementById('mainContent')?.addEventListener('click', e => {
    // Pagination
    const pg = e.target.closest('.pg-btn');
    if (pg?.dataset.type) {
      state.pages[pg.dataset.type] = +pg.dataset.page;
      const tipo = pg.dataset.type;
      if (['logros','voluntariados','personales'].includes(tipo)) renderList(tipo);
      else renderEstudiosList(tipo);
      return;
    }

    // Edit
    const ed = e.target.closest('.edit-btn');
    if (ed) {
      const type = ed.dataset.type;
      const r    = state.records[type]?.find(x => x.id === ed.dataset.id);
      if (!r) return;
      if (['logros','voluntariados','personales'].includes(type)) openModal(type, r);
      else openEstudiosModal(type, r);
      return;
    }

    // Delete
    const dl = e.target.closest('.delete-btn');
    if (dl) {
      const type = dl.dataset.type;
      const r    = state.records[type]?.find(x => x.id === dl.dataset.id);
      if (r) confirmDelete(type, dl.dataset.id, r.titulo || r.nombre);
      return;
    }

    // Mat-count link: navegar a tareas/apuntes filtrando por materia
    const mc = e.target.closest('.mat-count[data-tab]');
    if (mc) {
      switchEstudiosTab(mc.dataset.tab);
      // Filtrar por materia
      const searchEl = document.getElementById(mc.dataset.tab === 'tareas' ? 'tar-search' : 'apu-search');
      const materia  = state.records.materias.find(m => m.id === mc.dataset.materiaId);
      if (searchEl && materia) {
        searchEl.value = materia.nombre;
        applyFilter(mc.dataset.tab);
      }
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

  initUploadZone('logro-upzone','logro-cert','logro-upinner','logro-uppreview','logro-img-preview','logro-remove-img','logro-cert-data');
  initUploadZone('vol-upzone',  'vol-cert',  'vol-upinner',  'vol-uppreview',  'vol-img-preview',  'vol-remove-img',  'vol-cert-data');
  initUploadZone('pers-upzone', 'pers-cert', 'pers-upinner', 'pers-uppreview', 'pers-img-preview', 'pers-remove-img', 'pers-cert-data');

  bindEvents();
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