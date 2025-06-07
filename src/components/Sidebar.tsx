import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  History, 
  Settings, 
  ChevronLeft,
  CreditCard, 
  Users, 
  BarChart,
  LogOut,
  Package,
  Database
} from 'lucide-react';
import logoSvg from '../assets/logo-cube.svg';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const Sidebar = ({ isOpen, setIsOpen }: SidebarProps) => {
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };
  
  // Navigation items
  const navItems = [
    { path: '/', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { path: '/crear-factura', label: 'Crear Factura', icon: <FileText className="w-5 h-5" /> },
    { path: '/crear-tiquete', label: 'Crear Tiquete', icon: <FileText className="w-5 h-5" /> },
    { path: '/historial', label: 'Historial', icon: <History className="w-5 h-5" /> },
    { path: '/clientes', label: 'Clientes', icon: <Users className="w-5 h-5" /> },
    { path: '/productos', label: 'Productos o Servicios', icon: <Package className="w-5 h-5" /> },
    { path: '/pagos', label: 'Pagos', icon: <CreditCard className="w-5 h-5" /> },
    { path: '/reportes', label: 'Reportes', icon: <BarChart className="w-5 h-5" /> },
    { path: '/configuracion', label: 'Configuración', icon: <Settings className="w-5 h-5" /> },
    { path: '/admin/database', label: 'Admin. Base de Datos', icon: <Database className="w-5 h-5" /> },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black bg-opacity-50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 transform glass-card border-r dark:border-primary-500/30 border-gold-500/30
        transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:z-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-4 border-b dark:border-primary-500/30 border-gold-500/30">
            <Link to="/" className="flex items-center space-x-2">
              <div className="h-8 w-8 flex items-center justify-center">
                <img src={logoSvg} alt="INNOVAI POS Logo" className="w-8 h-8" />
              </div>
              <span className="text-lg font-semibold bg-gradient-to-r from-primary-400 to-secondary-400 bg-clip-text text-transparent">
               INNOVAI POS
              </span>
            </Link>
            
            <button 
              onClick={() => setIsOpen(false)}
              className="md:hidden p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="h-5 w-5 dark:text-white text-gray-800" />
            </button>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center px-3 py-2 rounded-lg transition-colors
                  ${isActive(item.path) 
                    ? 'dark:bg-primary-500/20 bg-gold-500/20 dark:text-white text-gray-800 border-l-2 dark:border-primary-500 border-gold-500' 
                    : 'dark:text-gray-300 text-gray-600 dark:hover:bg-white/10 hover:bg-gold-500/10 dark:hover:text-white hover:text-gray-800'}
                `}
              >
                {item.icon}
                <span className="ml-3">{item.label}</span>
                
                {isActive(item.path) && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full dark:bg-primary-500 bg-gold-500"></span>
                )}
              </Link>
            ))}
          </nav>
          
          {/* Footer */}
          <div className="p-4 border-t dark:border-primary-500/30 border-gold-500/30">
            <button className="flex items-center w-full px-3 py-2 dark:text-gray-300 text-gray-600 rounded-lg dark:hover:bg-white/10 hover:bg-gold-500/10 dark:hover:text-white hover:text-gray-800 transition-colors">
              <LogOut className="w-5 h-5" />
              <span className="ml-3">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;