import { useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function Ayuda() {
  const [exportando, setExportando] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const [migrando, setMigrando] = useState(false);
  const [migraMsg, setMigraMsg] = useState('');
  const [migrandoGar, setMigrandoGar] = useState(false);
  const [migraGarMsg, setMigraGarMsg] = useState('');

  const exportar = async () => {
    setExportando(true);
    setExportMsg('');
    try {
      const [cliSnap, alqSnap] = await Promise.all([
        getDocs(collection(db, 'clientes')),
        getDocs(collection(db, 'alquileres')),
      ]);
      const data = {
        exportado: new Date().toISOString(),
        clientes: cliSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        alquileres: alqSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mundo-disfraz-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMsg(`✅ ${data.clientes.length} clientes y ${data.alquileres.length} alquileres exportados`);
    } catch (e) {
      setExportMsg('❌ Error al exportar: ' + e.message);
    }
    setExportando(false);
  };

  const migrarTelefonos = async () => {
    setMigrando(true);
    setMigraMsg('');
    try {
      const snap = await getDocs(collection(db, 'clientes'));
      let migrados = 0;
      for (const d of snap.docs) {
        const c = d.data();
        if (!c.telefono || c.telefonoPrincipal) continue;
        const partes = c.telefono.split(' / ');
        const ref = doc(db, 'clientes', d.id);
        await updateDoc(ref, {
          telefonoPrincipal: partes[0].trim(),
          telefonoSecundario: partes[1]?.trim() || '',
        });
        migrados++;
      }
      setMigraMsg(`✅ ${migrados} clientes migrados (teléfono dividido en principal/secundario)`);
    } catch (e) {
      setMigraMsg('❌ Error: ' + e.message);
    }
    setMigrando(false);
  };

  const migrarGarantiasDevueltas = async () => {
    setMigrandoGar(true);
    setMigraGarMsg('');
    try {
      const snap = await getDocs(collection(db, 'alquileres'));
      let migrados = 0;
      for (const d of snap.docs) {
        const a = d.data();
        if (a.estado === 'devuelto' && a.garantia && !a.garantiaDevuelta) {
          await updateDoc(doc(db, 'alquileres', d.id), { garantiaDevuelta: true });
          migrados++;
        }
      }
      setMigraGarMsg(`✅ ${migrados} alquileres actualizados (garantía marcada como devuelta)`);
    } catch (e) {
      setMigraGarMsg('❌ Error: ' + e.message);
    }
    setMigrandoGar(false);
  };

  return (
    <div className="page">
      <h2>🎭 Ayuda — Mundo Disfraz</h2>
      <p className="text-muted" style={{ marginBottom: 20 }}>Resumen de todas las funcionalidades de la aplicación.</p>

      <div className="help-section">
        <h3>🔐 Login</h3>
        <ul>
          <li>Inicio de sesión con email y contraseña</li>
          <li>Rutas protegidas (redirige al login si no está autenticado)</li>
        </ul>
      </div>

      <div className="help-section">
        <h3>📊 Dashboard</h3>
        <ul>
          <li>Tarjetas con estadísticas: Clientes, Alquileres, Pendientes, Total Caja, Total Señas</li>
          <li>Lista de últimos alquileres con teléfono visible (principal/secundario) y cambio rápido de estado</li>
          <li>Botón WhatsApp comprobante y recordatorio fuera de término (⚠️) en cada fila</li>
          <li>✏️ Editar: modal con todos los datos incluyendo fotos, teléfono (dos campos) y estado</li>
          <li>🗑️ Eliminar alquiler desde el mismo Dashboard</li>
        </ul>
      </div>

      <div className="help-section">
        <h3>👥 Clientes</h3>
        <ul>
          <li>Buscar por apellido (sin importar mayúsculas/minúsculas)</li>
          <li>Sin texto, trae <strong>todos</strong> ordenados alfabéticamente</li>
          <li><strong>Crear</strong>, <strong>Editar</strong> y <strong>Borrar</strong> clientes (borrar solo si no tiene alquileres)</li>
          <li>Teléfono dividido en <strong>Celular Principal</strong> (prefijo 381) y <strong>Celular Secundario</strong> (opcional)</li>
          <li>Al crear o editar, los teléfonos con formato antiguo ("381... / ...") se separan automáticamente</li>
          <li>Se eliminó el campo Email del formulario de alta y edición</li>
          <li>Al crear un cliente, aparece botón <strong>"➕ Cargar Alquiler"</strong> para ir directo a Nuevo Alquiler</li>
          <li>Ver <strong>historial de alquileres</strong> del cliente (botón 📋)</li>
          <li>En el historial: <strong>"➕ Nuevo Alquiler"</strong> para cargar otro alquiler a ese cliente</li>
          <li>Tocar una fila del historial muestra la <strong>ficha completa</strong> con fotos, fechas, precios y teléfono</li>
          <li>✏️ Editar y 🗑️ eliminar alquiler directamente desde el historial</li>
          <li>En la edición del alquiler: teléfono (dos campos), estado al tope, cambiar fotos</li>
          <li>La página se desplaza automáticamente al detalle al abrirlo</li>
        </ul>
      </div>

      <div className="help-section">
        <h3>➕ Nuevo Alquiler (3 pasos)</h3>
        <h4>Paso 1 — Seleccionar Cliente</h4>
        <ul>
          <li>Buscar por apellido; presionar Buscar o Enter</li>
          <li>Columnas Apellido y Nombre ordenables</li>
          <li>Si el cliente no existe, aparece un <strong>formulario para crearlo</strong> ahí mismo. Al crearlo, se selecciona automáticamente y pasa al paso 2</li>
          <li>Doble click para seleccionar cliente</li>
          <li>Botón "Saltar (sin cliente)"</li>
        </ul>
        <h4>Paso 2 — Items, Fechas y Precios</h4>
        <ul>
          <li>Item simple: nombre del disfraz (texto), talle y foto</li>
          <li>Botón <strong>"+ Agregar item"</strong> para añadir más disfraces manualmente</li>
          <li>Botón <strong>"📷 Tomar foto"</strong> que abre la cámara del celular directamente</li>
          <li>Foto: también pegar imagen (Ctrl+V) o pegar URL</li>
          <li>Fecha de Alquiler, Fecha del Evento, Fecha de Devolución, Turno, Colegio</li>
          <li>Precio (default $17000), Seña (default $0), Garantía + checkbox "Garantía devuelta", Nota</li>
          <li>Selector de <strong>Estado</strong> (pendiente, reservado, retirado, entregado)</li>
          <li>Muestra historial de alquileres del cliente seleccionado</li>
        </ul>
        <h4>Paso 3 — Confirmar</h4>
        <ul>
          <li>Resumen de todo antes de guardar</li>
          <li>Al confirmar: las fotos se comprimen y guardan como <strong>base64</strong> en Firestore</li>
          <li>Se guarda el teléfono del cliente (principal + secundario)</li>
          <li>Se abre WhatsApp con el <strong>comprobante</strong> (Precio, Seña, Saldo a Pagar, Garantía + términos)</li>
          <li>WhatsApp usa el <strong>Celular Principal</strong> (o el primer teléfono del campo combinado)</li>
          <li><strong>Al guardar:</strong> aparece un mensaje preguntando "¿Enviar el comprobante por WhatsApp?" — se envía apenas se confirma el alquiler, sin perder el número</li>
          <li>Si no se quiere enviar en ese momento, el botón "📤 Enviar comprobante" queda arriba de la página para enviarlo después</li>
          <li>Si la Seña es $0, se omite la línea "Saldo a Pagar"</li>
          <li><strong>Validación de fotos:</strong> si hay items sin foto, pregunta "¿Continuar igual?" antes de guardar</li>
          <li>El botón de WhatsApp comprobante se mantiene visible aunque desaparezca el mensaje de éxito</li>
          <li>Se limpia el formulario y vuelve al paso 1</li>
        </ul>
      </div>

      <div className="help-section">
        <h3>📋 Alquileres</h3>
        <ul>
          <li>Lista completa con <strong>búsqueda por nombre de cliente</strong></li>
          <li>Pestañas de filtro: Todos, Pendiente, Retirado, Entregado, Devuelto, Reservado</li>
          <li>Filtro por <strong>fecha de devolución</strong></li>
          <li>Columnas <strong>ordenables</strong>: Cliente, Fecha/Turno, Precio, Estado</li>
          <li>Cambiar estado desde un menú desplegable en cada fila</li>
          <li>Teléfono visible en cada fila (📞 principal/secundario)</li>
          <li>Botones WhatsApp comprobante (📤) y recordatorio fuera de término (⚠️)</li>
          <li><strong>📷 X items</strong> → abre ficha con foto de cada disfraz + info completa</li>
          <li>En el detalle: <strong>selector de estado</strong> y botón <strong>"✏️ Editar"</strong></li>
          <li>Al cambiar estado a "devuelto" con garantía pendiente, se marca automáticamente como devuelta (sin preguntar)</li>
          <li>✏️ Editar → modal con teléfono (dos campos), estado, items con fotos, fechas, precio, nota</li>
          <li>🗑️ Borrar (con confirmación)</li>
          <li>Tabla con scroll horizontal en mobile</li>
        </ul>
      </div>

      <div className="help-section">
        <h3>📈 Reportes</h3>
        <ul>
          <li><strong>Filtro por rango de fechas</strong> (Desde / Hasta) que afecta a todo</li>
          <li>Tarjetas de resumen: Total Caja, Señas, Saldo Pendiente, Alquileres, Garantías x Devolver, <strong>Sin Foto</strong></li>
          <li>Las tarjetas <strong>Garantías x Devolver</strong> y <strong>Sin Foto</strong> son clickeables: al tocarlas se despliega un listado detallado debajo con los datos filtrados</li>
          <li>En ambos listados desplegables, la columna <strong>Estado</strong> es ordenable (tocando el encabezado alterna ▲/▼)</li>
          <li>Pestañas para elegir gráfico:
            <ul>
              <li>Alquileres x Día → barras + línea de tendencia</li>
              <li>Ingresos x Día ($) → barras + línea de tendencia</li>
              <li>Devoluciones x Día → barras + línea de tendencia</li>
              <li>Disfraces más Alquilados → barras horizontal (top 9)</li>
              <li>Alquileres por Colegio → barras horizontal</li>
              <li>Garantías Pendientes → tabla completa con ✗/✓, columnas Precio/Seña/Estado, totales por día, exportar CSV. Orden: Resumen → Totales x Día → Detalle uno a uno</li>
              <li><strong>Buscar Disfraz</strong> → buscá por nombre de disfraz y muestra Item, Foto, Cliente, Teléfono (link a WhatsApp) y Fecha del alquiler</li>
              <li>Detalle x Día → tabla ordenable con Monto Total y columna Garantías</li>
            </ul>
          </li>
          <li>Tablas con barra de scroll superior sincronizada</li>
        </ul>
      </div>

      <div className="help-section">
        <h3>📱 Funcionalidades Móviles</h3>
        <ul>
          <li>Diseño responsive (se adapta a pantallas chicas)</li>
          <li>Tablas con scroll horizontal en celular</li>
          <li>Menú de navegación horizontal scrolleable</li>
          <li>Se ocultan columnas secundarias (Dirección, Teléfono, Garantía, Colegio)</li>
          <li>Botones más grandes para tocar con el dedo</li>
          <li>La cámara se abre al tocar "📷 Tomar foto" (capture="environment")</li>
          <li>Inputs y selects con tamaño táctil (16px)</li>
        </ul>
      </div>

      <div className="help-section">
        <h3>🖼️ Fotos</h3>
        <ul>
          <li>Las fotos se guardan como <strong>base64</strong> directamente en Firestore</li>
          <li>No requiere Firebase Storage ni activar facturación</li>
          <li>Las fotos importadas de Google Drive se muestran como thumbnail inline (no abren ventana de Drive)</li>
          <li>Al tocar cualquier foto se abre en <strong>pantalla completa</strong> (modal oscuro) con:
            <ul>
              <li>✕ para cerrar</li>
              <li>Tecla Escape para cerrar</li>
              <li>Click en fondo oscuro para cerrar</li>
              <li>Fotos de Google Drive se muestran inline en lugar de abrir link</li>
            </ul>
          </li>
          <li>Si no se puede mostrar la foto de Drive, aparece un link "Ver en Drive"</li>
          <li>Las fotos se comprimen a ~200KB antes de guardar (1024px, 0.6 calidad)</li>
        </ul>
      </div>

      <div className="help-section">
        <h3>⚙️ Tecnología</h3>
        <ul>
          <li><strong>Frontend:</strong> React + Vite (JavaScript)</li>
          <li><strong>Base de datos:</strong> Firebase Firestore (NoSQL)</li>
          <li><strong>Autenticación:</strong> Firebase Auth (email/contraseña)</li>
          <li><strong>Fotos:</strong> Guardadas como base64 en Firestore (sin Firebase Storage)</li>
          <li><strong>Hosting:</strong> Firebase Hosting</li>
        </ul>
        <h4>📊 Límites del plan gratuito</h4>
        <ul>
          <li><strong>Firestore:</strong> 50.000 lecturas / 20.000 escrituras por día, 1 GB almacenado</li>
          <li><strong>Auth:</strong> 50.000 usuarios activos por mes</li>
          <li>Para el uso de Mundo Disfraz está más que cubierto</li>
        </ul>
      </div>

      <div className="help-section">
        <h3>💾 Backup / Exportar Datos</h3>
        <p>Descargá un archivo JSON con todos los clientes, alquileres y fotos de la base de datos.</p>
        <button onClick={exportar} className="btn btn-primary" disabled={exportando}>
          {exportando ? 'Exportando...' : '📥 Exportar todo'}
        </button>
        {exportMsg && <p style={{ marginTop: 8 }}>{exportMsg}</p>}
      </div>

      <div className="help-section">
        <h3>📱 Migrar teléfonos</h3>
        <p>Divide el teléfono de cada cliente en "Celular principal" y "Celular secundario" (si tiene dos números separados por " / ").</p>
        <button onClick={migrarTelefonos} className="btn btn-primary" disabled={migrando}>
          {migrando ? 'Migrando...' : 'Migrar teléfonos'}
        </button>
        {migraMsg && <p style={{ marginTop: 8 }}>{migraMsg}</p>}
      </div>

      <div className="help-section">
        <h3>✅ Migrar garantías devueltas</h3>
        <p>Marca como devuelta la garantía de todos los alquileres que estén en estado "devuelto" y tengan garantía pendiente.</p>
        <button onClick={migrarGarantiasDevueltas} className="btn btn-primary" disabled={migrandoGar}>
          {migrandoGar ? 'Migrando...' : 'Marcar garantías devueltas'}
        </button>
        {migraGarMsg && <p style={{ marginTop: 8 }}>{migraGarMsg}</p>}
      </div>
    </div>
  );
}
