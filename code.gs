/**
 * ============================================================
 * Code.gs — Backend Google Apps Script
 * Portfolio de Logros: API REST para Google Sheets
 * ============================================================
 *
 * INSTRUCCIONES:
 * 1. Abre https://script.google.com/ y crea un nuevo proyecto.
 * 2. Pega este código en el editor.
 * 3. Configura la constante SPREADSHEET_ID con el ID de tu hoja.
 * 4. Implementa como Web App (ver README para detalles).
 *
 * ESTRUCTURA DE LA HOJA DE CÁLCULO:
 * - Pestaña "Logros"        → logros/reconocimientos
 * - Pestaña "Voluntariados" → actividades voluntarias
 * - Pestaña "Personales"    → logros privados/personales
 * (ver encabezados exactos más abajo)
 */

// ============================================================
// CONFIGURACIÓN — ÚNICO VALOR QUE DEBES CAMBIAR
// ============================================================
/**
 * ID de tu Google Spreadsheet.
 * Lo encuentras en la URL de la hoja:
 * https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit
 */
const SPREADSHEET_ID = '1Dy_HH3h9wlMXf-EsfQeeGiy1hgFRTMVN5KWUmYr_taA';

// ============================================================
// NOMBRES DE PESTAÑAS Y ENCABEZADOS
// ============================================================
const SHEETS = {
  logros: {
    name: 'Logros',
    headers: ['id', 'titulo', 'descripcion', 'puesto', 'beneficios', 'fechaInicio', 'fechaFin', 'presente', 'etiquetas', 'createdAt', 'updatedAt'],
  },
  voluntariados: {
    name: 'Voluntariados',
    headers: ['id', 'titulo', 'organizacion', 'descripcion', 'fechaInicio', 'fechaFin', 'presente', 'rol', 'horas', 'createdAt', 'updatedAt'],
  },
  personales: {
    name: 'Personales',
    headers: ['id', 'titulo', 'descripcion', 'puesto', 'beneficios', 'fechaInicio', 'fechaFin', 'presente', 'etiquetas', 'createdAt', 'updatedAt'],
  },
};

// ============================================================
// CORS HEADERS — necesarios para que el frontend pueda llamar
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

/**
 * doGet: responde a peticiones GET.
 * Se usa opcionalmente para servir el HTML de la app
 * si decides alojar todo en Apps Script.
 */
function doGet(e) {
  // Si quieres servir el HTML desde Apps Script, descomenta:
  // return HtmlService.createHtmlOutputFromFile('index')
  //   .setTitle('Portfolio de Logros')
  //   .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  // Por defecto, retorna información básica de la API
  const output = ContentService
    .createTextOutput(JSON.stringify({ ok: true, message: 'API activa. Usa POST para operar.' }))
    .setMimeType(ContentService.MimeType.JSON);
  return setCorsHeaders(output);
}

/**
 * doPost: punto de entrada principal para todas las operaciones CRUD.
 *
 * Espera un JSON con el siguiente esquema:
 * {
 *   action: 'create' | 'read' | 'update' | 'delete',
 *   type:   'logros' | 'voluntariados' | 'personales',
 *   data:   { ...campos }
 * }
 */
