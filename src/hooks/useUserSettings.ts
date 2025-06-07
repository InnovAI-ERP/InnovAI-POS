import { useEffect, useState } from 'react';
import { envService } from '../services/envService';
import { getSelectedCompany, updateCompanyEnvironment } from '../services/companyService';

// Definir la interfaz para los ajustes del usuario
export interface UserSettings {
  neighborhood: string;
  user_id?: string;
  company_name: string;
  identification_type: string;
  identification_number: string;
  commercial_name: string | null;
  province: string;
  canton: string;
  district: string;
  address: string | null;
  phone: string | null;
  email: string;
  economic_activity: string;
  api_username: string | null;
  api_password: string | null;
  api_pin: string | null;
  api_key_path: string | null;
  created_at?: string;
  updated_at?: string;
}

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    function loadSettings() {
      try {
        // Verificar si hay una empresa seleccionada
        const selectedCompany = getSelectedCompany();
        
        // Intentar cargar configuración desde localStorage
        const savedSettings = localStorage.getItem('user_settings');
        
        if (savedSettings) {
          // Si hay configuración guardada, usarla
          setSettings(JSON.parse(savedSettings));
        } else if (selectedCompany) {
          // Si hay una empresa seleccionada pero no configuración guardada,
          // usar las variables de entorno actuales convertidas a formato UserSettings
          const defaultSettings = envService.toUserSettings();
          
          // Guardar configuración por defecto
          localStorage.setItem('user_settings', JSON.stringify(defaultSettings));
          setSettings(defaultSettings);
        } else {
          // Si no hay empresa seleccionada ni configuración guardada,
          // crear una configuración predeterminada
          const defaultSettings: UserSettings = {
            company_name: 'INNOVA & AI GROUP CR SOCIEDAD DE RESPONSABILIDAD LIMITADA',
            identification_type: '02',
            identification_number: '3102928079',
            commercial_name: null,
            province: 'San José',
            canton: 'San José',
            district: 'San Sebastian',
            address: 'San Sebastian, San José, de la Iglesia Bautista 75 metros sur, 25 oeste, Avenida París',
            phone: '506-88821455',
            email: 'admin@innovaicr.com',
            economic_activity: '741203',
            api_username: null,
            api_password: null,
            api_pin: null,
            api_key_path: null
          };
          
          // Guardar configuración por defecto
          localStorage.setItem('user_settings', JSON.stringify(defaultSettings));
          setSettings(defaultSettings);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Error al cargar la configuración'));
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  async function updateSettings(updates: Partial<UserSettings>, certificateFile?: File) {
    try {
      // Si hay un archivo de certificado, guardarlo
      let certificatePath = updates.api_key_path;
      if (certificateFile) {
        // En un entorno de navegador, solo almacenamos la ruta del archivo
        certificatePath = `certificados/${certificateFile.name}`;
        console.log('Archivo de certificado seleccionado:', certificateFile.name);
      }

      // Obtener la configuración actual
      const currentSettings = settings || {};
      
      // Crear la nueva configuración combinando la actual con las actualizaciones
      const newSettings: UserSettings = {
        ...currentSettings,
        ...updates,
        api_key_path: certificatePath || updates.api_key_path || currentSettings.api_key_path,
        updated_at: new Date().toISOString()
      } as UserSettings;

      // Guardar en localStorage
      localStorage.setItem('user_settings', JSON.stringify(newSettings));
      
      // Actualizar el estado
      setSettings(newSettings);

      // Verificar si hay una empresa seleccionada para actualizar su archivo .env
      const selectedCompany = getSelectedCompany();
      if (selectedCompany) {
        // Actualizar el archivo .env de la empresa seleccionada en el servidor
        await updateCompanyEnvironment(selectedCompany.id, createEnvContent(newSettings));
        console.log(`Archivo .env actualizado para la empresa: ${selectedCompany.name}`);
      } else {
        // Si no hay empresa seleccionada, actualizar el archivo .env predeterminado
        // y descargarlo para el usuario (compatibilidad con versiones anteriores)
        downloadEnvFile(newSettings);
      }

      return { data: newSettings, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Error al actualizar la configuración') };
    }
  }

  // Crear contenido del archivo .env con los datos del usuario
  function createEnvContent(settings: UserSettings): Record<string, string> {
    return {
      // Mantener los valores actuales de Supabase y otros que no sean del usuario
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
      VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      VITE_HACIENDA_API_URL: import.meta.env.VITE_HACIENDA_API_URL || 'https://api-sandbox.comprobanteselectronicos.go.cr/recepcion/v1/recepcion/',
      VITE_HACIENDA_TOKEN_URL: import.meta.env.VITE_HACIENDA_TOKEN_URL || 'https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/protocol/openid-connect/token',
      VITE_HACIENDA_CLIENT_ID: import.meta.env.VITE_HACIENDA_CLIENT_ID || 'api-stag',
      
      // Valores actualizados del usuario
      VITE_HACIENDA_USERNAME: settings.api_username || '',
      VITE_HACIENDA_PASSWORD: settings.api_password || '',
      VITE_HACIENDA_CERTIFICATE_PATH: settings.api_key_path || '',
      VITE_COMPANY_NAME: settings.company_name || '',
      VITE_IDENTIFICATION_TYPE: settings.identification_type || '',
      VITE_IDENTIFICATION_NUMBER: settings.identification_number || '',
      VITE_COMMERCIAL_NAME: settings.commercial_name || '',
      VITE_PROVINCE: settings.province || '',
      VITE_CANTON: settings.canton || '',
      VITE_DISTRICT: settings.district || '',
      VITE_ADDRESS: settings.address || '',
      VITE_PHONE: settings.phone || '',
      VITE_EMAIL: settings.email || '',
      VITE_ECONOMIC_ACTIVITY: settings.economic_activity || '',
      
      // Configuración del servidor SMTP (mantener valores actuales)
      EMAIL_HOST: import.meta.env.EMAIL_HOST || 'smtp.gmail.com',
      EMAIL_PORT: import.meta.env.EMAIL_PORT || '465',
      EMAIL_SECURE: import.meta.env.EMAIL_SECURE || 'true',
      EMAIL_USER: settings.email || import.meta.env.EMAIL_USER || '',
      EMAIL_PASSWORD: import.meta.env.EMAIL_PASSWORD || '',
      EMAIL_FROM: import.meta.env.EMAIL_FROM || `facturacion@${settings.email?.split('@')[1] || ''}`,
      EMAIL_FROM_NAME: import.meta.env.EMAIL_FROM_NAME || settings.company_name || '',
      
      // Otros
      INCLUDE_ACCEPTANCE_DOC: import.meta.env.INCLUDE_ACCEPTANCE_DOC || 'true'
    };
  }
  
  // Descargar archivo .env para el usuario (compatibilidad con versiones anteriores)
  function downloadEnvFile(settings: UserSettings): boolean {
    try {
      // Convertir el objeto de configuración a formato .env
      const envData = createEnvContent(settings);
      const envContent = Object.entries(envData)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
      
      // Crear un objeto Blob con el contenido
      const blob = new Blob([envContent], { type: 'text/plain' });
      
      // Crear un enlace de descarga
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '.env';
      
      // Simular clic para descargar el archivo
      document.body.appendChild(link);
      link.click();
      
      // Limpiar
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('Archivo .env creado y descargado correctamente');
      return true;
    } catch (error) {
      console.error('Error al descargar el archivo .env:', error);
      return false;
    }
  }

  return { settings, loading, error, updateSettings };
}