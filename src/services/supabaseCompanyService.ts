import { supabase } from '../lib/supabase';
import { envService } from './envService';

// Tipos para la tabla de empresas
export interface Company {
  id: string;
  name: string;
  legal_name: string;
  identification_type: string;
  identification_number: string;
  email: string;
  phone?: string;
  address?: string;
  province?: string;
  canton?: string;
  district?: string;
  postal_code?: string;
  hacienda_username?: string;
  hacienda_password?: string;
  currency?: string;
  tax_regime?: string;
  economic_activity?: string;
  security_code?: string; // Código de seguridad para comprobantes electrónicos
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Tipos para la tabla de configuración de empresas
export interface CompanySettings {
  id?: string;
  company_id: string;
  
  // Credenciales de administrador
  admin_username?: string;
  admin_password?: string;
  
  // Credenciales de Hacienda
  hacienda_api_url?: string;
  hacienda_token_url?: string;
  hacienda_client_id?: string;
  hacienda_username?: string;
  hacienda_password?: string;
  hacienda_certificate_path?: string;
  hacienda_token?: string;
  
  // Datos del emisor
  company_name: string;
  identification_type: string;
  identification_number: string;
  commercial_name?: string;
  province?: string;
  canton?: string;
  district?: string;
  address?: string;
  phone?: string;
  email?: string;
  economic_activity?: string;
  
  // Configuración del servidor SMTP
  email_host?: string;
  email_port?: number;
  email_secure?: boolean;
  email_user?: string;
  email_password?: string;
  email_from?: string;
  email_from_name?: string;
  
  // Otras configuraciones
  include_acceptance_doc?: boolean;
  logo_path?: string;
  
  created_at?: string;
  updated_at?: string;
}

/**
 * Servicio para gestionar empresas y sus configuraciones en Supabase
 */
class SupabaseCompanyService {
  private selectedCompanyId: string | null = null;
  
  constructor() {
    // Intentar cargar la empresa seleccionada del localStorage (compatibilidad durante la migración)
    this.selectedCompanyId = localStorage.getItem('selected_company');
  }
  
  /**
   * Obtiene el código de seguridad de una empresa para comprobantes electrónicos
   * Si no existe, genera uno nuevo y lo guarda en Supabase
   * 
   * @param companyId ID de la empresa
   * @returns Código de seguridad de 8 dígitos
   */
  /**
   * Obtiene el código de seguridad de una empresa desde Supabase.
   * Si no existe un código de seguridad, genera uno nuevo y lo guarda en la base de datos.
   * 
   * @param companyId ID de la empresa
   * @returns Código de seguridad de 8 dígitos
   */
  async getCompanySecurityCode(companyId: string): Promise<string> {
    try {
      // 1. Verificar si hay algún código persistente en una sesión previa en localStorage solo para validación
      const storageKey = `company_${companyId}_security_code`;
      const cachedCode = localStorage.getItem(storageKey);
      
      // 2. Intentar obtener el código de seguridad existente desde Supabase
      const company = await this.getCompanyById(companyId);
      
      // 3. Si existe en Supabase y es válido, devolverlo y actualizar caché
      if (company?.security_code && company.security_code.length === 8) {
        console.log(`Usando código de seguridad existente para empresa ${companyId} desde Supabase:`, company.security_code);
        localStorage.setItem(storageKey, company.security_code); // Actualiza caché local
        return company.security_code;
      }
      
      // 4. Si no existe en Supabase pero tenemos uno en caché, usarlo y guardarlo en Supabase
      if (cachedCode && cachedCode.length === 8) {
        console.log(`Usando código de seguridad en caché para empresa ${companyId}:`, cachedCode);
        // Guardar en Supabase para futuras consultas
        await this.updateCompanySecurityCode(companyId, cachedCode);
        return cachedCode;
      }
      
      // 5. Si no existe ni en Supabase ni en caché, generar uno nuevo y FIJO
      const newSecurityCode = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('');
      console.log(`Generado nuevo código de seguridad para empresa ${companyId}:`, newSecurityCode);
      
      // 6. Guardar el nuevo código en localStorage inmediatamente como respaldo
      localStorage.setItem(storageKey, newSecurityCode);
      
      // 7. Guardar en Supabase y esperar a que se complete
      const result = await this.updateCompanySecurityCode(companyId, newSecurityCode);
      
      if (result.success) {
        console.log('Código de seguridad guardado exitosamente en Supabase');
        return newSecurityCode;
      } else {
        console.error('Error al guardar código en Supabase, pero ya está en localStorage:', result.error);
        return newSecurityCode; // Devolvemos el código aunque falle Supabase, ya que está en localStorage
      }
    } catch (error: any) {
      console.error('Error al obtener/guardar código de seguridad:', error);
      
      // 8. Si ocurre algún error, verificar si tenemos un código en localStorage como último recurso
      const storageKey = `company_${companyId}_security_code`;
      const cachedCode = localStorage.getItem(storageKey);
      
      if (cachedCode && cachedCode.length === 8) {
        console.warn(`Recuperando código de seguridad de respaldo para empresa ${companyId}:`, cachedCode);
        return cachedCode;
      }
      
      throw new Error('No se pudo obtener el código de seguridad: ' + (error?.message || 'Error desconocido'));
    }
  }
  