function doPost(e) {
  let result;

  try {
    // Parsear el body (viene como texto plano)
    const body = JSON.parse(e.postData.contents);
    const { action, type, data } = body;

    // Validar tipo de hoja
    if (!SHEETS[type]) {
      throw new Error(`Tipo inválido: "${type}". Debe ser logros, voluntariados o personales.`);
    }

    // Inicializar la hoja si no existe
    ensureSheet(type);

    // Despachar la acción
    switch (action) {
      case 'create': result = createRecord(type, data);     break;
      case 'read':   result = readRecords(type, data);      break;
      case 'update': result = updateRecord(type, data);     break;
      case 'delete': result = deleteRecord(type, data);     break;
      default:
        throw new Error(`Acción inválida: "${action}".`);
    }

  } catch (err) {
    result = {
      ok: false,
      message: err.message || 'Error interno del servidor.',
    };
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
 * createRecord — Inserta una nueva fila en la pestaña correspondiente.
 * Genera un ID único (timestamp + random) y timestamps de creación.
 *
 * @param {string} type  - 'logros' | 'voluntariados' | 'personales'
 * @param {Object} data  - Campos del registro
 * @returns {Object}     - { ok, message, data: { id } }
 */
function createRecord(type, data) {
  const sheet = getSheet(type);
  const headers = SHEETS[type].headers;
  const now = new Date().toISOString();

  // Generar ID único
  const id = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  // Construir fila según los encabezados definidos
  const row = headers.map(h => {
    if (h === 'id')        return id;
    if (h === 'createdAt') return now;
    if (h === 'updatedAt') return now;
    return data[h] !== undefined ? String(data[h]) : '';
  });

  sheet.appendRow(row);

  return {
    ok: true,
    message: 'Registro creado correctamente.',
    data: { id },
  };
}

/**
 * readRecords — Lee todos los registros de una pestaña.
 * Convierte cada fila en un objeto usando los encabezados como claves.
 *
 * @param {string} type  - Tipo de registro
 * @param {Object} query - (reservado para filtros futuros)
 * @returns {Object}     - { ok, data: [ ...records ] }
 */
function readRecords(type, query) {
  const sheet = getSheet(type);
  const headers = SHEETS[type].headers;
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    // Solo encabezados o vacío
    return { ok: true, data: [] };
  }

  // Obtener todas las filas de datos (desde fila 2)
  const range = sheet.getRange(2, 1, lastRow - 1, headers.length);
  const rows = range.getValues();

  const records = rows
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] !== undefined ? String(row[i]) : '';
      });
      return obj;
    })
    // Filtrar filas vacías (por si hay filas con ID vacío)
    .filter(r => r.id && r.id.trim() !== '');

  return { ok: true, data: records };
}

/**
 * updateRecord — Actualiza una fila existente buscando por ID.
 * Preserva el campo 'createdAt' original y actualiza 'updatedAt'.
 *
 * @param {string} type - Tipo de registro
 * @param {Object} data - Campos a actualizar (debe incluir 'id')
 * @returns {Object}    - { ok, message }
 */
function updateRecord(type, data) {
  const sheet = getSheet(type);
  const headers = SHEETS[type].headers;
  const id = data.id;

  if (!id) throw new Error('ID requerido para actualizar.');

  const rowIndex = findRowById(sheet, id, headers);
  if (rowIndex === -1) throw new Error(`Registro con ID "${id}" no encontrado.`);

  const now = new Date().toISOString();

  // Leer la fila actual para preservar createdAt
  const currentRange = sheet.getRange(rowIndex, 1, 1, headers.length);
  const currentRow = currentRange.getValues()[0];
  const currentObj = {};
  headers.forEach((h, i) => { currentObj[h] = currentRow[i]; });

  // Construir la fila actualizada
  const newRow = headers.map(h => {
    if (h === 'id')        return id;
    if (h === 'createdAt') return currentObj.createdAt || now;  // preservar
    if (h === 'updatedAt') return now;                           // actualizar
    return data[h] !== undefined ? String(data[h]) : (currentObj[h] || '');
  });

  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([newRow]);

  return { ok: true, message: 'Registro actualizado correctamente.' };
}

/**
 * deleteRecord — Elimina una fila buscando por ID.
 *
 * @param {string} type - Tipo de registro
 * @param {Object} data - Debe incluir 'id'
 * @returns {Object}    - { ok, message }
 */
function deleteRecord(type, data) {
  const sheet = getSheet(type);
  const headers = SHEETS[type].headers;
  const id = data.id;

  if (!id) throw new Error('ID requerido para eliminar.');

  const rowIndex = findRowById(sheet, id, headers);
  if (rowIndex === -1) throw new Error(`Registro con ID "${id}" no encontrado.`);

  sheet.deleteRow(rowIndex);

  return { ok: true, message: 'Registro eliminado correctamente.' };
}

// ============================================================
// UTILIDADES INTERNAS
// ============================================================

