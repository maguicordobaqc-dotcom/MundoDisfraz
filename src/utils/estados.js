export const ESTADOS_ALQUILER = [
  { value: 'reservado', label: 'Reservado' },
  { value: 'retirado', label: 'Retirado' },
  { value: 'devuelto', label: 'Devuelto' },
];

export const ESTADO_DEFAULT = 'reservado';

/**
 * Normaliza estados legados que puedan existir en registros viejos de Firestore
 * sin modificar la base de datos:
 * - "pendiente" o vacío -> "reservado"
 * - "entregado"         -> "retirado"
 */
export function normalizarEstado(estado) {
  const e = String(estado || '').trim().toLowerCase();
  if (e === 'reservado' || e === 'pendiente' || !e) return 'reservado';
  if (e === 'retirado' || e === 'entregado') return 'retirado';
  if (e === 'devuelto') return 'devuelto';
  return ESTADO_DEFAULT;
}
