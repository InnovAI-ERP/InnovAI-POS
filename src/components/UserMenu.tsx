import React, { useRef, useEffect, useState } from 'react';
import { LogOut, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
// Remove framer-motion import since it's not installed
// Replace with CSS transitions or install framer-motion using:
// npm install framer-motion
// or
// yarn add framer-motion
import { useUserSettings } from '../hooks/useUserSettings';
import { useAuth } from '../hooks/useAuth';
import { envService } from '../services/envService';

interface UserMenuProps {
  onClose?: () => void;
}

/**
 * Componente de menú desplegable para el usuario actual
 * Muestra información del usuario y opciones como configuración y cerrar sesión
 */
const UserMenu: React.FC<UserMenuProps> = ({ onClose }) => {
  const { settings } = useUserSettings();
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Estado para almacenar la información de la empresa
  const [companyInfo, setCompanyInfo] = useState({
    name: '',
    idNumber: '',
    email: ''
  });
  
  // Cargar información actualizada de la empresa
  useEffect(() => {
    // Obtener datos actualizados del entorno
    const envConfig = envService.getAll();
    
    setCompanyInfo({
      name: envConfig.COMPANY_NAME || 'Usuario',
      idNumber: envConfig.IDENTIFICATION_NUMBER || 'Sin identificación',
      email: envConfig.EMAIL || 'Sin correo'
    });
  }, [user]); // Actualizar cuando cambie el usuario

  // Función para manejar el cierre de sesión
  const handleLogout = async () => {
    if (onClose) onClose();
    await logout();
    // La redirección se maneja en el hook useAuth
    navigate('/login');
  };

  // Función para ir a la página de configuración
  const goToSettings = () => {
    navigate('/configuracion');
    if (onClose) onClose();
  };

  // Ya no necesitamos esta función ya que obtenemos las iniciales en el Header

  // Efecto para cerrar el menú al hacer clic fuera de él
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        if (onClose) onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      className="fixed right-4 top-14 w-64 mt-2 bg-gradient-to-b from-amber-400 to-amber-500 dark:from-amber-500 dark:to-amber-600 border border-amber-300 dark:border-amber-600 rounded-lg shadow-2xl z-[9999] animate-fadeIn"
      ref={menuRef}
      style={{ boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)' }}
    >
      <div className="p-4 border-b border-amber-300 dark:border-amber-600">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-900">{companyInfo.name}</p>
        <p className="text-xs text-gray-700 dark:text-gray-800">{companyInfo.idNumber}</p>
        <p className="text-xs text-gray-600 dark:text-gray-700 mt-1">{companyInfo.email}</p>
      </div>
      
      <div className="p-2">
        <button 
          onClick={goToSettings}
          className="w-full text-left px-4 py-2 text-sm text-gray-800 dark:text-gray-900 hover:bg-amber-300 dark:hover:bg-amber-400 rounded-md flex items-center space-x-2 transition-colors"
        >
          <Settings size={16} className="text-gray-700 dark:text-gray-800" />
          <span>Configuración</span>
        </button>
        
        <button 
          onClick={handleLogout}
          className="w-full text-left px-4 py-2 text-sm text-gray-800 dark:text-gray-900 hover:bg-amber-300 dark:hover:bg-amber-400 rounded-md flex items-center space-x-2 transition-colors"
        >
          <LogOut size={16} className="text-gray-700 dark:text-gray-800" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </div>
  );
};

export default UserMenu;