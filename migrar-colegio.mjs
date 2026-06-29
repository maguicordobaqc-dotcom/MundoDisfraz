import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { initializeApp } = await import('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = await import('firebase/firestore');

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

function extraerColegio(items) {
  if (!items || items.length === 0) return '';
  for (const item of items) {
    if (item.colegio) return item.colegio;
    if (item.descripcion) {
      const m = item.descripcion.match(/Colegio:\s*([^,]+)/i);
      if (m) return m[1].trim();
    }
  }
  return '';
}

async function migrar() {
  const snap = await getDocs(collection(db, 'alquileres'));
  let actualizados = 0;

  for (const alq of snap.docs) {
    const data = alq.data();
    if (data.colegio && data.colegio.trim()) continue;

    const colegio = extraerColegio(data.items);
    if (colegio) {
      await updateDoc(doc(db, 'alquileres', alq.id), { colegio });
      actualizados++;
      console.log(`  ✔ ${data.clienteNombre} → "${colegio}"`);
    }
  }

  console.log(`\nActualizados: ${actualizados} alquileres`);
  process.exit(0);
}

migrar().catch(err => { console.error(err); process.exit(1); });
