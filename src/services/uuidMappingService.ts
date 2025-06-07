// Servicio centralizado para manejar mapeos de IDs a UUIDs para Supabase
// Este servicio asegura que todas las operaciones usen los UUIDs correctos

/**
 * Mapa de IDs de empresas a UUIDs para compatibilidad con Supabase
 * Es crítico usar los UUIDs correctos para todas las operaciones de base de datos
 */
const COMPANY_UUID_MAP: Record<string, string> = {
  // UUID real de la empresa INNOVA - VERIFICADO Y CORRECTO
  'innova': 'ea41ea38-b0d6-4493-a0bb-325194738cb6',
  
  // Sustituir este UUID con el real cuando se tenga disponible
  'empresa2': 'f4a3e7d8-9b6c-5a1f-8e2d-7c4b9d0a3f5e',
  
  // UUID genérico para pruebas y desarrollo local
  'test': 'ea41ea38-b0d6-4493-a0bb-325194738cb6',
  'default': 'ea41ea38-b0d6-4493-a0bb-325194738cb6'
};

// Variable para almacenar el último UUID mapeado (para depuración)
let lastMappedUUID = '';

/**
 * Convierte un ID de empresa (como "innova") al UUID correcto para usar en Supabase
 * 
 * @param companyId ID de la empresa (ej: "innova")
 * @returns UUID válido para usar en Supabase
 */
export const getCompanyUuid = (companyId: string): string => {
  if (!companyId) {
    console.error('⛔ Error: getCompanyUuid llamado con companyId nulo o vacío. Usando UUID por defecto.');
    lastMappedUUID = COMPANY_UUID_MAP['default'];
    return lastMappedUUID;
  }
  
  // Normalizar ID (minúsculas, sin espacios)
  const normalizedId = companyId.toLowerCase().trim();
  
  // Si ya es un UUID válido, devolverlo directamente
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(normalizedId)) {
    console.log(`ℹ️ ID ya es un UUID válido: ${normalizedId}`);
    lastMappedUUID = normalizedId;
    return normalizedId;
  }
  
  // Buscar en el mapa
  const uuid = COMPANY_UUID_MAP[normalizedId];
  if (!uuid) {
    console.error(`⚠️ No se encontró UUID para la empresa: ${normalizedId}. Usando el UUID de INNOVA como respaldo.`);
    lastMappedUUID = COMPANY_UUID_MAP['innova'];
    return lastMappedUUID;
  }
  
  console.log(`✅ Mapeado correcto: '${normalizedId}' → UUID: '${uuid}'`);
  lastMappedUUID = uuid;
  return uuid;
};

/**
 * Obtiene el último UUID mapeado (útil para depuración)
 * @returns El último UUID mapeado
 */
export const getLastMappedUuid = (): string => {
  return lastMappedUUID;
};

/**
 * Los servicios que necesitan usar este mapeo de UUID:
 * - supabaseClientService.ts
 * - supabaseProductService.ts
 * - supabaseInvoiceService.ts
 * - supabaseCompanyService.ts
 * - Cualquier otro servicio que hace referencia a company_id
 */
