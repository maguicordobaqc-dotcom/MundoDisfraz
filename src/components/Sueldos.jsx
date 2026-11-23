import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

const TABS = ['📱 WhatsApp', '⏰ Carga Horaria', '📊 Resumen', '💰 Descuentos', '📋 Pagos', '🎁 Aguinaldo'];
const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

function pad2(n) { return String(n).padStart(2, '0'); }

function formatHours(horas) {
  const h = Math.floor(Math.abs(horas));
  const m = Math.round((Math.abs(horas) - h) * 60);
  return `${h}h ${m}m`;
}

function parseHHMM(s) {
  if (!s) return 0;
  const [h, m] = s.split(':').map(Number);
  return h + m / 60;
}

function minsToStr(mins) {
  if (mins == null || isNaN(mins)) return '';
  return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
}

function strToMins(s) {
  if (!s) return null;
  const [h, m] = s.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

// ─── WhatsApp parser ────────────────────────────────────────────────
function parseWhatsApp(text, dateFormat) {
  const lines = text.split('\n');
  // dateFormat: 'DMY' (DD/MM/YY) or 'MDY' (MM/DD/YY)
  const days = {}; // key: "YYYY-MM-DD"

  // Patterns for common WhatsApp export formats
  // Group: day, month, year, hour, min, ampm, sender, msg
  const patterns = [
    // 1: "13/6/26, 8:24 a. m. - Nelly: mensaje"
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})[,.\s]+(\d{1,2}):(\d{2})(?::\d{2})?\s*([aApP][\.\s]*[mM][\.\s]*)\s*[-:]\s*(.+?):\s*(.*)$/,
    // 2: "[13/6/26, 8:24:00 AM] Nelly: mensaje"
    /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4})[,.\s]+(\d{1,2}):(\d{2})(?::\d{2})?\s*([aApP][\.\s]*[mM][\.\s]*)\]\s*(.+?):\s*(.*)$/,
  ];

  function parseAmPm(s) {
    const clean = s.replace(/[\u202f\u00a0.]/g, '').trim().toLowerCase();
    return clean.startsWith('p') ? 'PM' : clean.startsWith('a') ? 'AM' : null;
  }

  function getKey(d, m, y) {
    if (dateFormat === 'MDY') [d, m] = [m, d];
    d = Number(d); m = Number(m);
    let yyyy = Number(y);
    if (yyyy < 100) yyyy += 2000;
    return `${yyyy}-${pad2(m)}-${pad2(d)}`;
  }

  function addIn(key, mins, conf) {
    if (!days[key]) days[key] = { fecha: key, entrada: null, salida: null, confianza: 'baja', esEnfermedad: false, notas: '' };
    const cur = days[key];
    if (cur.entrada == null || (cur.confianza === 'baja' && conf !== 'baja')) {
      cur.entrada = mins;
      if (conf !== 'baja') cur.confianza = conf;
    }
  }

  function addOut(key, mins, conf) {
    if (!days[key]) days[key] = { fecha: key, entrada: null, salida: null, confianza: 'baja', esEnfermedad: false, notas: '' };
    const cur = days[key];
    if (cur.salida == null || (cur.confianza === 'baja' && conf !== 'baja')) {
      cur.salida = mins;
      if (conf !== 'baja') cur.confianza = conf;
    }
  }

  function setExact(key, entrada, salida) {
    days[key] = { fecha: key, entrada, salida, confianza: 'alta', esEnfermedad: false, notas: '' };
  }

  for (const line of lines) {
    let match = null, patIdx = -1;
    for (let i = 0; i < patterns.length; i++) {
      const m = line.match(patterns[i]);
      if (m) { match = m; patIdx = i; break; }
    }
    if (!match) continue;

    let [, d, me, a, hh, mm, ampmRaw, sender, msg] = match;
    const key = getKey(d, me, a);
    const ts = parseAmPm(ampmRaw);
    if (!ts) continue;

    let hour = Number(hh), min = Number(mm);
    if (ts === 'PM' && hour !== 12) hour += 12;
    if (ts === 'AM' && hour === 12) hour = 0;
    const totalMins = hour * 60 + min;

    const ml = (msg || '').trim().toLocaleLowerCase();
    const sc = (sender || '').trim().toLocaleLowerCase().replace('\u200e', '');
    const isMagui = sc.includes('magui');

    if (isMagui) {
      // "8.27 a 16.38"
      let mc = ml.match(/(\d{1,2})[.](\d{1,2})\s+a\s+(\d{1,2})[.](\d{1,2})/);
      if (mc) {
        setExact(key, Number(mc[1]) * 60 + Number(mc[2]), Number(mc[3]) * 60 + Number(mc[4]));
        continue;
      }
      // "8 a 16.21"
      mc = ml.match(/(\d{1,2})\s+a\s+(\d{1,2})[.](\d{1,2})/);
      if (mc) {
        setExact(key, Number(mc[1]) * 60, Number(mc[2]) * 60 + Number(mc[3]));
        continue;
      }
      // "y llegaste 8.40"
      mc = ml.match(/llegaste\s+(\d{1,2})[.](\d{1,2})/);
      if (mc) {
        addIn(key, Number(mc[1]) * 60 + Number(mc[2]), 'media');
        continue;
      }
      // "Lunes te fuiste a las 16.10"
      mc = ml.match(/(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)\s+te\s+fuiste\s+a\s+las\s+(\d{1,2})[.](\d{1,2})/);
      if (mc) {
        addOut(key, Number(mc[2]) * 60 + Number(mc[3]), 'media');
        continue;
      }
    }

    // Nelly messages
    if (sc.includes('nelly')) {
      // "llegue 8 y 30"
      let mc = ml.match(/llegu[ée]\s+(\d{1,2})\s+y\s+(\d{1,2})/);
      if (mc) {
        addIn(key, Number(mc[1]) * 60 + Number(mc[2]), 'media');
        continue;
      }
      if (/\bllegu[ée]\b/.test(ml)) {
        addIn(key, totalMins, 'baja');
        continue;
      }
      if (ml.includes('estoy afuera')) {
        addIn(key, totalMins, 'baja');
        continue;
      }
      if (ml.includes('me retiro')) {
        addOut(key, totalMins, 'baja');
        continue;
      }
      const bare = ml.replace(/[.!]+$/, '').trim();
      if (bare === 'señora' || bare === 'señora ' || bare === '') {
        if (hour >= 7 && hour <= 9) {
          addIn(key, totalMins, 'baja');
        }
      }
    }
  }

  // Estimate 8h for days with only arrival
  for (const k of Object.keys(days)) {
    const info = days[k];
    if (info.entrada != null && info.salida == null) {
      info.salida = info.entrada + 480;
      if (info.confianza === 'baja') info.confianza = 'media';
    }
  }

  // Sort by date
  return Object.keys(days).sort().map(k => days[k]);
}

