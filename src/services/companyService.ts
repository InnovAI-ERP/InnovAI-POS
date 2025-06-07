// Servicio para gestionar empresas y sus configuraciones
import { companyConfig } from '../config/companyConfig';

// Definir la interfaz para una empresa
export interface Company {
  id: string;
  name: string;
  idNumber: string;
  envFile: string;
  logo?: string;
  isDefault?: boolean;
}

// Almacenamiento local para la empresa seleccionada
const SELECTED_COMPANY_KEY = 'selected_company';

/**
 * Obtiene la lista de empresas disponibles
 */
export const getAvailableCompanies = async (): Promise<Company[]> => {
  try {
    // En una implementación real, esto podría venir de una API o base de datos
    // Por ahora, usamos el archivo de configuración
    return companyConfig.availableCompanies;
  } catch (error) {
    console.error('Error al obtener empresas disponibles:', error);
    return [];
  }
};

/**
 * Obtiene la empresa actualmente seleccionada
 */
export const getSelectedCompany = (): Company | null => {
  try {
    const selectedCompanyId = localStorage.getItem(SELECTED_COMPANY_KEY);
    
    if (!selectedCompanyId) {
      // Si no hay empresa seleccionada, intentar obtener la por defecto
      const defaultCompany = companyConfig.availableCompanies.find(
        company => company.isDefault
      );
      
      if (defaultCompany) {
        return defaultCompany;
      }
      
      return null;
    }
    
    // Buscar la empresa por ID
    const company = companyConfig.availableCompanies.find(
      company => company.id === selectedCompanyId
    );
    
    return company || null;
  } catch (error) {
    console.error('Error al obtener empresa seleccionada:', error);
    return null;
  }
};

/**
 * Selecciona una empresa y carga su configuración
 */
export const selectCompany = async (companyId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Verificar si la empresa existe
    const company = companyConfig.availableCompanies.find(c => c.id === companyId);
    
    if (!company) {
      return { success: false, error: 'Empresa no encontrada' };
    }
    
    // Guardar la selección en localStorage
    localStorage.setItem(SELECTED_COMPANY_KEY, companyId);
    
    // En una implementación real, aquí cargaríamos las variables de entorno del servidor
    // Para simular, vamos a forzar una recarga de la página para que tome las variables
    // que estarían disponibles a nivel de servidor después del login
    
    console.log(`Empresa seleccionada: ${company.name}`);
    
    return { success: true };
  } catch (error) {
    console.error('Error al seleccionar empresa:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
};

/**
 * Carga el archivo .env de una empresa
 * En un entorno real, esto sería una llamada a un endpoint del servidor
 */
export const loadCompanyEnvironment = async (companyId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Verificar si la empresa existe
    const company = companyConfig.availableCompanies.find(c => c.id === companyId);
    
    if (!company) {
      return { success: false, error: 'Empresa no encontrada' };
    }
    
    console.log(`Cargando variables de entorno desde: ${company.envFile}`);
    
    // En un entorno real, esto sería una llamada a un endpoint del backend
    // que cargaría el archivo .env correspondiente
    
    // Importar el servicio de entorno para actualizar las variables
    const { envService } = await import('./envService');
    
    try {
      // Simulación de carga de variables desde el archivo .env de la empresa
      // En el entorno real, aquí se usaría fetch o axios para obtener las variables del servidor
      const companyEnvVars = await fetchCompanyEnvVars(company.id);
      
      // Actualizar el cache del servicio de entorno con las variables de la empresa seleccionada
      envService.updateCache(companyEnvVars);
      
      console.log('Variables de entorno cargadas correctamente para empresa:', company.name);
      return { success: true };
    } catch (envError) {
      console.error('Error al cargar variables de entorno:', envError);
      return { success: false, error: 'Error al cargar variables de entorno' };
    }
  } catch (error) {
    console.error('Error al cargar variables de entorno:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
};

/**
 * Simula la obtención de variables de entorno del servidor basadas en el ID de la empresa
 * En un entorno real, esto sería una llamada a un endpoint del servidor
 */
async function fetchCompanyEnvVars(companyId: string): Promise<Record<string, any>> {
  // Simular un delay para imitar una llamada a la red
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Devolver variables de entorno según el ID de la empresa
  if (companyId === 'innova') {
    return {
      COMPANY_NAME: 'INNOVA & AI GROUP CR SOCIEDAD DE RESPONSABILIDAD LIMITADA',
      IDENTIFICATION_TYPE: '02',
      IDENTIFICATION_NUMBER: '3102928079',
      COMMERCIAL_NAME: 'Grupo InnovAI',
      PROVINCE: 'San José',
      CANTON: 'San José',
      DISTRICT: 'San Sebastian',
      ADDRESS: 'San Sebastian, San José, de la Iglesia Bautista 75 metros sur, 25 oeste, Avenida París',
      PHONE: '506-88821455',
      EMAIL: 'admin@innovaicr.com',
      ECONOMIC_ACTIVITY: '741203',
      ADMIN_USERNAME: '3102928079',
      ADMIN_PASSWORD: 'AutomationBT2023',
      HACIENDA_USERNAME: 'cpj-3-102-928079@stag.comprobanteselectronicos.go.cr',
      HACIENDA_PASSWORD: '}:f%}y>LU7)D|)|I%SwQ'
    };
  } else if (companyId === 'empresa2') {
    return {
      COMPANY_NAME: 'EMPRESA 2 SOCIEDAD ANÓNIMA',
      IDENTIFICATION_TYPE: '02',
      IDENTIFICATION_NUMBER: '3101123456',
      COMMERCIAL_NAME: 'Empresa 2',
      PROVINCE: 'Heredia',
      CANTON: 'Heredia',
      DISTRICT: 'Central',
      ADDRESS: 'Heredia, Centro Comercial Paseo de las Flores, Local #15',
      PHONE: '506-22334455',
      EMAIL: 'admin@empresa2.com',
      ECONOMIC_ACTIVITY: '721001',
      ADMIN_USERNAME: '3101123456',
      ADMIN_PASSWORD: 'empresa2pass',
      HACIENDA_USERNAME: 'cpj-3-101-123456@stag.comprobanteselectronicos.go.cr',
      HACIENDA_PASSWORD: 'contrasena123'
    };
  } else {
    // Si el ID de empresa no coincide, devolver un objeto vacío
    return {};
  }
}

/**
 * Actualiza el archivo .env de una empresa
 */
export const updateCompanyEnvironment = async (
  companyId: string, 
  envData: Record<string, string>
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Verificar si la empresa existe
    const company = companyConfig.availableCompanies.find(c => c.id === companyId);
    
    if (!company) {
      return { success: false, error: 'Empresa no encontrada' };
    }
    
    console.log(`Actualizando variables de entorno para: ${company.name}`);
    
    // Convertir datos a formato .env
    const envContent = Object.entries(envData)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    // En un entorno real, esto sería una llamada a un endpoint del backend
    // que actualizaría el archivo .env correspondiente
    
    console.log('Contenido del archivo .env a actualizar:', envContent);
    
    // Simulación de éxito
    return { success: true };
  } catch (error) {
    console.error('Error al actualizar variables de entorno:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
};
