/**
 * Servicio para manejar variables de entorno de la aplicación
 * Este servicio permite acceder a las variables de entorno cargadas
 * y proporciona valores predeterminados para cuando no están definidas
 */

// Interfaz para todas las variables de entorno utilizadas en la aplicación
export interface EnvVariables {
  // Credenciales de administrador para la empresa
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;

  // Supabase
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  
  // Hacienda
  HACIENDA_API_URL: string;
  HACIENDA_TOKEN_URL: string;
  HACIENDA_CLIENT_ID: string;
  HACIENDA_USERNAME: string;
  HACIENDA_PASSWORD: string;
  HACIENDA_CERTIFICATE_PATH: string;
  
  // Información de la empresa
  COMPANY_NAME: string;
  IDENTIFICATION_TYPE: string;
  IDENTIFICATION_NUMBER: string;
  COMMERCIAL_NAME: string;
  PROVINCE: string;
  CANTON: string;
  DISTRICT: string;
  ADDRESS: string;
  PHONE: string;
  EMAIL: string;
  ECONOMIC_ACTIVITY: string;
  
  // Email
  EMAIL_HOST: string;
  EMAIL_PORT: number;
  EMAIL_SECURE: boolean;
  EMAIL_USER: string;
  EMAIL_PASSWORD: string;
  EMAIL_FROM: string;
  EMAIL_FROM_NAME: string;
  
  // Otros
  INCLUDE_ACCEPTANCE_DOC: boolean;
}

// Singleton para manejar las variables de entorno
class EnvService {
  // Cache de las variables de entorno
  private cache: Partial<EnvVariables> = {};
  
  // Indica si las variables ya fueron inicializadas
  private initialized: boolean = false;
  
  constructor() {
    // Inicializar el cache con las variables actuales
    this.initializeCache();
  }
  
  /**
   * Inicializa el cache con las variables de entorno actuales
   */
  private initializeCache(): void {
    try {
      this.cache = {
        // Credenciales de administrador
        ADMIN_USERNAME: import.meta.env.ADMIN_USERNAME || '',
        ADMIN_PASSWORD: import.meta.env.ADMIN_PASSWORD || '',
        
        // Supabase
        SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
        SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        
        // Hacienda
        HACIENDA_API_URL: import.meta.env.VITE_HACIENDA_API_URL || '',
        HACIENDA_TOKEN_URL: import.meta.env.VITE_HACIENDA_TOKEN_URL || '',
        HACIENDA_CLIENT_ID: import.meta.env.VITE_HACIENDA_CLIENT_ID || '',
        HACIENDA_USERNAME: import.meta.env.VITE_HACIENDA_USERNAME || '',
        HACIENDA_PASSWORD: import.meta.env.VITE_HACIENDA_PASSWORD || '',
        HACIENDA_CERTIFICATE_PATH: import.meta.env.VITE_HACIENDA_CERTIFICATE_PATH || '',
        
        // Información de la empresa
        COMPANY_NAME: import.meta.env.VITE_COMPANY_NAME || '',
        IDENTIFICATION_TYPE: import.meta.env.VITE_IDENTIFICATION_TYPE || '',
        IDENTIFICATION_NUMBER: import.meta.env.VITE_IDENTIFICATION_NUMBER || '',
        COMMERCIAL_NAME: import.meta.env.VITE_COMMERCIAL_NAME || '',
        PROVINCE: import.meta.env.VITE_PROVINCE || '',
        CANTON: import.meta.env.VITE_CANTON || '',
        DISTRICT: import.meta.env.VITE_DISTRICT || '',
        ADDRESS: import.meta.env.VITE_ADDRESS || '',
        PHONE: import.meta.env.VITE_PHONE || '',
        EMAIL: import.meta.env.VITE_EMAIL || '',
        ECONOMIC_ACTIVITY: import.meta.env.VITE_ECONOMIC_ACTIVITY || '',
        
        // Email
        EMAIL_HOST: import.meta.env.EMAIL_HOST || 'smtp.gmail.com',
        EMAIL_PORT: parseInt(import.meta.env.EMAIL_PORT || '465'),
        EMAIL_SECURE: import.meta.env.EMAIL_SECURE === 'true',
        EMAIL_USER: import.meta.env.EMAIL_USER || '',
        EMAIL_PASSWORD: import.meta.env.EMAIL_PASSWORD || '',
        EMAIL_FROM: import.meta.env.EMAIL_FROM || '',
        EMAIL_FROM_NAME: import.meta.env.EMAIL_FROM_NAME || '',
        
        // Otros
        INCLUDE_ACCEPTANCE_DOC: import.meta.env.INCLUDE_ACCEPTANCE_DOC === 'true',
      };
      
      this.initialized = true;
      console.log('Variables de entorno inicializadas correctamente');
    } catch (error) {
      console.error('Error al inicializar variables de entorno:', error);
      this.initialized = false;
    }
  }
  
