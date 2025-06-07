/**
 * sequenceService.ts
 * Servicio centralizado para la generación de consecutivos y claves de facturación
 * Este servicio es la fuente única de verdad para todos los consecutivos y claves
 */

import { format } from 'date-fns';
import { supabaseCompanyService } from './supabaseCompanyService';

/**
 * Estructura para almacenar la configuración de consecutivos
 */
interface SequenceSettings {
  lastConsecutive: number;
  environment: 'test' | 'prod';
  updatedAt: string;
}

/**
 * Genera el número consecutivo para facturas y tiquetes según el formato requerido por Hacienda
 * 
 * @param companyId ID de la empresa
 * @param tipoDoc Tipo de documento ('01' para Factura, '04' para Tiquete)
 * @param terminal Terminal (2 dígitos)
 * @param sucursal Sucursal (3 dígitos)
 * @returns Número consecutivo de 20 dígitos
 */
export const generateConsecutiveNumber = (
  companyId: string,
  tipoDoc: string = '01',
  terminal: string = '01',
  sucursal: string = '002'
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
    let settings: SequenceSettings = { 
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
    return tipoDoc + terminal + sucursal + randomConsecutive.padStart(13, '0');
  }
};

/**
 * Genera una clave única para factura/tiquete según el formato de Hacienda (50 dígitos)
 * 
 * Estructura de 50 dígitos:
 * - Código país (3): 506
 * - Fecha (6): ddMMyy
 * - Situación (1): 1 (normal)
 * - Cédula emisor (12): padded con ceros
 * - Número consecutivo (20): incluye tipo (2) + terminal (2) + sucursal (3) + consecutivo (13)
 * - Código seguridad (8): fijo por usuario/compañía
 * 
 * @param companyId ID de la empresa
 * @param emisorNumero Número de identificación del emisor
 * @param tipoDocumento Tipo de documento ('01' para Factura, '04' para Tiquete)
 * @param terminal Terminal (2 dígitos)
 * @param sucursal Sucursal (3 dígitos)
 * @param consecutivoExistente Opcional: Número consecutivo ya generado
 */
export const generateInvoiceKey = async (
  companyId: string,
  emisorNumero: string, 
  tipoDocumento: string = '01', 
  terminal: string = '01', 
  sucursal: string = '002',
  consecutivoExistente?: string
): Promise<string> => {
  // Verificar y formatear los parámetros de entrada
  if (terminal.length !== 2) {
    console.warn(`Terminal debe tener 2 dígitos. Se recibió: ${terminal}. Usando '01' como valor predeterminado.`);
    terminal = '01';
  }

  if (sucursal.length !== 3) {
    console.warn(`Sucursal debe tener 3 dígitos. Se recibió: ${sucursal}. Usando '002' como valor predeterminado.`);
    sucursal = '002';
  }

  const date = new Date();
  const countryCode = '506'; // Costa Rica (3 dígitos exactos)
  const formattedDate = format(date, 'ddMMyy'); // 6 dígitos (ddMMyy)
  const situacion = '1'; // Normal (1 dígito)
  
  // Usar el consecutivo existente si se proporciona, o generar uno nuevo
  let consecutiveNumber: string;
  
  if (consecutivoExistente) {
    console.log('Usando consecutivo existente para la clave:', consecutivoExistente);
    consecutiveNumber = consecutivoExistente;
  } else {
    // Obtener el consecutivo usando la misma función
    console.log('Generando nuevo consecutivo para la clave con tipoDocumento:', tipoDocumento);
    consecutiveNumber = generateConsecutiveNumber(companyId, tipoDocumento, terminal, sucursal);
  }
  
  // Verificar que el consecutivo tenga exactamente 20 dígitos
  if (consecutiveNumber.length !== 20) {
    console.error(`Error: El consecutivo tiene ${consecutiveNumber.length} dígitos en lugar de 20: ${consecutiveNumber}`);
    // Ajustar si es necesario
    if (consecutiveNumber.length < 20) {
      consecutiveNumber = consecutiveNumber.padStart(20, '0');
    } else if (consecutiveNumber.length > 20) {
      consecutiveNumber = consecutiveNumber.substring(0, 20);
    }
  }
  
  // Obtener el código de seguridad fijo del usuario desde Supabase
  const securityCode = await getUserSecurityCode(companyId);
  
  // Build the complete invoice key according to Hacienda's format
  // Format: <country_code><date><situacion><issuer_id><consecutive_number><security_code>
  // Total: 3 + 6 + 1 + 12 + 20 + 8 = 50 dígitos exactos
  let clave = countryCode + formattedDate + situacion + emisorNumero.padStart(12, '0') + consecutiveNumber + securityCode;
  
  // Verificar que la clave tenga exactamente 50 dígitos
  if (clave.length !== 50) {
    console.warn(`La clave generada tiene ${clave.length} dígitos en lugar de 50. Ajustando...`);
    // Si la clave es muy corta, agregar dígitos al código de seguridad (al final)
    if (clave.length < 50) {
      // Agregar dígitos al final para completar 50 caracteres
      const digitsNeeded = 50 - clave.length;
      const additionalSecurityDigits = Array.from({ length: digitsNeeded }, () => 
        Math.floor(Math.random() * 10)).join('');
      clave = clave + additionalSecurityDigits;
    } else if (clave.length > 50) {
      // Si es más larga, recortar manteniendo el código de país (506) intacto
      clave = clave.substring(0, 50);
    }
  }
  
  // Verificar que la clave comience con 506 (código de país)
  if (!clave.startsWith('506')) {
    console.error('Error: La clave no comienza con el código de país 506');
    // Forzar que comience con 506
    clave = '506' + clave.substring(3);
  }
  
  return clave;
};

