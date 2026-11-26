import { useState, useEffect } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { initTopScrollbar } from '../utils/topScrollbar';
import { getWhatsAppReceiptUrl, getWhatsAppReminderUrl } from '../utils/receipt';
import { ESTADOS_ALQUILER, normalizarEstado } from '../utils/estados';
import { getAlquileres, getClientes, upsertAlquilerCache, removeAlquilerCache } from '../utils/dataCache';
import FotoModal from './FotoModal';
import { Link } from 'react-router-dom';

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

export default function Dashboard() {
  const [stats, setStats] = useState({ clientes: 0, alquileres: 0, reservados: 0, caja: 0, señas: 0 });
  const [recientes, setRecientes] = useState([]);
  const [editando, setEditando] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const [cargando, setCargando] = useState(true);

  const aplicarDatos = (clientesLista, alquileresLista) => {
    const total = alquileresLista.length;
    const res = alquileresLista.filter((d) => normalizarEstado(d.estado) === 'reservado').length;
    const caja = alquileresLista.reduce((s, d) => s + (Number(d.precio) || 0), 0);
    const señas = alquileresLista.reduce((s, d) => s + (Number(d.seña) || 0), 0);
    setRecientes(alquileresLista.slice(0, 5));
    setStats({ clientes: clientesLista.length, alquileres: total, reservados: res, caja, señas });
  };

  const cargar = async (force = false) => {
    setCargando(true);
    setErr('');
    try {
      const [clientesLista, alquileresLista] = await Promise.all([
        getClientes(force),
        getAlquileres(force),
      ]);
      aplicarDatos(clientesLista, alquileresLista);
    } catch (e) {
      setErr('Error al cargar datos: ' + e.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(false); }, []);

  useEffect(() => { setTimeout(initTopScrollbar, 300); }, [recientes]);

  const cambiarEstado = async (id, nuevoEstado, alquiler) => {
    const data = { estado: nuevoEstado };
    if (nuevoEstado === 'devuelto' && alquiler?.garantia && !alquiler.garantiaDevuelta) {
      data.garantiaDevuelta = true;
    }
    try {
      await updateDoc(doc(db, 'alquileres', id), data);
      const updated = upsertAlquilerCache(id, data);
      const clientesLista = await getClientes(false);
      if (updated) aplicarDatos(clientesLista, updated);
    } catch (e) {
      setErr('Error al cambiar estado: ' + e.message);
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
      const clientesLista = await getClientes(false);
      if (updated) aplicarDatos(clientesLista, updated);
      setEditando(null);
      setMsg('Alquiler actualizado');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setErr('Error al guardar: ' + e.message);
      setTimeout(() => setErr(''), 5000);
    }
  };

  const borrar = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este alquiler?')) return;
    try {
      await deleteDoc(doc(db, 'alquileres', id));
      const updated = removeAlquilerCache(id);
      const clientesLista = await getClientes(false);
      if (updated) aplicarDatos(clientesLista, updated);
      setEditando(null);
    } catch (e) {
      setErr('Error al eliminar: ' + e.message);
      setTimeout(() => setErr(''), 5000);
    }
  };

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Panel Principal</h2>
        <button onClick={() => cargar(true)} className="btn btn-secondary btn-small" disabled={cargando}>
          {cargando ? 'Cargando...' : '🔄 Actualizar'}
        </button>
      </div>
      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}
      <div className="stats">
        <div className="stat-card"><span className="stat-num">{stats.clientes}</span>Clientes</div>
        <div className="stat-card"><span className="stat-num">{stats.alquileres}</span>Alquileres</div>
        <div className="stat-card warn"><span className="stat-num">{stats.reservados}</span>Reservados</div>
        <div className="stat-card"><span className="stat-num">${stats.caja.toLocaleString()}</span>Total Caja</div>
        <div className="stat-card"><span className="stat-num">${stats.señas.toLocaleString()}</span>Total Señas</div>
      </div>
      <div className="actions">
        <Link to="/nuevo-alquiler" className="btn btn-primary">+ Nuevo Alquiler</Link>
        <Link to="/clientes" className="btn btn-secondary">Buscar Cliente</Link>
        <Link to="/reportes" className="btn btn-secondary">Ver Reportes</Link>
      </div>
      {recientes.length > 0 && (
        <div className="section">
          <h3>Últimos Alquileres</h3>
          <table className="table">
            <thead><tr><th>Cliente</th><th>Teléfono</th><th>Fecha</th><th>Precio</th><th>Estado</th><th></th><th></th></tr></thead>
            <tbody>
              {recientes.map((r) => (
                <tr key={r.id}>
                  <td>{r.clienteNombre}</td>
                  <td>{r.clienteTelefonoPrincipal || r.clienteTelefono?.split(' / ')[0] || ''}{r.clienteTelefonoSecundario ? ` / ${r.clienteTelefonoSecundario}` : r.clienteTelefono?.includes(' / ') ? ` / ${r.clienteTelefono.split(' / ')[1]}` : ''}</td>
                  <td>{r.fechaAlquiler}</td>
                  <td>${r.precio}</td>
                  <td><span className={`badge badge-${normalizarEstado(r.estado)}`}>{normalizarEstado(r.estado)}</span></td>
                  <td>
                    <select
                      value={normalizarEstado(r.estado)}
                      onChange={(e) => cambiarEstado(r.id, e.target.value, r)}
                      className="estado-select"
                    >
                      {ESTADOS_ALQUILER.map((e) => (
                        <option key={e.value} value={e.value}>{e.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button onClick={() => abrirEditar(r)} className="btn btn-small btn-secondary" title="Editar">✏️</button>
                    <button onClick={() => borrar(r.id)} className="btn btn-small btn-danger" style={{ marginLeft: 4 }} title="Eliminar">🗑️</button>
                    {(() => { const url = getWhatsAppReceiptUrl(r); return url ? <a href={url} target="_blank" rel="noreferrer" className="btn btn-small btn-primary" style={{ marginLeft: 4, textDecoration: 'none' }} title="Comprobante">📤</a> : null; })()}
                    {(() => { const url = getWhatsAppReminderUrl(r); return url ? <a href={url} target="_blank" rel="noreferrer" className="btn btn-small" style={{ marginLeft: 4, textDecoration: 'none', background: '#ffcccc', color: '#b30000' }} title="Fuera de término">⚠️</a> : null; })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                <label>Celular principal</label>
                <input value={editForm.telefonoPrincipal} onChange={(e) => setEditForm({ ...editForm, telefonoPrincipal: e.target.value })} placeholder="381..." type="tel" />
              </div>
              <div className="form-group">
                <label>Celular secundario</label>
                <input value={editForm.telefonoSecundario} onChange={(e) => setEditForm({ ...editForm, telefonoSecundario: e.target.value })} placeholder="Opcional" type="tel" />
              </div>
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
      <FotoModal src={fotoAmpliada} onClose={() => setFotoAmpliada(null)} />
    </div>
  );
}
