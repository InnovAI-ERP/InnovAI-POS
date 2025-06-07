import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useUserSettings } from './useUserSettings';
import { getAvailableCompanies, selectCompany, loadCompanyEnvironment } from '../services/companyService';
import { envService } from '../services/envService';

// Comprobar si estamos en modo migración o si debemos usar Supabase
const isLocalMode = false; // Permitir conexión a Supabase para la migración

// Definir la interfaz User para tipar correctamente
interface User {
  id: string;
  email?: string;
  [key: string]: any;
}

export interface Company {
  id: string;
  name: string;
  idNumber: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const navigate = useNavigate();
  const { settings } = useUserSettings();

  // Verificar el estado de autenticación al cargar
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (isLocalMode) {
          // En modo local, simplemente establecer loading a false
          console.log('Modo local activo: sistema funcionando sin Supabase');
        } else {
          // En modo Supabase
          console.log('Modo Supabase activo: conectando con la base de datos');
        }
        setLoading(false);
        
        // Verificar si hay datos de usuario en localStorage
        const savedUser = localStorage.getItem('local_user');
        if (savedUser) {
          try {
            const parsedUser = JSON.parse(savedUser);
            setUser(parsedUser);
            
            // Recuperar información de la empresa seleccionada
            const savedCompanyId = localStorage.getItem('selected_company');
            if (savedCompanyId) {
              const companies = await getAvailableCompanies();
              const savedCompany = companies.find(c => c.id === savedCompanyId);
              if (savedCompany) {
                setCurrentCompany({
                  id: savedCompany.id,
                  name: savedCompany.name,
                  idNumber: savedCompany.idNumber
                });
              }
            }
          } catch (e) {
            console.error('Error al parsear usuario guardado:', e);
          }
        }
      } catch (err) {
        console.error('Error al verificar autenticación:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // No es necesario limpiar suscripciones ya que no hay listeners activos
    return () => {};
  }, [navigate]);


  // Función para iniciar sesión con credenciales específicas e identificar la empresa automáticamente
  const login = async (username: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      // Cargar las empresas disponibles
      const companies = await getAvailableCompanies();
      
      // Verificar si hay empresas configuradas
      if (!companies || companies.length === 0) {
        throw new Error("No hay empresas configuradas en el sistema");
      }
      
      // Buscar la empresa que corresponde a las credenciales proporcionadas
      let foundCompany = null;
      
      // Probar todas las empresas disponibles (esto garantiza que cargamos los archivos .env correctos)
      for (const company of companies) {
        // Cargar el archivo .env de la empresa
        console.log(`Verificando credenciales para empresa: ${company.name}`);
        await loadCompanyEnvironment(company.id);
        
        // Obtener las credenciales almacenadas en el archivo .env específico de esta empresa
        const envConfig = envService.getAll();
        
        // Verificar si la empresa tiene credenciales de administrador configuradas
        if (envConfig.ADMIN_USERNAME && envConfig.ADMIN_PASSWORD) {
          console.log(`Comparando: ${username} === ${envConfig.ADMIN_USERNAME}`);
          
          // Verificar si las credenciales coinciden exactamente con las almacenadas
          if (username === envConfig.ADMIN_USERNAME && password === envConfig.ADMIN_PASSWORD) {
            console.log(`¡Credenciales coinciden con empresa: ${company.name}!`);
            foundCompany = company;
            break; // Encontramos la empresa correcta, salimos del bucle
          }
        } else {
          // Si no hay credenciales específicas pero el username coincide con el ID de la empresa
          // (comportamiento de respaldo)
          if (username === company.idNumber) {
            console.log(`Username coincide con ID de empresa: ${company.name}, verificando contraseña`);
            // En este caso solo aceptaremos contraseñas específicas para cada empresa
            // sin valores predeterminados, para mayor seguridad
            if (company.id === 'innova' && password === 'AutomationBT2023') {
              foundCompany = company;
              break;
            } else if (company.id === 'empresa2' && password === 'empresa2pass') {
              foundCompany = company;
              break;
            }
            // Aquí se pueden añadir más empresas si es necesario
          }
        }
      }
      
      // Si se encontró la empresa, seleccionarla y guardar la sesión
      if (foundCompany) {
        console.log('Empresa encontrada:', foundCompany.name);
        
        // Antes de continuar, asegurarse de que se carguen completamente las variables de entorno
        // de la empresa identificada
        try {
          // Seleccionar la empresa encontrada
          const result = await selectCompany(foundCompany.id);
          
          if (!result.success) {
            console.error('Error al seleccionar empresa:', result.error);
            setError(new Error('No se pudo cargar la configuración de la empresa.'));
            return { success: false, error: 'No se pudo cargar la configuración de la empresa.' };
          }
          
          // Cargar el entorno nuevamente para asegurar que tenemos los datos más recientes
          const envResult = await loadCompanyEnvironment(foundCompany.id);
          if (!envResult.success) {
            console.error('Error al cargar variables de entorno:', envResult.error);
            setError(new Error('No se pudieron cargar las variables de entorno de la empresa.'));
            return { success: false, error: 'No se pudieron cargar las variables de entorno de la empresa.' };
          }
          
          // Verificar que las variables de entorno se hayan cargado correctamente
          const envConfig = envService.getAll();
          
          console.log('Variables de entorno cargadas para:', envConfig.COMPANY_NAME);
          
          // Guardar la sesión en localStorage con información de la empresa
          const userData: User = {
            id: foundCompany.id, // Asegurarnos de incluir el campo id requerido por el tipo User
            email: `${username}@${foundCompany.id}.com`, // Campo requerido por el tipo User
            name: foundCompany.name, // Campo requerido por el tipo User
            companyId: foundCompany.id,
            idNumber: envConfig.IDENTIFICATION_NUMBER || foundCompany.idNumber
          };
          
          // Información adicional para localStorage (no afecta al tipo User)
          const storageData = {
            ...userData,
            lastLogin: new Date().toISOString()
          };
          
          localStorage.setItem('local_user', JSON.stringify(storageData));
          
          // También guardar el ID de la empresa seleccionada para mantener coherencia
          localStorage.setItem('selected_company', foundCompany.id);
          
          // Actualizar el estado con el objeto que cumple con el tipo User
          setUser(userData);
          
          // Establecer la empresa actual
          setCurrentCompany({
            id: foundCompany.id,
            name: foundCompany.name,
            idNumber: foundCompany.idNumber
          });
          
          // Navegar al dashboard
          navigate('/dashboard');
          
          return { success: true, error: null };
        } catch (error) {
          console.error('Error durante el proceso de login:', error);
          // Asegurarnos de que el error sea de tipo Error antes de pasarlo a setError
          setError(error instanceof Error ? error : new Error('Error desconocido durante el login'));
          return { success: false, error: 'Ocurrió un error durante el inicio de sesión. Por favor, intente nuevamente.' };
        }
      } else {
        // Si no se encontró la empresa, mostrar error
        setError(new Error('Credenciales inválidas. Por favor, verifique su nombre de usuario y contraseña.'));
        return { success: false, error: 'Credenciales inválidas. Por favor, verifique su nombre de usuario y contraseña.' };
      }
    } catch (err) {
      const error = err as Error;
      console.error('Error en login:', error);
      setError(error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Función para cerrar sesión
  const logout = async () => {
    try {
      // Eliminar usuario y empresa del estado
      setUser(null);
      setCurrentCompany(null);
      
      // Eliminar usuario del localStorage
      localStorage.removeItem('local_user');
      
      // Redirigir al login
      navigate('/login');
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
      setError(err as Error);
    }
  };

  return {
    user,
    settings,
    loading,
    error,
    login,
    logout,
    currentCompany,
  };
}