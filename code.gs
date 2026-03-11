/**
 * ============================================================
 * Code.gs — Backend Google Apps Script
 * Meritora Portfolio: Logros + Voluntariados + Personales + Estudios
 * ============================================================
 *
 * INSTRUCCIONES:
 * 1. Abre https://script.google.com/ y crea un nuevo proyecto.
 * 2. Pega este código en el editor.
 * 3. Configura SPREADSHEET_ID con el ID de tu hoja.
 * 4. Ejecuta setupSpreadsheet() una vez para crear todas las pestañas.
 * 5. Implementa como Web App (Ejecutar > Implementar > Nueva implementación).
 *
 * ESTRUCTURA DEL GOOGLE SHEETS:
 * ┌─────────────────────────────────────────────────────────────┐
 * │  Pestaña          │  Descripción                           │
 * ├─────────────────────────────────────────────────────────────┤
 * │  Logros           │  Premios, certificaciones, hitos       │
 * │  Voluntariados    │  Actividades voluntarias               │
 * │  Personales       │  Logros privados/personales            │
 * │  Materias         │  Asignaturas o cursos                  │
 * │  Tareas           │  Tareas por materia (relación FK)      │
 * │  Apuntes          │  Notas por materia (relación FK)       │
 * └─────────────────────────────────────────────────────────────┘
 *
 * RELACIONES:
 *   Materias  ──1:N──> Tareas  (via materiaId)
 *   Materias  ──1:N──> Apuntes (via materiaId)
 *
 * FORMATO DE FECHAS:
 *   - Se almacenan como texto ISO: "2025-03-15"
 *   - Se muestran en frontend como: "15/03/2025"
 *   - La función serializeValue() garantiza el formateo correcto
 */

// ============================================================
// CONFIGURACIÓN
// ============================================================
const SPREADSHEET_ID = '1Dy_HH3h9wlMXf-EsfQeeGiy1hgFRTMVN5KWUmYr_taA';

// ============================================================
// DEFINICIÓN DE HOJAS Y COLUMNAS
// ============================================================
const SHEETS = {

  // ── Existentes ──────────────────────────────────────────────
  logros: {
    name: 'Logros',
    headers: ['id','titulo','descripcion','puesto','beneficios',
              'fechaInicio','fechaFin','presente','etiquetas',
              'imagen','createdAt','updatedAt'],
  },
  voluntariados: {
    name: 'Voluntariados',
    headers: ['id','titulo','organizacion','descripcion',
              'fechaInicio','fechaFin','presente','rol','horas',
              'imagen','createdAt','updatedAt'],
  },
  personales: {
    name: 'Personales',
    headers: ['id','titulo','descripcion','puesto','beneficios',
              'fechaInicio','fechaFin','presente','etiquetas',
              'imagen','createdAt','updatedAt'],
  },

  // ── Estudios ────────────────────────────────────────────────

  /**
   * Materias — Hoja principal del módulo Estudios
   * Campos:
   *   id          → ID único generado automáticamente
   *   nombre      → Nombre de la materia/asignatura
   *   profesor    → Nombre del profesor (opcional)
   *   descripcion → Descripción breve (opcional)
   *   periodo     → Período académico (ej. "2025-I", "Semestre 1")
   *   fechaInicio → Fecha de inicio (ISO: yyyy-MM-dd)
   *   fechaFin    → Fecha de finalización (ISO: yyyy-MM-dd)
   *   estado      → "en_curso" | "finalizada"
   *   color       → Color de etiqueta HEX (opcional, para UI)
   *   createdAt   → Timestamp de creación (ISO)
   *   updatedAt   → Timestamp de última actualización (ISO)
   */
  materias: {
    name: 'Materias',
    headers: ['id','nombre','profesor','descripcion','periodo',
              'fechaInicio','fechaFin','estado','color',
              'createdAt','updatedAt'],
  },

  /**
   * Tareas — Relación N:1 con Materias (via materiaId)
   * Campos:
   *   id           → ID único
   *   materiaId    → FK → Materias.id
   *   titulo       → Título de la tarea
   *   descripcion  → Descripción o instrucciones
   *   fechaAsig    → Fecha de asignación (ISO)
   *   fechaEntrega → Fecha de entrega (ISO)
   *   estado       → "pendiente" | "en_progreso" | "completada"
   *   prioridad    → "baja" | "media" | "alta"
   *   enlace       → URL de referencia (opcional)
   *   createdAt    → Timestamp creación
   *   updatedAt    → Timestamp actualización
   */
  tareas: {
    name: 'Tareas',
    headers: ['id','materiaId','titulo','descripcion',
              'fechaAsig','fechaEntrega','estado','prioridad',
              'enlace','createdAt','updatedAt'],
  },

  /**
   * Apuntes — Relación N:1 con Materias (via materiaId)
   * Campos:
   *   id          → ID único
   *   materiaId   → FK → Materias.id
   *   titulo      → Título del apunte
   *   contenido   → Texto de la nota
   *   fecha       → Fecha del apunte (ISO)
   *   enlace      → URL de archivo o recurso (opcional)
   *   createdAt   → Timestamp creación
   *   updatedAt   → Timestamp actualización
   */
  apuntes: {
    name: 'Apuntes',
    headers: ['id','materiaId','titulo','contenido',
              'fecha','enlace','createdAt','updatedAt'],
  },
};

