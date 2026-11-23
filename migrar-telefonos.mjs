import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

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

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('Uso: node migrar-telefonos.mjs <email> <contraseña>');
  process.exit(1);
}

try {
  await signInWithEmailAndPassword(auth, email, password);
  console.log('Autenticado correctamente');

  const snap = await getDocs(collection(db, 'clientes'));
  let migrados = 0;

  for (const d of snap.docs) {
    const c = d.data();
    if (!c.telefono || c.telefonoPrincipal) continue; // ya migrado o sin telefono

    const partes = c.telefono.split(' / ');
    const ref = doc(db, 'clientes', d.id);
    await updateDoc(ref, {
      telefonoPrincipal: partes[0].trim(),
      telefonoSecundario: partes[1]?.trim() || '',
    });
    migrados++;
    console.log(`  ✅ ${c.apellido}, ${c.nombre}: "${c.telefono}" → principal="${partes[0].trim()}"${partes[1] ? `, secundario="${partes[1].trim()}"` : ''}`);
  }

  console.log(`\nMigración completada: ${migrados} clientes actualizados`);
} catch (e) {
  console.error('Error:', e.message);
}
