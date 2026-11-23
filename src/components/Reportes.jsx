import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { initTopScrollbar } from '../utils/topScrollbar';
import { ComposedChart, BarChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList, Cell } from 'recharts';
import FotoModal from './FotoModal';

function esDriveUrl(url) {
  return url && (url.includes('drive.google.com') || url.includes('googleusercontent'));
}
function getDriveImageUrl(url) {
  const match = url.match(/[-\w]{25,}/);
  return match ? `https://drive.google.com/thumbnail?id=${match[0]}&sz=w800-h800` : url;
}

const COLORS = ['#6c63ff', '#ff6584', '#00b894', '#fdcb6e', '#e17055', '#0984e3', '#a29bfe', '#fd79a8', '#00cec9', '#e84393'];

const GRAFICOS = [
  { key: 'alquileres', label: 'Alquileres x Día' },
  { key: 'ingresos', label: 'Ingresos x Día' },
  { key: 'devoluciones', label: 'Devoluciones x Día' },
  { key: 'disfraces', label: 'Disfraces' },
  { key: 'colegios', label: 'Colegios' },
  { key: 'garantias', label: 'Garantías Pendientes' },
  { key: 'buscar', label: 'Buscar Disfraz' },
  { key: 'detalle', label: 'Detalle x Día' },
];

function calcMediaMovil(datos, campo, ventana = 3) {
  return datos.map((d, i) => {
    const start = Math.max(0, i - ventana + 1);
    const slice = datos.slice(start, i + 1);
    const avg = slice.reduce((s, x) => s + (x[campo] || 0), 0) / slice.length;
    return { ...d, tendencia: Math.round(avg * 10) / 10 };
  });
}

