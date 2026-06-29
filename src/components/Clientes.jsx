import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { getWhatsAppReceiptUrl, getWhatsAppReminderUrl } from '../utils/receipt';

function esDriveUrl(url) {
  return url && url.includes('drive.google.com');
}

function getDriveImageUrl(url) {
  const match = url && url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? `https://drive.google.com/uc?export=view&id=${match[1]}` : url;
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

export default function Clientes() {
  const [search, setSearch] = useState('');
  const [resultados, setResultados] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ nombre: '', apellido: '', direccion: '', telefono: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [nuevoClienteId, setNuevoClienteId] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [showHistorial, setShowHistorial] = useState(false);
  const [editando, setEditando] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [sortField, setSortField] = useState('apellido');
  const [sortDir, setSortDir] = useState('asc');
  const [editandoAlquiler, setEditandoAlquiler] = useState(null);
  const [editFormAlquiler, setEditFormAlquiler] = useState({});
  const [detalleAlquiler, setDetalleAlquiler] = useState(null);

  const buscar = async () => {
    const q = search.trim()
      ? query(
          collection(db, 'clientes'),
          where('apellidoSearch', '>=', search.trim().toLowerCase()),
          where('apellidoSearch', '<=', search.trim().toLowerCase() + '\uf8ff')
        )
      : query(collection(db, 'clientes'), orderBy('apellidoSearch', 'asc'));
    const snap = await getDocs(q);
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    data.sort((a, b) => (a.apellido || '').localeCompare(b.apellido || ''));
    setResultados(data);
    setSelected(null);
    setHistorial([]);
    setShowHistorial(false);
    setDetalleAlquiler(null);
    if (search.trim()) setForm((f) => ({ ...f, apellido: search.trim() }));
  };

  useEffect(() => { if (!search) { setResultados([]); setHistorial([]); } }, [search]);

  const crearCliente = async (e) => {
    e.preventDefault();
    const ref = await addDoc(collection(db, 'clientes'), {
      ...form,
      apellidoSearch: (form.apellido || '').toLowerCase(),
      nombreSearch: (form.nombre || '').toLowerCase(),
      createdAt: serverTimestamp()
    });
    setMsg('Cliente creado correctamente');
    setNuevoClienteId(ref.id);
    setShowForm(false);
    setForm({ nombre: '', apellido: '', direccion: '', telefono: '' });
    buscar();
  };

  const limpiarNuevoCliente = () => {
    setMsg('');
    setNuevoClienteId(null);
  };

  const verHistorial = async (c) => {
    setSelected(c);
    setShowHistorial(true);
    setDetalleAlquiler(null);
    try {
      const q = query(
        collection(db, 'alquileres'),
        where('clienteId', '==', c.id)
      );
      const snap = await getDocs(q);
      const datos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      datos.sort((a, b) => {
        const ta = a.createdAt?.seconds || 0;
        const tb = b.createdAt?.seconds || 0;
        return tb - ta;
      });
      setHistorial(datos);
    } catch (err) {
      console.error('Error al obtener historial:', err);
      setHistorial([]);
    }
  };

  const abrirEditarAlquiler = (a) => {
    setEditandoAlquiler(a.id);
    setEditFormAlquiler({
      items: (a.items || []).map((i) => ({ ...i, file: null, preview: '' })),
      fechaAlquiler: a.fechaAlquiler || '',
      fechaEvento: a.fechaEvento || '',
      fechaDevolucion: a.fechaDevolucion || '',
      turno: a.turno || 'mañana',
      colegio: a.colegio || '',
      telefono: a.clienteTelefono || '',
      precio: a.precio || '',
      seña: a.seña || '',
      garantia: a.garantia || '',
      garantiaDevuelta: a.garantiaDevuelta || false,
      nota: a.nota || '',
      estado: a.estado || 'pendiente',
    });
  };

  const actualizarAlquiler = async (id) => {
    try {
      const itemsConFotos = [];
      for (const item of editFormAlquiler.items) {
        if (item.file) {
          const b64 = await comprimirImagen(item.file);
          itemsConFotos.push({ nombre: item.nombre, talle: item.talle, fotoUrl: b64 });
        } else {
          itemsConFotos.push({ nombre: item.nombre, talle: item.talle, fotoUrl: item.fotoUrl || '' });
        }
      }
      await updateDoc(doc(db, 'alquileres', id), {
        items: itemsConFotos,
        clienteTelefono: editFormAlquiler.telefono,
        fechaAlquiler: editFormAlquiler.fechaAlquiler,
        fechaEvento: editFormAlquiler.fechaEvento,
        fechaDevolucion: editFormAlquiler.fechaDevolucion,
        turno: editFormAlquiler.turno,
        colegio: editFormAlquiler.colegio,
        precio: Number(editFormAlquiler.precio),
        seña: Number(editFormAlquiler.seña),
        garantia: editFormAlquiler.garantia,
        garantiaDevuelta: editFormAlquiler.garantiaDevuelta,
        nota: editFormAlquiler.nota,
        estado: editFormAlquiler.estado,
      });
      setEditandoAlquiler(null);
      setMsg('Alquiler actualizado');
      setTimeout(() => setMsg(''), 3000);
      if (selected) verHistorial(selected);
    } catch (e) {
      setErr('Error al guardar: ' + e.message);
      setTimeout(() => setErr(''), 5000);
    }
  };

  const borrarAlquiler = async (id) => {
    if (!window.confirm('¿Eliminar este alquiler?')) return;
    await deleteDoc(doc(db, 'alquileres', id));
    if (selected) verHistorial(selected);
  };

  const handleEditFile = (item, file) => {
    if (!file) return item;
    if (item.preview && !item.fotoUrl) URL.revokeObjectURL(item.preview);
    return { ...item, file, preview: URL.createObjectURL(file), fotoUrl: '' };
  };

  const handleEditFotoUrl = (item, url) => {
    if (item.preview && !item.fotoUrl) URL.revokeObjectURL(item.preview);
    return { ...item, fotoUrl: url, file: null, preview: url || '' };
  };

  const abrirEditar = (c) => {
    setEditando(c.id);
    setEditForm({
      nombre: c.nombre || '',
      apellido: c.apellido || '',
      direccion: c.direccion || '',
      telefono: c.telefono || '',
    });
  };

  const guardarEdicion = async () => {
    await updateDoc(doc(db, 'clientes', editando), {
      nombre: editForm.nombre,
      apellido: editForm.apellido,
      direccion: editForm.direccion,
      telefono: editForm.telefono,
      apellidoSearch: (editForm.apellido || '').toLowerCase(),
      nombreSearch: (editForm.nombre || '').toLowerCase(),
    });
    setEditando(null);
    setMsg('Cliente actualizado');
    buscar();
    setTimeout(() => setMsg(''), 3000);
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

  const seleccionarCliente = (c) => {
    verHistorial(c);
  };

  const tieneAlquileres = (id) => {
    return false;
  };

  const ordenados = [...resultados].sort((a, b) => {
    let va = (a[sortField] || '').toUpperCase();
    let vb = (b[sortField] || '').toUpperCase();
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const borrarCliente = async (c) => {
    try {
      const q = query(collection(db, 'alquileres'), where('clienteId', '==', c.id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        alert('No se puede borrar: este cliente tiene alquileres registrados.');
        return;
      }
      if (!window.confirm(`¿Eliminar a ${c.apellido?.toUpperCase()}, ${c.nombre}?`)) return;
      await deleteDoc(doc(db, 'clientes', c.id));
      setMsg('Cliente eliminado');
      buscar();
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      console.error('Error al borrar cliente:', err);
      alert('Error al borrar el cliente');
    }
  };

  return (
    <div className="page">
      <h2>Clientes</h2>
      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      <div className="search-box">
        <input
          type="text"
          placeholder="Buscar por apellido..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && buscar()}
        />
        <button onClick={buscar} className="btn btn-primary">Buscar</button>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-secondary">
          {showForm ? 'Cancelar' : '+ Nuevo Cliente'}
        </button>
      </div>

      {msg && <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span>{msg}</span>
        {nuevoClienteId && <Link to={`/nuevo-alquiler?clienteId=${nuevoClienteId}`} className="btn btn-primary btn-small" style={{ textDecoration: 'none' }}>➕ Cargar Alquiler</Link>}
        <button onClick={limpiarNuevoCliente} className="btn btn-small btn-secondary" style={{ marginLeft: 'auto' }}>✕</button>
      </div>}

      {showForm && (
        <div className="card">
          <h3>Nuevo Cliente</h3>
          <form onSubmit={crearCliente}>
            <div className="form-row">
              <div className="form-group">
                <label>Nombre</label>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Apellido</label>
                <input value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} required />
              </div>
            </div>
            <div className="form-group">
              <label>Dirección</label>
              <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Teléfono</label>
                <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">Guardar Cliente</button>
          </form>
        </div>
      )}

      {resultados.length > 0 && (
        <div className="card">
          <h3>Resultados ({resultados.length})</h3>
          <div className="table-wrapper">
          <table className="table">
            <thead><tr>
              <th>Apellido</th><th>Nombre</th><th className="col-direccion">Dirección</th><th className="col-telefono">Teléfono</th><th>Acción</th>
            </tr></thead>
            <tbody>
              {resultados.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.apellido?.toUpperCase()}</strong></td>
                  <td>{c.nombre}</td>
                  <td className="col-direccion">{c.direccion}</td>
                  <td className="col-telefono">{c.telefono}</td>
                  <td>
                    <button onClick={() => seleccionarCliente(c)} className="btn btn-small btn-secondary">📋</button>
                    <button onClick={() => abrirEditar(c)} className="btn btn-small btn-secondary" style={{ marginLeft: 4 }}>✏️</button>
                    {!tieneAlquileres(c.id) && <button onClick={() => borrarCliente(c)} className="btn btn-small btn-danger" style={{ marginLeft: 4 }}>🗑️</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {showHistorial && selected && (
        <div className="card">
          <h3>Historial de {selected.apellido?.toUpperCase()}, {selected.nombre}</h3>
          <Link to={`/nuevo-alquiler?clienteId=${selected.id}`} className="btn btn-primary btn-small" style={{ textDecoration: 'none', marginBottom: 12, display: 'inline-block' }}>➕ Nuevo Alquiler</Link>
          {historial.length === 0 ? (
            <p className="text-muted">Sin alquileres registrados</p>
          ) : (
            <>
            <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Fecha</th><th>Evento</th><th>Items</th><th>Precio</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {historial.map((h) => (
                  <tr key={h.id} className="clickable" onClick={() => {
                    setDetalleAlquiler(detalleAlquiler?.id === h.id ? null : h);
                    setTimeout(() => {
                      const el = document.getElementById('detalle-alquiler-cliente');
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                  }}>
                    <td>{h.fechaAlquiler}</td>
                    <td>{h.fechaEvento || '-'}</td>
                    <td>{(h.items || []).map((i) => i.nombre).join(', ')}</td>
                    <td>${h.precio}</td>
                    <td><span className={`badge badge-${h.estado}`}>{h.estado}</span></td>
                    <td>
                      <button onClick={(e) => { e.stopPropagation(); abrirEditarAlquiler(h); }} className="btn btn-small btn-secondary" title="Editar">✏️</button>
                      <button onClick={(e) => { e.stopPropagation(); borrarAlquiler(h.id); }} className="btn btn-small btn-danger" style={{ marginLeft: 4 }} title="Eliminar">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {detalleAlquiler && (
              <div className="card" style={{ marginTop: 16 }} id="detalle-alquiler-cliente">
                <h4>Detalle del Alquiler</h4>
                <p><strong>Dirección:</strong> {detalleAlquiler.clienteDireccion || '-'}</p>
                {detalleAlquiler.clienteTelefono && <p><strong>Teléfono:</strong> 📞 <a href={`tel:${detalleAlquiler.clienteTelefono}`} style={{ textDecoration: 'none', color: 'var(--primary)', fontWeight: 600 }}>{detalleAlquiler.clienteTelefono}</a></p>}
                <p><strong>Fecha:</strong> {detalleAlquiler.fechaAlquiler} {detalleAlquiler.turno ? `| Turno: ${detalleAlquiler.turno}` : ''} {detalleAlquiler.colegio ? `| Colegio: ${detalleAlquiler.colegio}` : ''}</p>
                {detalleAlquiler.fechaEvento && <p><strong>Evento:</strong> {detalleAlquiler.fechaEvento}</p>}
                {detalleAlquiler.fechaDevolucion && <p><strong>Devolución:</strong> {detalleAlquiler.fechaDevolucion}</p>}
                <h4 style={{ marginTop: 12, marginBottom: 8 }}>Items</h4>
                {(detalleAlquiler.items || []).map((it, idx) => (
                  <div key={idx} className="detalle-item">
                    {it.fotoUrl && !esDriveUrl(it.fotoUrl) ? (
                      <img src={it.fotoUrl} alt={it.nombre} className="thumb" />
                    ) : null}
                    {it.fotoUrl && esDriveUrl(it.fotoUrl) ? (
                      <a href={it.fotoUrl} target="_blank" rel="noreferrer" title="Abrir en Google Drive">
                        <img src={getDriveImageUrl(it.fotoUrl)} alt={it.nombre} className="thumb" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.textContent = '📷 Ver en Drive'; e.target.parentElement.className = 'btn btn-small btn-secondary'; }} />
                      </a>
                    ) : null}
                    <div><strong>{it.nombre}</strong>{it.talle ? ` (${it.talle})` : ''}</div>
                  </div>
                ))}
                {(detalleAlquiler.items || []).length === 0 && <p className="text-muted">Sin items</p>}
                <p style={{ marginTop: 8 }}><strong>Precio:</strong> ${detalleAlquiler.precio} | <strong>Seña:</strong> ${detalleAlquiler.seña || '0'}</p>
                {detalleAlquiler.garantia && <p><strong>Garantía:</strong> {detalleAlquiler.garantia} {detalleAlquiler.garantiaDevuelta ? '✅ Devuelta' : '❌ Pendiente'}</p>}
                {detalleAlquiler.nota && <p><strong>Nota:</strong> {detalleAlquiler.nota}</p>}
                <div className="flex gap" style={{ marginTop: 12 }}>
                  <button onClick={() => abrirEditarAlquiler(detalleAlquiler)} className="btn btn-primary">✏️ Editar Alquiler</button>
                  {(() => { const url = getWhatsAppReceiptUrl(detalleAlquiler); return url ? <a href={url} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ textDecoration: 'none' }}>📤 Comprobante</a> : null; })()}
                  {(() => { const url = getWhatsAppReminderUrl(detalleAlquiler); return url ? <a href={url} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ textDecoration: 'none', background: '#ffcccc', color: '#b30000' }}>⚠️ Fuera de término</a> : null; })()}
                  <button onClick={() => { if (window.confirm('¿Eliminar este alquiler?')) borrarAlquiler(detalleAlquiler.id); }} className="btn btn-danger">🗑️ Eliminar</button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      )}

      {editando && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Editar Cliente</h3>
            <div className="flex gap" style={{ marginBottom: 16 }}>
              <button onClick={() => setEditando(null)} className="btn btn-secondary">Cancelar</button>
              <button onClick={guardarEdicion} className="btn btn-primary">Guardar Cambios</button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Nombre</label>
                <input value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Apellido</label>
                <input value={editForm.apellido} onChange={(e) => setEditForm({ ...editForm, apellido: e.target.value })} required />
              </div>
            </div>
            <div className="form-group">
              <label>Dirección</label>
              <input value={editForm.direccion} onChange={(e) => setEditForm({ ...editForm, direccion: e.target.value })} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Teléfono</label>
                <input value={editForm.telefono} onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })} />
              </div>
            </div>
          </div>
        </div>
      )}

      {editandoAlquiler && (
        <div className="modal-overlay" onClick={() => setEditandoAlquiler(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Editar Alquiler</h3>
            <div className="flex gap" style={{ marginBottom: 16 }}>
              <button onClick={() => setEditandoAlquiler(null)} className="btn btn-secondary">Cancelar</button>
              <button onClick={() => actualizarAlquiler(editandoAlquiler)} className="btn btn-primary">Guardar Cambios</button>
            </div>

            <div className="form-row" style={{ marginBottom: 8 }}>
              <div className="form-group">
                <label>Teléfono</label>
                <input value={editFormAlquiler.telefono} onChange={(e) => setEditFormAlquiler({ ...editFormAlquiler, telefono: e.target.value })} placeholder="Ej: 11 1234-5678" type="tel" />
              </div>
              <div className="form-group">
                <label>Estado</label>
                <select value={editFormAlquiler.estado} onChange={(e) => setEditFormAlquiler({ ...editFormAlquiler, estado: e.target.value })}>
                  <option value="pendiente">Pendiente</option>
                  <option value="reservado">Reservado</option>
                  <option value="retirado">Retirado</option>
                  <option value="entregado">Entregado</option>
                  <option value="devuelto">Devuelto</option>
                </select>
              </div>
            </div>

            <h4>Items</h4>
            {editFormAlquiler.items.map((item, i) => (
              <div key={i} className="item-row" style={{ alignItems: 'flex-end' }}>
                <div className="form-group">
                  <label>Nombre</label>
                  <input value={item.nombre} onChange={(e) => {
                    const copy = [...editFormAlquiler.items];
                    copy[i] = { ...copy[i], nombre: e.target.value };
                    setEditFormAlquiler({ ...editFormAlquiler, items: copy });
                  }} />
                </div>
                <div className="form-group">
                  <label>Talle</label>
                  <input value={item.talle || ''} onChange={(e) => {
                    const copy = [...editFormAlquiler.items];
                    copy[i] = { ...copy[i], talle: e.target.value };
                    setEditFormAlquiler({ ...editFormAlquiler, items: copy });
                  }} />
                </div>
                <div className="form-group">
                  <label>Foto</label>
                  <div className="foto-inputs">
                    <label className="btn-foto">
                      📷 {item.fotoUrl ? 'Cambiar foto' : 'Tomar foto'}
                      <input type="file" accept="image/*" capture="environment" onChange={(e) => {
                        if (e.target.files[0]) {
                          const copy = [...editFormAlquiler.items];
                          copy[i] = handleEditFile(copy[i], e.target.files[0]);
                          setEditFormAlquiler({ ...editFormAlquiler, items: copy });
                        }
                      }} />
                    </label>
                    <span className="paste-hint">o Ctrl+V para pegar</span>
                    <input value={item.fotoUrl || ''} onChange={(e) => {
                      const copy = [...editFormAlquiler.items];
                      copy[i] = handleEditFotoUrl(copy[i], e.target.value);
                      setEditFormAlquiler({ ...editFormAlquiler, items: copy });
                    }} placeholder="O pegar URL de imagen..." className="url-input" />
                    {(item.preview || item.fotoUrl) && !esDriveUrl(item.preview || item.fotoUrl) && <img src={item.preview || item.fotoUrl} alt="preview" className="thumb" />}
                    {(item.preview || item.fotoUrl) && esDriveUrl(item.preview || item.fotoUrl) && (
                      <a href={item.preview || item.fotoUrl} target="_blank" rel="noreferrer" title="Abrir en Google Drive">
                        <img src={getDriveImageUrl(item.preview || item.fotoUrl)} alt="preview" className="thumb" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.textContent = '📷 Ver en Drive'; e.target.parentElement.className = 'btn btn-small btn-secondary'; }} />
                      </a>
                    )}
                  </div>
                </div>
                <button type="button" className="btn btn-danger btn-small" onClick={() => {
                  setEditFormAlquiler({ ...editFormAlquiler, items: editFormAlquiler.items.filter((_, idx) => idx !== i) });
                }}>✕</button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary" onClick={() => {
              setEditFormAlquiler({ ...editFormAlquiler, items: [...editFormAlquiler.items, { nombre: '', talle: '', fotoUrl: '', file: null, preview: '' }] });
            }}>+ Agregar item</button>

            <hr />

            <div className="form-row">
              <div className="form-group">
                <label>Fecha Alquiler</label>
                <input type="date" value={editFormAlquiler.fechaAlquiler} onChange={(e) => setEditFormAlquiler({ ...editFormAlquiler, fechaAlquiler: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Fecha Evento</label>
                <input type="date" value={editFormAlquiler.fechaEvento} onChange={(e) => setEditFormAlquiler({ ...editFormAlquiler, fechaEvento: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Fecha Devolución</label>
                <input type="date" value={editFormAlquiler.fechaDevolucion} onChange={(e) => setEditFormAlquiler({ ...editFormAlquiler, fechaDevolucion: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Turno</label>
                <select value={editFormAlquiler.turno} onChange={(e) => setEditFormAlquiler({ ...editFormAlquiler, turno: e.target.value })}>
                  <option value="mañana">Mañana</option>
                  <option value="tarde">Tarde</option>
                </select>
              </div>
              <div className="form-group">
                <label>Colegio</label>
                <input value={editFormAlquiler.colegio} onChange={(e) => setEditFormAlquiler({ ...editFormAlquiler, colegio: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Precio ($)</label>
                <input type="number" value={editFormAlquiler.precio} onChange={(e) => setEditFormAlquiler({ ...editFormAlquiler, precio: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Seña ($)</label>
                <input type="number" value={editFormAlquiler.seña} onChange={(e) => setEditFormAlquiler({ ...editFormAlquiler, seña: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Garantía</label>
                <input value={editFormAlquiler.garantia} onChange={(e) => setEditFormAlquiler({ ...editFormAlquiler, garantia: e.target.value })} />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                <label className="checkbox-label">
                  <input type="checkbox" checked={editFormAlquiler.garantiaDevuelta} onChange={(e) => setEditFormAlquiler({ ...editFormAlquiler, garantiaDevuelta: e.target.checked })} />
                  Garantía devuelta
                </label>
              </div>
            </div>
            <div className="form-group">
              <label>Nota</label>
              <textarea value={editFormAlquiler.nota} onChange={(e) => setEditFormAlquiler({ ...editFormAlquiler, nota: e.target.value })} rows={2} />
            </div>
          </div>
        </div>
      )}

      {resultados.length === 0 && search && (
        <div className="card"><p className="text-muted">No se encontraron clientes con ese apellido.</p></div>
      )}
    </div>
  );
}
