import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { esSupervisor } from '../utils/supervisores';

export default function Navbar() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const supervisor = esSupervisor(user?.email);

  const isActive = (path) => (location.pathname === path ? 'nav-link active' : 'nav-link');

  return (
    <nav className="navbar">
      <Link to="/" className="nav-brand">🎭 Mundo Disfraz</Link>
      <div className="nav-links">
        <Link to="/" className={isActive('/')}>Inicio</Link>
        <Link to="/clientes" className={isActive('/clientes')}>Clientes</Link>
        <Link to="/nuevo-alquiler" className={isActive('/nuevo-alquiler')}>Nuevo Alquiler</Link>
        <Link to="/alquileres" className={isActive('/alquileres')}>Alquileres</Link>
        <Link to="/reportes" className={isActive('/reportes')}>Reportes</Link>
        <Link to="/ayuda" className={isActive('/ayuda')}>Ayuda</Link>
        {supervisor && <Link to="/mantenimiento" className={isActive('/mantenimiento')}>⚙️ Mantenimiento</Link>}
      </div>
      <div className="nav-user">
        <span className="nav-email">{user?.email}</span>
        <button onClick={logout} className="btn btn-small">Salir</button>
      </div>
    </nav>
  );
}