// ─── Component ───────────────────────────────────────────────────────
export default function Sueldos() {
  const [tab, setTab] = useState(0);

  // Config
  const [config, setConfig] = useState({ tasaPorHora: 3600.66, boletoMonto: 17000, antiguedadPorcentaje: 1, antiguedadAnios: 2, fechaIngreso: '2024-01-01' });

  // Horas (loaded from Firestore)
  const [horas, setHoras] = useState([]);
  const [mesHoras, setMesHoras] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  });

  // Manual hour form
  const [hForm, setHForm] = useState({ fecha: '', entrada: '', salida: '', notas: '' });
  const [editHId, setEditHId] = useState(null);

  // WhatsApp import
  const fileInputRef = useRef(null);
  const [dateFormat, setDateFormat] = useState('DMY');
  const [parsedDays, setParsedDays] = useState([]);
  const [importedMes, setImportedMes] = useState('');
  const [fileName, setFileName] = useState('');

  // Descuentos
  const [descuentos, setDescuentos] = useState([]);
  const [dForm, setDForm] = useState({ nombre: '', total: '', cuotas: '6', mesInicio: '' });
  const [showDForm, setShowDForm] = useState(false);

  // Pagos
  const [pagos, setPagos] = useState([]);
  const [pForm, setPForm] = useState({ fecha: '', monto: '', tipo: 'sueldo', mesCorrespondiente: '', nota: '' });
  const [showPForm, setShowPForm] = useState(false);

  // Messages
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };
  const flashe = (m) => { setErr(m); setTimeout(() => setErr(''), 5000); };

  // ─── Load config ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'empleada_config'));
        if (!snap.empty) {
          setConfig(c => ({ ...c, ...snap.docs[0].data() }));
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // ─── Load horas ───────────────────────────────────────────────────
  const cargarHoras = async (monthKey) => {
    try {
      const q = query(collection(db, 'empleada_horas'), where('monthKey', '==', monthKey), orderBy('fecha', 'asc'));
      const snap = await getDocs(q);
      setHoras(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      setHoras([]);
    }
  };
  useEffect(() => { cargarHoras(mesHoras); }, [mesHoras]);

  // ─── WhatsApp file handling ───────────────────────────────────────
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const days = parseWhatsApp(ev.target.result, dateFormat);
      if (days.length === 0) {
        flashe('No se encontraron registros de horas. Probá cambiando el formato de fecha.');
        return;
      }
      // Detect month from first entry
      if (days.length > 0) {
        setImportedMes(days[0].fecha.slice(0, 7));
      }
      setParsedDays(days);
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Re-parse when format changes
  useEffect(() => {
    if (fileName && fileInputRef.current?.files?.[0]) {
      const file = fileInputRef.current.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        const days = parseWhatsApp(ev.target.result, dateFormat);
        if (days.length > 0) setImportedMes(days[0].fecha.slice(0, 7));
        setParsedDays(days);
      };
      reader.readAsText(file, 'UTF-8');
    }
  }, [dateFormat]);

  const updateParsedDay = (idx, field, value) => {
    setParsedDays(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const removeParsedDay = (idx) => {
    setParsedDays(prev => prev.filter((_, i) => i !== idx));
  };

  const addParsedDay = () => {
    const today = new Date().toISOString().slice(0, 10);
    setParsedDays(prev => [...prev, { fecha: today, entrada: 480, salida: 960, confianza: 'manual', esEnfermedad: false, notas: '' }]);
  };

  const guardarTodos = async () => {
    if (parsedDays.length === 0) { flashe('No hay días para guardar'); return; }
    try {
      for (const day of parsedDays) {
        const entrada = day.entrada;
        const salida = day.salida;
        if (entrada == null || salida == null) continue;
        const horas = (salida - entrada) / 60;
        const monthKey = day.fecha.slice(0, 7);
        await addDoc(collection(db, 'empleada_horas'), {
          fecha: day.fecha,
          entrada: minsToStr(entrada),
          salida: minsToStr(salida),
          horas,
          notas: day.notas || (day.esEnfermedad ? 'Enferma con certificado' : ''),
          monthKey,
          confianza: day.confianza || 'manual',
          esEnfermedad: !!day.esEnfermedad,
          createdAt: Timestamp.now(),
        });
      }
      flash(`${parsedDays.length} días guardados correctamente`);
      setParsedDays([]);
      setFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      // Reload the month we just imported
      if (importedMes) setMesHoras(importedMes);
    } catch (e) {
      flashe('Error al guardar: ' + e.message);
    }
  };

  // ─── Manual hour CRUD ─────────────────────────────────────────────
  const guardarHora = async () => {
    if (!hForm.fecha || !hForm.entrada || !hForm.salida) { flashe('Completá fecha, entrada y salida'); return; }
    try {
      const horas = parseHHMM(hForm.salida) - parseHHMM(hForm.entrada);
      if (horas <= 0) { flashe('La salida debe ser después de la entrada'); return; }
      const data = {
        fecha: hForm.fecha, entrada: hForm.entrada, salida: hForm.salida, horas,
        notas: hForm.notas || '', monthKey: mesHoras, createdAt: Timestamp.now(),
      };
      if (editHId) {
        await updateDoc(doc(db, 'empleada_horas', editHId), data);
        flash('Hora actualizada');
      } else {
        await addDoc(collection(db, 'empleada_horas'), data);
        flash('Hora cargada');
      }
      setHForm({ fecha: '', entrada: '', salida: '', notas: '' });
      setEditHId(null);
      cargarHoras(mesHoras);
    } catch (e) { flashe('Error: ' + e.message); }
  };

  const editarHora = (h) => {
    setHForm({ fecha: h.fecha, entrada: h.entrada, salida: h.salida, notas: h.notas || '' });
    setEditHId(h.id);
  };

  const eliminarHora = async (id) => {
    if (!window.confirm('¿Eliminar este registro?')) return;
    await deleteDoc(doc(db, 'empleada_horas', id));
    cargarHoras(mesHoras);
    flash('Registro eliminado');
  };

  // ─── Descuentos ───────────────────────────────────────────────────
  const cargarDescuentos = async () => {
    const q = query(collection(db, 'empleada_descuentos'), where('activo', '==', true), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    setDescuentos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };
  useEffect(() => { cargarDescuentos(); }, []);

  const agregarDescuento = async () => {
    if (!dForm.nombre || !dForm.total || !dForm.cuotas) { flashe('Completá todos los campos'); return; }
    const total = Number(dForm.total);
    const cuotas = Number(dForm.cuotas);
    try {
      await addDoc(collection(db, 'empleada_descuentos'), {
        nombre: dForm.nombre, total, cuotas, cuotasRestantes: cuotas,
        valorCuota: Math.round(total / cuotas), mesInicio: dForm.mesInicio || mesHoras,
        activo: true, createdAt: Timestamp.now(),
      });
      setDForm({ nombre: '', total: '', cuotas: '6', mesInicio: '' });
      setShowDForm(false);
      cargarDescuentos();
      flash('Descuento agregado');
    } catch (e) { flashe('Error: ' + e.message); }
  };

  const pagarCuota = async (d) => {
    const res = window.confirm(`¿Pagar 1 cuota de "${d.nombre}" ($${d.valorCuota.toLocaleString()})?`);
    if (!res) return;
    try {
      const rest = d.cuotasRestantes - 1;
      await updateDoc(doc(db, 'empleada_descuentos', d.id), { cuotasRestantes: rest, activo: rest > 0 });
      await addDoc(collection(db, 'empleada_pagos'), {
        fecha: new Date().toISOString().slice(0, 10), monto: d.valorCuota, tipo: 'cuota_descuento',
        mesCorrespondiente: mesHoras, descuentoId: d.id,
        nota: `Cuota ${d.cuotas - rest}/${d.cuotas} - ${d.nombre}`, createdAt: Timestamp.now(),
      });
      cargarDescuentos();
      cargarPagos();
      flash('Cuota registrada');
    } catch (e) { flashe('Error: ' + e.message); }
  };

  // ─── Pagos ────────────────────────────────────────────────────────
  const cargarPagos = async () => {
    const q = query(collection(db, 'empleada_pagos'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    setPagos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };
  useEffect(() => { cargarPagos(); }, []);

  const agregarPago = async () => {
    if (!pForm.fecha || !pForm.monto) { flashe('Completá fecha y monto'); return; }
    try {
      await addDoc(collection(db, 'empleada_pagos'), {
        fecha: pForm.fecha, monto: Number(pForm.monto), tipo: pForm.tipo,
        mesCorrespondiente: pForm.mesCorrespondiente || mesHoras, nota: pForm.nota || '',
        createdAt: Timestamp.now(),
      });
      setPForm({ fecha: '', monto: '', tipo: 'sueldo', mesCorrespondiente: '', nota: '' });
      setShowPForm(false);
      cargarPagos();
      flash('Pago registrado');
    } catch (e) { flashe('Error: ' + e.message); }
  };

  // ─── Month calculations ───────────────────────────────────────────
  const totalHoras = horas.reduce((s, h) => s + (h.horas || 0), 0);
  const sueldoBase = totalHoras * config.tasaPorHora;
  const antiguedadMonto = sueldoBase * (config.antiguedadPorcentaje || 1) / 100 * (config.antiguedadAnios || 0);
  const boletoTotal = config.boletoMonto || 0;
  const bruto = sueldoBase + antiguedadMonto + boletoTotal;

  const descuentosConCuotas = descuentos.filter(d => d.cuotasRestantes > 0);
  const totalCuotasMes = descuentosConCuotas.reduce((s, d) => s + (d.valorCuota || 0), 0);

  const pagosDelMes = pagos.filter(p => p.mesCorrespondiente === mesHoras);
  const totalPagadoMes = pagosDelMes.reduce((s, p) => s + (p.monto || 0), 0);

  const neto = bruto - totalCuotasMes;
  const saldoPendiente = neto - totalPagadoMes;

  // ─── Aguinaldo ────────────────────────────────────────────────────
  const [semestreAguinaldo, setSemestreAguinaldo] = useState(() => {
    const d = new Date();
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    return m <= 6 ? `${y}-S1` : `${y}-S2`;
  });

  const obtenerMesesSemestre = (s) => {
    const [y, si] = s.split('-S');
    const num = Number(si);
    const inicio = num === 1 ? 1 : 7;
    return Array.from({ length: 6 }, (_, i) => `${y}-${pad2(inicio + i)}`);
  };

  const mesesSemestre = obtenerMesesSemestre(semestreAguinaldo);
  const pagosSemestre = pagos.filter(p => p.tipo === 'sueldo' && mesesSemestre.includes(p.mesCorrespondiente));
  const mejorMesAguinaldo = pagosSemestre.reduce((max, p) => Math.max(max, p.monto || 0), 0);
  const aguinaldoCalculado = mejorMesAguinaldo ? mejorMesAguinaldo / 2 : 0;
  const aguinaldoPagado = pagos.filter(p => p.tipo === 'aguinaldo' && String(p.mesCorrespondiente).startsWith(semestreAguinaldo.split('-S')[0]));

  // ─── Render helpers ──────────────────────────────────────────────
  function renderConfianza(c) {
    const map = { alta: { label: 'OK', cls: 'badge-entregado' }, media: { label: '~', cls: 'badge-pendiente' }, baja: { label: '?', cls: 'badge-retirado' } };
    const m = map[c] || map.baja;
    return <span className={`badge ${m.cls}`}>{m.label}</span>;
  }

  function renderParsedRow(day, idx) {
    const entrada = day.entrada;
    const salida = day.salida;
    const diff = (entrada != null && salida != null) ? salida - entrada : null;
    const dt = day.fecha ? new Date(day.fecha + 'T12:00:00') : null;
    const diaSemana = dt ? DIAS[dt.getDay()] : '';

    return (
      <tr key={idx}>
        <td style={{ whiteSpace: 'nowrap' }}>
          <input type="date" value={day.fecha} onChange={e => updateParsedDay(idx, 'fecha', e.target.value)}
            style={{ width: 140, padding: '4px 6px', fontSize: '0.85rem' }} />
          <span className="text-muted" style={{ marginLeft: 4 }}>{diaSemana}</span>
        </td>
        <td>
          <input type="time" value={minsToStr(entrada)} onChange={e => updateParsedDay(idx, 'entrada', strToMins(e.target.value))}
            style={{ width: 100, padding: '4px 6px', fontSize: '0.85rem' }} />
        </td>
        <td>
          <input type="time" value={minsToStr(salida)} onChange={e => updateParsedDay(idx, 'salida', strToMins(e.target.value))}
            style={{ width: 100, padding: '4px 6px', fontSize: '0.85rem' }} />
        </td>
        <td>{diff != null ? <strong>{formatHours(diff / 60)}</strong> : '-'}</td>
        <td>{renderConfianza(day.confianza)}</td>
        <td>
          <label className="checkbox-label" style={{ justifyContent: 'center' }}>
            <input type="checkbox" checked={!!day.esEnfermedad} onChange={e => updateParsedDay(idx, 'esEnfermedad', e.target.checked)} />
          </label>
        </td>
        <td>
          <input value={day.notas || ''} onChange={e => updateParsedDay(idx, 'notas', e.target.value)}
            style={{ width: 120, padding: '4px 6px', fontSize: '0.85rem' }} />
        </td>
        <td>
          <button className="btn btn-small btn-danger" onClick={() => removeParsedDay(idx)}>✕</button>
        </td>
      </tr>
    );
  }

  // ─── JSX ─────────────────────────────────────────────────────────
  return (
    <div className="sueldos">
      <h2>Sueldos - Nelly</h2>
      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      <div className="tabs">
        {TABS.map((t, i) => (
          <button key={t} className={`tab${tab === i ? ' active' : ''}`} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      {/* ══════════════════ TAB 0: WhatsApp Import ══════════════════ */}
      {tab === 0 && (
        <div>
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Importar desde WhatsApp</h3>
            <p className="text-muted" style={{ marginBottom: 12 }}>
              Subí el archivo .txt exportado de WhatsApp para extraer las horas de entrada y salida automáticamente.
            </p>
            <div className="form-row" style={{ alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: '0 0 auto', minWidth: 200 }}>
                <label>Formato de fecha en el archivo</label>
                <select value={dateFormat} onChange={e => setDateFormat(e.target.value)}>
                  <option value="DMY">DD/MM/YY (Argentina, Europa)</option>
                  <option value="MDY">MM/DD/YY (EE.UU.)</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Archivo .txt de WhatsApp</label>
                <input type="file" accept=".txt" ref={fileInputRef} onChange={handleFile} />
              </div>
            </div>
            {fileName && <p className="text-muted" style={{ fontSize: '0.85rem' }}>Archivo: {fileName}</p>}
          </div>

          {parsedDays.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>
                  Días detectados: {parsedDays.length}
                  {importedMes && <span className="text-muted" style={{ fontWeight: 'normal', marginLeft: 8 }}>({importedMes})</span>}
                </h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary" onClick={addParsedDay}>+ Agregar día</button>
                  <button className="btn btn-primary" onClick={guardarTodos}>
                    Guardar todo ({parsedDays.length} días)
                  </button>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Fecha</th><th>Entrada</th><th>Salida</th><th>Horas</th>
                      <th>Conf.</th><th>Enferma</th><th>Notas</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedDays.map((day, i) => renderParsedRow(day, i))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ TAB 1: Carga Horaria ══════════════════ */}
      {tab === 1 && (
        <div className="card">
          <div className="form-row" style={{ marginBottom: 16, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: '0 0 auto' }}>
              <label>Mes</label>
              <input type="month" value={mesHoras} onChange={e => setMesHoras(e.target.value)} />
            </div>
          </div>

          <div className="sueldos-hora-form">
            <div className="form-row">
              <div className="form-group">
                <label>Fecha</label>
                <input type="date" value={hForm.fecha} onChange={e => setHForm({ ...hForm, fecha: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Entrada</label>
                <input type="time" value={hForm.entrada} onChange={e => setHForm({ ...hForm, entrada: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Salida</label>
                <input type="time" value={hForm.salida} onChange={e => setHForm({ ...hForm, salida: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Notas</label>
                <input value={hForm.notas} onChange={e => setHForm({ ...hForm, notas: e.target.value })} placeholder="ej: enferma, boleto" />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="btn btn-primary" onClick={guardarHora}>{editHId ? 'Actualizar' : '+ Cargar'}</button>
                {editHId && <button className="btn btn-secondary" style={{ marginLeft: 8 }} onClick={() => { setEditHId(null); setHForm({ fecha: '', entrada: '', salida: '', notas: '' }); }}>Cancelar</button>}
              </div>
            </div>
            {hForm.entrada && hForm.salida && (
              <div className="text-muted" style={{ marginTop: 4 }}>
                Horas: {formatHours(parseHHMM(hForm.salida) - parseHHMM(hForm.entrada))}
              </div>
            )}
          </div>

          <div className="table-wrapper" style={{ marginTop: 16 }}>
            <table className="table">
              <thead>
                <tr><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Horas</th><th>Notas</th><th></th></tr>
              </thead>
              <tbody>
                {horas.map(h => (
                  <tr key={h.id}>
                    <td>{h.fecha}</td>
                    <td>{h.entrada}</td>
                    <td>{h.salida}</td>
                    <td><strong>{formatHours(h.horas)}</strong></td>
                    <td>{h.notas || '-'}</td>
                    <td>
                      <button className="btn btn-small btn-secondary" onClick={() => editarHora(h)}>✏️</button>
                      <button className="btn btn-small btn-danger" style={{ marginLeft: 4 }} onClick={() => eliminarHora(h.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
                {horas.length === 0 && (
                  <tr><td colSpan="6" className="text-muted" style={{ textAlign: 'center', padding: 24 }}>Sin registros este mes</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan="3">Total</td>
                  <td>{formatHours(totalHoras)}</td>
                  <td colSpan="2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════ TAB 2: Resumen Mensual ══════════════════ */}
      {tab === 2 && (
        <div className="card">
          <div className="form-row" style={{ marginBottom: 16, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: '0 0 auto' }}>
              <label>Mes</label>
              <input type="month" value={mesHoras} onChange={e => setMesHoras(e.target.value)} />
            </div>
          </div>

          <div className="sueldos-resumen">
            <div className="resumen-item">
              <span>Horas trabajadas</span>
              <span>{formatHours(totalHoras)}</span>
            </div>
            <div className="resumen-item">
              <span>Valor hora (AFIP Cat.5)</span>
              <span>${config.tasaPorHora.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="resumen-item total-row">
              <span>Sueldo base</span>
              <span>${sueldoBase.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="resumen-item">
              <span>Antigüedad ({config.antiguedadPorcentaje || 1}% × {config.antiguedadAnios || 0} años)</span>
              <span>${antiguedadMonto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="resumen-item">
              <span>Boleto (transporte)</span>
              <span>${boletoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="resumen-item grand-total">
              <span>Sueldo Bruto</span>
              <span>${bruto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <hr />
            <div className="resumen-item warn-total">
              <span>Descuentos del mes ({descuentosConCuotas.length} activos)</span>
              <span>-${totalCuotasMes.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            {descuentosConCuotas.map(d => (
              <div key={d.id} className="resumen-item" style={{ fontSize: '0.85rem', paddingLeft: 24 }}>
                <span>{d.nombre} (cuota {d.cuotas - d.cuotasRestantes + 1}/{d.cuotas})</span>
                <span>-${d.valorCuota.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
            <div className="resumen-item grand-total">
              <span>Saldo a pagar</span>
              <span>${neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <hr />
            <div className="resumen-item">
              <span>Pagado hasta ahora</span>
              <span>${totalPagadoMes.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className={`resumen-item ${saldoPendiente <= 0 ? '' : 'warn-total'}`}>
              <span><strong>Saldo pendiente</strong></span>
              <span><strong>${saldoPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ TAB 3: Descuentos ══════════════════ */}
      {tab === 3 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Planes de descuento activos</h3>
            <button className="btn btn-primary" onClick={() => setShowDForm(!showDForm)}>
              {showDForm ? 'Cancelar' : '+ Nuevo descuento'}
            </button>
          </div>

          {showDForm && (
            <div style={{ marginBottom: 16, padding: 16, background: 'var(--bg)', borderRadius: 8 }}>
              <div className="form-row">
                <div className="form-group">
                  <label>Nombre</label>
                  <input value={dForm.nombre} onChange={e => setDForm({ ...dForm, nombre: e.target.value })} placeholder="Ej: Préstamo" />
                </div>
                <div className="form-group">
                  <label>Total $</label>
                  <input type="number" value={dForm.total} onChange={e => setDForm({ ...dForm, total: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Cuotas</label>
                  <input type="number" value={dForm.cuotas} onChange={e => setDForm({ ...dForm, cuotas: e.target.value })} min="1" />
                </div>
                <div className="form-group">
                  <label>Mes inicio</label>
                  <input type="month" value={dForm.mesInicio} onChange={e => setDForm({ ...dForm, mesInicio: e.target.value })} />
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={agregarDescuento}>Guardar</button>
                </div>
              </div>
              {dForm.total && dForm.cuotas && (
                <div className="text-muted">Valor por cuota: ${(Number(dForm.total) / Number(dForm.cuotas)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
              )}
            </div>
          )}

          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Nombre</th><th>Total</th><th>Cuotas</th><th>Restantes</th><th>Valor cuota</th><th></th></tr>
              </thead>
              <tbody>
                {descuentos.map(d => (
                  <tr key={d.id}>
                    <td>{d.nombre}</td>
                    <td>${d.total.toLocaleString('es-AR')}</td>
                    <td>{d.cuotas}</td>
                    <td>{d.cuotasRestantes}</td>
                    <td>${(d.valorCuota || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td>
                      {d.cuotasRestantes > 0 && (
                        <button className="btn btn-small btn-primary" onClick={() => pagarCuota(d)}>Pagar cuota</button>
                      )}
                      {d.cuotasRestantes === 0 && <span className="badge badge-entregado">Pagado</span>}
                    </td>
                  </tr>
                ))}
                {descuentos.length === 0 && (
                  <tr><td colSpan="6" className="text-muted" style={{ textAlign: 'center', padding: 24 }}>Sin descuentos activos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════ TAB 4: Pagos ══════════════════ */}
      {tab === 4 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Historial de pagos</h3>
            <button className="btn btn-primary" onClick={() => setShowPForm(!showPForm)}>
              {showPForm ? 'Cancelar' : '+ Registrar pago'}
            </button>
          </div>

          {showPForm && (
            <div style={{ marginBottom: 16, padding: 16, background: 'var(--bg)', borderRadius: 8 }}>
              <div className="form-row">
                <div className="form-group">
                  <label>Fecha</label>
                  <input type="date" value={pForm.fecha} onChange={e => setPForm({ ...pForm, fecha: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Monto $</label>
                  <input type="number" value={pForm.monto} onChange={e => setPForm({ ...pForm, monto: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Tipo</label>
                  <select value={pForm.tipo} onChange={e => setPForm({ ...pForm, tipo: e.target.value })}>
                    <option value="sueldo">Sueldo</option>
                    <option value="adelanto">Adelanto</option>
                    <option value="cuota_descuento">Cuota descuento</option>
                    <option value="aguinaldo">Aguinaldo</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Mes correspondiente</label>
                  <input type="month" value={pForm.mesCorrespondiente} onChange={e => setPForm({ ...pForm, mesCorrespondiente: e.target.value })} />
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={agregarPago}>Guardar</button>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Nota (opcional)</label>
                <input value={pForm.nota} onChange={e => setPForm({ ...pForm, nota: e.target.value })} placeholder="Detalle del pago" />
              </div>
            </div>
          )}

          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Fecha</th><th>Monto</th><th>Tipo</th><th>Mes</th><th>Nota</th></tr>
              </thead>
              <tbody>
                {pagos.map(p => (
                  <tr key={p.id}>
                    <td>{p.fecha}</td>
                    <td><strong>${(p.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong></td>
                    <td><span className={`badge badge-${p.tipo === 'sueldo' ? 'entregado' : p.tipo === 'adelanto' ? 'pendiente' : 'retirado'}`}>{p.tipo}</span></td>
                    <td>{p.mesCorrespondiente || '-'}</td>
                    <td>{p.nota || '-'}</td>
                  </tr>
                ))}
                {pagos.length === 0 && (
                  <tr><td colSpan="5" className="text-muted" style={{ textAlign: 'center', padding: 24 }}>Sin pagos registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="sueldos-resumen" style={{ marginTop: 16 }}>
            <div className="resumen-item grand-total">
              <span>Total pagado (todos los meses)</span>
              <span>${pagos.reduce((s, p) => s + (p.monto || 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ TAB 5: Aguinaldo ══════════════════ */}
      {tab === 5 && (
        <div className="card">
          <div className="form-row" style={{ marginBottom: 16, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: '0 0 auto' }}>
              <label>Semestre</label>
              <select value={semestreAguinaldo} onChange={e => setSemestreAguinaldo(e.target.value)}>
                <option value={`${new Date().getFullYear()}-S1`}>{new Date().getFullYear()} - 1er Semestre</option>
                <option value={`${new Date().getFullYear()}-S2`}>{new Date().getFullYear()} - 2do Semestre</option>
                <option value={`${new Date().getFullYear() - 1}-S1`}>{new Date().getFullYear() - 1} - 1er Semestre</option>
                <option value={`${new Date().getFullYear() - 1}-S2`}>{new Date().getFullYear() - 1} - 2do Semestre</option>
              </select>
            </div>
          </div>

          <div className="table-wrapper" style={{ marginBottom: 16 }}>
            <table className="table">
              <thead>
                <tr><th>Mes</th><th>Sueldo pagado</th></tr>
              </thead>
              <tbody>
                {mesesSemestre.map(m => {
                  const p = pagosSemestre.filter(pg => pg.mesCorrespondiente === m);
                  const total = p.reduce((s, pg) => s + (pg.monto || 0), 0);
                  const [y, mes] = m.split('-');
                  return (
                    <tr key={m}>
                      <td>{meses[Number(mes) - 1]} {y}</td>
                      <td>${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="sueldos-resumen">
            <div className="resumen-item">
              <span>Mejor sueldo del semestre</span>
              <span>${mejorMesAguinaldo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="resumen-item grand-total">
              <span>Aguinaldo (SAC) = Mejor sueldo / 2</span>
              <span>${aguinaldoCalculado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            {aguinaldoPagado.length > 0 && (
              <>
                <hr />
                <div className="resumen-item">
                  <span>Aguinaldo ya pagado</span>
                  <span>-${aguinaldoPagado.reduce((s, p) => s + (p.monto || 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
