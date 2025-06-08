/**
 * Servicio para manejar la autenticación y tokens con Hacienda
 */
import axios from 'axios';
import crypto from 'crypto';
import { envService } from './envService';

interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  error?: string;
}

/**
 * Obtiene un token de acceso para la API de Hacienda
 * @returns Objeto con el token de acceso y tiempo de expiración
 */
export const getAccessToken = async (): Promise<TokenResponse> => {
  try {
    // Obtener credenciales desde las variables de entorno
    const username = envService.get('HACIENDA_USERNAME');
    const password = envService.get('HACIENDA_PASSWORD');
    const clientId = envService.get('HACIENDA_CLIENT_ID');
    const tokenUrl = envService.get('HACIENDA_TOKEN_URL');

    // Verificar que todas las credenciales están disponibles
    if (!username || !password || !clientId || !tokenUrl) {
      throw new Error('Faltan credenciales de Hacienda en el archivo de configuración');
    }

    // Configurar los datos para la solicitud
    const formData = new URLSearchParams();
    formData.append('w', 'token');
    formData.append('r', 'gettoken');
    formData.append('grant_type', 'password');
    formData.append('client_id', clientId);
    formData.append('username', username);
    formData.append('password', password);

    // Realizar la solicitud HTTP
    const response = await axios.post(tokenUrl, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Verificar si la respuesta contiene los datos esperados
    if (response.data && response.data.access_token) {
      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in
      };
    } else {
      throw new Error('Respuesta de token inválida');
    }
  } catch (error) {
    console.error('Error al obtener token de acceso:', error);
    
    // Devolver objeto con información de error
    return {
      accessToken: '',
      expiresIn: 0,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

/**
 * Refresca un token de acceso para la API de Hacienda usando el refresh token
 * @param refreshToken Token de refresco previamente obtenido
 * @returns Objeto con el nuevo token de acceso, refresh token y tiempo de expiración
 */
export const refreshAccessToken = async (refreshToken: string): Promise<TokenResponse> => {
  try {
    // Obtener credenciales desde las variables de entorno
    const clientId = envService.get('HACIENDA_CLIENT_ID');
    const tokenUrl = envService.get('HACIENDA_TOKEN_URL');

    // Verificar que todas las credenciales están disponibles
    if (!refreshToken || !clientId || !tokenUrl) {
      throw new Error('Faltan datos para refrescar el token');
    }

    // Configurar los datos para la solicitud
    const formData = new URLSearchParams();
    formData.append('w', 'token');
    formData.append('r', 'refresh');
    formData.append('grant_type', 'refresh_token');
    formData.append('client_id', clientId);
    formData.append('refresh_token', refreshToken);

    // Realizar la solicitud HTTP
    const response = await axios.post(tokenUrl, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Verificar si la respuesta contiene los datos esperados
    if (response.data && response.data.access_token) {
      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in
      };
    } else {
      throw new Error('Respuesta de refresh token inválida');
    }
  } catch (error) {
    console.error('Error al refrescar token de acceso:', error);
    
    // Devolver objeto con información de error
    return {
      accessToken: '',
      expiresIn: 0,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

/**
 * Interfaz para los parámetros necesarios para generar la clave
 */
interface ClaveParams {
  tipoCedula: string;
  cedula: string;
  codigoPais: string;
  consecutivo: string;
  situacion: string;
  codigoSeguridad: string;
  tipoDocumento: string;
  terminal: string;
  sucursal: string;
}

/**
 * Genera una clave de acceso para documentos electrónicos de Hacienda
 * @param params Parámetros necesarios para generar la clave
 * @returns La clave generada o un error
 */
export const generateClave = async (params: ClaveParams): Promise<string> => {
  try {
    // Verificar que todos los parámetros requeridos estén presentes
    const { 
      tipoCedula, 
      cedula, 
      codigoPais, 
      consecutivo, 
      situacion, 
      codigoSeguridad, 
      tipoDocumento, 
      terminal, 
      sucursal 
    } = params;

    if (!tipoCedula || !cedula || !codigoPais || !consecutivo || 
        !situacion || !codigoSeguridad || !tipoDocumento || 
        !terminal || !sucursal) {
      throw new Error('Faltan parámetros requeridos para generar la clave');
    }

    // Obtener la fecha actual en formato DDMMAA
    const now = new Date();
    const fechaEmision = `${now.getDate().toString().padStart(2, '0')}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getFullYear().toString().slice(-2)}`;

    // Concatenar los valores en el orden requerido
    const concatenatedString = `${tipoCedula}${cedula}${codigoPais}${consecutivo}${fechaEmision}${situacion}`;

    // Calcular el SHA-1 de la cadena concatenada
    const hash = crypto.createHash('sha1').update(concatenatedString).digest();
    
    // Codificar el hash en Base64
    const base64Hash = hash.toString('base64');

    return base64Hash;
  } catch (error) {
    console.error('Error al generar clave:', error);
    throw error;
  }
};

/**
 * Alternativa para generar la clave usando la API de Hacienda
 * @param params Parámetros necesarios para generar la clave
 * @returns La clave generada por la API
 */
export const generateClaveViaAPI = async (params: ClaveParams): Promise<string> => {
  try {
    // Configurar los datos para la solicitud
    const formData = new URLSearchParams();
    formData.append('w', 'clave');
    formData.append('r', 'clave');
    formData.append('tipoCedula', params.tipoCedula);
    formData.append('cedula', params.cedula);
    formData.append('codigoPais', params.codigoPais);
    formData.append('consecutivo', params.consecutivo);
    formData.append('situacion', params.situacion);
    formData.append('codigoSeguridad', params.codigoSeguridad);
    formData.append('tipoDocumento', params.tipoDocumento);
    formData.append('terminal', params.terminal);
    formData.append('sucursal', params.sucursal);

    // Realizar la solicitud HTTP
    const response = await axios.post('https://api.hacienda.go.cr/fe/ae', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Verificar si la respuesta contiene la clave
    if (response.data && response.data.clave) {
      return response.data.clave;
    } else {
      throw new Error('Respuesta de generación de clave inválida');
    }
  } catch (error) {
    console.error('Error al generar clave via API:', error);
    throw error;
  }
};

/**
 * Gestiona los tokens de acceso con almacenamiento y refresco automático
 */
class TokenManager {
  private tokenData: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  } | null = null;

  /**
   * Obtiene un token válido, refrescándolo si es necesario
   * @returns Token de acceso válido
   */
  async getValidToken(): Promise<string> {
    // Si no hay token o está próximo a expirar (menos de 5 minutos), obtener uno nuevo
    const now = Date.now();
    const tokenExpiryBuffer = 5 * 60 * 1000; // 5 minutos en milisegundos

    if (!this.tokenData || now >= (this.tokenData.expiresAt - tokenExpiryBuffer)) {
      // Si tenemos un refresh token y no ha expirado completamente, intentar refrescar
      if (this.tokenData && this.tokenData.refreshToken && now < this.tokenData.expiresAt) {
        try {
          const refreshResult = await refreshAccessToken(this.tokenData.refreshToken);
          
          if (refreshResult.accessToken && !refreshResult.error) {
            this.tokenData = {
              accessToken: refreshResult.accessToken,
              refreshToken: refreshResult.refreshToken || this.tokenData.refreshToken,
              expiresAt: now + (refreshResult.expiresIn * 1000)
            };
          } else {
            // Si falla el refresco, obtener un token nuevo
            await this.fetchNewToken();
          }
        } catch (error) {
          // Si hay error en el refresco, obtener un token nuevo
          await this.fetchNewToken();
        }
      } else {
        // Si no hay token o ha expirado completamente, obtener uno nuevo
        await this.fetchNewToken();
      }
    }

    return this.tokenData?.accessToken || '';
  }

  /**
   * Obtiene un nuevo token de acceso
   */
  private async fetchNewToken(): Promise<void> {
    try {
      const tokenResult = await getAccessToken();
      
      if (tokenResult.accessToken && !tokenResult.error) {
        this.tokenData = {
          accessToken: tokenResult.accessToken,
          refreshToken: tokenResult.refreshToken || '',
          expiresAt: Date.now() + (tokenResult.expiresIn * 1000)
        };
      } else {
        throw new Error(tokenResult.error || 'No se pudo obtener el token');
      }
    } catch (error) {
      console.error('Error al obtener nuevo token:', error);
      this.tokenData = null;
      throw error;
    }
  }

  /**
   * Invalida el token actual forzando su renovación en la próxima solicitud
   */
  invalidateToken(): void {
    this.tokenData = null;
  }
}

// Exportar una instancia del gestor de tokens para uso en toda la aplicación
export const tokenManager = new TokenManager();
