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

async function importar() {
  console.log('Descargando CSV...');
  const resp = await fetch(CSV_URL);
  const csv = await resp.text();
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  const rows = parsed.data.filter(r => r['Apellido Y Nombre'] && r['Apellido Y Nombre'].trim());
  console.log(`Total filas en CSV: ${rows.length}`);

  console.log('Cargando alquileres existentes...');
  const alqSnap = await getDocs(collection(db, 'alquileres'));
  const existing = new Map();
  alqSnap.forEach(d => {
    const data = d.data();
    const key = `${data.clienteNombre}|${data.fechaAlquiler}|${data.precio}`;
    existing.set(key, true);
  });
  console.log(`Alquileres existentes: ${existing.size}`);

  let importados = 0;
  let duplicados = 0;

  for (const row of rows) {
    const { apellido, nombre } = parseNombre(row['Apellido Y Nombre']);
    if (!apellido) continue;

    const fechaAlquiler = parseFecha(row['Fecha Reserva']);
    const precio = parsePrecio(row['Precio del Alquiler']);
    const clienteNombre = `${apellido.toUpperCase()}, ${nombre}`;
    const key = `${clienteNombre}|${fechaAlquiler}|${precio}`;

    if (existing.has(key)) {
      duplicados++;
      continue;
    }

    // Find or create client
    const q = query(
      collection(db, 'clientes'),
      where('apellido', '==', apellido),
      where('nombre', '==', nombre)
    );
    const snap = await getDocs(q);
    let cliente = snap.docs.length > 0 ? snap.docs[0] : null;

    if (!cliente) {
      const ref = await addDoc(collection(db, 'clientes'), {
        apellido,
        nombre,
        apellidoSearch: apellido.toLowerCase(),
        nombreSearch: nombre.toLowerCase(),
        direccion: (row['Direccion'] || '').trim(),
        telefono: ((row['Celular'] || '') + (row['Telefono 2'] && row['Telefono 2'] !== '--------' && row['Telefono 2'] !== '.' ? ' / ' + row['Telefono 2'] : '')).trim().replace(/^ \/ /, ''),
        email: (row['Dirección de correo electrónico'] || '').trim(),
        createdAt: serverTimestamp()
      });
      cliente = { id: ref.id, data: () => ({ telefono: '' }) };
      console.log(`  + Cliente creado: ${apellido}, ${nombre}`);
    }

    const foto1 = extractDriveUrl(row['Foto 1 Disfraz + Accesorios Elegidos']);
    const foto2 = extractDriveUrl(row['Foto 2 Disfraz + Accesorios Elegidos']);
    const foto3 = extractDriveUrl(row['Foto 3 Disfraz + Accesorios Elegidos']);
    const fotos = [foto1, foto2, foto3].filter(Boolean);

    const items = [];
    const disfraz = (row['Marca tu Disfraz'] || '').trim();
    if (disfraz) {
      items.push({ nombre: disfraz, fotoUrl: fotos[0] || '' });
    }

    const telefono = ((row['Celular'] || '') + (row['Telefono 2'] && row['Telefono 2'] !== '--------' && row['Telefono 2'] !== '.' ? ' / ' + row['Telefono 2'] : '')).trim().replace(/^ \/ /, '');

    await addDoc(collection(db, 'alquileres'), {
      clienteId: cliente.id,
      clienteNombre,
      clienteApellido: apellido.toUpperCase(),
      clienteDireccion: (row['Direccion'] || '').trim(),
      clienteTelefono: telefono,
      items,
      fechaAlquiler,
      fechaDevolucion: parseFecha(row['Fecha Devolución  - Finalizado el Acto de 10 a 13 o de 18 a 20 hrs']),
      turno: (row['Turno Evento'] || '').trim().toLowerCase() || 'mañana',
      colegio: (row['Colegio'] || '').trim(),
      precio,
      seña: parsePrecio(row['Seña']),
      garantia: (row['Garantia'] || '').trim(),
      garantiaDevuelta: false,
      estado: 'pendiente',
      createdAt: serverTimestamp()
    });

    importados++;
    console.log(`  ✅ ${clienteNombre} | ${fechaAlquiler} | $${precio}`);
  }

  console.log('\n=== RESUMEN ===');
  console.log(`Importados: ${importados}`);
  console.log(`Duplicados (saltados): ${duplicados}`);
  process.exit(0);
}

importar().catch(err => { console.error(err); process.exit(1); });