  /**
   * Actualiza el código de seguridad de una empresa en Supabase
   * 
   * @param companyId ID de la empresa
   * @param securityCode Código de seguridad (8 dígitos)
   * @returns Resultado de la operación
   */
  async updateCompanySecurityCode(companyId: string, securityCode: string): Promise<{ success: boolean; error?: any }> {
    try {
      console.log(`Actualizando código de seguridad para empresa ${companyId}:`, securityCode);
      
      // Si el companyId es 'default', verificar si tenemos una empresa real para usar
      let targetCompanyId = companyId;
      
      if (companyId === 'default') {
        // Intentar obtener una empresa real para actualizar
        try {
          const { data } = await supabase
            .from('companies')
            .select('id')
            .eq('is_active', true)
            .limit(1);
            
          if (data && data.length > 0) {
            targetCompanyId = data[0].id;
            console.log(`Usando ID real ${targetCompanyId} en lugar de 'default'`);
          }
        } catch (findError) {
          console.error('Error al buscar empresa real para actualizar:', findError);
        }
      }
      
      // Intentar actualizar la empresa en Supabase
      const { error } = await supabase
        .from('companies')
        .update({ security_code: securityCode, updated_at: new Date().toISOString() })
        .eq('id', targetCompanyId);
      
      if (error) {
        console.error('Error al actualizar código de seguridad:', error);
        
        // Si falló la actualización, intentar insertar una nueva empresa
        if (error.code === '22P02' || error.code === '23503') { // Error de UUID o FK
          console.log('Intentando crear nueva empresa con el código de seguridad...');
          
          const newCompany = {
            id: targetCompanyId === 'default' ? undefined : targetCompanyId, // Permitir que Supabase genere un UUID
            name: 'Empresa Predeterminada',
            legal_name: 'Empresa Predeterminada S.A.',
            identification_type: '02',
            identification_number: '0000000000',
            email: 'info@empresa.com',
            security_code: securityCode,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_active: true
          };
          
          const { data, error: insertError } = await supabase
            .from('companies')
            .insert([newCompany])
            .select();
            
          if (insertError) {
            console.error('Error al crear nueva empresa:', insertError);
            return { success: false, error: insertError };
          }
          
          console.log('Nueva empresa creada exitosamente con código de seguridad', data);
          return { success: true };
        } else {
          return { success: false, error };
        }
      }
      
      console.log(`Código de seguridad actualizado con éxito para empresa ${companyId}`);
      return { success: true };
    } catch (error) {
      console.error('Error en updateCompanySecurityCode:', error);
      return { success: false, error };
    }
  }
  
