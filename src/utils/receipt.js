import { normalizarEstado } from './estados';

function formatFechaAR(fecha) {
  if (!fecha) return '';
  const m = String(fecha).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : fecha;
}

export function getWhatsAppReceiptUrl(alquiler) {
  if (!alquiler?.clienteTelefono && !alquiler?.clienteTelefonoPrincipal) return null;
  const saldo = (Number(alquiler.precio) || 0) - (Number(alquiler.seña) || 0);
  const retiroPartes = [
    alquiler.fechaRetiro ? formatFechaAR(alquiler.fechaRetiro) : '',
    alquiler.horaRetiro ? String(alquiler.horaRetiro).trim() : '',
  ].filter(Boolean);
  const retiroLinea = retiroPartes.length > 0 ? `*Retiro del disfraz:* ${retiroPartes.join(' - ')}\n` : '';
  const txt = `🎭 *MUNDO DISFRAZ - Comprobante*\n\n` +
    `Cliente: ${alquiler.clienteNombre}\n` +
    `Fecha: ${alquiler.fechaAlquiler}${alquiler.turno ? ` (${alquiler.turno})` : ''}\n` +
    `${alquiler.fechaEvento ? `Evento: ${alquiler.fechaEvento}\n` : ''}` +
    `${alquiler.fechaDevolucion ? `Devolución: ${alquiler.fechaDevolucion}\n` : ''}` +
    `${alquiler.colegio ? `Colegio: ${alquiler.colegio}\n` : ''}` +
    `Items: ${Array.isArray(alquiler.items) ? alquiler.items.map(i => i.nombre || i).join(', ') : alquiler.items}\n` +
    `Precio Alquiler: $${alquiler.precio}\n` +
    `Seña: $${alquiler.seña || '0'}\n` +
    `${alquiler.garantia ? `Garantía: ${alquiler.garantia}\n` : ''}` +
    `${Number(alquiler.seña) > 0 ? `Saldo a Pagar: $${saldo}\n` : ''}` +
    `${retiroLinea}\n` +
    `*Los disfraces se devuelven lavados, caso contrario se descuenta el importe del lavado.*\n` +
    `*En fechas patrias, los disfraces se devuelven finalizado el acto.*\n` +
    `*Se cobrará el valor total del alquiler por cada día de atraso.*\n` +
    `*Garantía solo en Efectivo*\n\n` +
    `MUNDO DISFRAZ\n` +
    `Avda Perón 2550 - Tel: 3814143161`;
  const tel = (alquiler.clienteTelefonoPrincipal || alquiler.clienteTelefono || '').split('/')[0].replace(/[^0-9]/g, '');
  return `https://wa.me/54${tel}?text=${encodeURIComponent(txt)}`;
}

export function getWhatsAppReminderUrl(alquiler) {
  if (!alquiler?.clienteTelefono && !alquiler?.clienteTelefonoPrincipal) return null;
  if (!alquiler.fechaDevolucion) return null;
  if (normalizarEstado(alquiler.estado) !== 'retirado') return null;
  const hoy = new Date();
  const dev = new Date(alquiler.fechaDevolucion);
  const dias = Math.floor((hoy - dev) / (1000 * 60 * 60 * 24));
  if (dias < 1) return null;
  const txt = `⚠️ *TU DISFRAZ ESTÁ FUERA DE TÉRMINO*\n\n` +
    `Recordá devolver tu disfraz *PARA EVITAR MULTAS*\n\n` +
    `Pasaron *${dias} día${dias !== 1 ? 's' : ''}* de la fecha de devolución.\n\n` +
    `Cliente: ${alquiler.clienteNombre}\n` +
    `Items: ${Array.isArray(alquiler.items) ? alquiler.items.map(i => i.nombre || i).join(', ') : alquiler.items}\n` +
    `Devolución: ${alquiler.fechaDevolucion}`;
  const tel = (alquiler.clienteTelefonoPrincipal || alquiler.clienteTelefono || '').split('/')[0].replace(/[^0-9]/g, '');
  return `https://wa.me/54${tel}?text=${encodeURIComponent(txt)}`;
}