/**
 * Función unificada para generar secuencias sincronizadas
 * Genera el consecutivo y la clave en una sola operación, garantizando consistencia
 * 
 * @param companyId ID de la empresa
 * @param emisorNumero Número de identificación del emisor
 * @param tipoDocumento Tipo de documento ('01' para Factura, '04' para Tiquete)
 * @param terminal Terminal (2 dígitos)
 * @param sucursal Sucursal (3 dígitos)
 * @returns Objeto con número consecutivo y clave
 */
export const generateSequence = async (
  companyId: string,
  emisorNumero: string,
  tipoDocumento: string = '01',
  terminal: string = '01',
  sucursal: string = '002'
): Promise<{ numeroConsecutivo: string; clave: string }> => {
  // Generar primero el consecutivo
  const numeroConsecutivo = generateConsecutiveNumber(companyId, tipoDocumento, terminal, sucursal);
  
  // Usar ese mismo consecutivo para generar la clave
  const clave = await generateInvoiceKey(companyId, emisorNumero, tipoDocumento, terminal, sucursal, numeroConsecutivo);
  
  console.log(`Secuencia generada: { numeroConsecutivo: ${numeroConsecutivo}, clave: ${clave} }`);
  
  return {
    numeroConsecutivo,
    clave
  };
};

/**
 * Obtiene el código de seguridad fijo de 8 dígitos para la empresa EXCLUSIVAMENTE desde Supabase.
 * Este código DEBE ser el mismo para todas las facturas de la misma empresa y se almacena
 * únicamente en la tabla 'companies' en el campo 'security_code'.
 * 
 * @param companyId ID de la empresa
 * @returns Código de seguridad de 8 dígitos
 */
export const getUserSecurityCode = async (companyId: string): Promise<string> => {
  try {
    // Obtener el código SOLO desde Supabase
    const securityCode = await supabaseCompanyService.getCompanySecurityCode(companyId);
    
    // Verificar que el código sea válido
    if (securityCode && securityCode.length === 8) {
      console.log(`Usando código de seguridad existente (Supabase) para ${companyId}:`, securityCode);
      return securityCode;
    }
    
    // Si el código no es válido, se habrá generado uno nuevo en getCompanySecurityCode
    // pero lo validamos de nuevo por seguridad
    throw new Error('Código de seguridad inválido o no encontrado en Supabase');
  } catch (error: any) {
    console.error('Error grave al obtener código de seguridad:', error);
    throw new Error('No se pudo obtener el código de seguridad: ' + (error?.message || 'Error desconocido'));
  }
};

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
    const currentSettings: SequenceSettings = currentSettingsStr 
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
 * Obtiene el ambiente actual configurado para consecutivos
 * @param companyId ID de la empresa
 * @returns Ambiente actual ('test' o 'prod')
 */
export const getCurrentEnvironment = (companyId: string): 'test' | 'prod' => {
  try {
    const storageKey = `company_${companyId}_consecutive_settings`;
    const settingsStr = localStorage.getItem(storageKey);
    
    if (settingsStr) {
      const settings: SequenceSettings = JSON.parse(settingsStr);
      return settings.environment;
    }
    
    // Por defecto, ambiente de pruebas
    return 'test';
  } catch (error) {
    console.error('Error al obtener ambiente:', error);
    return 'test'; // En caso de error, asumir ambiente de pruebas por seguridad
  }
};