  /**
   * Obtiene la lista de empresas disponibles
   */
  /**
   * Crea una nueva empresa en Supabase
   */
  async createCompany(companyData: Omit<Company, 'id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; data?: Company; error?: any }> {
    try {
      console.log('Creando empresa en Supabase con estructura corregida:', companyData.name);
      const { data, error } = await supabase
        .from('companies')
        .insert({
          name: companyData.name,
          legal_name: companyData.legal_name || companyData.name,
          identification_type: companyData.identification_type,
          identification_number: companyData.identification_number,
          email: companyData.email || 'info@empresa.com',
          phone: companyData.phone || '',
          address: companyData.address || '',
          province: companyData.province || '',
          canton: companyData.canton || '',
          district: companyData.district || '',
          is_active: true
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error al crear empresa:', error);
        return { success: false, error };
      }
      
      console.log('Empresa creada con éxito en Supabase:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Error en createCompany:', error);
      return { success: false, error };
    }
  }

  /**
   * Obtiene la lista de empresas disponibles
   */
  async getCompanies(): Promise<Company[]> {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name');
        
      if (error) {
        console.error('Error al obtener empresas:', error);
        throw error;
      }
      
      const companies = data || [];
      console.log('Empresas obtenidas de Supabase:', companies.length);
      return companies;
    } catch (error) {
      console.error('Error en getCompanies:', error);
      // Ya no usamos fallback a localStorage, para asegurar que los datos vengan de Supabase
      return [];
      
      // Datos predeterminados si todo falla
      return [
        {
          id: 'innova',
          name: 'INNOVA & AI GROUP CR SOCIEDAD DE RESPONSABILIDAD LIMITADA',
          legal_name: 'INNOVA & AI GROUP CR SOCIEDAD DE RESPONSABILIDAD LIMITADA',
          identification_type: '02',
          identification_number: '3102928079',
          email: 'info@innovaicr.com',
          phone: '',
          address: '',
          province: '',
          canton: '',
          district: '',
          is_active: true
        },
        {
          id: 'empresa2',
          name: 'KEVIN ALONSO UMAÑA TREJOS',
          legal_name: 'KEVIN ALONSO UMAÑA TREJOS',
          identification_type: '01',
          identification_number: '115550190',
          email: 'kevin@example.com',
          phone: '',
          address: '',
          province: '',
          canton: '',
          district: '',
          is_active: true
        }
      ];
    }
  }
  
  /**
   * Obtiene una empresa por su ID
   */
  async getCompanyById(companyId: string): Promise<Company | null> {
    // Si el companyId es 'default', usar un ID específico para consultar en la base de datos
    // o buscar la empresa predeterminada
    if (companyId === 'default') {
      try {
        // Intentar obtener la primera empresa activa (como fallback para 'default')
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .eq('is_active', true)
          .limit(1);
          
        if (error) {
          console.error('Error al obtener empresa predeterminada:', error);
          // No lanzar el error, seguir con el fallback
        } else if (data && data.length > 0) {
          console.log('Usando primera empresa activa como predeterminada:', data[0].id);
          return data[0];
        }
      } catch (error) {
        console.error('Error al buscar empresa predeterminada:', error);
        // Continuar con el fallback
      }
    } else {
      // Si tenemos un ID específico que no es 'default', intentar obtenerlo directamente
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .eq('id', companyId)
          .single();
          
        if (error) {
          console.error(`Error al obtener empresa ${companyId}:`, error);
          // No lanzar el error, seguir con el fallback
        } else if (data) {
          return data;
        }
      } catch (error) {
        console.error(`Error en getCompanyById para ${companyId}:`, error);
        // Continuar con el fallback
      }
    }
    
    // Si llegamos aquí, no se encontró la empresa en Supabase
    // Intentar usar memoria local como último recurso
    const localCompanyData = localStorage.getItem(`company_${companyId}`);
    if (localCompanyData) {
      try {
        const localCompany = JSON.parse(localCompanyData);
        console.log(`Usando datos locales para empresa ${companyId}`, localCompany);
        return localCompany;
      } catch (error) {
        console.error('Error al parsear datos locales de empresa:', error);
      }
    }
    
