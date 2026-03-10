# 📁 Portfolio de Logros — README

Portal web para registrar logros, reconocimientos, voluntariados y logros personales, conectado a Google Sheets mediante Google Apps Script.

---

## 📂 Estructura de archivos

```
portfolio-logros/
├── index.html     → SPA (Single Page App) principal
├── styles.css     → Estilos (estética editorial oscura)
├── app.js         → Lógica frontend (fetch a Apps Script, UI)
├── Code.gs        → Backend Google Apps Script (API REST)
└── README.md      → Este archivo
```

---

## 🗂️ Estructura del Google Sheet

### Pestañas y encabezados (fila 1)

#### Pestaña: `Logros`
| id | titulo | descripcion | puesto | beneficios | fechaInicio | fechaFin | presente | etiquetas | createdAt | updatedAt |
|----|--------|-------------|--------|------------|-------------|----------|----------|-----------|-----------|-----------|
| 1716000000_abc123 | Premio Innovación 2024 | Primer lugar en hackathon nacional | 1er lugar | USD 2,000 | 2024-03-15 | 2024-03-17 | false | tecnología,hackathon | 2024-03-18T10:00:00.000Z | 2024-03-18T10:00:00.000Z |
| 1716000001_def456 | Liderazgo de producto | Coordinando equipo de 8 personas | Product Lead | Aumento salarial | 2023-09-01 |  | true | liderazgo,carrera | 2023-09-01T08:00:00.000Z | 2024-01-01T09:00:00.000Z |

#### Pestaña: `Voluntariados`
| id | titulo | organizacion | descripcion | fechaInicio | fechaFin | presente | rol | horas | createdAt | updatedAt |
|----|--------|--------------|-------------|-------------|----------|----------|-----|-------|-----------|-----------|
| 1716000002_ghi789 | Tutor de programación | Code for Kids | Clases semanales de código para niños | 2023-01-10 |  | true | Instructor voluntario | 120 | 2023-01-10T12:00:00.000Z | 2024-06-01T08:00:00.000Z |
| 1716000003_jkl012 | Banco de alimentos | Cruz Roja Local | Distribución de alimentos | 2022-11-01 | 2023-02-28 | false | Coordinador logística | 48 | 2022-11-01T10:00:00.000Z | 2023-03-01T10:00:00.000Z |

#### Pestaña: `Personales`
| id | titulo | descripcion | puesto | beneficios | fechaInicio | fechaFin | presente | etiquetas | createdAt | updatedAt |
|----|--------|-------------|--------|------------|-------------|----------|----------|-----------|-----------|-----------|
| 1716000004_mno345 | Desafío 100 días de código | Programar 1h diaria por 100 días | Completado | Habilidades mejoradas | 2024-01-01 | 2024-04-10 | false | programación,hábitos | 2024-01-01T07:00:00.000Z | 2024-04-10T20:00:00.000Z |
| 1716000005_pqr678 | Maratón de Madrid | Completar mi primera maratón | Finisher | Medalla + experiencia | 2024-04-21 |  | false | deporte,reto | 2024-04-22T09:00:00.000Z | 2024-04-22T09:00:00.000Z |

---

## 🚀 Instrucciones de despliegue paso a paso

### PASO 1 — Crear el Google Sheet

