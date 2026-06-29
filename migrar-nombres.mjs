import { createRequire } from 'module';
const require = createRequire(import.meta.url);
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

async function migrar() {
  // Read all clients and build a map
  const clientesSnap = await getDocs(collection(db, 'clientes'));
  const clientes = {};
  clientesSnap.docs.forEach(d => {
    clientes[d.id] = d.data();
  });
  console.log(`Clientes cargados: ${Object.keys(clientes).length}`);

  // Read all rentals
  const q = query(collection(db, 'alquileres'), orderBy('createdAt', 'desc'));
  const alqSnap = await getDocs(q);
  const rentals = alqSnap.docs;
  console.log(`Alquileres a migrar: ${rentals.length}`);

  let count = 0;
  for (const rentDoc of rentals) {
    const data = rentDoc.data();
    const clienteId = data.clienteId;
    let nuevoNombre = data.clienteNombre;

    if (clienteId && clientes[clienteId]) {
      const c = clientes[clienteId];
      const ape = (c.apellido || '').toUpperCase();
      const nom = c.nombre || '';
      nuevoNombre = `${ape}, ${nom}`;
    } else {
      // Fallback: split existing nombre (last word = apellido)
      const parts = (data.clienteNombre || '').split(' ');
      const ape = (parts.pop() || '').toUpperCase();
      const nom = parts.join(' ');
      nuevoNombre = `${ape}, ${nom}`;
    }

    await updateDoc(doc(db, 'alquileres', rentDoc.id), {
      clienteNombre: nuevoNombre,
      clienteApellido: nuevoNombre.split(',')[0]
    });
    count++;
    if (count % 30 === 0) console.log(`  ... ${count} migrados`);
  }

  console.log(`\nMigración completada: ${count} alquileres actualizados`);
  process.exit(0);
}

migrar().catch(err => { console.error(err); process.exit(1); });
