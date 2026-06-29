import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
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

export default function Alquileres() {
  const [alquileres, setAlquileres] = useState([]);
  const [filter, setFilter] = useState('todos');
  const [filtroFechaDev, setFiltroFechaDev] = useState('');
  const [detalle, setDetalle] = useState(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [sortField, setSortField] = useState('fechaAlquiler');
  const [sortDir, setSortDir] = useState('desc');
  const [searchCliente, setSearchCliente] = useState('');
  const [editando, setEditando] = useState(null);
  const [editForm, setEditForm] = useState({});

  const cargar = async () => {
    const q = query(collection(db, 'alquileres'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    setAlquileres(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => { cargar(); }, []);

  const cambiarEstado = async (id, nuevoEstado) => {
    await updateDoc(doc(db, 'alquileres', id), { estado: nuevoEstado });
    cargar();
  };

  const borrar = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este alquiler?')) return;
    await deleteDoc(doc(db, 'alquileres', id));
    setEditando(null);
    cargar();
  };

  const abrirEditar = (a) => {
    setEditando(a.id);
    setEditForm({
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
      await updateDoc(doc(db, 'alquileres', id), {
        items: itemsConFotos,
        clienteTelefono: editForm.telefono,
        fechaAlquiler: editForm.fechaAlquiler,
        fechaEvento: editForm.fechaEvento,
        fechaDevolucion: editForm.fechaDevolucion,
        turno: editForm.turno,
        colegio: editForm.colegio,
        precio: Number(editForm.precio),
        seña: Number(editForm.seña),
        garantia: editForm.garantia,
        garantiaDevuelta: editForm.garantiaDevuelta,
        nota: editForm.nota,
        estado: editForm.estado,
      });
      setEditando(null);
      setMsg('Alquiler actualizado');
      setTimeout(() => setMsg(''), 3000);
      cargar();
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

  let filtrados = alquileres.filter((a) => filter === 'todos' || a.estado === filter);
  if (filtroFechaDev) {
    filtrados = filtrados.filter((a) => a.fechaDevolucion === filtroFechaDev);
  }

  if (searchCliente.trim()) {
    const q = searchCliente.trim().toLowerCase();
    filtrados = filtrados.filter((a) =>
      (a.clienteNombre || '').toLowerCase().includes(q)
    );
  }

  filtrados.sort((a, b) => {
    let va = a[sortField] ?? '', vb = b[sortField] ?? '';
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

  return (
    <div className="page">
      <h2>Alquileres</h2>
      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      <div className="search-box">
        <input
          placeholder="Buscar por nombre de cliente..."
          value={searchCliente}
          onChange={(e) => setSearchCliente(e.target.value)}
        />
        <button onClick={() => { setSearchCliente(''); setDetalle(null); }} className="btn btn-secondary">Limpiar</button>
      </div>

      <div className="tabs">
        {['todos', 'pendiente', 'retirado', 'entregado', 'devuelto', 'reservado'].map((t) => (
          <button key={t} className={`tab ${filter === t ? 'active' : ''}`} onClick={() => { setFilter(t); setDetalle(null); }}>
            {t === 'todos' ? 'Todos' : t.charAt(0).toUpperCase() + t.slice(1)}
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
                {a.clienteTelefono ? <span style={{ fontSize: '0.85rem' }}>📞 {a.clienteTelefono}</span> : null}
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
              <td><span className={`badge badge-${a.estado}`}>{a.estado}</span></td>
              <td>
                <select
                  value={a.estado}
                  onChange={(e) => {
                    const nuevoEstado = e.target.value;
                    cambiarEstado(a.id, nuevoEstado);
                    if (detalle?.id === a.id) setDetalle({ ...detalle, estado: nuevoEstado });
                  }}
                  className="estado-select"
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="reservado">Reservado</option>
                  <option value="retirado">Retirado</option>
                  <option value="entregado">Entregado</option>
                  <option value="devuelto">Devuelto</option>
                </select>
              </td>
              <td>
                <button onClick={() => abrirEditar(a)} className="btn btn-small btn-secondary">✏️</button>
                <button onClick={() => borrar(a.id)} className="btn btn-small btn-danger" style={{ marginLeft: 4 }}>🗑️</button>
              </td>
            </tr>
          ))}
          {filtrados.length === 0 && (
            <tr><td colSpan={10} className="text-muted">No hay alquileres</td></tr>
          )}
        </tbody>
      </table>
      </div>

      {detalle && (
        <div className="card" id="detalle-alquiler">
          <div className="flex gap" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
            <h3 style={{ flex: 1, margin: 0 }}>Detalle de {detalle.clienteNombre}</h3>
            <div className="flex gap" style={{ alignItems: 'center' }}>
              <select value={detalle.estado} onChange={(e) => {
                const nuevoEstado = e.target.value;
                cambiarEstado(detalle.id, nuevoEstado);
                setDetalle({ ...detalle, estado: nuevoEstado });
              }} className="estado-select" style={{ padding: '8px 12px', fontSize: '0.9rem' }}>
                <option value="pendiente">Pendiente</option>
                <option value="reservado">Reservado</option>
                <option value="retirado">Retirado</option>
                <option value="entregado">Entregado</option>
                <option value="devuelto">Devuelto</option>
              </select>
              <button onClick={() => abrirEditar(detalle)} className="btn btn-small btn-primary">✏️ Editar</button>
              {(() => { const url = getWhatsAppReceiptUrl(detalle); return url ? <a href={url} target="_blank" rel="noreferrer" className="btn btn-small btn-primary" style={{ textDecoration: 'none' }}>📤 Comprobante</a> : null; })()}
              {(() => { const url = getWhatsAppReminderUrl(detalle); return url ? <a href={url} target="_blank" rel="noreferrer" className="btn btn-small" style={{ textDecoration: 'none', background: '#ffcccc', color: '#b30000' }}>⚠️ Fuera de término</a> : null; })()}
            </div>
          </div>
          <p><strong>Dirección:</strong> {detalle.clienteDireccion}</p>
          {detalle.clienteTelefono && <p><strong>Teléfono:</strong> 📞 <a href={`tel:${detalle.clienteTelefono.split('/')[0].trim()}`} style={{ textDecoration: 'none', color: 'var(--primary)', fontWeight: 600 }}>{detalle.clienteTelefono}</a></p>}
          <p><strong>Fecha:</strong> {detalle.fechaAlquiler} {detalle.turno ? `| Turno: ${detalle.turno}` : ''} {detalle.colegio ? `| Colegio: ${detalle.colegio}` : ''}</p>
          {detalle.fechaEvento && <p><strong>Evento:</strong> {detalle.fechaEvento}</p>}
          {detalle.fechaDevolucion && <p><strong>Devolución:</strong> {detalle.fechaDevolucion}</p>}

          <h4 style={{ marginTop: 12, marginBottom: 8 }}>Items</h4>
          {detalle.items?.map((it, i) => (
            <div key={i} className="detalle-item">
              {it.fotoUrl && !esDriveUrl(it.fotoUrl) && <img src={it.fotoUrl} alt={it.nombre} className="thumb" />}
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
                <label>Teléfono</label>
                <input value={editForm.telefono} onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })} placeholder="Ej: 11 1234-5678" type="tel" />
              </div>
              <div className="form-group">
                <label>Estado</label>
                <select value={editForm.estado} onChange={(e) => setEditForm({ ...editForm, estado: e.target.value })}>
                  <option value="pendiente">Pendiente</option>
                  <option value="reservado">Reservado</option>
                  <option value="retirado">Retirado</option>
                  <option value="entregado">Entregado</option>
                  <option value="devuelto">Devuelto</option>
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
                    {(item.preview || item.fotoUrl) && !esDriveUrl(item.preview || item.fotoUrl) && <img src={item.preview || item.fotoUrl} alt="preview" className="thumb" />}
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
