import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { getWhatsAppReceiptUrl } from '../utils/receipt';

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

export default function NuevoAlquiler() {
  const [step, setStep] = useState(1);
  const [searchApe, setSearchApe] = useState('');
  const [clientes, setClientes] = useState([]);
  const [busco, setBusco] = useState(false);
  const [cliente, setCliente] = useState(null);
  const [items, setItems] = useState([{ nombre: '', talle: '', file: null, preview: '', fotoUrl: '' }]);
  const [fechaAlquiler, setFechaAlquiler] = useState('');
  const [fechaEvento, setFechaEvento] = useState('');
  const [fechaDevolucion, setFechaDevolucion] = useState('');
  const [turno, setTurno] = useState('mañana');
  const [colegio, setColegio] = useState('');
  const [precio, setPrecio] = useState('');
  const [seña, setSeña] = useState('');
  const [garantia, setGarantia] = useState('');
  const [garantiaDevuelta, setGarantiaDevuelta] = useState(false);
  const [nota, setNota] = useState('');
  const [estado, setEstado] = useState('pendiente');
  const [subiendo, setSubiendo] = useState(false);
  const [exito, setExito] = useState('');
  const [error, setError] = useState('');
  const [ultimoAlquiler, setUltimoAlquiler] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [disponibles, setDisponibles] = useState([]);
  const [customNombre, setCustomNombre] = useState('');
  const [sortField, setSortField] = useState('apellido');
  const [sortDir, setSortDir] = useState('asc');
  const [filtroDisponibles, setFiltroDisponibles] = useState('');
  const [customFoto, setCustomFoto] = useState(null);
  const [customFotoPreview, setCustomFotoPreview] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'alquileres'));
        const nombres = new Set();
        snap.docs.forEach((d) => {
          (d.data().items || []).forEach((i) => {
            if (i.nombre) nombres.add(i.nombre);
          });
        });
        setDisponibles(Array.from(nombres).sort());
      } catch (err) {
        console.error('Error al cargar disfraces:', err);
      }
    })();
  }, []);

  const [params] = useSearchParams();
  useEffect(() => {
    const id = params.get('clienteId');
    if (id) {
      (async () => {
        try {
          const snap = await getDocs(query(collection(db, 'clientes'), where('__name__', '==', id)));
          if (!snap.empty) {
            const d = snap.docs[0];
            selectCliente({ id: d.id, ...d.data() });
          }
        } catch (err) {
          console.error('Error al cargar cliente desde URL:', err);
        }
      })();
    }
  }, []);

  const buscarClientes = async () => {
    setBusco(true);
    const q = searchApe.trim()
      ? query(
          collection(db, 'clientes'),
          where('apellidoSearch', '>=', searchApe.trim().toLowerCase()),
          where('apellidoSearch', '<=', searchApe.trim().toLowerCase() + '\uf8ff')
        )
      : query(collection(db, 'clientes'), orderBy('apellidoSearch', 'asc'));
    const snap = await getDocs(q);
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    data.sort((a, b) => (a.apellido || '').localeCompare(b.apellido || ''));
    setClientes(data);
  };

  const selectCliente = async (c) => {
    setCliente(c);
    setStep(2);
    setHistorial([]);
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

  const agregarItem = (nombre = '') => {
    setItems([...items, { nombre, talle: '', file: null, preview: '', fotoUrl: '' }]);
  };

  const agregarCustom = () => {
    if (!customNombre.trim()) return;
    const preview = customFotoPreview || '';
    const file = customFoto || null;
    const idx = items.findIndex((i) => !i.nombre);
    if (idx >= 0) {
      const copy = [...items];
      copy[idx] = { ...copy[idx], nombre: customNombre.trim(), file, preview, fotoUrl: preview };
      setItems(copy);
    } else {
      setItems([...items, { nombre: customNombre.trim(), talle: '', file, preview, fotoUrl: preview }]);
    }
    setCustomNombre('');
    setCustomFoto(null);
    setCustomFotoPreview('');
  };

  const seleccionarDisfraz = (nombre) => {
    const idx = items.findIndex((i) => !i.nombre);
    if (idx >= 0) {
      const copy = [...items];
      copy[idx] = { ...copy[idx], nombre };
      setItems(copy);
    } else {
      setItems([...items, { nombre, talle: '', file: null, preview: '', fotoUrl: '' }]);
    }
  };

  const updateItem = (i, field, val) => {
    const copy = [...items];
    copy[i][field] = val;
    setItems(copy);
  };

  const removeItem = (i) => {
    if (items[i].preview) URL.revokeObjectURL(items[i].preview);
    setItems(items.filter((_, idx) => idx !== i));
  };

  const handleFile = (i, file) => {
    if (!file) return;
    updateItem(i, 'preview', URL.createObjectURL(file));
    updateItem(i, 'file', file);
    updateItem(i, 'fotoUrl', '');
  };

  const handlePaste = (i, e) => {
    const clipboardItems = e.clipboardData.items;
    for (const item of clipboardItems) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          const file = new File([blob], `clipboard_${Date.now()}.png`, { type: blob.type });
          handleFile(i, file);
        }
        return;
      }
    }
  };

  const handleFotoUrl = (i, url) => {
    if (items[i].preview) URL.revokeObjectURL(items[i].preview);
    updateItem(i, 'fotoUrl', url);
    updateItem(i, 'file', null);
    updateItem(i, 'preview', url || '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) { setError('Agregá al menos un item'); return; }
    setSubiendo(true);
    setError('');

    const itemsValidos = items.filter((i) => i.nombre);
    if (itemsValidos.length === 0) { setError('Agregá al menos un item'); setSubiendo(false); return; }

    try {
      const itemsConFotos = [];
      for (const item of itemsValidos) {
        if (item.file) {
          const b64 = await comprimirImagen(item.file);
          itemsConFotos.push({ nombre: item.nombre, talle: item.talle, fotoUrl: b64 });
        } else {
          itemsConFotos.push({ nombre: item.nombre, talle: item.talle, fotoUrl: item.fotoUrl || '' });
        }
      }

      await addDoc(collection(db, 'alquileres'), {
        clienteId: cliente.id,
        clienteNombre: `${cliente.apellido?.toUpperCase()}, ${cliente.nombre}`,
        clienteApellido: cliente.apellido?.toUpperCase(),
        clienteDireccion: cliente.direccion,
        clienteTelefono: cliente.telefono || '',
        items: itemsConFotos,
        fechaAlquiler,
        fechaEvento,
        fechaDevolucion,
        turno,
        colegio,
        precio: Number(precio),
        seña: Number(seña),
        garantia,
        garantiaDevuelta,
        nota,
        estado,
        createdAt: serverTimestamp()
      });

      setExito('¡Alquiler registrado con éxito!');
      setUltimoAlquiler({
        clienteNombre: cliente ? `${cliente.apellido?.toUpperCase()}, ${cliente.nombre}` : 'Sin cliente',
        clienteTelefono: cliente?.telefono || '',
        items: itemsValidos.map((i) => i.nombre).join(', '),
        fechaAlquiler,
        fechaEvento,
        fechaDevolucion,
        turno,
        colegio,
        precio,
        seña,
        garantia,
      });
      setStep(1); setCliente(null); setItems([{ nombre: '', talle: '', file: null, preview: '', fotoUrl: '' }]);
      setFechaAlquiler(''); setFechaEvento(''); setFechaDevolucion(''); setTurno('mañana'); setColegio('');
      setPrecio(''); setSeña(''); setGarantia(''); setGarantiaDevuelta(false); setNota(''); setEstado('pendiente');
      setSearchApe(''); setClientes([]); setBusco(false);
      setTimeout(() => setExito(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendo(false);
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

  const ordenados = [...clientes].sort((a, b) => {
    let va = (a[sortField] || '').toUpperCase();
    let vb = (b[sortField] || '').toUpperCase();
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="page">
      <h2>Nuevo Alquiler</h2>

      {exito && <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span>{exito}</span>
      </div>}
      {error && <div className="alert alert-error">{error}</div>}
      {ultimoAlquiler?.clienteTelefono && (() => {
        const url = getWhatsAppReceiptUrl(ultimoAlquiler);
        return url ? <div style={{ marginBottom: 12 }}><a href={url} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ textDecoration: 'none' }}>📤 Enviar comprobante por WhatsApp</a></div> : null;
      })()}

      <div className="steps">
        <div className={`step ${step >= 1 ? 'active' : ''}`}>1. Cliente</div>
        <div className={`step ${step >= 2 ? 'active' : ''}`}>2. Items y Fechas</div>
        <div className={`step ${step >= 3 ? 'active' : ''}`}>3. Confirmar</div>
      </div>

      {step === 1 && (
        <div className="card">
          <h3>Seleccionar Cliente</h3>
          <div className="search-box">
            <input
              placeholder="Buscar por apellido..."
              value={searchApe}
              onChange={(e) => { setSearchApe(e.target.value); setBusco(false); }}
              onKeyDown={(e) => e.key === 'Enter' && buscarClientes()}
            />
            <button onClick={buscarClientes} className="btn btn-primary">Buscar</button>
          </div>

          {ordenados.length > 0 && (
            <div className="table-wrapper">
            <table className="table">
              <thead><tr>
                <th className="sortable" onClick={() => handleSort('apellido')}>Apellido{sortIcon('apellido')}</th>
                <th className="sortable" onClick={() => handleSort('nombre')}>Nombre{sortIcon('nombre')}</th>
                <th>Dirección</th><th>Teléfono</th><th></th>
              </tr></thead>
              <tbody>
                  {ordenados.map((c) => (
                  <tr key={c.id} className="clickable" onDoubleClick={() => selectCliente(c)}>
                    <td><strong>{c.apellido?.toUpperCase()}</strong></td>
                    <td>{c.nombre}</td>
                    <td>{c.direccion}</td>
                    <td>{c.telefono}</td>
                    <td><button onClick={() => selectCliente(c)} className="btn btn-small btn-primary">Seleccionar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}

          {ordenados.length === 0 && busco && (
            <div className="card" style={{ marginTop: 12 }}>
              <h4>Cliente no encontrado — Crear nuevo</h4>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target;
                const nombre = form.nombre.value.trim();
                const apellido = form.apellido.value.trim();
                if (!nombre || !apellido) return;
                const ref = await addDoc(collection(db, 'clientes'), {
                  nombre, apellido,
                  direccion: form.direccion.value.trim(),
                  telefono: form.telefono.value.trim(),
                  apellidoSearch: apellido.toLowerCase(),
                  nombreSearch: nombre.toLowerCase(),
                  createdAt: serverTimestamp()
                });
                const nuevoCliente = { id: ref.id, nombre, apellido, direccion: form.direccion.value.trim(), telefono: form.telefono.value.trim() };
                selectCliente(nuevoCliente);
              }}>
                <div className="form-row">
                  <div className="form-group"><label>Nombre</label><input name="nombre" required /></div>
                  <div className="form-group"><label>Apellido</label><input name="apellido" required defaultValue={searchApe} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Dirección</label><input name="direccion" /></div>
                  <div className="form-group"><label>Teléfono</label><input name="telefono" type="tel" /></div>
                </div>
                <button type="submit" className="btn btn-primary">Crear y Seleccionar</button>
              </form>
            </div>
          )}

          <button onClick={() => setStep(2)} className="btn btn-secondary" disabled={!cliente}>
            Saltar (sin cliente)
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          {cliente && (
            <>
            <div className="selected-client">
              <strong>Cliente:</strong> {cliente.apellido?.toUpperCase()}, {cliente.nombre} &mdash; {cliente.direccion}
            </div>

            {historial.length > 0 && (
              <div className="historial">
                <h4>Historial de alquileres</h4>
                <div className="table-wrapper">
                <table className="table">
                  <thead><tr><th>Fecha Alq.</th><th>Evento</th><th>Items</th><th>Precio</th><th>Estado</th></tr></thead>
                  <tbody>
                    {historial.map((h) => (
                      <tr key={h.id}>
                        <td>{h.fechaAlquiler}</td>
                        <td>{h.fechaEvento || '-'}</td>
                        <td>{(h.items || []).map((i) => i.nombre).join(', ')}</td>
                        <td>${h.precio}</td>
                        <td><span className={`badge badge-${h.estado}`}>{h.estado}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
            </>
          )}

          <form onSubmit={(e) => { e.preventDefault(); setStep(3); }}>
            <h3>Items del Alquiler</h3>

            <div className="dual-panel">
              <div className="panel panel-left">
                <h4>Disfraces Disponibles</h4>
                <input
                  value={filtroDisponibles}
                  onChange={(e) => setFiltroDisponibles(e.target.value)}
                  placeholder="Buscar disfraz..."
                  className="search-inside"
                />
                <div className="available-list">
                  {disponibles.filter((n) => !filtroDisponibles || n.toLowerCase().includes(filtroDisponibles.toLowerCase())).map((nombre) => (
                    <div key={nombre} className="available-item" onClick={() => seleccionarDisfraz(nombre)}>
                      <span>{nombre}</span>
                      <span className="add-icon">+</span>
                    </div>
                  ))}
                  {disponibles.filter((n) => !filtroDisponibles || n.toLowerCase().includes(filtroDisponibles.toLowerCase())).length === 0 && disponibles.length > 0 && <p className="text-muted">Sin resultados</p>}
                  {disponibles.length === 0 && <p className="text-muted">Cargando...</p>}
                </div>
                <div className="custom-add" style={{ flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={customNombre}
                      onChange={(e) => setCustomNombre(e.target.value)}
                      placeholder="Escribí un nombre personalizado..."
                      onKeyDown={(e) => { if (e.key === 'Enter' && customNombre.trim()) { agregarCustom(); } }}
                      style={{ flex: 1 }}
                    />
                    <button type="button" className="btn btn-small btn-primary" onClick={agregarCustom}>
                      Agregar
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label className="btn-foto" style={{ padding: '6px 12px', fontSize: 12 }}>
                      📷 Foto
                      <input type="file" accept="image/*" capture="environment" onChange={(e) => {
                        if (e.target.files[0]) {
                          setCustomFoto(e.target.files[0]);
                          const reader = new FileReader();
                          reader.onload = (ev) => setCustomFotoPreview(ev.target.result);
                          reader.readAsDataURL(e.target.files[0]);
                        }
                      }} />
                    </label>
                    {customFotoPreview && <>
                      <img src={customFotoPreview} alt="preview" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
                      <button type="button" className="btn btn-small btn-danger" onClick={() => { setCustomFoto(null); setCustomFotoPreview(''); }}>✕</button>
                    </>}
                  </div>
                </div>
                <button type="button" className="btn btn-secondary btn-full" style={{ marginTop: 8 }} onClick={() => agregarItem('')}>
                  + Agregar otro item
                </button>
              </div>

              <div className="panel panel-right">
                <h4>Items Seleccionados</h4>
                {items.length === 0 && <p className="text-muted">No hay items. Tocá un disfraz de la lista.</p>}
                {items.map((item, i) => (
                  <div key={i} className="selected-item">
                    <div className="selected-item-header">
                      <strong>{item.nombre || 'Item ' + (i + 1)}</strong>
                      {item.nombre && <button type="button" onClick={() => removeItem(i)} className="btn btn-danger btn-small">✕</button>}
                    </div>
                    {item.nombre ? (
                    <div className="selected-item-fields">
                      <div className="form-group">
                        <label>Talle</label>
                        <input value={item.talle} onChange={(e) => updateItem(i, 'talle', e.target.value)} placeholder="Ej: T8, M..." />
                      </div>
                      <div className="form-group">
                        <label>Foto</label>
                        <div className="foto-inputs" onPaste={(e) => handlePaste(i, e)}>
                          <label className="btn-foto">
                            📷 {item.fotoUrl ? 'Cambiar foto' : 'Tomar foto'}
                            <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFile(i, e.target.files[0])} />
                          </label>
                          <span className="paste-hint">o Ctrl+V para pegar</span>
                          <input value={item.fotoUrl} onChange={(e) => handleFotoUrl(i, e.target.value)} placeholder="O pegar URL de imagen..." className="url-input" />
                        </div>
                        {item.preview && <img src={item.preview} alt="preview" className="thumb" />}
                      </div>
                    </div>
                    ) : (
                      <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Tocá un disfraz de la lista para asignarlo</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <hr />

            <div className="form-row">
              <div className="form-group">
                <label>Fecha de Alquiler</label>
                <input type="date" value={fechaAlquiler} onChange={(e) => setFechaAlquiler(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Fecha del Evento</label>
                <input type="date" value={fechaEvento} onChange={(e) => setFechaEvento(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Fecha de Devolución</label>
                <input type="date" value={fechaDevolucion} onChange={(e) => setFechaDevolucion(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Turno</label>
                <select value={turno} onChange={(e) => setTurno(e.target.value)}>
                  <option value="mañana">Mañana</option>
                  <option value="tarde">Tarde</option>
                </select>
              </div>
              <div className="form-group">
                <label>Colegio / Institución</label>
                <input value={colegio} onChange={(e) => setColegio(e.target.value)} placeholder="Ej: San Javier" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Precio total ($)</label>
                <input type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Seña ($)</label>
                <input type="number" value={seña} onChange={(e) => setSeña(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Garantía</label>
                <input value={garantia} onChange={(e) => setGarantia(e.target.value)} placeholder="Ej: DNI, celular, efectivo..." />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                <label className="checkbox-label">
                  <input type="checkbox" checked={garantiaDevuelta} onChange={(e) => setGarantiaDevuelta(e.target.checked)} />
                  Garantía devuelta
                </label>
              </div>
            </div>
            <div className="form-group">
              <label>Nota adicional</label>
              <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} />
            </div>
            <div className="form-group">
              <label>Estado</label>
              <select value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="pendiente">Pendiente</option>
                <option value="reservado">Reservado</option>
                <option value="retirado">Retirado</option>
                <option value="entregado">Entregado</option>
                <option value="devuelto">Devuelto</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary" disabled={!items.some((i) => i.nombre)}>Continuar</button>
          </form>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h3>Confirmar Alquiler</h3>
          {cliente && (
            <p><strong>Cliente:</strong> {cliente.apellido?.toUpperCase()}, {cliente.nombre} - {cliente.direccion}</p>
          )}
          <p><strong>Fecha Alquiler:</strong> {fechaAlquiler}{fechaEvento ? ` | Evento: ${fechaEvento}` : ''}{fechaDevolucion ? ` | Devolución: ${fechaDevolucion}` : ''} | <strong>Turno:</strong> {turno}</p>
          {colegio && <p><strong>Colegio:</strong> {colegio}</p>}
          <p><strong>Items:</strong></p>
          <ul>{items.map((i, idx) => <li key={idx}>{i.nombre}{i.talle ? ` (Talle: ${i.talle})` : ''}</li>)}</ul>
          <p><strong>Precio:</strong> ${precio} | <strong>Seña:</strong> ${seña || '0'}</p>
          {garantia && <p><strong>Garantía:</strong> {garantia} {garantiaDevuelta ? '✅ Devuelta' : '❌ Pendiente'}</p>}
          {nota && <p><strong>Nota:</strong> {nota}</p>}
          <p><strong>Estado:</strong> <span className={`badge badge-${estado}`}>{estado}</span></p>

          <div className="flex gap">
            <button onClick={() => setStep(2)} className="btn btn-secondary">Volver</button>
            <button onClick={handleSubmit} className="btn btn-primary" disabled={subiendo}>
              {subiendo ? 'Guardando...' : 'Confirmar y Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
