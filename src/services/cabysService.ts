import axios from 'axios';
import { CabysResponse, CabysItem } from '../types/invoice';

// Base URL for CABYS API
const CABYS_API_URL = 'https://api.hacienda.go.cr/fe/cabys';

/**
 * Search products or services by description
 * @param query Search term
 * @param limit Maximum number of results to return
 */
export const searchByDescription = async (query: string, limit: number = 10): Promise<CabysResponse> => {
  try {
    const encodedQuery = encodeURIComponent(query);
    const response = await axios.get<CabysResponse>(`${CABYS_API_URL}?q=${encodedQuery}&top=${limit}`);
    return response.data;
  } catch (error) {
    console.error('Error searching CABYS by description:', error);
    return { cabys: [] };
  }
};

/**
 * Get a product or service by its CABYS code
 * @param code CABYS code
 */
export const getByCode = async (code: string): Promise<CabysItem[]> => {
  try {
    const response = await axios.get<CabysItem[]>(`${CABYS_API_URL}?codigo=${code}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching CABYS by code:', error);
    return [];
  }
};

/**
 * Format CABYS item for display
 * @param item CABYS item
 */
export const formatCabysItem = (item: CabysItem): string => {
  return `${item.codigo} - ${item.descripcion} (${item.impuesto}%)`;
};