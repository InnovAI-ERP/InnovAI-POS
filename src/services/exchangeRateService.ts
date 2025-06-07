import axios from 'axios';

/**
 * Interfaz para el tipo de cambio del dólar
 */
interface DollarExchangeRate {
  venta: {
    fecha: string;
    valor: number;
  };
  compra: {
    fecha: string;
    valor: number;
  };
}

/**
 * Interfaz para el tipo de cambio del euro
 */
interface EuroExchangeRate {
  fecha: string;
  dolares: number;
  colones: number;
}

/**
 * Obtiene el tipo de cambio del dólar desde la API de Hacienda
 * @returns Promesa con el tipo de cambio del dólar (valor de venta)
 */
export const getDollarExchangeRate = async (): Promise<number> => {
  try {
    const response = await axios.get<DollarExchangeRate>('https://api.hacienda.go.cr/indicadores/tc/dolar');
    // Devolvemos el valor de venta según lo requerido
    return response.data.venta.valor;
  } catch (error) {
    console.error('Error al obtener el tipo de cambio del dólar:', error);
    // En caso de error, devolvemos un valor por defecto
    return 506.00;
  }
};

/**
 * Obtiene el tipo de cambio del euro desde la API de Hacienda
 * @returns Promesa con el tipo de cambio del euro
 */
export const getEuroExchangeRate = async (): Promise<number> => {
  try {
    const response = await axios.get<EuroExchangeRate>('https://api.hacienda.go.cr/indicadores/tc/euro');
    // La API devuelve directamente el valor en colones
    return response.data.colones;
  } catch (error) {
    console.error('Error al obtener el tipo de cambio del euro:', error);
    // En caso de error, devolvemos un valor por defecto
    return 567.23;
  }
};

/**
 * Obtiene el tipo de cambio según la moneda seleccionada
 * @param currency Código de la moneda (CRC, USD, EUR)
 * @returns Promesa con el tipo de cambio correspondiente
 */
export const getExchangeRate = async (currency: string): Promise<number> => {
  switch (currency) {
    case 'CRC':
      return 1; // Para colones, el tipo de cambio es 1
    case 'USD':
      return await getDollarExchangeRate();
    case 'EUR':
      return await getEuroExchangeRate();
    default:
      return 1; // Valor por defecto
  }
};