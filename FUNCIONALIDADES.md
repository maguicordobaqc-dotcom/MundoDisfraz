# MUNDO DISFRAZ — App Web

## Resumen de funcionalidades

### 🔐 Login
- Inicio de sesión con email y contraseña
- Rutas protegidas (redirige al login si no está autenticado)

### 📊 Dashboard
- Tarjetas con estadísticas: Total en Caja, Total Señas, Saldo Pendiente, Alquileres, Garantías x Devolver
- Lista de últimos alquileres con estado

### 👥 Clientes
- Buscar por apellido (sin importar mayúsculas/minúsculas)
- Si se busca sin texto, trae **todos** los clientes
- Columnas **Apellido** y **Nombre** ordenables (click en cabecera, flecha ascendente/descendente)
- **Crear** nuevo cliente
- **Editar** cliente (modal con todos los campos)
- **Borrar** cliente (solo si no tiene alquileres, con confirmación)
- Ver **historial de alquileres** del cliente (botón o doble click)
- Doble click en fila para ver historial

### ➕ Nuevo Alquiler (3 pasos)

**Paso 1 — Seleccionar Cliente**
- Buscar por apellido
- Sin texto: muestra todos los clientes ordenados alfabéticamente
- Columnas Apellido y Nombre ordenables
- Doble click para seleccionar cliente
- Botón "Saltar (sin cliente)"

**Paso 2 — Items, Fechas y Precios**
- Panel izquierdo: **Disfraces Disponibles**
  - Lista de todos los disfraces usados anteriormente (ordenados alfabéticamente)
  - Campo **"Buscar disfraz..."** que filtra a medida que escribís
  - Click en un disfraz para agregarlo
  - Campo para escribir un **nombre personalizado** y agregarlo
- Panel derecho: **Items Seleccionados**
  - Cada item tiene: nombre, talle, foto
  - Foto: **subir archivo** o **pegar imagen (Ctrl+V)** o **pegar URL**
  - Botón ✕ para quitar item
- Fecha de Alquiler (obligatorio)
- Fecha de Devolución
- Turno (mañana/tarde)
- Colegio / Institución
- Precio total, Seña
- Garantía + checkbox "Garantía devuelta"
- Nota adicional
- Muestra historial de alquileres del cliente seleccionado

**Paso 3 — Confirmar**
- Resumen de todo antes de guardar
- Botón Volver y Confirmar
- Las fotos se suben a Firebase Storage automáticamente

### 📋 Alquileres
- Lista completa con **búsqueda por nombre de cliente**
- Pestañas de filtro: Todos, Pendiente, Retirado, Entregado, Devuelto, Reservado
- Columnas **ordenables**: Cliente, Fecha/Turno, Precio, Estado (con flechas)
- Cambiar estado desde un **menú desplegable** en cada fila
- Botón **✏️ Editar** → modal con todos los campos editables:
  - Items (agregar/quitar), fechas, turno, colegio, precio, seña, garantía, nota, estado
- Botón **🗑️ Borrar** (con confirmación)
- Click en "N items" para ver detalle completo con fotos

### 📈 Reportes
- **Filtro por rango de fechas** (Desde / Hasta) que afecta a todo
- Tarjetas de resumen: Total en Caja, Señas, Saldo Pendiente, Cantidad, Garantías Pendientes
- **Pestañas** para elegir qué gráfico ver:
  - **Alquileres x Día** → gráfico de barras + línea de tendencia
  - **Ingresos x Día ($)** → gráfico de barras + línea de tendencia
  - **Disfraces más Alquilados** → gráfico de barras horizontal (top 9 + Otros)
  - **Alquileres por Colegio** → gráfico de barras horizontal
  - **Garantías Pendientes** → tabla detallada
  - **Detalle x Día** → tabla con fecha y cantidad

### 📱 Funcionalidades Móviles
- Diseño responsive (se adapta a pantallas chicas)
- La cámara del celular se abre automáticamente al tocar "Seleccionar archivo" en foto

---

## Pendiente / Posibles mejoras

- [ ] **Exportar reportes a PDF o Excel**
- [ ] **Recordatorios automáticos** (garantías, devoluciones)
- [ ] **Múltiples fotos por item**
- [ ] **Imprimir comprobante / recibo**
- [ ] **Backup automático** de datos de Firestore
- [ ] **Roles de usuario** (admin, empleado)
- [ ] **Historial de cambios** en alquileres (log de ediciones)
- [ ] **Notificaciones** de garantías próximas a vencer