/**
 * getSheet — Obtiene (o crea) la hoja por tipo.
 */
function getSheet(type) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetName = SHEETS[type].name;
  return ss.getSheetByName(sheetName) || createSheetWithHeaders(ss, type);
}

/**
 * ensureSheet — Garantiza que la pestaña exista con sus encabezados.
 * Crea la pestaña si no existe.
 */
function ensureSheet(type) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetName = SHEETS[type].name;
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = createSheetWithHeaders(ss, type);
  } else {
    // Verificar que los encabezados existan en la fila 1
    const firstRow = sheet.getRange(1, 1, 1, SHEETS[type].headers.length).getValues()[0];
    if (!firstRow[0]) {
      sheet.getRange(1, 1, 1, SHEETS[type].headers.length).setValues([SHEETS[type].headers]);
    }
  }
  return sheet;
}

/**
 * createSheetWithHeaders — Crea una nueva pestaña con los encabezados en negrita.
 */
function createSheetWithHeaders(ss, type) {
  const sheetName = SHEETS[type].name;
  const headers = SHEETS[type].headers;
  const sheet = ss.insertSheet(sheetName);

  // Escribir encabezados en la fila 1
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);

  // Formatear encabezados: negrita, fondo oscuro, texto blanco
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#1a1a2e');
  headerRange.setFontColor('#ffffff');

  // Congelar la fila de encabezados
  sheet.setFrozenRows(1);

  // Ajustar ancho de columnas
  headers.forEach((_, i) => sheet.setColumnWidth(i + 1, 160));

  return sheet;
}

/**
 * findRowById — Busca la fila (número de fila en Sheet) que contiene el ID dado.
 * Retorna -1 si no se encuentra.
 */
function findRowById(sheet, id, headers) {
  const idColIndex = headers.indexOf('id');
  if (idColIndex === -1) return -1;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  // Obtener solo la columna de IDs (desde fila 2)
  const colValues = sheet.getRange(2, idColIndex + 1, lastRow - 1, 1).getValues();

  for (let i = 0; i < colValues.length; i++) {
    if (String(colValues[i][0]) === String(id)) {
      return i + 2; // +2 porque empezamos en fila 2 (fila 1 = encabezados)
    }
  }
  return -1;
}

// ============================================================
// FUNCIÓN DE CONFIGURACIÓN INICIAL (ejecutar manualmente una vez)
// ============================================================
/**
 * setupSpreadsheet — Crea todas las pestañas con sus encabezados.
 * Ejecuta esta función UNA VEZ desde el editor de Apps Script
 * (menú "Ejecutar" > "setupSpreadsheet") para inicializar la hoja.
 */
function setupSpreadsheet() {
  ['logros', 'voluntariados', 'personales'].forEach(type => ensureSheet(type));
  Logger.log('✅ Hoja configurada correctamente. Pestañas creadas: Logros, Voluntariados, Personales.');
}

// ============================================================
// FUNCIÓN DE PRUEBA (para ejecutar desde el editor)
// ============================================================
/**
 * testAPI — Prueba básica de las funciones CRUD.
 * Ejecuta desde el editor de Apps Script para verificar el funcionamiento.
 */
function testAPI() {
  // Test CREATE
  const created = createRecord('logros', {
    titulo: 'Test logro',
    descripcion: 'Prueba de creación',
    etiquetas: 'test,prueba',
    presente: 'false',
    fechaInicio: '2024-01-01',
  });
  Logger.log('CREATE:', JSON.stringify(created));

  // Test READ
  const records = readRecords('logros', {});
  Logger.log('READ count:', records.data.length);

  if (records.data.length > 0) {
    const firstId = records.data[0].id;

    // Test UPDATE
    const updated = updateRecord('logros', { id: firstId, titulo: 'Logro actualizado' });
    Logger.log('UPDATE:', JSON.stringify(updated));

    // Test DELETE
    const deleted = deleteRecord('logros', { id: firstId });
    Logger.log('DELETE:', JSON.stringify(deleted));
  }
}