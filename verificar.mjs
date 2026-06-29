import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Papa = require('papaparse');
const fetch = require('node-fetch');
const { initializeApp } = await import('firebase/app');
const { getFirestore, collection, getDocs, query, orderBy } = await import('firebase/firestore');

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

async function verificar() {
  const resp = await fetch('https://docs.google.com/spreadsheets/d/1cxIsJ8IGkwbsdH3Iq3RAvIGtOn4Aeplhq0uPBw_f6yc/export?format=csv');
  const csv = await resp.text();
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  const rows = parsed.data.filter(r => r['Apellido Y Nombre'] && r['Apellido Y Nombre'].trim());

  const q = query(collection(db, 'alquileres'), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);

  let ok = 0, mal = 0;
  for (let i = 0; i < Math.min(rows.length, snap.docs.length); i++) {
    const r = rows[i];
    const d = snap.docs[i].data();
    const csvEstado = (r['Columna 15'] || '').trim().toLowerCase();
    const dbEstado = (d.estado || '').trim().toLowerCase();
    const csvApe = (r['Apellido Y Nombre'] || '').split(' ')[0].toUpperCase();
    const dbApe = (d.clienteApellido || '').toUpperCase();

    if (csvEstado !== dbEstado) {
      console.log(`✗ #${i}: CSV=${csvApe}/${csvEstado} DB=${dbApe}/${dbEstado}`);
      mal++;
    } else {
      ok++;
    }
  }

  console.log(`\nCoinciden: ${ok} | No coinciden: ${mal}`);
  process.exit(0);
}

verificar().catch(err => { console.error(err); process.exit(1); });
