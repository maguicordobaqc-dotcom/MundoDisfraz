/**
 * Normaliza un texto para búsquedas flexibles:
 * - minúsculas
 * - sin tildes ni diacríticos ("Gómez" -> "gomez")
 * - reemplaza comas y signos por espacios ("TORRES, Juan" -> "torres juan")
 */
export function normalizarTexto(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[,.;:/_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Devuelve true si todas las palabras de la consulta aparecen en los campos dados,
 * sin importar el orden, las mayúsculas, las comas ni las tildes.
 */
export function coincideBusqueda(consulta, campos) {
  const q = normalizarTexto(consulta);
  if (!q) return true;
  const palabras = q.split(' ');
  const textoCombinado = normalizarTexto(campos.filter(Boolean).join(' '));
  return palabras.every((p) => textoCombinado.includes(p));
}
