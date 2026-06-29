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

async function migrar() {
  const snap = await getDocs(collection(db, 'clientes'));
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const ape = (data.apellido || '').toLowerCase();
    const nom = (data.nombre || '').toLowerCase();
    await updateDoc(doc(db, 'clientes', d.id), {
      apellidoSearch: ape,
      nombreSearch: nom
    });
    count++;
    if (count % 30 === 0) console.log(`  ... ${count}`);
  }
  console.log(`Migrados: ${count} clientes`);
  process.exit(0);
}

migrar().catch(err => { console.error(err); process.exit(1); });
