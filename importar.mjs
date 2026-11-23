import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Papa = require('papaparse');

const fetch = require('node-fetch');

const { initializeApp } = await import('firebase/app');
const { getFirestore, collection, addDoc, query, where, getDocs, serverTimestamp } = await import('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDci8oCyLCtbiSAcM6YJGQUQV5ZhVplmOk",
  authDomain: "mundo-disfraz.firebaseapp.com",
  projectId: "mundo-disfraz",
  storageBucket: "mundo-disfraz.firebasestorage.app",
  messagingSenderId: "757189931171",
  appId: "1:757189931171:web:301bd7426a05e9e5b08f16",
  measurementId: "G-NDN7BKFNF3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const CSV_URL = 'https://docs.google.com/spreadsheets/d/1cxIsJ8IGkwbsdH3Iq3RAvIGtOn4Aeplhq0uPBw_f6yc/export?format=csv';

function parseNombre(raw) {
  raw = (raw || '').trim().replace(/\s+/g, ' ');
  const parts = raw.split(' ');
  if (parts.length === 0 || raw === '') return { apellido: '', nombre: '' };
  return {
    apellido: parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase(),
    nombre: parts.slice(1).join(' ').replace(/\b\w/g, c => c.toUpperCase())
  };
}

function parsePrecio(val) {
  if (!val) return 0;
  const s = String(val).replace(/[$.,\s]/g, '').toLowerCase();
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1]) : 0;
}

function parseFecha(val) {
  if (!val) return '';
  const parts = String(val).split('/');
  if (parts.length === 3) {
    return `${parts[2].padStart(4, '20')}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return val;
}

function extractDriveUrl(val) {
  if (!val) return '';
  const m = String(val).match(/(https?:\/\/drive\.google\.com\/[^\s,]+)/);
  return m ? m[1] : '';
}

async function clienteExiste(db, apellido, nombre) {
  const q = query(
    collection(db, 'clientes'),
    where('apellido', '==', apellido),
    where('nombre', '==', nombre)
  );
  const snap = await getDocs(q);
  return snap.docs.length > 0 ? snap.docs[0] : null;
}

async function importar() {
  console.log('Descargando CSV...');
  const resp = await fetch(CSV_URL);
  const csv = await resp.text();
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  const rows = parsed.data.filter(r => r['Apellido Y Nombre'] && r['Apellido Y Nombre'].trim());

  console.log(`Total filas: ${rows.length}`);

  let clientesCreados = 0;
  let alquileresCreados = 0;
  let clientesExistentes = 0;

  for (const row of rows) {
    const { apellido, nombre } = parseNombre(row['Apellido Y Nombre']);
    if (!apellido) continue;

    let cliente = await clienteExiste(db, apellido, nombre);

    if (!cliente) {
      const clienteRef = await addDoc(collection(db, 'clientes'), {
        apellido,
        nombre,
        direccion: (row['Direccion'] || '').trim(),
        telefono: ((row['Celular'] || '') + (row['Telefono 2'] && row['Telefono 2'] !== '--------' && row['Telefono 2'] !== '.' ? ' / ' + row['Telefono 2'] : '')).trim().replace(/^ \/ /, ''),
        email: (row['Dirección de correo electrónico'] || '').trim(),
        createdAt: serverTimestamp()
      });
      cliente = { id: clienteRef.id };
      clientesCreados++;
      console.log(`  + Cliente: ${apellido}, ${nombre}`);
    } else {
      clientesExistentes++;
    }

    const foto1 = extractDriveUrl(row['Foto 1 Disfraz + Accesorios Elegidos']);
    const foto2 = extractDriveUrl(row['Foto 2 Disfraz + Accesorios Elegidos']);
    const foto3 = extractDriveUrl(row['Foto 3 Disfraz + Accesorios Elegidos']);
    const fotos = [foto1, foto2, foto3].filter(Boolean);

    const items = [];
    const disfraz = (row['Marca tu Disfraz'] || '').trim();
    if (disfraz) {
      items.push({
        nombre: disfraz,
        fotoUrl: fotos[0] || '',
        descripcion: `Talle: ${row['Talle'] || ''}, Turno: ${row['Turno Evento'] || ''}, Colegio: ${row['Colegio'] || ''}`.replace(/, $/, '')
      });
    }

    const precio = parsePrecio(row['Precio del Alquiler']);

    await addDoc(collection(db, 'alquileres'), {
      clienteId: cliente.id,
      clienteNombre: `${nombre} ${apellido}`,
      clienteDireccion: (row['Direccion'] || '').trim(),
      items,
      fechaAlquiler: parseFecha(row['Fecha Reserva']),
      fechaEvento: parseFecha(row['Fecha Evento']),
      fechaDevolucion: parseFecha(row['Fecha Devolución  - Finalizado el Acto de 10 a 13 o de 18 a 20 hrs']),
      precio,
      seña: parsePrecio(row['Seña']),
      garantia: (row['Garantia'] || '').trim(),
      nota: '',
      estado: 'pendiente',
      createdAt: serverTimestamp()
    });

    alquileresCreados++;
    if (alquileresCreados % 20 === 0) console.log(`  ... ${alquileresCreados} alquileres procesados`);
  }

  console.log('\n=== RESUMEN ===');
  console.log(`Clientes nuevos: ${clientesCreados}`);
  console.log(`Clientes ya existentes: ${clientesExistentes}`);
  console.log(`Alquileres creados: ${alquileresCreados}`);
  console.log('¡Importación completada!');
  process.exit(0);
}

importar().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
