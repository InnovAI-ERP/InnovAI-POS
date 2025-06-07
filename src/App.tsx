import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import InvoiceCreate from './pages/InvoiceCreate';
import TiqueteCreate from './pages/TiqueteCreate';
import InvoiceHistory from './pages/InvoiceHistory';
import NewClients from './pages/NewClients';
import Products from './pages/Products';
import UserSettings from './pages/UserSettings';
import Login from './pages/Login';
import DatabaseAdmin from './pages/DatabaseAdmin';
import Pagos from './pages/Pagos';
import { useAuth } from './hooks/useAuth';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Cargando...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
      <Route path="/user-dashboard" element={<Navigate to="/dashboard" />} />
      
      <Route path="/" element={user ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<Navigate to="/dashboard" />} />
      </Route>
      
      <Route path="/dashboard" element={user ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<Dashboard />} />
      </Route>
      
      <Route path="/crear-factura" element={user ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<InvoiceCreate />} />
      </Route>
      
      <Route path="/crear-tiquete" element={user ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<TiqueteCreate />} />
      </Route>
      
      <Route path="/historial" element={user ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<InvoiceHistory />} />
      </Route>

      <Route path="/clientes" element={user ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<NewClients />} />
      </Route>

      <Route path="/productos" element={user ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<Products />} />
      </Route>

      <Route path="/pagos" element={user ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<Pagos />} />
      </Route>

      <Route path="/configuracion" element={user ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<UserSettings />} />
      </Route>
      
      <Route path="/admin/database" element={user ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<DatabaseAdmin />} />
      </Route>
    </Routes>
  );
}

export default App;