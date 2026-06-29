import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { ComposedChart, BarChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList, Cell } from 'recharts';

const COLORS = ['#6c63ff', '#ff6584', '#00b894', '#fdcb6e', '#e17055', '#0984e3', '#a29bfe', '#fd79a8', '#00cec9', '#e84393'];

const GRAFICOS = [
  { key: 'alquileres', label: 'Alquileres x Día' },
  { key: 'ingresos', label: 'Ingresos x Día' },
  { key: 'devoluciones', label: 'Devoluciones x Día' },
  { key: 'disfraces', label: 'Disfraces' },
  { key: 'colegios', label: 'Colegios' },
  { key: 'garantias', label: 'Garantías Pendientes' },
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

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'alquileres'));
      setAlquileres(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    })();
  }, []);

  const filtrados = useMemo(() => {
    let arr = alquileres;
    if (fechaDesde) arr = arr.filter((a) => (a.fechaAlquiler || '') >= fechaDesde);
    if (fechaHasta) arr = arr.filter((a) => (a.fechaAlquiler || '') <= fechaHasta);
    return arr;
  }, [alquileres, fechaDesde, fechaHasta]);

  const { totalPrecio, totalSeña, saldoPendiente, totalAlquileres, porDia, graficoDia, graficoIngresos, graficoDevoluciones, disfraces, garantiasPendientes, colegios } = useMemo(() => {
    const total = filtrados.length;
    let precio = 0, seña = 0;
    const dias = {}, ingresosPorDia = {}, devolucionesPorDia = {}, conteoCol = {};

    filtrados.forEach((a) => {
      precio += Number(a.precio) || 0;
      seña += Number(a.seña) || 0;
      if (a.fechaAlquiler) {
        dias[a.fechaAlquiler] = (dias[a.fechaAlquiler] || 0) + 1;
        ingresosPorDia[a.fechaAlquiler] = (ingresosPorDia[a.fechaAlquiler] || 0) + (Number(a.precio) || 0);
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
      .filter((a) => a.garantia && a.garantia !== 'No' && a.garantia !== 'Sin' && a.garantia !== '' && !a.garantiaDevuelta)
      .map((a) => ({ id: a.id, cliente: a.clienteNombre, garantia: a.garantia, fecha: a.fechaAlquiler }));

    const fechas = Object.keys(dias).sort();
    const diaArr = fechas.map((f) => ({ fecha: f, alquileres: dias[f] }));
    const ingArr = fechas.map((f) => ({ fecha: f, ingresos: ingresosPorDia[f] }));
    const diaArrTend = calcMediaMovil(diaArr, 'alquileres');
    const ingArrTend = calcMediaMovil(ingArr, 'ingresos');
    const porDiaArr = fechas.map((f) => ({ fecha: f, cantidad: dias[f], monto: ingresosPorDia[f] })).reverse();

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

    return {
      totalPrecio: precio, totalSeña: seña, saldoPendiente: precio - seña,
      totalAlquileres: total, porDia: porDiaArr,
      graficoDia: diaArrTend, graficoIngresos: ingArrTend, graficoDevoluciones: devArrTend,
      disfraces: disfArr, garantiasPendientes: pend, colegios: colArr
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
        <div className="stat-card warn"><span className="stat-num">{garantiasPendientes.length}</span>Garantías x Devolver</div>
      </div>

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
          <h3>Garantías Pendientes de Devolución</h3>
          <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Cliente</th><th>Garantía</th><th>Fecha</th></tr></thead>
            <tbody>
              {garantiasPendientes.map((g) => (
                <tr key={g.id}>
                  <td>{g.cliente}</td>
                  <td>{g.garantia}</td>
                  <td>{g.fecha}</td>
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

      {graficoActivo === 'detalle' && (
        <div className="card">
          <h3>Detalle por Día</h3>
          <div className="table-wrapper">
          <table className="table">
            <thead><tr>
              <th className="sortable" onClick={() => handleDetSort('fecha')}>Fecha{detIcon('fecha')}</th>
              <th className="sortable" onClick={() => handleDetSort('cantidad')}>Alquileres{detIcon('cantidad')}</th>
              <th className="sortable" onClick={() => handleDetSort('monto')}>Monto Total{detIcon('monto')}</th>
            </tr></thead>
            <tbody>
              {porDiaOrdenado.map((d) => (
                <tr key={d.fecha}>
                  <td>{d.fecha}</td>
                  <td>{d.cantidad}</td>
                  <td>${d.monto?.toLocaleString()}</td>
                </tr>
              ))}
              {porDia.length === 0 && <tr><td colSpan={3} className="text-muted">Sin datos para este rango</td></tr>}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
