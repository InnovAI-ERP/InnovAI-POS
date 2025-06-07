/**
 * Servicio para consultar la API de Hacienda
 */

interface ContribuyenteResponse {
  nombre?: string;
  tipoIdentificacion?: string;
  regimen?: {
    codigo?: number;
    descripcion?: string;
  };
  situacion?: {
    moroso?: string;
    omiso?: string;
    estado?: string;
    administracionTributaria?: string;
  };
  actividades?: Array<{
    estado?: string;
    tipo?: string;
    codigo?: string;
    descripcion?: string;
  }>;
}

/**
 * Busca un contribuyente por su número de identificación
 * @param identificacion Número de identificación del contribuyente
 * @returns Datos del contribuyente
 */
export const buscarContribuyente = async (identificacion: string): Promise<ContribuyenteResponse | null> => {
  try {
    const response = await fetch(`https://api.hacienda.go.cr/fe/ae?identificacion=${identificacion}`);
    
    if (!response.ok) {
      throw new Error(`Error al consultar la API: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error al buscar contribuyente:', error);
    return null;
  }
};

/**
 * Verifica si el estado del contribuyente es válido para facturación electrónica
 * @param contribuyente Datos del contribuyente obtenidos de la API de Hacienda
 * @returns Un objeto con el resultado de la validación
 */
export const validarEstadoContribuyente = (contribuyente: ContribuyenteResponse | null): { 
  esValido: boolean; 
  mensaje: string;
  estado?: string; 
} => {
  // Si no hay contribuyente, no podemos validar
  if (!contribuyente) {
    return { esValido: false, mensaje: 'No se encontró información del contribuyente' };
  }

  // Estados no válidos para facturación electrónica
  const estadosInvalidos = ['No inscrito', 'Desinscrito', 'Desinscrito oficio'];
  
  const estado = contribuyente.situacion?.estado;
  
  // Si no hay estado, no podemos validar
  if (!estado) {
    return { esValido: false, mensaje: 'No se pudo determinar el estado del contribuyente' };
  }
  
  // Verificar si el estado está en la lista de estados inválidos
  if (estadosInvalidos.includes(estado)) {
    return {
      esValido: false,
      mensaje: `El siguiente cliente no puede incluirse en la base de datos para recibir un comprobante electrónico ya que su estado ante Hacienda es "${estado}"`,
      estado
    };
  }
  
  // Si no está en la lista de inválidos, es válido
  return { esValido: true, mensaje: 'Estado válido', estado };
};

/**
 * Obtiene el tipo de identificación en formato para el formulario
 * @param tipoIdentificacion Tipo de identificación de la API
 * @returns Tipo de identificación para el formulario
 */
export const mapearTipoIdentificacion = (tipoIdentificacion?: string): string => {
  if (!tipoIdentificacion) return '01';
  
  // Mapear el tipo de identificación según la respuesta de la API
  switch (tipoIdentificacion) {
    case '01':
    case '1':
    case 'Física':
      return '01';
    case '02':
    case '2':
    case 'Jurídica':
      return '02';
    case '03':
    case '3':
    case 'DIMEX':
      return '03';
    case '04':
    case '4':
    case 'NITE':
      return '04';
    default:
      return '01';
  }
};