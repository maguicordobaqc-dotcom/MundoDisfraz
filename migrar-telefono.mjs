import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, updateDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyADK2a6A_tV2kzS5p6R_z_pqrv8BD_4XxA",
  authDomain: "mundo-disfraz.firebaseapp.com",
  projectId: "mundo-disfraz",
  storageBucket: "mundo-disfraz.appspot.com",
  messagingSenderId: "459103153606",
  appId: "1:459103153606:web:1ded1a41aa05d5ad9ec9ca"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrar() {
  console.log('Cargando clientes...');
  const clientesSnap = await getDocs(collection(db, 'clientes'));
  const clientes = {};
  clientesSnap.forEach(d => {
    const data = d.data();
    clientes[d.id] = data.telefono || '';
  });
  console.log(`Clientes cargados: ${Object.keys(clientes).length}`);

  console.log('Cargando alquileres...');
  const alqSnap = await getDocs(query(collection(db, 'alquileres')));
  let actualizados = 0;
  let saltados = 0;

  for (const d of alqSnap.docs) {
    const data = d.data();
    if (data.clienteTelefono) {
      saltados++;
      continue;
    }
    const telefono = clientes[data.clienteId] || '';
    if (telefono) {
      await updateDoc(doc(db, 'alquileres', d.id), { clienteTelefono: telefono });
      actualizados++;
      console.log(`  ✅ ${data.clienteNombre || data.clienteId} → ${telefono}`);
    } else {
      saltados++;
    }
  }

  console.log(`\n✅ Actualizados: ${actualizados}`);
  console.log(`⏭️  Saltados (ya tienen o sin teléfono): ${saltados}`);
  process.exit(0);
}

migrar().catch(err => { console.error(err); process.exit(1); });
