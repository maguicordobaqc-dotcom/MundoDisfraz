import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import Clientes from './components/Clientes';
import NuevoAlquiler from './components/NuevoAlquiler';
import Alquileres from './components/Alquileres';
import Reportes from './components/Reportes';
import Ayuda from './components/Ayuda';
import './App.css';

function ProtectedLayout() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/nuevo-alquiler" element={<NuevoAlquiler />} />
          <Route path="/alquileres" element={<Alquileres />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/ayuda" element={<Ayuda />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
