import { useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { normalizarEstado } from '../utils/estados';
import { getAlquileres, upsertAlquilerCache } from '../utils/dataCache';
import { esBase64Image, guardarFotoEnColeccion, eliminarFotoDeColeccion } from '../utils/fotos';

function getFechaCorteISO(dias) {
  const d = new Date();
  d.setDate(d.getDate() - Number(dias));
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatFechaCorta(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export default function Mantenimiento() {
  const [exportando, setExportando] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const [migrando, setMigrando] = useState(false);
  const [migraMsg, setMigraMsg] = useState('');
  const [migrandoGar, setMigrandoGar] = useState(false);
  const [migraGarMsg, setMigraGarMsg] = useState('');
  const [migrandoFotos, setMigrandoFotos] = useState(false);
  const [migraFotosMsg, setMigraFotosMsg] = useState('');
  const [diasLimpieza, setDiasLimpieza] = useState('60');
  const [previewLimpieza, setPreviewLimpieza] = useState(null);
  const [limpiandoFotos, setLimpiandoFotos] = useState(false);
  const [limpiezaMsg, setLimpiezaMsg] = useState('');

  const exportar = async () => {
    setExportando(true);
    setExportMsg('');
    try {
      const [cliSnap, alqSnap, fotosSnap] = await Promise.all([
        getDocs(collection(db, 'clientes')),
        getDocs(collection(db, 'alquileres')),
        getDocs(collection(db, 'alquileres_fotos')),
      ]);
      const data = {
        exportado: new Date().toISOString(),
        clientes: cliSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        alquileres: alqSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        alquileres_fotos: fotosSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mundo-disfraz-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMsg(`✅ ${data.clientes.length} clientes, ${data.alquileres.length} alquileres y ${data.alquileres_fotos.length} fotos separadas exportadas`);
    } catch (e) {
      setExportMsg('❌ Error al exportar: ' + e.message);
    }
    setExportando(false);
  };

  const migrarFotosSeparadas = async () => {
    setMigrandoFotos(true);
    setMigraFotosMsg('Analizando alquileres con fotos embebidas...');
    try {
      const todos = await getAlquileres(false);
      const pendientes = todos.filter((a) => (a.items || []).some((it) => esBase64Image(it.fotoUrl)));
      const totalFotos = pendientes.reduce(
        (sum, a) => sum + (a.items || []).filter((it) => esBase64Image(it.fotoUrl)).length,
        0
      );

      if (pendientes.length === 0) {
        setMigraFotosMsg('✅ Todas las fotos ya están separadas en "alquileres_fotos". No hay nada pendiente.');
        setMigrandoFotos(false);
        return;
      }

      const ok = window.confirm(
        `Se encontraron ${totalFotos} fotos embebidas en ${pendientes.length} alquileres.\n\n` +
        `Se van a mover de forma segura a la colección separada "alquileres_fotos" (sin borrar ninguna foto) para que la app abra mucho más rápido.\n\n¿Continuar?`
      );
      if (!ok) {
        setMigraFotosMsg('');
        setMigrandoFotos(false);
        return;
      }

      let alqMovidos = 0;
      let fotosMovidas = 0;

      for (const a of pendientes) {
        const nuevosItems = [];
        for (const it of (a.items || [])) {
          if (esBase64Image(it.fotoUrl)) {
            const fotoId = await guardarFotoEnColeccion(it.fotoUrl, a.id);
            fotosMovidas++;
            const { fotoUrl: _old, ...rest } = it;
            nuevosItems.push({ ...rest, fotoUrl: '', fotoId });
          } else {
            nuevosItems.push(it);
          }
        }
        await updateDoc(doc(db, 'alquileres', a.id), { items: nuevosItems });
        upsertAlquilerCache(a.id, { items: nuevosItems });
        alqMovidos++;
        if (alqMovidos % 5 === 0 || alqMovidos === pendientes.length) {
          setMigraFotosMsg(`⏳ Migrando... ${alqMovidos}/${pendientes.length} alquileres (${fotosMovidas}/${totalFotos} fotos)`);
        }
      }

      setMigraFotosMsg(`✅ Migración completa: ${fotosMovidas} fotos de ${alqMovidos} alquileres movidas a "alquileres_fotos".`);
    } catch (e) {
      setMigraFotosMsg('❌ Error durante la migración (las fotos ya movidas quedaron a salvo, podés reintentar): ' + e.message);
    }
    setMigrandoFotos(false);
  };

  const analizarLimpiezaFotos = async () => {
    setLimpiezaMsg('');
    try {
      const corte = getFechaCorteISO(diasLimpieza);
      const todos = await getAlquileres(false);
      const candidatos = todos.filter((a) => {
        if (normalizarEstado(a.estado) !== 'devuelto') return false;
        const fechaRef = a.fechaDevolucion || a.fechaAlquiler || '';
        if (!fechaRef || fechaRef > corte) return false;
        return (a.items || []).some((it) => Boolean(it.fotoId) || esBase64Image(it.fotoUrl));
      });
      const totalFotos = candidatos.reduce(
        (sum, a) => sum + (a.items || []).filter((it) => Boolean(it.fotoId) || esBase64Image(it.fotoUrl)).length,
        0
      );
      setPreviewLimpieza({
        dias: Number(diasLimpieza),
        corte,
        alquileresCount: candidatos.length,
        fotosCount: totalFotos,
        ids: candidatos.map((a) => a.id),
      });
    } catch (e) {
      setLimpiezaMsg('❌ Error al analizar: ' + e.message);
    }
  };

  const limpiarFotosViejas = async () => {
    if (!previewLimpieza || previewLimpieza.fotosCount === 0) return;
    const ok = window.confirm(
      `¿Eliminar ${previewLimpieza.fotosCount} fotos de ${previewLimpieza.alquileresCount} alquileres YA DEVUELTOS con fecha anterior o igual al ${formatFechaCorta(previewLimpieza.corte)}?\n\n` +
      `• Recomendamos tener un backup guardado antes.\n` +
      `• NO se borra ningún alquiler, cliente ni reporte.\n` +
      `• NO se toca ningún alquiler Reservado ni Retirado.`
    );
    if (!ok) return;

    setLimpiandoFotos(true);
    setLimpiezaMsg('Limpiando fotos viejas...');
    try {
      const todos = await getAlquileres(false);
      const idSet = new Set(previewLimpieza.ids);
      const objetivos = todos.filter((a) => idSet.has(a.id) && normalizarEstado(a.estado) === 'devuelto');

      let alqLimpiados = 0;
      let fotosEliminadas = 0;

      for (const a of objetivos) {
        const nuevosItems = [];
        let cambio = false;
        for (const it of (a.items || [])) {
          if (it.fotoId || esBase64Image(it.fotoUrl)) {
            if (it.fotoId) await eliminarFotoDeColeccion(it.fotoId);
            fotosEliminadas++;
            cambio = true;
            const { fotoId: _oldId, fotoUrl: _oldUrl, ...rest } = it;
            nuevosItems.push({ ...rest, fotoUrl: '', fotoLimpiada: true });
          } else {
            nuevosItems.push(it);
          }
        }
        if (cambio) {
          await updateDoc(doc(db, 'alquileres', a.id), { items: nuevosItems });
          upsertAlquilerCache(a.id, { items: nuevosItems });
          alqLimpiados++;
          if (alqLimpiados % 5 === 0 || alqLimpiados === objetivos.length) {
            setLimpiezaMsg(`⏳ Limpiando... ${alqLimpiados}/${objetivos.length} alquileres (${fotosEliminadas} fotos eliminadas)`);
          }
        }
      }

      setPreviewLimpieza(null);
      setLimpiezaMsg(`✅ Mantenimiento completado: ${fotosEliminadas} fotos eliminadas de ${alqLimpiados} alquileres devueltos. Todos los registros y reportes quedaron intactos.`);
    } catch (e) {
      setLimpiezaMsg('❌ Error durante la limpieza: ' + e.message);
    }
    setLimpiandoFotos(false);
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
        if (normalizarEstado(a.estado) === 'devuelto' && a.garantia && !a.garantiaDevuelta) {
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
      <h2>⚙️ Mantenimiento — Solo Supervisores</h2>
      <p className="text-muted" style={{ marginBottom: 20 }}>
        Herramientas de respaldo, limpieza y migración de la base de datos. Esta sección solo es visible para cuentas supervisoras.
      </p>

      <div className="help-section">
        <h3>💾 Backup / Exportar Datos</h3>
        <p>Descargá un archivo JSON con todos los clientes, alquileres y fotos separadas de la base de datos.</p>
        <button onClick={exportar} className="btn btn-primary" disabled={exportando}>
          {exportando ? 'Exportando...' : '📥 Exportar todo'}
        </button>
        {exportMsg && <p style={{ marginTop: 8 }}>{exportMsg}</p>}
      </div>

      <div className="help-section">
        <h3>🧹 Mantenimiento de fotos viejas (solo devueltos)</h3>
        <p>Elimina únicamente las fotos de alquileres que ya están en estado <strong>Devuelto</strong> con más tiempo del elegido, manteniendo intactos todos los datos del alquiler, historial y reportes. <strong>Nunca</strong> toca alquileres Reservados ni Retirados.</p>
        <div className="form-row" style={{ alignItems: 'flex-end', marginBottom: 12 }}>
          <div className="form-group" style={{ flex: '0 0 auto', minWidth: 220 }}>
            <label>Limpiar fotos de devueltos hace más de:</label>
            <select
              value={diasLimpieza}
              onChange={(e) => { setDiasLimpieza(e.target.value); setPreviewLimpieza(null); setLimpiezaMsg(''); }}
              disabled={limpiandoFotos}
            >
              <option value="30">30 días (1 mes)</option>
              <option value="60">60 días (2 meses — recomendado)</option>
              <option value="90">90 días (3 meses)</option>
              <option value="180">180 días (6 meses)</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: '0 0 auto' }}>
            <button onClick={analizarLimpiezaFotos} className="btn btn-secondary" disabled={limpiandoFotos}>
              🔍 Analizar fotos a limpiar
            </button>
          </div>
        </div>
        {previewLimpieza && (
          <div className="card" style={{ marginBottom: 12, background: '#f8f9fa' }}>
            <p style={{ marginBottom: 8 }}>
              Se encontraron <strong>{previewLimpieza.fotosCount} fotos</strong> en <strong>{previewLimpieza.alquileresCount} alquileres devueltos</strong> con fecha anterior o igual al <strong>{formatFechaCorta(previewLimpieza.corte)}</strong>.
            </p>
            {previewLimpieza.fotosCount > 0 ? (
              <button onClick={limpiarFotosViejas} className="btn btn-danger" disabled={limpiandoFotos}>
                {limpiandoFotos ? 'Limpiando...' : `🧹 Eliminar ${previewLimpieza.fotosCount} fotos viejas`}
              </button>
            ) : (
              <p className="text-muted" style={{ margin: 0 }}>No hay fotos viejas para limpiar en ese rango.</p>
            )}
          </div>
        )}
        {limpiezaMsg && <p style={{ marginTop: 8 }}>{limpiezaMsg}</p>}
      </div>

      <div className="help-section">
        <h3>🚀 Optimizar velocidad (Separar fotos existentes)</h3>
        <p>Mueve fotos viejas que pudieran haber quedado embebidas en <code>alquileres</code> hacia la colección separada <code>alquileres_fotos</code> (sin borrar ninguna foto).</p>
        <button onClick={migrarFotosSeparadas} className="btn btn-secondary" disabled={migrandoFotos}>
          {migrandoFotos ? 'Migrando fotos...' : '🚀 Separar fotos existentes'}
        </button>
        {migraFotosMsg && <p style={{ marginTop: 8 }}>{migraFotosMsg}</p>}
      </div>

      <div className="help-section">
        <h3>📱 Migrar teléfonos</h3>
        <p>Divide el teléfono de cada cliente en "Celular principal" y "Celular secundario" (si tiene dos números separados por " / ").</p>
        <button onClick={migrarTelefonos} className="btn btn-secondary" disabled={migrando}>
          {migrando ? 'Migrando...' : 'Migrar teléfonos'}
        </button>
        {migraMsg && <p style={{ marginTop: 8 }}>{migraMsg}</p>}
      </div>

      <div className="help-section">
        <h3>✅ Migrar garantías devueltas</h3>
        <p>Marca como devuelta la garantía de todos los alquileres que estén en estado "devuelto" y tengan garantía pendiente.</p>
        <button onClick={migrarGarantiasDevueltas} className="btn btn-secondary" disabled={migrandoGar}>
          {migrandoGar ? 'Migrando...' : 'Marcar garantías devueltas'}
        </button>
        {migraGarMsg && <p style={{ marginTop: 8 }}>{migraGarMsg}</p>}
      </div>
    </div>
  );
}
