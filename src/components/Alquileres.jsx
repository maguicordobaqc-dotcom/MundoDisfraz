import { useState, useEffect } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { initTopScrollbar } from '../utils/topScrollbar';
import { getWhatsAppReceiptUrl, getWhatsAppReminderUrl } from '../utils/receipt';
import { ESTADOS_ALQUILER, normalizarEstado } from '../utils/estados';
import { coincideBusqueda } from '../utils/search';
import { getAlquileres, upsertAlquilerCache, removeAlquilerCache } from '../utils/dataCache';
import FotoModal from './FotoModal';

function esDriveUrl(url) {
  return url && (url.includes('drive.google.com') || url.includes('googleusercontent'));
}

function getDriveImageUrl(url) {
  const match = url && url.match(/[-\w]{25,}/);
  return match ? `https://drive.google.com/thumbnail?id=${match[0]}&sz=w400-h400` : url;
}

function comprimirImagen(file, maxAncho = 1024, calidad = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxAncho || height > maxAncho) {
          const ratio = Math.min(maxAncho / width, maxAncho / height);
          width *= ratio;
          height *= ratio;
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', calidad));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Alquileres() {
  const [alquileres, setAlquileres] = useState([]);
  const [filter, setFilter] = useState('todos');
  const [filtroFechaDev, setFiltroFechaDev] = useState('');
  const [detalle, setDetalle] = useState(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [sortField, setSortField] = useState('fechaAlquiler');
  const [sortDir, setSortDir] = useState('desc');
  const [modoBusqueda, setModoBusqueda] = useState('cliente');
  const [searchCliente, setSearchCliente] = useState('');
  const [searchDisfraz, setSearchDisfraz] = useState('');
  const [editando, setEditando] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = async (force = false) => {
    setCargando(true);
    setErr('');
    try {
      const data = await getAlquileres(force);
      setAlquileres(data);
    } catch (e) {
      setErr('Error al cargar alquileres: ' + e.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(false); }, []);

  useEffect(() => { setTimeout(initTopScrollbar, 300); }, [alquileres, modoBusqueda]);

  const cambiarEstado = async (id, nuevoEstado, alquiler) => {
    const data = { estado: nuevoEstado };
    if (nuevoEstado === 'devuelto' && alquiler?.garantia && !alquiler.garantiaDevuelta) {
      data.garantiaDevuelta = true;
    }
    try {
      await updateDoc(doc(db, 'alquileres', id), data);
      const updated = upsertAlquilerCache(id, data);
      if (updated) {
        setAlquileres(updated);
      } else {
        setAlquileres((prev) => prev.map((a) => (a.id === id ? { ...a, ...data } : a)));
      }
      if (detalle?.id === id) setDetalle((prev) => (prev ? { ...prev, ...data } : prev));
    } catch (e) {
      setErr('Error al cambiar estado: ' + e.message);
      setTimeout(() => setErr(''), 5000);
    }
  };

  const borrar = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este alquiler?')) return;
    try {
      await deleteDoc(doc(db, 'alquileres', id));
      const updated = removeAlquilerCache(id);
      if (updated) {
        setAlquileres(updated);
      } else {
        setAlquileres((prev) => prev.filter((a) => a.id !== id));
      }
      if (detalle?.id === id) setDetalle(null);
      setEditando(null);
    } catch (e) {
      setErr('Error al eliminar: ' + e.message);
      setTimeout(() => setErr(''), 5000);
    }
  };

  const abrirEditar = (a) => {
    setEditando(a.id);
    const partes = (a.clienteTelefono || '').split(' / ');
    setEditForm({
      items: (a.items || []).map((i) => ({ ...i, file: null, preview: '' })),
      fechaAlquiler: a.fechaAlquiler || '',
      fechaEvento: a.fechaEvento || '',
      fechaDevolucion: a.fechaDevolucion || '',
      fechaRetiro: a.fechaRetiro || '',
      horaRetiro: a.horaRetiro || '',
      turno: a.turno || 'mañana',
      colegio: a.colegio || '',
      telefonoPrincipal: a.clienteTelefonoPrincipal || partes[0] || '',
      telefonoSecundario: a.clienteTelefonoSecundario || partes[1] || '',
      precio: a.precio || '',
      seña: a.seña || '',
      garantia: a.garantia || '',
      garantiaDevuelta: a.garantiaDevuelta || false,
      nota: a.nota || '',
      estado: normalizarEstado(a.estado),
    });
  };

  const actualizar = async (id) => {
    try {
      const itemsConFotos = [];
      for (const item of editForm.items) {
        if (item.file) {
          const b64 = await comprimirImagen(item.file);
          itemsConFotos.push({ nombre: item.nombre, talle: item.talle, fotoUrl: b64 });
        } else {
          itemsConFotos.push({ nombre: item.nombre, talle: item.talle, fotoUrl: item.fotoUrl || '' });
        }
      }
      const telCombined = editForm.telefonoPrincipal.trim() + (editForm.telefonoSecundario.trim() ? ' / ' + editForm.telefonoSecundario.trim() : '');
      const data = {
        items: itemsConFotos,
        clienteTelefono: telCombined,
        clienteTelefonoPrincipal: editForm.telefonoPrincipal,
        clienteTelefonoSecundario: editForm.telefonoSecundario,
        fechaAlquiler: editForm.fechaAlquiler,
        fechaEvento: editForm.fechaEvento,
        fechaDevolucion: editForm.fechaDevolucion,
        fechaRetiro: editForm.fechaRetiro || '',
        horaRetiro: (editForm.horaRetiro || '').trim(),
        turno: editForm.turno,
        colegio: editForm.colegio,
        precio: Number(editForm.precio),
        seña: Number(editForm.seña),
        garantia: editForm.garantia,
        garantiaDevuelta: editForm.garantiaDevuelta,
        nota: editForm.nota,
        estado: editForm.estado,
      };
      if (editForm.estado === 'devuelto' && editForm.garantia && !editForm.garantiaDevuelta) {
        data.garantiaDevuelta = true;
      }
      await updateDoc(doc(db, 'alquileres', id), data);
      const updated = upsertAlquilerCache(id, data);
      if (updated) {
        setAlquileres(updated);
      } else {
        setAlquileres((prev) => prev.map((a) => (a.id === id ? { ...a, ...data } : a)));
      }
      if (detalle?.id === id) setDetalle((prev) => (prev ? { ...prev, ...data } : prev));
      setEditando(null);
      setMsg('Alquiler actualizado');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setErr('Error al guardar: ' + e.message);
      setTimeout(() => setErr(''), 5000);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortIcon = (field) => {
    if (sortField !== field) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  const porTexto = searchCliente.trim()
    ? alquileres.filter((a) => coincideBusqueda(searchCliente, [a.clienteNombre, a.clienteApellido]))
    : alquileres;

  const porTextoYFecha = filtroFechaDev
    ? porTexto.filter((a) => a.fechaDevolucion === filtroFechaDev)
    : porTexto;

  const conteosCliente = {
    todos: porTextoYFecha.length,
    reservado: porTextoYFecha.filter((a) => normalizarEstado(a.estado) === 'reservado').length,
    retirado: porTextoYFecha.filter((a) => normalizarEstado(a.estado) === 'retirado').length,
    devuelto: porTextoYFecha.filter((a) => normalizarEstado(a.estado) === 'devuelto').length,
  };

  let filtrados = filter === 'todos'
    ? [...porTextoYFecha]
    : porTextoYFecha.filter((a) => normalizarEstado(a.estado) === filter);

  filtrados.sort((a, b) => {
    let va = sortField === 'estado' ? normalizarEstado(a.estado) : (a[sortField] ?? '');
    let vb = sortField === 'estado' ? normalizarEstado(b.estado) : (b[sortField] ?? '');
    if (sortField === 'precio' || sortField === 'seña') {
      va = Number(va); vb = Number(vb);
    } else {
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // ─── Búsqueda por Disfraz ──────────────────────────────────────────
  const itemsPorDisfrazTexto = [];
  if (modoBusqueda === 'disfraz') {
    const qDisfraz = searchDisfraz.trim();
    alquileres.forEach((a) => {
      (a.items || []).forEach((it, idx) => {
        if (!qDisfraz || coincideBusqueda(qDisfraz, [it.nombre, it.talle, it.descripcion])) {
          itemsPorDisfrazTexto.push({
            key: `${a.id}-${idx}`,
            alquiler: a,
            item: it,
            estadoNorm: normalizarEstado(a.estado),
          });
        }
      });
    });
  }

  const itemsDisfrazTextoYFecha = filtroFechaDev
    ? itemsPorDisfrazTexto.filter((row) => row.alquiler.fechaDevolucion === filtroFechaDev)
    : itemsPorDisfrazTexto;

  const conteosDisfraz = {
    todos: itemsDisfrazTextoYFecha.length,
    reservado: itemsDisfrazTextoYFecha.filter((r) => r.estadoNorm === 'reservado').length,
    retirado: itemsDisfrazTextoYFecha.filter((r) => r.estadoNorm === 'retirado').length,
    devuelto: itemsDisfrazTextoYFecha.filter((r) => r.estadoNorm === 'devuelto').length,
  };

  const mostrarListaDisfraz = searchDisfraz.trim().length >= 2 || filter !== 'todos' || Boolean(filtroFechaDev);
  const disfracesFiltrados = mostrarListaDisfraz
    ? (filter === 'todos'
        ? [...itemsDisfrazTextoYFecha]
        : itemsDisfrazTextoYFecha.filter((r) => r.estadoNorm === filter)
      ).sort((a, b) => {
        const fa = a.alquiler.fechaAlquiler || '';
        const fb = b.alquiler.fechaAlquiler || '';
        if (fa !== fb) return fb.localeCompare(fa);
        return (b.alquiler.createdAt?.seconds || 0) - (a.alquiler.createdAt?.seconds || 0);
      })
    : [];

  const conteos = modoBusqueda === 'disfraz' ? conteosDisfraz : conteosCliente;

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Alquileres</h2>
        <button onClick={() => cargar(true)} className="btn btn-secondary btn-small" disabled={cargando}>
          {cargando ? 'Cargando...' : '🔄 Actualizar'}
        </button>
      </div>
      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      <div className="tabs" style={{ marginBottom: 12 }}>
        <button
          className={`tab ${modoBusqueda === 'cliente' ? 'active' : ''}`}
          onClick={() => { setModoBusqueda('cliente'); setDetalle(null); }}
        >
          👤 Por Cliente
        </button>
        <button
          className={`tab ${modoBusqueda === 'disfraz' ? 'active' : ''}`}
          onClick={() => { setModoBusqueda('disfraz'); setDetalle(null); }}
        >
          🎭 Por Disfraz
        </button>
      </div>

      {modoBusqueda === 'cliente' ? (
        <div className="search-box">
          <input
            placeholder="Buscar por apellido o nombre (ej: torres, juan torres)..."
            value={searchCliente}
            onChange={(e) => {
              const val = e.target.value;
              if (!searchCliente.trim() && val.trim() && filter !== 'todos') {
                setFilter('todos');
              }
              setSearchCliente(val);
              setDetalle(null);
            }}
          />
          <button onClick={() => { setSearchCliente(''); setDetalle(null); }} className="btn btn-secondary">Limpiar</button>
        </div>
      ) : (
        <div className="search-box">
          <input
            placeholder="Buscar disfraz por nombre o talle (ej: spiderman, princesa, granadero)..."
            value={searchDisfraz}
            onChange={(e) => {
              const val = e.target.value;
              if (!searchDisfraz.trim() && val.trim() && filter !== 'todos') {
                setFilter('todos');
              }
              setSearchDisfraz(val);
              setDetalle(null);
            }}
          />
          <button onClick={() => { setSearchDisfraz(''); setDetalle(null); }} className="btn btn-secondary">Limpiar</button>
        </div>
      )}

      <div className="tabs">
        {['todos', ...ESTADOS_ALQUILER.map((e) => e.value)].map((t) => (
          <button key={t} className={`tab ${filter === t ? 'active' : ''}`} onClick={() => { setFilter(t); setDetalle(null); }}>
            {t === 'todos' ? 'Todos' : t.charAt(0).toUpperCase() + t.slice(1)} ({conteos[t] ?? 0})
          </button>
        ))}
      </div>

      <div className="search-box" style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
          Fecha devolución:
          <input type="date" value={filtroFechaDev} onChange={(e) => { setFiltroFechaDev(e.target.value); setDetalle(null); }} style={{ padding: '6px 10px', border: '2px solid var(--border)', borderRadius: 8, fontSize: '0.9rem' }} />
        </label>
        {filtroFechaDev && <button className="btn btn-small btn-secondary" onClick={() => setFiltroFechaDev('')}>Limpiar fecha</button>}
      </div>

      {modoBusqueda === 'cliente' ? (
      <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            <th className="sortable" onClick={() => handleSort('clienteApellido')}>Cliente{sortIcon('clienteApellido')}</th>
            <th className="col-direccion">Dirección</th>
            <th className="sortable" onClick={() => handleSort('fechaAlquiler')}>Fecha / Turno{sortIcon('fechaAlquiler')}</th>
            <th className="col-colegio">Colegio</th>
            <th>Items</th>
            <th className="sortable" onClick={() => handleSort('precio')}>Precio{sortIcon('precio')}</th>
            <th className="col-garantia">Garantía</th>
            <th className="sortable" onClick={() => handleSort('estado')}>Estado{sortIcon('estado')}</th>
            <th>Acción</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtrados.map((a) => (
            <tr key={a.id}>
              <td>{a.clienteNombre}</td>
              <td className="col-direccion">{a.clienteDireccion}</td>
              <td>{a.fechaAlquiler}{a.turno ? ` (${a.turno})` : ''}</td>
              <td className="col-colegio">{a.colegio || '-'}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {(a.clienteTelefonoPrincipal || a.clienteTelefono) ? <span style={{ fontSize: '0.85rem' }}>📞 {a.clienteTelefonoPrincipal || a.clienteTelefono?.split(' / ')[0] || ''}{a.clienteTelefonoSecundario ? ` / ${a.clienteTelefonoSecundario}` : a.clienteTelefono?.includes(' / ') ? ` / ${a.clienteTelefono.split(' / ')[1]}` : ''}</span> : null}
                <button className="btn-link" onClick={() => {
                  setDetalle(detalle?.id === a.id ? null : a);
                  setTimeout(() => {
                    const el = document.getElementById('detalle-alquiler');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                }} style={{ fontWeight: 600, padding: '4px 10px', background: '#f0f2f5', borderRadius: 6, whiteSpace: 'nowrap' }}>
                  📷 {a.items?.length || 0} items
                </button>
                {(() => { const url = getWhatsAppReceiptUrl(a); return url ? <a href={url} target="_blank" rel="noreferrer" className="btn-link" style={{ textDecoration: 'none', padding: '4px 10px', background: '#f0f2f5', borderRadius: 6, whiteSpace: 'nowrap', marginLeft: 6 }}>📤</a> : null; })()}
                {(() => { const url = getWhatsAppReminderUrl(a); return url ? <a href={url} target="_blank" rel="noreferrer" className="btn-link" style={{ textDecoration: 'none', padding: '4px 10px', background: '#ffe0e0', borderRadius: 6, whiteSpace: 'nowrap', marginLeft: 4 }} title="Fuera de término">⚠️</a> : null; })()}
              </td>
              <td>${a.precio}</td>
              <td className="col-garantia">{a.garantiaDevuelta ? '✅' : a.garantia ? '❌' : '-'}</td>
              <td><span className={`badge badge-${normalizarEstado(a.estado)}`}>{normalizarEstado(a.estado)}</span></td>
              <td>
                <select
                  value={normalizarEstado(a.estado)}
                  onChange={(e) => {
                    const nuevoEstado = e.target.value;
                    cambiarEstado(a.id, nuevoEstado, a);
                    if (detalle?.id === a.id) setDetalle({ ...detalle, estado: nuevoEstado });
                  }}
                  className="estado-select"
                >
                  {ESTADOS_ALQUILER.map((e) => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </select>
              </td>
              <td>
                <button onClick={() => abrirEditar(a)} className="btn btn-small btn-secondary">✏️</button>
                <button onClick={() => borrar(a.id)} className="btn btn-small btn-danger" style={{ marginLeft: 4 }}>🗑️</button>
              </td>
            </tr>
          ))}
          {cargando && (
            <tr><td colSpan={10} className="text-muted">Cargando alquileres...</td></tr>
          )}
          {!cargando && filtrados.length === 0 && (
            <tr>
              <td colSpan={10} className="text-muted">
                {filter !== 'todos' && conteosCliente.todos > 0 ? (
                  <span>
                    No hay alquileres en "{filter}".{' '}
                    <button type="button" className="btn-link" style={{ fontWeight: 600 }} onClick={() => setFilter('todos')}>
                      Ver los {conteosCliente.todos} resultado{conteosCliente.todos !== 1 ? 's' : ''} en Todos
                    </button>
                  </span>
                ) : filtroFechaDev && porTexto.length > 0 ? (
                  <span>
                    No hay alquileres para la fecha de devolución {filtroFechaDev} (hay {porTexto.length} coincidencia{porTexto.length !== 1 ? 's' : ''} en otras fechas).{' '}
                    <button type="button" className="btn-link" style={{ fontWeight: 600 }} onClick={() => setFiltroFechaDev('')}>
                      Quitar filtro de fecha
                    </button>
                  </span>
                ) : (
                  'No hay alquileres'
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
      ) : (
      <div className="table-wrapper">
      {!cargando && !mostrarListaDisfraz ? (
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <p className="text-muted" style={{ marginBottom: 12 }}>
            Escribí al menos <strong>2 letras</strong> del disfraz que buscás (ej: <em>spiderman</em>, <em>princesa</em>, <em>granadero</em>) para ver todas las fotos y quién se lo llevó.
          </p>
          {conteosDisfraz.retirado > 0 && (
            <button type="button" className="btn btn-primary" onClick={() => setFilter('retirado')}>
              🎭 Ver todos los disfraces sin devolver ({conteosDisfraz.retirado} en Retirado)
            </button>
          )}
        </div>
      ) : (
      <table className="table">
        <thead>
          <tr>
            <th>Foto</th>
            <th>Disfraz</th>
            <th>Cliente / Contacto</th>
            <th>Fechas</th>
            <th>Estado</th>
            <th>Acción</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {disfracesFiltrados.map(({ key, alquiler: a, item: it, estadoNorm }) => {
            const telPrincipal = (a.clienteTelefonoPrincipal || a.clienteTelefono?.split(' / ')[0] || '').trim();
            const telClean = telPrincipal.replace(/[^0-9]/g, '');
            const waReceipt = getWhatsAppReceiptUrl(a);
            const waReminder = getWhatsAppReminderUrl(a);
            return (
              <tr key={key}>
                <td style={{ width: 76 }}>
                  {it.fotoUrl ? (
                    <img
                      src={esDriveUrl(it.fotoUrl) ? getDriveImageUrl(it.fotoUrl) : it.fotoUrl}
                      alt={it.nombre}
                      loading="lazy"
                      className="thumb"
                      style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, cursor: 'pointer' }}
                      onClick={() => setFotoAmpliada(it.fotoUrl)}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <span className="text-muted" style={{ fontSize: '0.8rem' }}>Sin foto</span>
                  )}
                </td>
                <td>
                  <strong>{it.nombre || 'Sin nombre'}</strong>
                  {it.talle && <div className="text-muted" style={{ fontSize: '0.8rem' }}>Talle: {it.talle}</div>}
                  {a.colegio && <div className="text-muted" style={{ fontSize: '0.8rem' }}>{a.colegio}</div>}
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{a.clienteNombre}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                    {telClean && (
                      <a href={`https://wa.me/54${telClean}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.85rem', textDecoration: 'none', color: 'var(--primary)', fontWeight: 600 }}>
                        📞 {telPrincipal}
                      </a>
                    )}
                    {waReceipt && <a href={waReceipt} target="_blank" rel="noreferrer" className="btn-link" style={{ textDecoration: 'none', padding: '2px 8px', background: '#f0f2f5', borderRadius: 6 }} title="Comprobante">📤</a>}
                    {waReminder && <a href={waReminder} target="_blank" rel="noreferrer" className="btn-link" style={{ textDecoration: 'none', padding: '2px 8px', background: '#ffe0e0', borderRadius: 6 }} title="Fuera de término">⚠️</a>}
                  </div>
                </td>
                <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                  <div>Alq: {a.fechaAlquiler || '-'}</div>
                  <div className="text-muted">Dev: {a.fechaDevolucion || '-'}</div>
                </td>
                <td><span className={`badge badge-${estadoNorm}`}>{estadoNorm}</span></td>
                <td>
                  <select
                    value={estadoNorm}
                    onChange={(e) => {
                      const nuevoEstado = e.target.value;
                      cambiarEstado(a.id, nuevoEstado, a);
                      if (detalle?.id === a.id) setDetalle({ ...detalle, estado: nuevoEstado });
                    }}
                    className="estado-select"
                  >
                    {ESTADOS_ALQUILER.map((e) => (
                      <option key={e.value} value={e.value}>{e.label}</option>
                    ))}
                  </select>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    onClick={() => {
                      setDetalle(detalle?.id === a.id ? null : a);
                      setTimeout(() => {
                        const el = document.getElementById('detalle-alquiler');
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 100);
                    }}
                    className="btn btn-small btn-secondary"
                    title="Ver ficha completa"
                  >
                    👁️
                  </button>
                  <button onClick={() => abrirEditar(a)} className="btn btn-small btn-secondary" style={{ marginLeft: 4 }} title="Editar">✏️</button>
                </td>
              </tr>
            );
          })}
          {cargando && (
            <tr><td colSpan={7} className="text-muted">Cargando disfraces...</td></tr>
          )}
          {!cargando && disfracesFiltrados.length === 0 && (
            <tr>
              <td colSpan={7} className="text-muted">
                {filter !== 'todos' && conteosDisfraz.todos > 0 ? (
                  <span>
                    No hay disfraces en "{filter}".{' '}
                    <button type="button" className="btn-link" style={{ fontWeight: 600 }} onClick={() => setFilter('todos')}>
                      Ver los {conteosDisfraz.todos} resultado{conteosDisfraz.todos !== 1 ? 's' : ''} en Todos
                    </button>
                  </span>
                ) : filtroFechaDev && itemsPorDisfrazTexto.length > 0 ? (
                  <span>
                    No hay disfraces para la fecha de devolución {filtroFechaDev} (hay {itemsPorDisfrazTexto.length} coincidencia{itemsPorDisfrazTexto.length !== 1 ? 's' : ''} en otras fechas).{' '}
                    <button type="button" className="btn-link" style={{ fontWeight: 600 }} onClick={() => setFiltroFechaDev('')}>
                      Quitar filtro de fecha
                    </button>
                  </span>
                ) : (
                  'No se encontraron disfraces con esa búsqueda'
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      )}
      </div>
      )}

      {detalle && (
        <div className="card" id="detalle-alquiler">
          <div className="flex gap" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
            <h3 style={{ flex: 1, margin: 0 }}>Detalle de {detalle.clienteNombre}</h3>
            <div className="flex gap" style={{ alignItems: 'center' }}>
              <select value={normalizarEstado(detalle.estado)} onChange={(e) => {
                const nuevoEstado = e.target.value;
                cambiarEstado(detalle.id, nuevoEstado, detalle);
                setDetalle({ ...detalle, estado: nuevoEstado });
              }} className="estado-select" style={{ padding: '8px 12px', fontSize: '0.9rem' }}>
                {ESTADOS_ALQUILER.map((e) => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
              <button onClick={() => abrirEditar(detalle)} className="btn btn-small btn-primary">✏️ Editar</button>
              {(() => { const url = getWhatsAppReceiptUrl(detalle); return url ? <a href={url} target="_blank" rel="noreferrer" className="btn btn-small btn-primary" style={{ textDecoration: 'none' }}>📤 Comprobante</a> : null; })()}
              {(() => { const url = getWhatsAppReminderUrl(detalle); return url ? <a href={url} target="_blank" rel="noreferrer" className="btn btn-small" style={{ textDecoration: 'none', background: '#ffcccc', color: '#b30000' }}>⚠️ Fuera de término</a> : null; })()}
            </div>
          </div>
          <p><strong>Dirección:</strong> {detalle.clienteDireccion}</p>
          {(detalle.clienteTelefonoPrincipal || detalle.clienteTelefono) && <p><strong>Teléfono:</strong> 📞 <a href={`tel:${(detalle.clienteTelefonoPrincipal || detalle.clienteTelefono || '').split('/')[0].trim()}`} style={{ textDecoration: 'none', color: 'var(--primary)', fontWeight: 600 }}>{detalle.clienteTelefonoPrincipal || detalle.clienteTelefono?.split(' / ')[0] || ''}{detalle.clienteTelefonoSecundario ? ` / ${detalle.clienteTelefonoSecundario}` : detalle.clienteTelefono?.includes(' / ') ? ` / ${detalle.clienteTelefono.split(' / ')[1]}` : ''}</a></p>}
          <p><strong>Fecha:</strong> {detalle.fechaAlquiler} {detalle.turno ? `| Turno: ${detalle.turno}` : ''} {detalle.colegio ? `| Colegio: ${detalle.colegio}` : ''}</p>
          {detalle.fechaEvento && <p><strong>Evento:</strong> {detalle.fechaEvento}</p>}
          {detalle.fechaDevolucion && <p><strong>Devolución:</strong> {detalle.fechaDevolucion}</p>}
          {(detalle.fechaRetiro || detalle.horaRetiro) && (
            <p><strong>Retiro del disfraz:</strong> {[detalle.fechaRetiro, detalle.horaRetiro].filter(Boolean).join(' - ')}</p>
          )}

          <h4 style={{ marginTop: 12, marginBottom: 8 }}>Items</h4>
          {detalle.items?.map((it, i) => (
            <div key={i} className="detalle-item">
              {it.fotoUrl && !esDriveUrl(it.fotoUrl) && <img src={it.fotoUrl} alt={it.nombre} className="thumb" style={{ cursor: 'pointer' }} onClick={() => setFotoAmpliada(it.fotoUrl)} />}
              {it.fotoUrl && esDriveUrl(it.fotoUrl) && (
                <a href={it.fotoUrl} target="_blank" rel="noreferrer" title="Abrir en Google Drive">
                  <img src={getDriveImageUrl(it.fotoUrl)} alt={it.nombre} className="thumb" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.textContent = '📷 Ver en Drive'; }} />
                </a>
              )}
              <div><strong>{it.nombre}</strong>{it.talle ? ` (${it.talle})` : ''}</div>
            </div>
          ))}
          <p><strong>Precio:</strong> ${detalle.precio} | <strong>Seña:</strong> ${detalle.seña || '0'}</p>
          {detalle.garantia && <p><strong>Garantía:</strong> {detalle.garantia} {detalle.garantiaDevuelta ? '✅ Devuelta' : '❌ Pendiente'}</p>}
          {detalle.nota && <p><strong>Nota:</strong> {detalle.nota}</p>}
        </div>
      )}

      <FotoModal src={fotoAmpliada} onClose={() => setFotoAmpliada(null)} />

      {editando && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Editar Alquiler</h3>
            <div className="flex gap" style={{ marginBottom: 16 }}>
              <button onClick={() => setEditando(null)} className="btn btn-secondary">Cancelar</button>
              <button onClick={() => actualizar(editando)} className="btn btn-primary">Guardar Cambios</button>
            </div>

            <div className="form-row" style={{ marginBottom: 8 }}>
              <div className="form-group">
                <label>Celular principal</label>
                <input value={editForm.telefonoPrincipal} onChange={(e) => setEditForm({ ...editForm, telefonoPrincipal: e.target.value })} placeholder="381..." type="tel" />
              </div>
              <div className="form-group">
                <label>Celular secundario</label>
                <input value={editForm.telefonoSecundario} onChange={(e) => setEditForm({ ...editForm, telefonoSecundario: e.target.value })} placeholder="Opcional" type="tel" />
              </div>
            </div>
            <div className="form-row" style={{ marginBottom: 8 }}>
              <div className="form-group">
                <label>Estado</label>
                <select value={editForm.estado} onChange={(e) => setEditForm({ ...editForm, estado: e.target.value })}>
                  {ESTADOS_ALQUILER.map((e) => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <h4>Items</h4>
            {editForm.items.map((item, i) => (
              <div key={i} className="item-row" style={{ alignItems: 'flex-end' }}>
                <div className="form-group">
                  <label>Nombre</label>
                  <input value={item.nombre} onChange={(e) => {
                    const copy = [...editForm.items];
                    copy[i] = { ...copy[i], nombre: e.target.value };
                    setEditForm({ ...editForm, items: copy });
                  }} />
                </div>
                <div className="form-group">
                  <label>Talle</label>
                  <input value={item.talle || ''} onChange={(e) => {
                    const copy = [...editForm.items];
                    copy[i] = { ...copy[i], talle: e.target.value };
                    setEditForm({ ...editForm, items: copy });
                  }} />
                </div>
                <div className="form-group">
                  <label>Foto</label>
                  <div className="foto-inputs">
                    <label className="btn-foto">
                      📷 {item.fotoUrl ? 'Cambiar foto' : 'Tomar foto'}
                      <input type="file" accept="image/*" capture="environment" onChange={(e) => {
                        if (e.target.files[0]) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const copy = [...editForm.items];
                            copy[i] = { ...copy[i], file: e.target.files[0], preview: ev.target.result, fotoUrl: ev.target.result };
                            setEditForm({ ...editForm, items: copy });
                          };
                          reader.readAsDataURL(e.target.files[0]);
                        }
                      }} />
                    </label>
                    {(item.preview || item.fotoUrl) && !esDriveUrl(item.preview || item.fotoUrl) && <img src={item.preview || item.fotoUrl} alt="preview" className="thumb" style={{ cursor: 'pointer' }} onClick={() => setFotoAmpliada(item.preview || item.fotoUrl)} />}
                    {(item.preview || item.fotoUrl) && esDriveUrl(item.preview || item.fotoUrl) && (
                      <a href={item.preview || item.fotoUrl} target="_blank" rel="noreferrer" title="Abrir en Google Drive">
                        <img src={getDriveImageUrl(item.preview || item.fotoUrl)} alt="preview" className="thumb" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.textContent = '📷 Ver en Drive'; e.target.parentElement.className = 'btn btn-small btn-secondary'; }} />
                      </a>
                    )}
                  </div>
                </div>
                <button type="button" className="btn btn-danger btn-small" onClick={() => {
                  setEditForm({ ...editForm, items: editForm.items.filter((_, idx) => idx !== i) });
                }}>✕</button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary" onClick={() => {
              setEditForm({ ...editForm, items: [...editForm.items, { nombre: '', talle: '', fotoUrl: '', file: null, preview: '' }] });
            }}>+ Agregar item</button>

            <hr />

            <div className="form-row">
              <div className="form-group">
                <label>Fecha Alquiler</label>
                <input type="date" value={editForm.fechaAlquiler} onChange={(e) => setEditForm({ ...editForm, fechaAlquiler: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Fecha Evento</label>
                <input type="date" value={editForm.fechaEvento} onChange={(e) => setEditForm({ ...editForm, fechaEvento: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Fecha Devolución</label>
                <input type="date" value={editForm.fechaDevolucion} onChange={(e) => setEditForm({ ...editForm, fechaDevolucion: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Fecha que retira (opcional)</label>
                <input type="date" value={editForm.fechaRetiro || ''} onChange={(e) => setEditForm({ ...editForm, fechaRetiro: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Hora de retiro (opcional)</label>
                <input value={editForm.horaRetiro || ''} onChange={(e) => setEditForm({ ...editForm, horaRetiro: e.target.value })} placeholder="Ej: 17:30 o de 17 a 19 hs" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Turno</label>
                <select value={editForm.turno} onChange={(e) => setEditForm({ ...editForm, turno: e.target.value })}>
                  <option value="mañana">Mañana</option>
                  <option value="tarde">Tarde</option>
                </select>
              </div>
              <div className="form-group">
                <label>Colegio</label>
                <input value={editForm.colegio} onChange={(e) => setEditForm({ ...editForm, colegio: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Precio ($)</label>
                <input type="number" value={editForm.precio} onChange={(e) => setEditForm({ ...editForm, precio: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Seña ($)</label>
                <input type="number" value={editForm.seña} onChange={(e) => setEditForm({ ...editForm, seña: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Garantía</label>
                <input value={editForm.garantia} onChange={(e) => setEditForm({ ...editForm, garantia: e.target.value })} />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                <label className="checkbox-label">
                  <input type="checkbox" checked={editForm.garantiaDevuelta} onChange={(e) => setEditForm({ ...editForm, garantiaDevuelta: e.target.checked })} />
                  Garantía devuelta
                </label>
              </div>
            </div>
            <div className="form-group">
              <label>Nota</label>
              <textarea value={editForm.nota} onChange={(e) => setEditForm({ ...editForm, nota: e.target.value })} rows={2} />
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
