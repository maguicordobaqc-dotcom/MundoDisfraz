// node backup.mjs
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { writeFileSync } from 'fs';

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
const auth = getAuth(app);

const ts = new Date().toISOString().replace(/[:.]/g, '-');

async function backup(name) {
  const snap = await getDocs(collection(db, name));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  writeFileSync(`backup-${name}-${ts}.json`, JSON.stringify(data, null, 2));
  console.log(`${name}: ${data.length} registros guardados`);
}

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('Uso: node backup.mjs <email> <contraseña>');
  process.exit(1);
}

try {
  await signInWithEmailAndPassword(auth, email, password);
  console.log('Autenticado correctamente');
  await backup('clientes');
  await backup('alquileres');
  console.log('Backup completado ✅');
} catch (e) {
  console.error('Error:', e.message);
}