    // Si todo falla, devolver un objeto mínimo para evitar errores
    const fallbackCompany: Company = {
      id: companyId,
      name: 'Empresa Predeterminada',
      legal_name: 'Empresa Predeterminada S.A.',
      identification_type: '02',
      identification_number: '0000000000',
      email: 'info@empresa.com',
      security_code: '',  // Este campo se llenará en getCompanySecurityCode
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true
    };
    
    console.log(`Creando empresa fallback para ${companyId}`, fallbackCompany);
    return fallbackCompany;
  }
  
  /**
   * Obtiene una empresa por su número de identificación
   */
  async getCompanyByIdNumber(idNumber: string): Promise<Company | null> {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('identification_number', idNumber)
        .single();
        
      if (error) {
        console.error(`Error al obtener empresa por número ${idNumber}:`, error);
        throw error;
      }
      
      return data || null;
    } catch (error) {
      console.error(`Error en getCompanyByIdNumber para ${idNumber}:`, error);
      
      // Compatibilidad con el sistema antiguo durante la migración
      try {
        const companies = await this.getCompanies();
        return companies.find(c => c.identification_number === idNumber) || null;
      } catch (fallbackError) {
        console.error('Error en fallback para getCompanyByIdNumber:', fallbackError);
        return null;
      }
    }
  }
  
  /**
   * Obtiene la empresa seleccionada actualmente
   */
  async getSelectedCompany(): Promise<Company | null> {
    if (!this.selectedCompanyId) {
      // Si no hay una empresa seleccionada, intentar obtener la empresa predeterminada
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .eq('is_default', true)
          .single();
          
        if (error) {
          console.error('Error al obtener empresa predeterminada:', error);
          // Si no hay una empresa predeterminada, obtener la primera empresa disponible
          const companies = await this.getCompanies();
          if (companies.length > 0) {
            this.selectedCompanyId = companies[0].id;
            return companies[0];
          }
          return null;
        }
        
        if (data) {
          this.selectedCompanyId = data.id;
          return data;
        }
        
        return null;
      } catch (error) {
        console.error('Error al obtener empresa seleccionada:', error);
        return null;
      }
    }
    
    return this.getCompanyById(this.selectedCompanyId);
  }
  
  /**
   * Selecciona una empresa y carga su configuración
   */
  async selectCompany(companyId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Verificar si la empresa existe
      const company = await this.getCompanyById(companyId);
      
      if (!company) {
        return { success: false, error: 'Empresa no encontrada' };
      }
      
      // Establecer la empresa seleccionada
      this.selectedCompanyId = companyId;
      localStorage.setItem('selected_company', companyId);
      
      // Cargar configuración de la empresa
      const settings = await this.getCompanySettings(companyId);
      
      if (!settings) {
        return { success: false, error: 'No se pudo cargar la configuración de la empresa' };
      }
      
      // Actualizar el servicio de entorno con la configuración de la empresa
      this.updateEnvironmentVariables(settings);
      
      console.log(`Empresa seleccionada: ${company.name}`);
      
      return { success: true };
    } catch (error) {
      console.error('Error al seleccionar empresa:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      };
    }
  }
  
  /**
   * Obtiene la configuración de una empresa
   */
  async getCompanySettings(companyId: string): Promise<CompanySettings | null> {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', companyId)
        .single();
        
      if (error) {
        console.error(`Error al obtener configuración para ${companyId}:`, error);
        throw error;
      }
      
      return data || null;
    } catch (error) {
      console.error(`Error en getCompanySettings para ${companyId}:`, error);
      
      // Compatibilidad con el sistema antiguo durante la migración
      // Si no hay datos en Supabase, intentar cargar desde el archivo .env
      try {
        // Obtener la empresa
        const company = await this.getCompanyById(companyId);
        
        if (company) {
          // Intentar cargar variables de entorno para esta empresa
          // Ya que no tenemos env_file_path, usaremos el ID de la empresa para determinar el archivo
          await this.loadCompanyEnvironment(companyId);
          
          // Obtener todas las variables de entorno
          const envVars = envService.getAll();
          
          // Convertir las variables de entorno al formato CompanySettings
          const settings: CompanySettings = {
            company_id: companyId,
            
            // Credenciales de administrador
            admin_username: envVars.ADMIN_USERNAME,
            admin_password: envVars.ADMIN_PASSWORD,
            
            // Credenciales de Hacienda
            hacienda_api_url: envVars.HACIENDA_API_URL,
            hacienda_token_url: envVars.HACIENDA_TOKEN_URL,
            hacienda_client_id: envVars.HACIENDA_CLIENT_ID,
            hacienda_username: envVars.HACIENDA_USERNAME,
            hacienda_password: envVars.HACIENDA_PASSWORD,
            hacienda_certificate_path: envVars.HACIENDA_CERTIFICATE_PATH,
            
            // Datos del emisor
            company_name: envVars.COMPANY_NAME || '',
            identification_type: envVars.IDENTIFICATION_TYPE || '',
            identification_number: envVars.IDENTIFICATION_NUMBER || '',
            commercial_name: envVars.COMMERCIAL_NAME || '',
            province: envVars.PROVINCE,
            canton: envVars.CANTON,
            district: envVars.DISTRICT,
            address: envVars.ADDRESS,
            phone: envVars.PHONE,
            email: envVars.EMAIL,
            economic_activity: envVars.ECONOMIC_ACTIVITY,
            
            // Configuración del servidor SMTP
            email_host: envVars.EMAIL_HOST,
            email_port: typeof envVars.EMAIL_PORT === 'string' ? parseInt(envVars.EMAIL_PORT) : envVars.EMAIL_PORT,
            email_secure: typeof envVars.EMAIL_SECURE === 'string' ? envVars.EMAIL_SECURE === 'true' : Boolean(envVars.EMAIL_SECURE),
            email_user: envVars.EMAIL_USER || '',
            email_password: envVars.EMAIL_PASSWORD || '',
            email_from: envVars.EMAIL_FROM || '',
            email_from_name: envVars.EMAIL_FROM_NAME || '',
            
            // Otras configuraciones
            include_acceptance_doc: typeof envVars.INCLUDE_ACCEPTANCE_DOC === 'string' ? envVars.INCLUDE_ACCEPTANCE_DOC === 'true' : Boolean(envVars.INCLUDE_ACCEPTANCE_DOC)
          };
          
          // Guardar la configuración en Supabase para futuras consultas
          this.saveCompanySettings(settings)
            .then(() => console.log(`Configuración de empresa ${companyId} migrada a Supabase`))
            .catch(err => console.error(`Error al migrar configuración a Supabase:`, err));
          
          return settings;
        }
      } catch (fallbackError) {
        console.error('Error en fallback para getCompanySettings:', fallbackError);
      }
      
      return null;
    }
  }
  
  /**
   * Guarda la configuración de una empresa
   */
  async saveCompanySettings(settings: CompanySettings): Promise<{ success: boolean; error?: string }> {
    try {
      // Verificar si ya existe configuración para esta empresa
      const { data: existingSettings } = await supabase
        .from('company_settings')
        .select('id')
        .eq('company_id', settings.company_id)
        .single();
      
      let result;
      
      if (existingSettings) {
        // Actualizar configuración existente
        const { error } = await supabase
          .from('company_settings')
          .update(settings)
          .eq('id', existingSettings.id);
          
        if (error) throw error;
        
        result = { success: true };
      } else {
        // Insertar nueva configuración
        const { error } = await supabase
          .from('company_settings')
          .insert(settings);
          
        if (error) throw error;
        
        result = { success: true };
      }
      
      // Actualizar el servicio de entorno con la nueva configuración
      this.updateEnvironmentVariables(settings);
      
      return result;
    } catch (error) {
      console.error('Error al guardar configuración de empresa:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      };
    }
  }
  
  /**
   * Carga el archivo .env de una empresa (compatibilidad con el sistema antiguo)
   */
  async loadCompanyEnvironment(companyId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Verificar si la empresa existe
      const company = await this.getCompanyById(companyId);
      
      if (!company) {
        return { success: false, error: 'Empresa no encontrada' };
      }
      
      // Primero intentar obtener la configuración desde Supabase
      const settings = await this.getCompanySettings(companyId);
      
      if (settings) {
        // Actualizar el servicio de entorno con la configuración obtenida
        this.updateEnvironmentVariables(settings);
        return { success: true };
      }
      
      // Si no hay datos en Supabase, intentar cargar directamente desde localStorage o el servicio de entorno
      try {
        // Usar el servicio de entorno para obtener las variables
        const envVars = envService.getAll() || {};
        
        if (Object.keys(envVars).length > 0) {
          // Actualizar el servicio de entorno con las variables cargadas
          envService.updateCache(envVars);
          
          console.log('Variables de entorno cargadas correctamente para empresa:', company.name);
          return { success: true };
        }
      } catch (envError) {
        console.error('Error al cargar variables de entorno:', envError);
        return { success: false, error: 'Error al cargar variables de entorno' };
      }
      
      return { success: false, error: 'No se pudo cargar la configuración de la empresa' };
    } catch (error) {
      console.error('Error al cargar variables de entorno:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      };
    }
  }
  
  /**
   * Actualiza las variables de entorno en el servicio de entorno
   */
  private updateEnvironmentVariables(settings: CompanySettings): void {
    // Convertir las configuraciones de la empresa al formato de variables de entorno
    const envVars = {
      // Credenciales de administrador
      ADMIN_USERNAME: settings.admin_username || '',
      ADMIN_PASSWORD: settings.admin_password || '',
      
      // Credenciales de Hacienda
      HACIENDA_API_URL: settings.hacienda_api_url || '',
      HACIENDA_TOKEN_URL: settings.hacienda_token_url || '',
      HACIENDA_CLIENT_ID: settings.hacienda_client_id || '',
      HACIENDA_USERNAME: settings.hacienda_username || '',
      HACIENDA_PASSWORD: settings.hacienda_password || '',
      HACIENDA_CERTIFICATE_PATH: settings.hacienda_certificate_path || '',
      HACIENDA_TOKEN: settings.hacienda_token || '',
      
      // Datos del emisor
      COMPANY_NAME: settings.company_name || '',
      IDENTIFICATION_TYPE: settings.identification_type || '',
      IDENTIFICATION_NUMBER: settings.identification_number || '',
      COMMERCIAL_NAME: settings.commercial_name || '',
      PROVINCE: settings.province || '',
      CANTON: settings.canton || '',
      DISTRICT: settings.district || '',
      ADDRESS: settings.address || '',
      PHONE: settings.phone || '',
      EMAIL: settings.email || '',
      ECONOMIC_ACTIVITY: settings.economic_activity || '',
      
      // Configuración del servidor SMTP
      EMAIL_HOST: settings.email_host || '',
      EMAIL_PORT: settings.email_port || 0,
      EMAIL_SECURE: settings.email_secure || false,
      EMAIL_USER: settings.email_user || '',
      EMAIL_PASSWORD: settings.email_password || '',
      EMAIL_FROM: settings.email_from || '',
      EMAIL_FROM_NAME: settings.email_from_name || '',
      
      // Otras configuraciones
      INCLUDE_ACCEPTANCE_DOC: settings.include_acceptance_doc || false
    };
    
    // Actualizar el servicio de entorno
    envService.updateCache(envVars);
  }
}

// Exportar la instancia del servicio
export const supabaseCompanyService = new SupabaseCompanyService();