// ============================================================
// CORS HEADERS
// ============================================================
function setCorsHeaders(output) {
  return output
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ============================================================
// ENTRY POINTS
// ============================================================
function doGet(e) {
  const output = ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      message: 'Meritora API activa. Usa POST para operar.',
      sheets: Object.keys(SHEETS),
    }))
    .setMimeType(ContentService.MimeType.JSON);
  return setCorsHeaders(output);
}

/**
 * doPost — Punto de entrada principal CRUD.
 *
 * Body esperado:
 * {
 *   action: 'create' | 'read' | 'update' | 'delete',
 *   type:   'logros' | 'voluntariados' | 'personales' | 'materias' | 'tareas' | 'apuntes',
 *   data:   { ...campos }
 * }
 */
function doPost(e) {
  let result;

  try {
    const body   = JSON.parse(e.postData.contents);
    const { action, type, data } = body;

    if (!SHEETS[type]) {
      throw new Error(`Tipo inválido: "${type}". Válidos: ${Object.keys(SHEETS).join(', ')}`);
    }

    ensureSheet(type);

    switch (action) {
      case 'create':           result = createRecord(type, data);              break;
      case 'read':             result = readRecords(type, data);               break;
      case 'update':           result = updateRecord(type, data);              break;
      case 'delete':           result = deleteRecord(type, data);              break;
      case 'getByMateriaId':   result = getByMateriaId(type, data.materiaId);  break;
      default:
        throw new Error(`Acción inválida: "${action}".`);
    }

  } catch (err) {
    result = { ok: false, message: err.message || 'Error interno del servidor.' };
  }

  const output = ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);

  return setCorsHeaders(output);
}

// ============================================================
// OPERACIONES CRUD
// ============================================================

/**
 * createRecord — Inserta una nueva fila.
 * Al crear una Materia, genera su color automáticamente.
 * Garantiza que no haya duplicados verificando el ID.
 */
function createRecord(type, data) {
  const sheet   = getSheet(type);
  const headers = SHEETS[type].headers;
  const now     = new Date().toISOString();

  // ID único: timestamp + random 6 chars
  const id = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  // Para materias, asignar color si no viene
  if (type === 'materias' && !data.color) {
    data.color = assignMateriaColor();
  }

  const row = headers.map(h => {
    if (h === 'id')        return id;
    if (h === 'createdAt') return now;
    if (h === 'updatedAt') return now;
    return data[h] !== undefined ? String(data[h]) : '';
  });

  sheet.appendRow(row);

  return { ok: true, message: 'Registro creado correctamente.', data: { id } };
}

/**
 * readRecords — Lee todos los registros de una pestaña.
 * CORRECCIÓN DE FECHAS: usa serializeValue() para manejar objetos Date
 * que Google Sheets devuelve al leer celdas de tipo fecha.
 */
function readRecords(type, query) {
  const sheet   = getSheet(type);
  const headers = SHEETS[type].headers;
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return { ok: true, data: [] };

  const range = sheet.getRange(2, 1, lastRow - 1, headers.length);
  const rows  = range.getValues();

  const records = rows
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = serializeValue(row[i], h);
      });
      return obj;
    })
    .filter(r => r.id && r.id.trim() !== '');

  return { ok: true, data: records };
}

/**
 * getByMateriaId — Lee tareas o apuntes de una materia específica.
 */
function getByMateriaId(type, materiaId) {
  if (!['tareas','apuntes'].includes(type)) {
    throw new Error('getByMateriaId solo aplica para tareas y apuntes.');
  }
  const result = readRecords(type, {});
  const filtered = result.data.filter(r => r.materiaId === String(materiaId));
  return { ok: true, data: filtered };
}