  /**
   * Actualiza las variables en el cache (simulando una recarga)
   * En un entorno real, esto sería una recarga de la aplicación
   * o una actualización de las variables mediante una petición al servidor
   */
  public updateCache(newValues: Partial<EnvVariables>): void {
    console.log('Actualizando cache de variables de entorno');
    console.log('Empresa anterior:', this.cache.COMPANY_NAME);
    
    // Reemplazar completamente el cache (no combinar con valores anteriores)
    this.cache = { ...newValues };
    
    console.log('Empresa actual:', this.cache.COMPANY_NAME);
    console.log('Variables de entorno actualizadas exitosamente');
  }
  
  /**
   * Obtiene el valor de una variable de entorno
   * @param key Nombre de la variable
   * @param defaultValue Valor predeterminado si la variable no existe
   */
  public get<K extends keyof EnvVariables>(
    key: K, 
    defaultValue?: EnvVariables[K]
  ): EnvVariables[K] {
    if (!this.initialized) {
      this.initializeCache();
    }
    
    const value = this.cache[key];
    return (value !== undefined ? value : defaultValue) as EnvVariables[K];
  }
  
  /**
   * Obtiene todas las variables de entorno como un objeto
   */
  public getAll(): Partial<EnvVariables> {
    if (!this.initialized) {
      this.initializeCache();
    }
    
    return { ...this.cache };
  }
  
  /**
   * Convierte las variables de entorno al formato UserSettings
   * para mantener compatibilidad con el sistema existente
   */
  public toUserSettings() {
    return {
      company_name: this.get('COMPANY_NAME'),
      identification_type: this.get('IDENTIFICATION_TYPE'),
      identification_number: this.get('IDENTIFICATION_NUMBER'),
      commercial_name: this.get('COMMERCIAL_NAME'),
      province: this.get('PROVINCE'),
      canton: this.get('CANTON'),
      district: this.get('DISTRICT'),
      address: this.get('ADDRESS'),
      phone: this.get('PHONE'),
      email: this.get('EMAIL'),
      economic_activity: this.get('ECONOMIC_ACTIVITY'),
      api_username: this.get('HACIENDA_USERNAME'),
      api_password: this.get('HACIENDA_PASSWORD'),
      api_pin: null,
      api_key_path: this.get('HACIENDA_CERTIFICATE_PATH')
    };
  }
  
  /**
   * Simula la carga de variables de entorno desde el servidor
   * @param companyId ID de la empresa
   */
  public async loadFromServer(companyId: string): Promise<boolean> {
    try {
      console.log(`Cargando variables de entorno para la empresa: ${companyId}`);
      
      // En un entorno real, esto sería una petición al servidor
      // para cargar las variables de entorno de la empresa seleccionada
      
      // Simulación de carga exitosa
      // Actualizar cache con algunos valores simulados para demostración
      this.updateCache({
        COMPANY_NAME: `Empresa ${companyId}`,
        IDENTIFICATION_NUMBER: `31${companyId.slice(-2)}12345`
      });
      
      return true;
    } catch (error) {
      console.error('Error al cargar variables de entorno desde el servidor:', error);
      return false;
    }
  }
}

// Exportar instancia única del servicio
export const envService = new EnvService();
