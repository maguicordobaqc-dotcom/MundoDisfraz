import { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export default function Ayuda() {
  const [exportando, setExportando] = useState(false);
  const [exportMsg, setExportMsg] = useState('');

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
          <li>Lista de últimos alquileres con teléfono visible y cambio rápido de estado</li>
          <li>✏️ Editar: modal con todos los datos incluyendo fotos, teléfono y estado</li>
          <li>🗑️ Eliminar alquiler desde el mismo Dashboard</li>
        </ul>
      </div>

      <div className="help-section">
        <h3>👥 Clientes</h3>
        <ul>
          <li>Buscar por apellido (sin importar mayúsculas/minúsculas)</li>
          <li>Sin texto, trae <strong>todos</strong> ordenados alfabéticamente</li>
          <li><strong>Crear</strong>, <strong>Editar</strong> y <strong>Borrar</strong> clientes (borrar solo si no tiene alquileres)</li>
          <li>Los clientes ya no tienen campo Email (se eliminó del formulario de alta y edición)</li>
          <li>Al crear un cliente, aparece botón <strong>"➕ Cargar Alquiler"</strong> para ir directo a Nuevo Alquiler</li>
          <li>Ver <strong>historial de alquileres</strong> del cliente (botón 📋)</li>
          <li>En el historial: <strong>"➕ Nuevo Alquiler"</strong> para cargar otro alquiler a ese cliente</li>
          <li>Tocar una fila del historial muestra la <strong>ficha completa</strong> con fotos, fechas, precios y teléfono</li>
          <li>✏️ Editar y 🗑️ eliminar alquiler directamente desde el historial</li>
          <li>En la edición del alquiler: teléfono, estado al tope, cambiar fotos</li>
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
          <li><strong>Panel izquierdo:</strong> Disfraces Disponibles con búsqueda en vivo</li>
          <li>Campo para escribir un nombre personalizado y agregarlo</li>
          <li>Al tocar un disfraz, se asigna al <strong>primer item vacío</strong></li>
          <li><strong>Panel derecho:</strong> Items Seleccionados con nombre, talle y foto</li>
          <li>Botón <strong>"📷 Tomar foto"</strong> que abre la cámara del celular directamente</li>
          <li>Foto: también pegar imagen (Ctrl+V) o pegar URL</li>
          <li>Fecha de Alquiler, Fecha de Devolución, Turno, Colegio</li>
          <li>Precio total, Seña, Garantía + checkbox "Garantía devuelta", Nota</li>
          <li>Muestra historial de alquileres del cliente seleccionado</li>
        </ul>
        <h4>Paso 3 — Confirmar</h4>
        <ul>
          <li>Resumen de todo antes de guardar</li>
          <li>Al confirmar: las fotos se comprimen y guardan como <strong>base64</strong> en Firestore</li>
          <li>Se guarda automáticamente el teléfono del cliente</li>
          <li>Se abre WhatsApp con el <strong>comprobante</strong> del alquiler (Precio, Seña, Garantía, Saldo a Pagar + términos del negocio)</li>
          <li>Si el cliente tiene varios teléfonos separados por " / ", se usa solo el primero para el link de WhatsApp</li>
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
          <li>Teléfono visible en cada fila (📞 número)</li>
          <li><strong>📷 X items</strong> → abre ficha con foto de cada disfraz + info completa</li>
          <li>En el detalle: <strong>selector de estado</strong> y botón <strong>"✏️ Editar"</strong></li>
          <li>✏️ Editar → modal con teléfono, estado al tope, items con fotos, fechas, precio, nota</li>
          <li>🗑️ Borrar (con confirmación)</li>
          <li>Tabla con scroll horizontal en mobile</li>
        </ul>
      </div>

      <div className="help-section">
        <h3>📈 Reportes</h3>
        <ul>
          <li><strong>Filtro por rango de fechas</strong> (Desde / Hasta) que afecta a todo</li>
          <li>Tarjetas de resumen: Total Caja, Señas, Saldo Pendiente, Alquileres, Garantías</li>
          <li>Pestañas para elegir gráfico:
            <ul>
              <li>Alquileres x Día → barras + línea de tendencia</li>
              <li>Ingresos x Día ($) → barras + línea de tendencia</li>
              <li>Devoluciones x Día → barras + línea de tendencia</li>
              <li>Disfraces más Alquilados → barras horizontal (top 9)</li>
              <li>Alquileres por Colegio → barras horizontal</li>
              <li>Garantías Pendientes → tabla</li>
              <li>Detalle x Día → tabla ordenable con Monto Total</li>
            </ul>
          </li>
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
          <li>Las fotos importadas de Google Drive se muestran como thumbnail</li>
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
    </div>
  );
}