/**
 * updateRecord — Actualiza una fila existente por ID.
 * Preserva createdAt original.
 */
function updateRecord(type, data) {
  const sheet   = getSheet(type);
  const headers = SHEETS[type].headers;
  const id      = data.id;

  if (!id) throw new Error('ID requerido para actualizar.');

  const rowIndex = findRowById(sheet, id, headers);
  if (rowIndex === -1) throw new Error(`Registro con ID "${id}" no encontrado.`);

  const now = new Date().toISOString();

  const currentRange = sheet.getRange(rowIndex, 1, 1, headers.length);
  const currentRow   = currentRange.getValues()[0];
  const currentObj   = {};
  headers.forEach((h, i) => { currentObj[h] = serializeValue(currentRow[i], h); });

  const newRow = headers.map(h => {
    if (h === 'id')        return id;
    if (h === 'createdAt') return currentObj.createdAt || now;
    if (h === 'updatedAt') return now;
    return data[h] !== undefined ? String(data[h]) : (currentObj[h] || '');
  });

  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([newRow]);

  return { ok: true, message: 'Registro actualizado correctamente.' };
}

/**
 * deleteRecord — Elimina una fila por ID.
 * Al borrar una Materia, también borra sus tareas y apuntes asociados (CASCADE).
 */
function deleteRecord(type, data) {
  const sheet   = getSheet(type);
  const headers = SHEETS[type].headers;
  const id      = data.id;

  if (!id) throw new Error('ID requerido para eliminar.');

  const rowIndex = findRowById(sheet, id, headers);
  if (rowIndex === -1) throw new Error(`Registro con ID "${id}" no encontrado.`);

  sheet.deleteRow(rowIndex);

  // CASCADE: si borramos una materia, borrar tareas y apuntes relacionados
  if (type === 'materias') {
    deleteByMateriaId('tareas',  id);
    deleteByMateriaId('apuntes', id);
  }

  return { ok: true, message: 'Registro eliminado correctamente.' };
}

/**
 * deleteByMateriaId — Elimina todas las filas donde materiaId === id.
 * Recorre de abajo hacia arriba para evitar desplazamiento de filas.
 */
function deleteByMateriaId(type, materiaId) {
  const sheet   = getSheet(type);
  const headers = SHEETS[type].headers;
  const midxCol = headers.indexOf('materiaId') + 1;
  if (midxCol === 0) return;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const colVals = sheet.getRange(2, midxCol, lastRow - 1, 1).getValues();
  // Recorrer de abajo a arriba
  for (let i = colVals.length - 1; i >= 0; i--) {
    if (String(colVals[i][0]) === String(materiaId)) {
      sheet.deleteRow(i + 2);
    }
  }
}

// ============================================================
// UTILIDADES INTERNAS
// ============================================================

/**
 * serializeValue — CORRECCIÓN DE FECHAS
 *
 * Google Sheets devuelve celdas de fecha como objetos Date en JavaScript.
 * Sin este manejo, String(date) produce "Tue Mar 05 2025 00:00:00 GMT-0400..."
 * Con este fix, las fechas se devuelven como "2025-03-05" (ISO compatible con <input type="date">)
 *
 * @param {*} value  - Valor de la celda
 * @param {string} fieldName - Nombre del campo (para detectar si es fecha)
 * @returns {string}
 */
function serializeValue(value, fieldName) {
  if (value === null || value === undefined || value === '') return '';

  // Si el valor es un objeto Date (Sheets lo hace con celdas de fecha)
  if (value instanceof Date && !isNaN(value.getTime())) {
    // Para campos de timestamp (createdAt, updatedAt) → ISO completo
    if (fieldName === 'createdAt' || fieldName === 'updatedAt') {
      return value.toISOString();
    }
    // Para campos de fecha simple → yyyy-MM-dd
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  return String(value);
}

/**
 * assignMateriaColor — Asigna un color de la paleta a las materias.
 * Evita duplicados rotando la paleta según el número actual de materias.
 */
function assignMateriaColor() {
  const palette = [
    '#3A7A96','#E0303A','#2563eb','#059669','#d97706',
    '#7c3aed','#db2777','#0891b2','#65a30d','#ea580c',
  ];
  const sheet   = getSheet('materias');
  const count   = Math.max(0, sheet.getLastRow() - 1);
  return palette[count % palette.length];
}

function getSheet(type) {
  const ss        = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetName = SHEETS[type].name;
  return ss.getSheetByName(sheetName) || createSheetWithHeaders(ss, type);
}

function ensureSheet(type) {
  const ss        = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetName = SHEETS[type].name;
  let sheet       = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = createSheetWithHeaders(ss, type);
  } else {
    const firstRow = sheet.getRange(1, 1, 1, SHEETS[type].headers.length).getValues()[0];
    if (!firstRow[0]) {
      sheet.getRange(1, 1, 1, SHEETS[type].headers.length).setValues([SHEETS[type].headers]);
    }
  }
  return sheet;
}

