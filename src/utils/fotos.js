import { collection, doc, addDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const fotoCache = new Map();
const inflightFotos = new Map();

export function esDriveUrl(url) {
  return Boolean(url && (url.includes('drive.google.com') || url.includes('googleusercontent')));
}

export function getDriveImageUrl(url, size = 'w400-h400') {
  const match = url && url.match(/[-\w]{25,}/);
  return match ? `https://drive.google.com/thumbnail?id=${match[0]}&sz=${size}` : url;
}

export function esBase64Image(url) {
  return Boolean(url && typeof url === 'string' && url.trim().startsWith('data:image'));
}

export function itemTieneFoto(item) {
  return Boolean(item?.fotoId || item?.fotoUrl || item?.file);
}

/**
 * Comprime un File/Blob de imagen a JPEG liviano (~50-75 KB) para Firestore.
 */
export function comprimirImagen(file, maxAncho = 800, calidad = 0.5) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxAncho || height > maxAncho) {
          const ratio = Math.min(maxAncho / width, maxAncho / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
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

/**
 * Obtiene una foto bajo demanda desde la colección "alquileres_fotos" con caché en memoria.
 */
export async function getFotoById(fotoId) {
  if (!fotoId) return '';
  if (fotoCache.has(fotoId)) return fotoCache.get(fotoId);
  if (inflightFotos.has(fotoId)) return inflightFotos.get(fotoId);

  const req = getDoc(doc(db, 'alquileres_fotos', fotoId))
    .then((snap) => {
      const dataUrl = snap.exists() ? (snap.data().dataUrl || '') : '';
      fotoCache.set(fotoId, dataUrl);
      return dataUrl;
    })
    .catch(() => '')
    .finally(() => {
      inflightFotos.delete(fotoId);
    });

  inflightFotos.set(fotoId, req);
  return req;
}

/**
 * Guarda una imagen base64 en "alquileres_fotos" y devuelve su fotoId.
 */
export async function guardarFotoEnColeccion(dataUrl, alquilerId = '') {
  const ref = await addDoc(collection(db, 'alquileres_fotos'), {
    alquilerId,
    dataUrl,
    createdAt: serverTimestamp(),
  });
  fotoCache.set(ref.id, dataUrl);
  return ref.id;
}

/**
 * Elimina una foto de "alquileres_fotos" (best-effort, no falla si ya no existe).
 */
export async function eliminarFotoDeColeccion(fotoId) {
  if (!fotoId) return;
  fotoCache.delete(fotoId);
  try {
    await deleteDoc(doc(db, 'alquileres_fotos', fotoId));
  } catch {
    /* ignore */
  }
}

/**
 * Procesa los items de un alquiler antes de guardarlo en Firestore:
 * - Si hay archivo nuevo o dataUrl base64, lo guarda en "alquileres_fotos" y deja solo fotoId.
 * - Si ya tenía fotoId y no cambió, lo conserva.
 * - Si es un link externo (ej. Google Drive), lo deja en fotoUrl.
 * - Limpia en "alquileres_fotos" las fotos reemplazadas o eliminadas.
 */
export async function prepararItemsConFotosSeparadas(items, alquilerId, itemsAnteriores = []) {
  const resultado = [];
  const fotoIdsUsados = new Set();

  for (const item of items) {
    let fotoId = item.fotoId || '';
    let fotoUrl = item.fotoUrl || '';

    if (item.file) {
      const b64 = await comprimirImagen(item.file);
      fotoId = await guardarFotoEnColeccion(b64, alquilerId);
      fotoUrl = '';
    } else if (esBase64Image(fotoUrl)) {
      fotoId = await guardarFotoEnColeccion(fotoUrl, alquilerId);
      fotoUrl = '';
    } else if (fotoUrl && !esBase64Image(fotoUrl)) {
      // Link externo (ej. Drive)
      fotoId = '';
    }

    if (fotoId) fotoIdsUsados.add(fotoId);

    const limpio = {
      nombre: item.nombre || '',
      talle: item.talle || '',
      fotoUrl,
      ...(fotoId ? { fotoId } : {}),
      ...(item.fotoLimpiada && !fotoId && !fotoUrl ? { fotoLimpiada: true } : {}),
    };
    resultado.push(limpio);
  }

  // Eliminar de alquileres_fotos los fotoId que ya no están en el alquiler
  for (const prev of itemsAnteriores) {
    if (prev?.fotoId && !fotoIdsUsados.has(prev.fotoId)) {
      await eliminarFotoDeColeccion(prev.fotoId);
    }
  }

  return resultado;
}

export async function eliminarFotosDeAlquiler(alquiler) {
  for (const it of (alquiler?.items || [])) {
    if (it?.fotoId) {
      await eliminarFotoDeColeccion(it.fotoId);
    }
  }
}

export function clearFotoCache() {
  fotoCache.clear();
  inflightFotos.clear();
}
