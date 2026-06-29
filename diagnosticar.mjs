import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { initializeApp } = await import('firebase/app');
const { getFirestore, collection, getDocs } = await import('firebase/firestore');

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

async function diagnosticar() {
  const clientesSnap = await getDocs(collection(db, 'clientes'));
  const alquileresSnap = await getDocs(collection(db, 'alquileres'));

  console.log(`Clientes: ${clientesSnap.docs.length}`);
  console.log(`Alquileres: ${alquileresSnap.docs.length}`);

  const clientes = clientesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const alquileres = alquileresSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Check how many alquileres have clienteId
  const conClienteId = alquileres.filter(a => a.clienteId);
  const sinClienteId = alquileres.filter(a => !a.clienteId);
  console.log(`\nAlquileres con clienteId: ${conClienteId.length}`);
  console.log(`Alquileres sin clienteId: ${sinClienteId.length}`);

  // Check how many alquileres have a matching client
  const clientIds = new Set(clientes.map(c => c.id));
  const conMatch = alquileres.filter(a => clientIds.has(a.clienteId));
  const sinMatch = alquileres.filter(a => a.clienteId && !clientIds.has(a.clienteId));
  console.log(`Alquileres con cliente existente: ${conMatch.length}`);
  console.log(`Alquileres con clienteId pero sin cliente: ${sinMatch.length}`);

  if (sinMatch.length > 0) {
    console.log('\nEjemplos sin match:');
    sinMatch.slice(0, 5).forEach(a => console.log(`  ${a.clienteNombre} → clienteId: ${a.clienteId}`));
  }

  // Try the query approach for one client
  if (clientes.length > 0) {
    const first = clientes[0];
    console.log(`\nProbando query para: ${first.apellido}, ${first.nombre} (id: ${first.id})`);
    
    const { query, where } = await import('firebase/firestore');
    const q = query(collection(db, 'alquileres'), where('clienteId', '==', first.id));
    const snap = await getDocs(q);
    console.log(`  Query directa devolvió: ${snap.docs.length} alquileres`);
    
    // Compare with filtering in JS
    const jsFilter = alquileres.filter(a => a.clienteId === first.id);
    console.log(`  Filtro JS devolvió: ${jsFilter.length} alquileres`);
  }

  process.exit(0);
}

diagnosticar().catch(err => { console.error(err); process.exit(1); });
