import { Menu, Search, Bell } from 'lucide-react';
import { useState, useEffect } from 'react';
// Optional: install framer-motion to enable animations
// import { AnimatePresence } from 'framer-motion';
import UserMenu from './UserMenu';
import ThemeToggle from './ThemeToggle';
import { useUserSettings } from '../hooks/useUserSettings';
import { useAuth } from '../hooks/useAuth';
import { envService } from '../services/envService';

interface HeaderProps {
  openSidebar: () => void;
}

const Header = ({ openSidebar }: HeaderProps) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [companyInfo, setCompanyInfo] = useState({
    name: '',
    idNumber: '',
    idType: '',
    initial: 'U'
  });
  const { settings } = useUserSettings();
  const { user } = useAuth();
  
  // Efecto para obtener y actualizar la información de la empresa
  useEffect(() => {
    // Obtener datos actualizados del entorno
    const envConfig = envService.getAll();
    const companyName = envConfig.COMPANY_NAME || '';
    
    // Obtener la primera letra o iniciales
    let initial = 'U';
    if (companyName) {
      const words = companyName.split(' ');
      if (words.length === 1) {
        initial = words[0].charAt(0);
      } else if (words.length > 1) {
        // Si el nombre tiene más de una palabra, tomar la primera letra de las dos primeras palabras
        initial = words[0].charAt(0) + (words[1].charAt(0) || '');
      }
      // Asegurar que sea mayúscula
      initial = initial.toUpperCase();
    }
    
    setCompanyInfo({
      name: companyName,
      idNumber: envConfig.IDENTIFICATION_NUMBER || '',
      idType: envConfig.IDENTIFICATION_TYPE || '',
      initial
    });
  }, [user]); // Actualizar cuando cambie el usuario
  return (
    <header className="glass-card border-b border-primary-500/30 dark:border-primary-500/30 border-gold-500/30 px-4 py-3 flex items-center justify-between dark:bg-dark-400/80 bg-white/90">
      <div className="flex items-center space-x-4">
        <button 
          onClick={openSidebar}
          className="md:hidden p-2 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Menu"
        >
          <Menu className="h-6 w-6 text-white" />
        </button>
        
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Buscar facturas..." 
            className="pl-10 pr-4 py-2 w-64 dark:bg-dark-400 bg-white border dark:border-gray-700 border-gray-300 rounded-md text-sm dark:text-white text-gray-800 dark:placeholder-gray-400 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>
      
      <div className="flex items-center space-x-3">
        <ThemeToggle />
        <button className="p-2 rounded-full hover:bg-white/10 transition-colors relative">
          <Bell className="h-6 w-6 dark:text-white text-gray-800" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary-500 rounded-full"></span>
        </button>
        
        <div className="flex items-center space-x-3 relative">
          <div className="hidden md:block text-right">
            <p className="text-sm title-primary">{companyInfo.name || 'Usuario Actual'}</p>
            <p className="text-xs title-section">{companyInfo.idNumber || 'Administrador'}</p>
          </div>
          
          <button 
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-md"
          >
            {companyInfo.initial}
          </button>

          <>
            {userMenuOpen && <UserMenu onClose={() => setUserMenuOpen(false)} />}
          </>
        </div>
      </div>
    </header>
  );
};

export default Header;