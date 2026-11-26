import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const cache = {
  alquileres: null,
  clientes: null,
};

let inflightAlquileres = null;
let inflightClientes = null;

function getCreatedSeconds(doc) {
  if (!doc?.createdAt) return 0;
  if (typeof doc.createdAt.seconds === 'number') return doc.createdAt.seconds;
  if (typeof doc.createdAt.toMillis === 'function') return Math.floor(doc.createdAt.toMillis() / 1000);
  return 0;
}

function ordenarAlquileresPorReciente(lista) {
  return [...lista].sort((a, b) => getCreatedSeconds(b) - getCreatedSeconds(a));
}

function ordenarClientesAlfabeticamente(lista) {
  return [...lista].sort((a, b) =>
    (a.apellido || '').localeCompare(b.apellido || '', 'es', { sensitivity: 'base' }) ||
    (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' })
  );
}

export async function getAlquileres(forceRefresh = false) {
  if (!forceRefresh && cache.alquileres !== null) {
    return cache.alquileres;
  }
  if (!forceRefresh && inflightAlquileres) {
    return inflightAlquileres;
  }

  const req = getDocs(collection(db, 'alquileres'))
    .then((snap) => {
      const data = ordenarAlquileresPorReciente(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      cache.alquileres = data;
      return data;
    })
    .finally(() => {
      if (inflightAlquileres === req) inflightAlquileres = null;
    });

  inflightAlquileres = req;
  return req;
}

export function upsertAlquilerCache(id, data, isNew = false) {
  if (cache.alquileres === null) return null;
  if (isNew) {
    cache.alquileres = [{ id, ...data }, ...cache.alquileres.filter((a) => a.id !== id)];
  } else {
    cache.alquileres = cache.alquileres.map((a) => (a.id === id ? { ...a, ...data } : a));
  }
  return cache.alquileres;
}

export function removeAlquilerCache(id) {
  if (cache.alquileres === null) return null;
  cache.alquileres = cache.alquileres.filter((a) => a.id !== id);
  return cache.alquileres;
}

export async function getClientes(forceRefresh = false) {
  if (!forceRefresh && cache.clientes !== null) {
    return cache.clientes;
  }
  if (!forceRefresh && inflightClientes) {
    return inflightClientes;
  }

  const req = getDocs(collection(db, 'clientes'))
    .then((snap) => {
      const data = ordenarClientesAlfabeticamente(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      cache.clientes = data;
      return data;
    })
    .finally(() => {
      if (inflightClientes === req) inflightClientes = null;
    });

  inflightClientes = req;
  return req;
}

export function upsertClienteCache(id, data, isNew = false) {
  if (cache.clientes === null) return null;
  const updated = isNew
    ? [...cache.clientes.filter((c) => c.id !== id), { id, ...data }]
    : cache.clientes.map((c) => (c.id === id ? { ...c, ...data } : c));
  cache.clientes = ordenarClientesAlfabeticamente(updated);
  return cache.clientes;
}

export function removeClienteCache(id) {
  if (cache.clientes === null) return null;
  cache.clientes = cache.clientes.filter((c) => c.id !== id);
  return cache.clientes;
}

export function clearAllCache() {
  cache.alquileres = null;
  cache.clientes = null;
  inflightAlquileres = null;
  inflightClientes = null;
}
