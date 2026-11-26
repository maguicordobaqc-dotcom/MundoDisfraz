export default function Ayuda() {
  return (
    <div className="page">
      <h2>🎭 Ayuda — Mundo Disfraz</h2>
      <p className="text-muted" style={{ marginBottom: 20 }}>
        Guía completa de todas las funcionalidades actuales de la aplicación.
      </p>

      <div className="help-section">
        <h3>🔐 Acceso y Roles</h3>
        <ul>
          <li>Inicio de sesión con email y contraseña (rutas protegidas).</li>
          <li><strong>Usuario operativo del local:</strong> acceso completo a Inicio, Clientes, Nuevo Alquiler, Alquileres, Reportes y Ayuda.</li>
          <li><strong>Cuentas supervisoras:</strong> además acceden a la sección <strong>⚙️ Mantenimiento</strong> (backups, limpieza de fotos viejas y migraciones), oculta para el resto de los usuarios.</li>
        </ul>
      </div>

      <div className="help-section">
        <h3>📊 Inicio (Panel Principal)</h3>
        <ul>
          <li>Tarjetas con estadísticas en vivo: <strong>Clientes</strong>, <strong>Alquileres</strong>, <strong>Reservados</strong>, <strong>⏰ Por Devolver</strong> (acceso directo a vencidos / de hoy), <strong>Total Caja</strong> y <strong>Total Señas</strong>.</li>
          <li>Lista de los últimos 5 alquileres con teléfono visible, cambio rápido de estado, edición (✏️), eliminación (🗑️), comprobante WhatsApp (📤) y recordatorio de fuera de término (⚠️).</li>
          <li>Botón <strong>🔄 Actualizar</strong> arriba a la derecha para traer cambios cargados desde otro celular o computadora.</li>
        </ul>
      </div>

      <div className="help-section">
        <h3>👥 Clientes</h3>
        <ul>
          <li><strong>Búsqueda flexible:</strong> buscá por <strong>apellido, nombre o teléfono</strong>, sin importar tildes, mayúsculas, comas ni el orden de palabras (ej: <em>"torres"</em>, <em>"gomez"</em>, <em>"juan torres"</em>). Sin texto trae todos ordenados alfabéticamente.</li>
          <li><strong>Crear</strong>, <strong>Editar</strong> y <strong>Borrar</strong> clientes (solo permite borrar si no tiene alquileres registrados).</li>
          <li>Teléfono dividido en <strong>Celular Principal</strong> (prefijo 381) y <strong>Celular Secundario</strong> (opcional).</li>
          <li>Al crear un cliente aparece el botón <strong>"➕ Cargar Alquiler"</strong> para ir directo a Nuevo Alquiler.</li>
          <li>Ver <strong>historial de alquileres</strong> del cliente (botón 📋), con acceso a ficha completa (fotos, fechas, fecha/hora de retiro, precios), edición (✏️), borrado (🗑️) y botón <strong>"➕ Nuevo Alquiler"</strong>.</li>
        </ul>
      </div>

      <div className="help-section">
        <h3>➕ Nuevo Alquiler (3 pasos)</h3>
        <h4>Paso 1 — Seleccionar Cliente</h4>
        <ul>
          <li>Búsqueda flexible por apellido, nombre o teléfono (sin importar tildes ni orden).</li>
          <li>Si el cliente no existe, se puede crear ahí mismo y pasa automáticamente al Paso 2.</li>
          <li>Doble click para seleccionar o botón "Saltar (sin cliente)".</li>
        </ul>
        <h4>Paso 2 — Items, Fechas, Retiro y Precios</h4>
        <ul>
          <li>Cada item tiene nombre del disfraz, talle y foto (<strong>📷 Tomar foto</strong> con cámara del celular, subir archivo, pegar con Ctrl+V o pegar URL).</li>
          <li>Botón <strong>"+ Agregar item"</strong> para sumar varios disfraces en el mismo alquiler.</li>
          <li>Fechas: <strong>Fecha de Alquiler</strong>, <strong>Fecha del Evento</strong> y <strong>Fecha de Devolución</strong>, más Turno y Colegio.</li>
          <li>Precio (default $17000), Seña, Garantía + checkbox "Garantía devuelta".</li>
          <li><strong>Fecha que retira y Hora de retiro (opcionales):</strong> para cuando el cliente reserva y retira otro día (podés escribir hora exacta ej. <code>17:30</code> o franja ej. <code>de 17 a 19 hs</code>). Si se lo lleva en el momento, se dejan vacíos.</li>
          <li>Selector de <strong>Estado</strong> simplificado en 3 opciones: <strong>Reservado</strong> (por defecto), <strong>Retirado</strong> y <strong>Devuelto</strong>.</li>
          <li>Muestra el historial de alquileres anteriores del cliente seleccionado.</li>
        </ul>
        <h4>Paso 3 — Confirmar y Comprobante WhatsApp</h4>
        <ul>
          <li>Resumen completo antes de guardar (incluyendo fecha y hora de retiro si se cargaron).</li>
          <li>Validación si algún item quedó sin foto (pregunta "¿Continuar igual?").</li>
          <li>Las fotos nuevas se comprimen a ~60 KB y se guardan en una colección separada (<code>alquileres_fotos</code>) para mantener la app rápida.</li>
          <li>Al confirmar ofrece enviar el <strong>comprobante por WhatsApp</strong> al Celular Principal, incluyendo Precio, Seña, Garantía, Saldo a Pagar (si hubo seña), <strong>Retiro del disfraz</strong> (si se cargó fecha/hora) y condiciones de devolución.</li>
        </ul>
      </div>

      <div className="help-section">
        <h3>📋 Alquileres (3 modos de consulta)</h3>
        <h4>👤 Modo 1 — Por Cliente</h4>
        <ul>
          <li><strong>Búsqueda flexible:</strong> por apellido o nombre en cualquier orden, sin importar comas ni tildes. Al empezar a escribir cambia automáticamente a la pestaña <strong>Todos</strong> para encontrar siempre al cliente al instante.</li>
          <li><strong>Solo 3 estados claros</strong> con contador en vivo en cada pestaña: <strong>Todos (N)</strong>, <strong>Reservado (N)</strong>, <strong>Retirado (N)</strong> y <strong>Devuelto (N)</strong>.</li>
          <li>Filtro por fecha de devolución (si un filtro oculta resultados de tu búsqueda, muestra un botón rápido para quitarlo).</li>
          <li>Cambio rápido de estado desde cada fila o desde el detalle; al pasar a <strong>Devuelto</strong> marca automáticamente la garantía como devuelta.</li>
          <li>Botones <strong>📷 X items</strong> (abre ficha completa con fotos y fecha/hora de retiro), <strong>📤</strong> comprobante WhatsApp, <strong>⚠️</strong> recordatorio fuera de término (solo en <em>Retirado</em> vencidos), <strong>✏️</strong> editar y <strong>🗑️</strong> borrar.</li>
        </ul>
        <h4>🎭 Modo 2 — Por Disfraz (con fotos)</h4>
        <ul>
          <li>Escribí al menos 2 letras del disfraz o talle (sin importar tildes) para ver <strong>todos los clientes que se lo llevaron</strong>, con la <strong>foto visible en cada fila</strong> (tocándola se amplía a pantalla completa).</li>
          <li>Incluye botón directo <strong>"Ver todos los disfraces sin devolver (en Retirado)"</strong> para revisar visualmente todo lo que está en la calle.</li>
          <li>Permite contactar por WhatsApp, cambiar el estado a <strong>Devuelto</strong>, ver la ficha completa (👁️) o editar (✏️) ahí mismo.</li>
        </ul>
        <h4>⏰ Modo 3 — Por Devolver (control diario)</h4>
        <ul>
          <li>Arranca <strong>con la fecha de hoy puesta por defecto</strong> en modo <strong>"Hasta esta fecha (para atrás)"</strong>, listando de una todos los alquileres <em>Retirados</em> que vencen hoy o están atrasados.</li>
          <li>Permite cambiar a <strong>"Solo esta fecha exacta"</strong> (por ejemplo para ver qué devuelven mañana), filtrar por nombre/disfraz y ordenar por <em>Hoy primero</em> o <em>Más atrasados primero</em>.</li>
          <li>Muestra etiqueta de <strong>Vence hoy</strong> o <strong>⚠️ X días de atraso</strong>, botón verde <strong>✓ Devuelto</strong> en 1 clic, botón <strong>⚠️ Reclamar</strong> por WhatsApp y acceso a fotos.</li>
        </ul>
      </div>

      <div className="help-section">
        <h3>📈 Reportes</h3>
        <ul>
          <li>Filtro por rango de fechas (Desde / Hasta) + botón <strong>🔄 Actualizar</strong>.</li>
          <li>Tarjetas resumen: Total Caja, Señas, Saldo Pendiente, Alquileres, <strong>Garantías x Devolver</strong> (desplegable) y <strong>Sin Foto</strong> (desplegable).</li>
          <li>Gráficos y tablas: Alquileres x Día, Ingresos x Día, Devoluciones x Día, Disfraces más Alquilados, Alquileres por Colegio, Garantías Pendientes (con exportar CSV), <strong>Buscar Disfraz</strong> (con fotos, estado y fecha de devolución) y Detalle x Día.</li>
        </ul>
      </div>

      <div className="help-section">
        <h3>⚡ Velocidad, Caché y Fotos</h3>
        <ul>
          <li><strong>Caché en sesión:</strong> la app carga los datos una vez al abrir y actualiza cada cambio al instante en pantalla sin volver a descargar toda la base. Si alguien cargó algo desde otro dispositivo, tocá <strong>🔄 Actualizar</strong>.</li>
          <li><strong>Fotos separadas (<code>alquileres_fotos</code>):</strong> las fotos se comprimen a ~60 KB (800px, calidad 0.5) y se cargan bajo demanda solo cuando abrís un alquiler o buscás por disfraz, logrando que la app abra en pocos segundos.</li>
          <li>Al tocar cualquier foto (propia o de Google Drive) se abre en <strong>pantalla completa</strong> (se cierra con ✕, tecla Escape o tocando el fondo oscuro).</li>
        </ul>
      </div>

      <div className="help-section">
        <h3>📱 Uso desde Celular</h3>
        <ul>
          <li>Diseño responsive adaptado a pantallas chicas con menú horizontal y tablas con scroll superior sincronizado.</li>
          <li>Al tocar <strong>"📷 Tomar foto"</strong> abre directamente la cámara trasera del celular.</li>
        </ul>
      </div>

      <div className="help-section">
        <h3>⚙️ Mantenimiento (solo cuentas supervisoras)</h3>
        <ul>
          <li>Las herramientas administrativas (<strong>Backup / Exportar JSON</strong>, <strong>Limpieza de fotos viejas de alquileres ya devueltos</strong> y <strong>Migraciones</strong>) están protegidas en la pestaña <strong>⚙️ Mantenimiento</strong>, visible únicamente para los usuarios supervisores autorizados.</li>
        </ul>
      </div>
    </div>
  );
}