export default function Reportes() {
  const [loading, setLoading] = useState(true);
  const [alquileres, setAlquileres] = useState([]);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [graficoActivo, setGraficoActivo] = useState('alquileres');
  const [detSort, setDetSort] = useState({ field: 'fecha', dir: 'desc' });
  const [buscarDisfraz, setBuscarDisfraz] = useState('');
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const [showSinFoto, setShowSinFoto] = useState(false);
  const [showGarPendientes, setShowGarPendientes] = useState(false);
  const [sinFotoSortDir, setSinFotoSortDir] = useState(null);
  const [garPendSortDir, setGarPendSortDir] = useState(null);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'alquileres'));
      setAlquileres(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    })();
  }, []);

  useEffect(() => { if (!loading) setTimeout(initTopScrollbar, 300); }, [loading, graficoActivo]);
  useEffect(() => { if (showSinFoto || showGarPendientes) setTimeout(initTopScrollbar, 100); }, [showSinFoto, showGarPendientes]);

  const filtrados = useMemo(() => {
    let arr = alquileres;
    if (fechaDesde) arr = arr.filter((a) => (a.fechaAlquiler || '') >= fechaDesde);
    if (fechaHasta) arr = arr.filter((a) => (a.fechaAlquiler || '') <= fechaHasta);
    return arr;
  }, [alquileres, fechaDesde, fechaHasta]);

  const { totalPrecio, totalSeña, saldoPendiente, totalAlquileres, porDia, graficoDia, graficoIngresos, graficoDevoluciones, disfraces, garantiasPendientes, colegios, garantiasResumen, sinFoto } = useMemo(() => {
    const total = filtrados.length;
    let precio = 0, seña = 0;
    const dias = {}, ingresosPorDia = {}, devolucionesPorDia = {}, conteoCol = {}, garantiasPorDia = {};

    filtrados.forEach((a) => {
      precio += Number(a.precio) || 0;
      seña += Number(a.seña) || 0;
      if (a.fechaAlquiler) {
        dias[a.fechaAlquiler] = (dias[a.fechaAlquiler] || 0) + 1;
        ingresosPorDia[a.fechaAlquiler] = (ingresosPorDia[a.fechaAlquiler] || 0) + (Number(a.precio) || 0);
        if (a.garantia && a.garantia !== 'No' && a.garantia !== 'Sin' && a.garantia !== '') {
          garantiasPorDia[a.fechaAlquiler] = (garantiasPorDia[a.fechaAlquiler] || 0) + 1;
        }
      }
      if (a.fechaDevolucion) {
        devolucionesPorDia[a.fechaDevolucion] = (devolucionesPorDia[a.fechaDevolucion] || 0) + 1;
      }
      if (a.colegio) {
        conteoCol[a.colegio] = (conteoCol[a.colegio] || 0) + 1;
      }
    });

    const fechasDev = Object.keys(devolucionesPorDia).sort();
    const devArr = fechasDev.map((f) => ({ fecha: f, devoluciones: devolucionesPorDia[f] }));
    const devArrTend = calcMediaMovil(devArr, 'devoluciones');

    const pend = filtrados
      .filter((a) => a.garantia && a.garantia !== 'No' && a.garantia !== 'Sin' && a.garantia !== '')
      .map((a) => ({
        id: a.id,
        cliente: a.clienteNombre,
        apellido: (a.clienteApellido || (a.clienteNombre || '').split(',')[0] || '').toLowerCase(),
        nombre: (a.clienteNombre || '').split(',')[1]?.trim()?.toLowerCase() || '',
        garantia: a.garantia,
        precio: a.precio,
        seña: a.seña,
        fecha: a.fechaAlquiler,
        estado: a.estado || '—',
        garantiaDevuelta: a.garantiaDevuelta || false,
      }))
      .sort((a, b) => a.apellido.localeCompare(b.apellido) || a.nombre.localeCompare(b.nombre));

    const garantiasPorDiaPend = {};
    pend.forEach((g) => {
      const montoGar = parseFloat(g.garantia.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
      if (!garantiasPorDiaPend[g.fecha]) garantiasPorDiaPend[g.fecha] = { cantidad: 0, montoGar: 0, montoPrecio: 0, montoSena: 0 };
      garantiasPorDiaPend[g.fecha].cantidad++;
      garantiasPorDiaPend[g.fecha].montoGar += montoGar;
      garantiasPorDiaPend[g.fecha].montoPrecio += (Number(g.precio) || 0);
      garantiasPorDiaPend[g.fecha].montoSena += (Number(g.seña) || 0);
    });
    const garantiasResumen = Object.entries(garantiasPorDiaPend)
      .map(([fecha, v]) => ({ fecha, cantidad: v.cantidad, montoGar: v.montoGar, montoPrecio: v.montoPrecio, montoSena: v.montoSena }))
      .sort((a, b) => b.fecha?.localeCompare?.(a.fecha) || 0);

    const fechas = Object.keys(dias).sort();
    const diaArr = fechas.map((f) => ({ fecha: f, alquileres: dias[f] }));
    const ingArr = fechas.map((f) => ({ fecha: f, ingresos: ingresosPorDia[f] }));
    const diaArrTend = calcMediaMovil(diaArr, 'alquileres');
    const ingArrTend = calcMediaMovil(ingArr, 'ingresos');
    const porDiaArr = fechas.map((f) => ({ fecha: f, cantidad: dias[f], monto: ingresosPorDia[f], garantias: garantiasPorDia[f] || 0 })).reverse();

    const conteo = {};
    filtrados.forEach((a) => {
      (a.items || []).forEach((it) => {
        const nombre = it.nombre || 'Sin nombre';
        conteo[nombre] = (conteo[nombre] || 0) + 1;
      });
    });
    let disfArr = Object.entries(conteo).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    if (disfArr.length > 10) {
      const top = disfArr.slice(0, 9);
      const otros = disfArr.slice(9).reduce((s, x) => s + x.value, 0);
      disfArr = [...top, { name: 'Otros', value: otros }];
    }

    const colArr = Object.entries(conteoCol).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    const sinFoto = filtrados.filter((a) => (a.items || []).length > 0 && (a.items || []).every((it) => !it.fotoUrl)).length;

    return {
      totalPrecio: precio, totalSeña: seña, saldoPendiente: precio - seña,
      totalAlquileres: total, porDia: porDiaArr,
      graficoDia: diaArrTend, graficoIngresos: ingArrTend, graficoDevoluciones: devArrTend,
      disfraces: disfArr, garantiasPendientes: pend, colegios: colArr, garantiasResumen, sinFoto
    };
  }, [filtrados]);

  const handleDetSort = (field) => {
    setDetSort((prev) => ({
      field,
      dir: prev.field === field ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'asc',
    }));
  };

  const detIcon = (field) => {
    if (detSort.field !== field) return ' ↕';
    return detSort.dir === 'asc' ? ' ↑' : ' ↓';
  };

  const exportarGarantias = () => {
    try {
      const filas = garantiasPendientes.map((g) => ({
        Apellido: g.apellido?.toUpperCase() || '',
        Nombre: g.nombre ? g.nombre.charAt(0).toUpperCase() + g.nombre.slice(1) : '',
        Garantia: g.garantia,
        Precio: Number(g.precio) || 0,
        Sena: Number(g.seña) || 0,
        Devuelta: g.garantiaDevuelta ? 'SI' : 'NO',
        Estado: g.estado,
        Fecha: g.fecha || '',
      }));
      const cols = ['Apellido', 'Nombre', 'Garantia', 'Precio', 'Sena', 'Devuelta', 'Estado', 'Fecha'];
      const csv = cols.join(',') + '\n' + filas.map((r) => cols.map((c) => `"${(r[c] || '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `garantias-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Error al exportar: ' + e.message);
    }
  };

  const porDiaOrdenado = [...porDia].sort((a, b) => {
    let va = a[detSort.field], vb = b[detSort.field];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return detSort.dir === 'asc' ? -1 : 1;
    if (va > vb) return detSort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  if (loading) return <div className="page"><p className="text-muted">Cargando...</p></div>;

  return (
    <div className="page">
      <h2>Reportes</h2>

      <div className="card">
        <div className="form-row">
          <div className="form-group">
            <label>Desde</label>
            <input type="date" value={fechaDesde} onChange={(e) => { setFechaDesde(e.target.value); if (!fechaHasta) setFechaHasta(e.target.value); }} />
          </div>
          <div className="form-group">
            <label>Hasta</label>
            <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button onClick={() => { setFechaDesde(''); setFechaHasta(''); }} className="btn btn-secondary">Limpiar</button>
          </div>
        </div>
      </div>

      <div className="stats">
        <div className="stat-card"><span className="stat-num">${totalPrecio.toLocaleString()}</span>Total en Caja</div>
        <div className="stat-card"><span className="stat-num">${totalSeña.toLocaleString()}</span>Total Señas</div>
        <div className="stat-card warn"><span className="stat-num">${saldoPendiente.toLocaleString()}</span>Saldo Pendiente</div>
        <div className="stat-card"><span className="stat-num">{totalAlquileres}</span>Alquileres</div>
        <div className="stat-card warn" style={{ cursor: 'pointer' }} onClick={() => setShowGarPendientes(!showGarPendientes)} title="Click para ver detalle"><span className="stat-num">{garantiasPendientes.filter(g => !g.garantiaDevuelta).length}</span>Garantías x Devolver {showGarPendientes ? '▲' : '▼'}</div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setShowSinFoto(!showSinFoto)} title="Click para ver detalle"><span className="stat-num">{sinFoto}</span>Sin Foto {showSinFoto ? '▲' : '▼'}</div>
      </div>

      {showSinFoto && sinFoto > 0 && (
        <div className="card">
          <h3>Alquileres sin Foto ({sinFoto})</h3>
          <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Cliente</th><th>Teléfono</th><th>Items</th><th>Fecha Alquiler</th><th>Fecha Devolución</th><th>Seña</th><th onClick={() => setSinFotoSortDir(sinFotoSortDir === 'asc' ? 'desc' : 'asc')} style={{ cursor: 'pointer' }}>Estado {sinFotoSortDir ? (sinFotoSortDir === 'asc' ? '▲' : '▼') : ''}</th></tr></thead>
            <tbody>
              {(() => {
                const items = filtrados.filter((a) => (a.items || []).length > 0 && (a.items || []).every((it) => !it.fotoUrl));
                if (sinFotoSortDir) {
                  items.sort((a, b) => {
                    const va = (a.estado || '').toLowerCase();
                    const vb = (b.estado || '').toLowerCase();
                    return sinFotoSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
                  });
                }
                return items.map((a) => (
                  <tr key={a.id}>
                    <td>{a.clienteApellido}, {a.clienteNombre}</td>
                    <td>{a.clienteTelefonoPrincipal || (a.clienteTelefono || '').split(' / ')[0] || '-'}</td>
                    <td>{(a.items || []).map((it) => it.nombre).join(', ')}</td>
                    <td>{a.fechaAlquiler || '-'}</td>
                    <td>{a.fechaDevolucion || '-'}</td>
                    <td>{a.seña != null ? '$' + Number(a.seña).toLocaleString() : '-'}</td>
                    <td><span className={`estado-badge ${(a.estado || 'pendiente').toLowerCase()}`}>{a.estado || 'pendiente'}</span></td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {showGarPendientes && (
        <div className="card">
          <h3>Garantías por Devolver ({garantiasPendientes.filter(g => !g.garantiaDevuelta).length})</h3>
          <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Apellido</th><th>Nombre</th><th>Garantía</th><th>Precio</th><th>Seña</th><th onClick={() => setGarPendSortDir(garPendSortDir === 'asc' ? 'desc' : 'asc')} style={{ cursor: 'pointer' }}>Estado {garPendSortDir ? (garPendSortDir === 'asc' ? '▲' : '▼') : ''}</th><th>Fecha</th></tr></thead>
            <tbody>
              {(() => {
                const items = garantiasPendientes.filter(g => !g.garantiaDevuelta);
                if (garPendSortDir) {
                  items.sort((a, b) => {
                    const va = (a.estado || '').toLowerCase();
                    const vb = (b.estado || '').toLowerCase();
                    return garPendSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
                  });
                }
                return items.map((g) => (
                  <tr key={g.id}>
                    <td>{g.apellido?.toUpperCase()}</td>
                    <td>{g.nombre ? g.nombre.charAt(0).toUpperCase() + g.nombre.slice(1) : ''}</td>
                    <td>{g.garantia}</td>
                    <td>${Number(g.precio).toLocaleString()}</td>
                    <td>${Number(g.seña).toLocaleString()}</td>
                    <td><span className={`badge badge-${g.estado}`}>{g.estado}</span></td>
                    <td>{g.fecha || '-'}</td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <div className="chart-tabs">
        {GRAFICOS.map((g) => (
          <button key={g.key} className={`chart-tab ${graficoActivo === g.key ? 'active' : ''}`} onClick={() => setGraficoActivo(g.key)}>
            {g.label}
          </button>
        ))}
      </div>

      {graficoActivo === 'alquileres' && (
        <div className="card">
          <h3>Alquileres por Día</h3>
          {graficoDia.length === 0 ? <p className="text-muted">Sin datos para este rango</p> : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={graficoDia}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="alquileres" fill="#6c63ff" name="Alquileres" radius={[4,4,0,0]}>
                <LabelList dataKey="alquileres" position="top" fontSize={11} />
              </Bar>
              <Line type="monotone" dataKey="tendencia" stroke="#e17055" strokeWidth={2} name="Tendencia" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          )}
        </div>
      )}

      {graficoActivo === 'ingresos' && (
        <div className="card">
          <h3>Ingresos por Día ($)</h3>
          {graficoIngresos.length === 0 ? <p className="text-muted">Sin datos para este rango</p> : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={graficoIngresos}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip formatter={(val) => `$${val.toLocaleString()}`} />
              <Bar dataKey="ingresos" fill="#00b894" name="Ingresos" radius={[4,4,0,0]}>
                <LabelList dataKey="ingresos" position="top" fontSize={11} formatter={(val) => `$${val}`} />
              </Bar>
              <Line type="monotone" dataKey="tendencia" stroke="#e17055" strokeWidth={2} name="Tendencia" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          )}
        </div>
      )}

      {graficoActivo === 'devoluciones' && (
        <div className="card">
          <h3>Devoluciones por Día</h3>
          {graficoDevoluciones.length === 0 ? <p className="text-muted">Sin datos para este rango</p> : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={graficoDevoluciones}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="devoluciones" fill="#fdcb6e" name="Devoluciones" radius={[4,4,0,0]}>
                <LabelList dataKey="devoluciones" position="top" fontSize={11} />
              </Bar>
              <Line type="monotone" dataKey="tendencia" stroke="#e17055" strokeWidth={2} name="Tendencia" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          )}
        </div>
      )}

      {graficoActivo === 'disfraces' && (
        <div className="card">
          <h3>Disfraces más Alquilados</h3>
          {disfraces.length === 0 ? <p className="text-muted">Sin datos para este rango</p> : (
          <ResponsiveContainer width="100%" height={Math.max(200, disfraces.length * 35)}>
            <BarChart data={disfraces} layout="vertical" margin={{ left: 20, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="value" position="right" fontSize={11} />
                {disfraces.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>
      )}

      {graficoActivo === 'colegios' && (
        <div className="card">
          <h3>Alquileres por Colegio</h3>
          {colegios.length === 0 ? <p className="text-muted">Sin datos para este rango</p> : (
          <ResponsiveContainer width="100%" height={Math.max(200, colegios.length * 35)}>
            <BarChart data={colegios} layout="vertical" margin={{ left: 20, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#6c63ff" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="value" position="right" fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>
      )}

      {graficoActivo === 'garantias' && garantiasPendientes.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Garantías Pendientes de Devolución</h3>
            <button onClick={exportarGarantias} className="btn btn-secondary">📥 Exportar CSV</button>
          </div>

          {(() => {
            const devueltas = garantiasPendientes.filter(g => g.garantiaDevuelta);
            const pendientes = garantiasPendientes.filter(g => !g.garantiaDevuelta);
            const sum = (arr, campo) => arr.reduce((s, g) => s + (campo === 'garantia' ? parseFloat(String(g[campo] || '0').replace(/[^0-9.,]/g, '').replace(',', '.')) || 0 : Number(g[campo]) || 0), 0);
            const secciones = [
              { label: '✅ Devueltas', data: devueltas },
              { label: '❌ Pendientes', data: pendientes },
              { label: '📊 Total General', data: garantiasPendientes },
            ];
            return (
              <div>
                <h4>Resumen</h4>
                <div className="table-wrapper">
                <table className="table">
                  <thead><tr><th></th><th>Cantidad</th><th>Total Garantía</th><th>Total Precio</th><th>Total Seña</th></tr></thead>
                  <tbody>
                    {secciones.map((s) => (
                      <tr key={s.label}>
                        <td><strong>{s.label}</strong></td>
                        <td>{s.data.length}</td>
                        <td>${sum(s.data, 'garantia').toLocaleString()}</td>
                        <td>${sum(s.data, 'precio').toLocaleString()}</td>
                        <td>${sum(s.data, 'seña').toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            );
          })()}

          {garantiasResumen.length > 0 && (
            <>
              <h4 style={{ marginTop: 20 }}>Totales por Día</h4>
              <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Fecha</th><th>Cantidad</th><th>Total Garantía</th><th>Total Precio</th><th>Total Seña</th></tr></thead>
                <tbody>
                  {garantiasResumen.map((r) => (
                    <tr key={r.fecha}>
                      <td>{r.fecha}</td>
                      <td>{r.cantidad}</td>
                      <td>${r.montoGar.toLocaleString()}</td>
                      <td>${r.montoPrecio.toLocaleString()}</td>
                      <td>${r.montoSena.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          )}

          <h4 style={{ marginTop: 20 }}>Detalle</h4>
          <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Apellido</th><th>Nombre</th><th>Garantía</th><th>Precio</th><th>Seña</th><th>Gar.</th><th>Estado</th><th>Fecha</th></tr></thead>
            <tbody>
              {garantiasPendientes.map((g) => (
                <tr key={g.id}>
                  <td>{g.apellido?.toUpperCase()}</td>
                  <td>{g.nombre ? g.nombre.charAt(0).toUpperCase() + g.nombre.slice(1) : ''}</td>
                  <td>{g.garantia}</td>
                  <td>${Number(g.precio).toLocaleString()}</td>
                  <td>${Number(g.seña).toLocaleString()}</td>
                  <td style={{ textAlign: 'center', fontSize: '1.2rem' }}>{g.garantiaDevuelta ? <span style={{ color: 'var(--success, green)' }}>✓</span> : <span style={{ color: 'var(--danger, red)' }}>✗</span>}</td>
                  <td><span className={`badge badge-${g.estado}`}>{g.estado}</span></td>
                  <td>{g.fecha || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {graficoActivo === 'garantias' && garantiasPendientes.length === 0 && (
        <div className="card">
          <h3>Garantías Pendientes de Devolución</h3>
          <p className="text-muted">No hay garantías pendientes para este rango</p>
        </div>
      )}

      {graficoActivo === 'buscar' && (
        <div className="card">
          <h3>Buscar Disfraz</h3>
          <div className="form-row">
            <div className="form-group">
              <input value={buscarDisfraz} onChange={(e) => setBuscarDisfraz(e.target.value)} placeholder="Escribí parte del nombre del disfraz..." style={{ width: '100%' }} />
            </div>
          </div>
          {buscarDisfraz.trim().length >= 2 && (() => {
            const q = buscarDisfraz.trim().toLowerCase();
            const resultados = [];
            const vistos = new Set();
            filtrados.forEach((a) => {
              (a.items || []).forEach((it) => {
                if ((it.nombre || '').toLowerCase().includes(q) && !vistos.has(a.id + it.nombre)) {
                  vistos.add(a.id + it.nombre);
                  resultados.push({
                    id: a.id,
                    alquilerId: a.id,
                    item: it.nombre,
                    talle: it.talle || '',
                    fotoUrl: it.fotoUrl || '',
                    cliente: a.clienteNombre,
                    telefono: a.clienteTelefonoPrincipal || a.clienteTelefono?.split(' / ')[0] || '',
                    fecha: a.fechaAlquiler,
                  });
                }
              });
            });
            resultados.sort((a, b) => a.item.localeCompare(b.item));
            return (
              <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Item</th><th>Foto</th><th>Cliente</th><th>Teléfono</th><th>Fecha</th></tr></thead>
                <tbody>
                  {resultados.map((r, i) => (
                    <tr key={r.alquilerId + i}>
                      <td>{r.item}{r.talle ? ` (${r.talle})` : ''}</td>
                      <td>{r.fotoUrl && !esDriveUrl(r.fotoUrl) ? <img src={r.fotoUrl} alt={r.item} className="thumb" style={{ cursor: 'pointer' }} onClick={() => setFotoAmpliada(r.fotoUrl)} /> : null}
                        {r.fotoUrl && esDriveUrl(r.fotoUrl) ? <img src={getDriveImageUrl(r.fotoUrl)} alt={r.item} className="thumb" style={{ cursor: 'pointer' }} onClick={() => setFotoAmpliada(r.fotoUrl)} /> : null}
                        {!r.fotoUrl ? <span className="text-muted">—</span> : null}
                      </td>
                      <td>{r.cliente}</td>
                      <td>{r.telefono ? <a href={`https://wa.me/54${r.telefono.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer">📞 {r.telefono}</a> : '-'}</td>
                      <td>{r.fecha || '-'}</td>
                    </tr>
                  ))}
                  {resultados.length === 0 && <tr><td colSpan={5} className="text-muted">Sin resultados</td></tr>}
                </tbody>
              </table>
              </div>
            );
          })()}
          {buscarDisfraz.trim().length < 2 && <p className="text-muted">Escribí al menos 2 caracteres para buscar</p>}
        </div>
      )}

      {graficoActivo === 'detalle' && (
        <div className="card">
          <h3>Detalle por Día</h3>
          <div className="table-wrapper">
          <table className="table">
            <thead><tr>
              <th className="sortable" onClick={() => handleDetSort('fecha')}>Fecha{detIcon('fecha')}</th>
              <th className="sortable" onClick={() => handleDetSort('cantidad')}>Alquileres{detIcon('cantidad')}</th>
              <th className="sortable" onClick={() => handleDetSort('garantias')}>Garantías{detIcon('garantias')}</th>
              <th className="sortable" onClick={() => handleDetSort('monto')}>Monto Total{detIcon('monto')}</th>
            </tr></thead>
            <tbody>
              {porDiaOrdenado.map((d) => (
                <tr key={d.fecha}>
                  <td>{d.fecha}</td>
                  <td>{d.cantidad}</td>
                  <td>{d.garantias}</td>
                  <td>${d.monto?.toLocaleString()}</td>
                </tr>
              ))}
              {porDia.length === 0 && <tr><td colSpan={4} className="text-muted">Sin datos para este rango</td></tr>}
            </tbody>
          </table>
          </div>
        </div>
      )}
      <FotoModal src={fotoAmpliada} onClose={() => setFotoAmpliada(null)} />
    </div>
  );
}
