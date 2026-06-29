import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Papa = require('papaparse');
const fetch = require('node-fetch');

const { initializeApp } = await import('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, query, orderBy } = await import('firebase/firestore');

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
    apellido: parts[0].toUpperCase(),
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

function mapEstado(val) {
  const v = (val || '').trim().toLowerCase();
  if (v === 'devuelto') return 'devuelto';
  if (v === 'retirado') return 'entregado';
  if (v === 'reservado') return 'reservado';
  if (v === 'pagado' || v === 'pendiente') return 'pendiente';
  return 'pendiente';
}

async function migrar() {
  console.log('Descargando CSV...');
  const resp = await fetch(CSV_URL);
  const csv = await resp.text();
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  const rows = parsed.data.filter(r => r['Apellido Y Nombre'] && r['Apellido Y Nombre'].trim());
  console.log(`Filas CSV: ${rows.length}`);

  const q = query(collection(db, 'alquileres'), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  const rentals = snap.docs;
  console.log(`Alquileres en DB: ${rentals.length}`);

  let actualizados = 0;

  for (let i = 0; i < Math.min(rows.length, rentals.length); i++) {
    const row = rows[i];
    const rDoc = rentals[i];
    const data = rDoc.data();

    const { apellido } = parseNombre(row['Apellido Y Nombre']);
    const csvApe = apellido;
    const dbApe = (data.clienteApellido || '').toUpperCase();

    if (csvApe !== dbApe) {
      // Try to find the right rental by matching apellido
      const match = rentals.find(d => {
        const dd = d.data();
        return (dd.clienteApellido || '').toUpperCase() === csvApe &&
               dd.fechaAlquiler === parseFecha(row['Fecha Reserva']);
      });
      if (match) {
        const estado = mapEstado(row['Columna 15']);
        await updateDoc(doc(db, 'alquileres', match.id), { estado });
        actualizados++;
        if (actualizados % 20 === 0) console.log(`  ... ${actualizados} actualizados`);
      }
      continue;
    }

    const estado = mapEstado(row['Columna 15']);
    await updateDoc(doc(db, 'alquileres', rDoc.id), { estado });
    actualizados++;
    if (actualizados % 20 === 0) console.log(`  ... ${actualizados} actualizados`);
  }

  console.log(`\nEstados actualizados: ${actualizados}`);
  process.exit(0);
}

migrar().catch(err => { console.error(err); process.exit(1); });