1. Ve a [https://docs.google.com/spreadsheets/](https://docs.google.com/spreadsheets/) y crea una hoja en blanco.
2. Dale un nombre descriptivo, por ejemplo: **"Portfolio de Logros"**.
3. Copia el **ID de la hoja** desde la URL:
   ```
   https://docs.google.com/spreadsheets/d/  →  ESTE_ES_EL_ID  ←  /edit#gid=0
   ```
4. Guarda este ID, lo necesitarás en el Paso 3.

> **Nota:** Las pestañas (`Logros`, `Voluntariados`, `Personales`) se crearán automáticamente cuando ejecutes `setupSpreadsheet()` en el Paso 4.

---

### PASO 2 — Crear el proyecto de Apps Script

**Opción A (recomendada): Desde Google Sheets**
1. Abre tu Google Sheet.
2. Ve a **Extensiones → Apps Script**.
3. Se abrirá el editor con un proyecto vinculado a tu hoja.

**Opción B: Proyecto independiente**
1. Ve a [https://script.google.com/](https://script.google.com/).
2. Haz clic en **"Nuevo proyecto"**.

---

### PASO 3 — Pegar el código backend

1. En el editor de Apps Script, borra el contenido de `Code.gs`.
2. Pega el contenido completo del archivo `Code.gs` de este proyecto.
3. **¡IMPORTANTE!** En la línea:
   ```javascript
   const SPREADSHEET_ID = 'REEMPLAZAR_POR_ID_DE_TU_SPREADSHEET';
   ```
   Reemplaza `REEMPLAZAR_POR_ID_DE_TU_SPREADSHEET` con el ID que copiaste en el Paso 1.

4. Guarda el archivo con **Ctrl+S** (o **Cmd+S** en Mac).

---

### PASO 4 — Inicializar la hoja (ejecutar una sola vez)

1. En el editor de Apps Script, abre el menú desplegable de funciones (cerca del botón ▶).
2. Selecciona la función **`setupSpreadsheet`**.
3. Haz clic en **▶ Ejecutar**.
4. Se te pedirá autorizar permisos: acepta todos (la app solo accede a tu Google Sheet).
5. Abre tu Google Sheet — deberías ver 3 nuevas pestañas: `Logros`, `Voluntariados`, `Personales`.

---

### PASO 5 — Desplegar como Web App

1. En el editor de Apps Script, haz clic en **"Implementar"** → **"Nueva implementación"**.
2. Haz clic en el ⚙️ junto a "Selecciona el tipo" → elige **"Aplicación web"**.
3. Completa los campos:
   - **Descripción:** `Portfolio API v1`
   - **Ejecutar como:** `Yo (tu_email@gmail.com)` ← la app accede a Sheets con tu cuenta
   - **Quién tiene acceso:** `Cualquier usuario (incluso anónimo)` ← necesario para que el frontend pueda llamar sin login
4. Haz clic en **"Implementar"**.
5. Copia la **URL de la aplicación web** que aparece. Tiene esta forma:
   ```
   https://script.google.com/macros/s/AKfycby.../exec
   ```
6. **Guarda esta URL**, la usarás en el Paso 6.

> ⚠️ **Nota de seguridad:** "Cualquier usuario anónimo" significa que cualquiera con la URL puede leer/escribir datos. Para uso personal esto es aceptable. Para equipos, considera:
> - Usar **"Usuarios de la organización"** si tienes Google Workspace.
> - Añadir un parámetro secreto (`apiKey`) que verifiques en `doPost`.
> - Configurar restricciones adicionales en el script.

---

### PASO 6 — Conectar el frontend

1. Abre el archivo **`app.js`**.
2. En la primera línea de configuración, reemplaza la URL:
   ```javascript
   // ANTES:
   const SCRIPT_URL = 'REEMPLAZAR_POR_URL_DE_DEPLOY';

   // DESPUÉS:
   const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby.../exec';
   ```
3. Guarda el archivo.

---

### PASO 7 — Abrir la aplicación

Abre `index.html` en tu navegador. Puedes:

**Opción A: Localmente**
- Haz doble clic en `index.html` (puede haber problemas de CORS localmente).
- Usa un servidor local simple:
  ```bash
  # Con Python 3
  python -m http.server 8080

  # Con Node.js (npx)
  npx serve .
  ```
  Luego abre `http://localhost:8080`.

**Opción B: Hosting gratuito**
- Sube los archivos a [GitHub Pages](https://pages.github.com/), [Netlify](https://netlify.com/), o [Vercel](https://vercel.com/).
- Para GitHub Pages: sube a un repo y activa Pages en la configuración.

**Opción C: Servir desde Apps Script (todo en uno)**
- Añade los archivos `index.html`, `styles.css` y `app.js` como archivos HTML en tu proyecto de Apps Script.
- Descomenta la línea en `doGet()` del `Code.gs` para servir el HTML.

---

## 🧪 Pruebas y depuración

### Probar el endpoint desde la consola del navegador

```javascript
// Reemplaza con tu URL real
const URL = 'https://script.google.com/macros/s/AKfycby.../exec';

// TEST: Leer registros
fetch(URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify({ action: 'read', type: 'logros', data: {} }),
  redirect: 'follow',
})
.then(r => r.json())
.then(console.log);
```

### Probar con curl

```bash
curl -L -X POST \
  'https://script.google.com/macros/s/AKfycby.../exec' \
  -H 'Content-Type: text/plain' \
  -d '{"action":"read","type":"logros","data":{}}'
```

### Probar con Postman

1. Método: **POST**
2. URL: tu `SCRIPT_URL`
3. Body → Raw → **Text**:
   ```json
   {"action":"read","type":"logros","data":{}}
   ```
4. Enviar.

### Ejecutar pruebas desde el editor de Apps Script

1. Selecciona la función `testAPI`.
2. Haz clic en ▶ Ejecutar.
3. Revisa los logs en **Ver → Registros**.

---

## 🔄 Actualizar el despliegue

Cuando modifiques `Code.gs`, debes **crear una nueva implementación**:

1. **Implementar** → **Administrar implementaciones**.
2. Haz clic en el ✏️ de tu implementación activa.
3. En "Versión" selecciona **"Nueva versión"**.
4. Haz clic en **"Implementar"**.

> La URL permanece igual — no necesitas actualizar `app.js`.

---

## 📤 Exportar a PDF

Google Sheets ofrece exportación nativa a PDF:

1. Abre tu Google Sheet.
2. **Archivo → Descargar → PDF**.
3. Configura el rango (todas las hojas o una sola pestaña).
4. Haz clic en **"Exportar"**.

Para un PDF más personalizado con el diseño del portal, considera usar la función de imprimir del navegador con `Ctrl+P` / `Cmd+P` estando en la vista que desees.

---

## 🔐 Scopes de OAuth requeridos

Apps Script solicitará estos permisos al ejecutar por primera vez:

| Scope | Razón |
|-------|-------|
| `spreadsheets` | Leer y escribir en Google Sheets |
| `script.external_request` | (No requerido en este proyecto) |

Solo se usa el scope de Google Sheets, no se accede a otros servicios de Google.

---

## 🛠️ Solución de problemas frecuentes

| Problema | Solución |
|----------|----------|
| "No se pudieron cargar los registros" | Verifica que `SCRIPT_URL` en `app.js` sea correcto y que el deploy esté activo |
| Error 401 / 403 al hacer POST | Asegúrate de que el deploy esté configurado como "Cualquier usuario" |
| La hoja no se crea | Ejecuta `setupSpreadsheet()` manualmente desde el editor |
| CORS error en localhost | Usa un servidor local (`python -m http.server`) en vez de abrir el archivo directamente |
| "ID no encontrado" al actualizar | El registro puede haber sido editado manualmente en Sheets; verifica que el ID existe en la columna A |
| Apps Script no ve cambios | Crea una nueva versión del deploy (ver "Actualizar el despliegue") |

---

## 📝 Personalización

### Añadir nuevos campos
1. Agrega el campo a `SHEETS.logros.headers` en `Code.gs`.
2. Agrega el input correspondiente en el formulario de `index.html`.
3. Añade la lectura del campo en `collectLogro()` de `app.js`.
4. Actualiza la tarjeta en `buildCard()` de `app.js`.
5. **Importante:** Añade manualmente el encabezado en la columna correcta de tu Google Sheet, o elimina y recrea la pestaña con `setupSpreadsheet()`.

### Cambiar el número de registros por página
En `app.js`, línea:
```javascript
const PAGE_SIZE = 9; // Cambia este número
```

### Cambiar el tema de colores
En `styles.css`, modifica las variables CSS en `:root`:
```css
--gold:       #d4a843;  /* Color de acento principal */
--bg:         #0e0f14;  /* Fondo oscuro */
--text-primary: #f0eee8; /* Texto principal */
```

---

*Generado como proyecto completo. Todos los archivos son de código abierto para uso personal.*