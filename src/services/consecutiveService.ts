/**
 * Servicio para manejar el reseteo de consecutivos al cambiar entre ambientes
 */

/**
 * Estructura para almacenar la configuración de consecutivos
 */
interface ConsecutiveSettings {
  lastConsecutive: number;
  environment: 'test' | 'prod';
  updatedAt: string;
}

/**
 * Resetea el consecutivo de facturación cuando se cambia de ambiente
 * @param companyId ID de la empresa 
 * @param newEnvironment Nuevo ambiente ('test' o 'prod')
 * @returns Resultado de la operación
 */
export const resetConsecutive = (companyId: string, newEnvironment: 'test' | 'prod'): { success: boolean, message: string } => {
  try {
    const storageKey = `company_${companyId}_consecutive_settings`;
    
    // Obtener la configuración actual si existe
    const currentSettingsStr = localStorage.getItem(storageKey);
    const currentSettings: ConsecutiveSettings = currentSettingsStr 
      ? JSON.parse(currentSettingsStr) 
      : {
          lastConsecutive: 0,
          environment: 'test',
          updatedAt: new Date().toISOString()
        };
    
    // Si el ambiente es diferente, resetear el consecutivo
    if (currentSettings.environment !== newEnvironment) {
      currentSettings.lastConsecutive = 0; // Reiniciar desde cero
      currentSettings.environment = newEnvironment;
      currentSettings.updatedAt = new Date().toISOString();
      
      // Guardar la nueva configuración
      localStorage.setItem(storageKey, JSON.stringify(currentSettings));
      
      return { 
        success: true, 
        message: `Consecutivo reiniciado para ambiente ${newEnvironment === 'prod' ? 'Producción' : 'Pruebas'}`
      };
    }
    
    return { 
      success: true, 
      message: `No se requiere reinicio, ya se está usando el ambiente ${newEnvironment === 'prod' ? 'Producción' : 'Pruebas'}`
    };
  } catch (error) {
    console.error('Error al resetear consecutivo:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Error desconocido al resetear consecutivo'
    };
  }
};

/**
 * Obtiene el siguiente consecutivo para facturas o tiquetes
 * @param companyId ID de la empresa
 * @param tipoDoc Tipo de documento ('01' para Factura, '04' para Tiquete, etc.)
 * @param terminal Número de terminal (default '00001')
 * @param sucursal Número de sucursal (default '001')
 * @returns Número consecutivo completo
 */
export const getNextConsecutive = (
  companyId: string,
  tipoDoc: string = '01',
  terminal: string = '01',  // Terminal: 2 dígitos
  sucursal: string = '002'  // Sucursal: 3 dígitos
): string => {
  try {
    // Validar que terminal tenga 2 dígitos
    if (terminal.length !== 2) {
      console.warn(`Terminal debería tener 2 dígitos, se ha recibido: ${terminal}. Usando '01' como valor predeterminado.`);
      terminal = '01';
    }
    
    // Validar que sucursal tenga 3 dígitos
    if (sucursal.length !== 3) {
      console.warn(`Sucursal debería tener 3 dígitos, se ha recibido: ${sucursal}. Usando '002' como valor predeterminado.`);
      sucursal = '002';
    }
    
    const storageKey = `company_${companyId}_consecutive_settings`;
    
    // Obtener la configuración actual si existe
    let settings: ConsecutiveSettings = { 
      lastConsecutive: 0,
      environment: 'test',
      updatedAt: new Date().toISOString()
    };
    
    const settingsStr = localStorage.getItem(storageKey);
    if (settingsStr) {
      settings = JSON.parse(settingsStr);
    }
    
    // Incrementar el consecutivo
    settings.lastConsecutive += 1;
    settings.updatedAt = new Date().toISOString();
    
    // Guardar la configuración actualizada
    localStorage.setItem(storageKey, JSON.stringify(settings));
    
    // Formatear el consecutivo con ceros a la izquierda (13 dígitos)
    // para que inicie con 0000000000001 y vaya incrementando
    const formattedConsecutive = settings.lastConsecutive.toString().padStart(13, '0');
    
    // Concatenar en el formato requerido: tipoDoc + terminal + sucursal + consecutivo
    // Esto genera un número de 20 dígitos exactos (2+2+3+13 = 20)
    return tipoDoc + terminal + sucursal + formattedConsecutive;
  } catch (error) {
    console.error('Error al obtener consecutivo:', error);
    
    // En caso de error, generar un consecutivo aleatorio para no bloquear al usuario
    const randomConsecutive = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
    return tipoDoc + terminal + sucursal + randomConsecutive;
  }
};

/**
 * Obtiene el ambiente actual configurado para consecutivos
 * @param companyId ID de la empresa
 * @returns Ambiente actual ('test' o 'prod')
 */
export const getCurrentEnvironment = (companyId: string): 'test' | 'prod' => {
  try {
    const storageKey = `company_${companyId}_consecutive_settings`;
    const settingsStr = localStorage.getItem(storageKey);
    
    if (settingsStr) {
      const settings: ConsecutiveSettings = JSON.parse(settingsStr);
      return settings.environment;
    }
    
    // Por defecto, ambiente de pruebas
    return 'test';
  } catch (error) {
    console.error('Error al obtener ambiente:', error);
    return 'test'; // En caso de error, asumir ambiente de pruebas por seguridad
  }
};