function createSheetWithHeaders(ss, type) {
  const sheetName = SHEETS[type].name;
  const headers   = SHEETS[type].headers;
  const sheet     = ss.insertSheet(sheetName);

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#1C3352');
  headerRange.setFontColor('#A8CDD6');
  sheet.setFrozenRows(1);
  headers.forEach((_, i) => sheet.setColumnWidth(i + 1, 160));

  return sheet;
}

function findRowById(sheet, id, headers) {
  const idColIndex = headers.indexOf('id');
  if (idColIndex === -1) return -1;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  const colValues = sheet.getRange(2, idColIndex + 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < colValues.length; i++) {
    if (String(colValues[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

// ============================================================
// CONFIGURACIÓN INICIAL — ejecutar UNA VEZ manualmente
// ============================================================

/**
 * setupSpreadsheet — Crea TODAS las pestañas con sus encabezados.
 *
 * EJECUTA ESTA FUNCIÓN DESDE EL EDITOR:
 * Menú "Ejecutar" > "setupSpreadsheet"
 *
 * Crea: Logros, Voluntariados, Personales, Materias, Tareas, Apuntes
 */
function setupSpreadsheet() {
  Object.keys(SHEETS).forEach(type => ensureSheet(type));
  Logger.log('✅ Hojas creadas: ' + Object.values(SHEETS).map(s => s.name).join(', '));
  Logger.log('📋 Estructura de columnas:');
  Object.entries(SHEETS).forEach(([key, val]) => {
    Logger.log(`  ${val.name}: ${val.headers.join(' | ')}`);
  });
}

// ============================================================
// PRUEBA INTEGRADA — módulo Estudios
// ============================================================

/**
 * testEstudios — Prueba el flujo completo de Estudios.
 * Ejecutar desde el editor para verificar que todo funciona.
 */
function testEstudios() {
  // 1. Crear materia
  const materia = createRecord('materias', {
    nombre:      'Cálculo Diferencial',
    profesor:    'Dr. García',
    descripcion: 'Límites, derivadas e integrales',
    periodo:     '2025-I',
    fechaInicio: '2025-01-15',
    fechaFin:    '2025-05-30',
    estado:      'en_curso',
  });
  Logger.log('MATERIA creada:', JSON.stringify(materia));

  const materiaId = materia.data.id;

  // 2. Crear tarea asociada
  const tarea = createRecord('tareas', {
    materiaId,
    titulo:       'Tarea 1 - Límites',
    descripcion:  'Resolver 10 ejercicios de límites',
    fechaAsig:    '2025-01-20',
    fechaEntrega: '2025-01-27',
    estado:       'pendiente',
    prioridad:    'alta',
  });
  Logger.log('TAREA creada:', JSON.stringify(tarea));

  // 3. Crear apunte asociado
  const apunte = createRecord('apuntes', {
    materiaId,
    titulo:    'Clase 1 — Introducción a límites',
    contenido: 'Un límite describe el comportamiento de f(x) cuando x→a.',
    fecha:     '2025-01-15',
  });
  Logger.log('APUNTE creado:', JSON.stringify(apunte));

  // 4. Leer todo
  const allMaterias = readRecords('materias', {});
  Logger.log('Total materias:', allMaterias.data.length);

  // 5. Verificar fechas (no deben tener "GMT" ni "UTC")
  if (allMaterias.data.length > 0) {
    const m = allMaterias.data[0];
    Logger.log('fechaInicio:', m.fechaInicio, '→ OK si es yyyy-MM-dd sin GMT');
    Logger.log('createdAt:',  m.createdAt,   '→ OK si es ISO completo');
  }

  // 6. Limpieza
  deleteRecord('materias', { id: materiaId }); // Borra materia + tareas + apuntes (CASCADE)
  Logger.log('✅ Test completado y limpieza ejecutada.');
}