export function getWhatsAppReceiptUrl(alquiler) {
  if (!alquiler?.clienteTelefono) return null;
  const saldo = (Number(alquiler.precio) || 0) - (Number(alquiler.seña) || 0);
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
    `${Number(alquiler.seña) > 0 ? `Saldo a Pagar: $${saldo}\n\n` : '\n'}` +
    `*La seña no se devuelve.*\n` +
    `*Los disfraces se devuelven lavados, caso contrario se descuenta el importe del lavado.*\n` +
    `*En fechas patrias, los disfraces se devuelven finalizado el acto.*\n` +
    `*Se cobrará el valor total del alquiler por cada día de atraso.*\n` +
    `*El depósito ni la seña se devuelven.*\n` +
    `*Garantía solo en Efectivo*\n\n` +
    `MUNDO DISFRAZ\n` +
    `Avda Perón 2550 - Tel: 3814143161`;
  const tel = alquiler.clienteTelefono.split('/')[0].replace(/[^0-9]/g, '');
  return `https://wa.me/54${tel}?text=${encodeURIComponent(txt)}`;
}

export function getWhatsAppReminderUrl(alquiler) {
  if (!alquiler?.clienteTelefono) return null;
  if (!alquiler.fechaDevolucion) return null;
  if (alquiler.estado !== 'entregado' && alquiler.estado !== 'retirado') return null;
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
  const tel = alquiler.clienteTelefono.split('/')[0].replace(/[^0-9]/g, '');
  return `https://wa.me/54${tel}?text=${encodeURIComponent(txt)}`;
}
