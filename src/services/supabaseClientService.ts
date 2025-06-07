import { supabase } from '../lib/supabase';
import { supabaseAuthService } from './supabaseAuthService';
import { getCompanyUuid } from './uuidMappingService';

// Interfaz para representar un cliente
export interface Client {
  id?: string;
  company_id: string;
  name: string;
  identification_type: string;
  identification_number: string;
  tax_status: string;
  email?: string;
  phone?: string;
  province?: string;
  canton?: string;
  district?: string;
  address?: string;
  economic_activity_code?: string;
  economic_activity_desc?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Interfaz para los resultados de búsqueda de clientes
export interface ClientSearchResult {
  success: boolean;
  data?: Client[];
  error?: string;
  total?: number;
}

// Interfaz para el resultado de operaciones con clientes
export interface ClientResult {
  success: boolean;
  data?: Client;
  error?: string;
}

/**
 * Servicio para gestionar clientes en Supabase
 */
class SupabaseClientService {
  /**
   * Obtiene todos los clientes de la empresa actual
   */
  async getClients(page = 1, limit = 20, searchTerm = ''): Promise<ClientSearchResult> {
    console.log('ℹ️ CLIENTES - Iniciando obtención de clientes...');
    try {
      // 1. Verificar autenticación y empresa seleccionada
      const user = supabaseAuthService.getCurrentUser();
      console.log('CLIENTES - Usuario actual:', user ? `ID: ${user.id}, Company: ${user.company_id}` : 'No hay usuario');
      
      if (!user || !user.company_id) {
        console.warn('⚠️ CLIENTES - Error: No hay usuario o empresa seleccionada');
        return {
          success: false,
          error: 'Usuario no autenticado o empresa no seleccionada'
        };
      }
      
      // 2. Convertir el ID de la empresa al UUID correcto
      const companyUuid = getCompanyUuid(user.company_id);
      console.log(`✅ CLIENTES - Usando UUID para empresa ${user.company_id}: ${companyUuid}`);
      
      // 3. Intentar una consulta simple para verificar la conexión
      const { count: testCount, error: testError } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyUuid);
      
      if (testError) {
        console.error('❌ CLIENTES - Error crítico de conexión con Supabase:', testError);
        return {
          success: false,
          error: `Error de conexión con la base de datos: ${testError.message}`
        };
      }
      
      console.log(`✅ CLIENTES - Conexión a Supabase correcta. Existen ${testCount || 0} clientes en total.`);
      
      // 4. Construir la consulta principal
      let query = supabase
        .from('clients')
        .select('*', { count: 'exact' })
        .eq('company_id', companyUuid)
        .eq('is_active', true);
        
      // Aplicar filtro de búsqueda si se proporciona
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,identification_number.ilike.%${searchTerm}%`);
        console.log(`CLIENTES - Aplicando filtro de búsqueda: "${searchTerm}"`);
      }
      
      // 5. Ejecutar consulta (con o sin paginación)
      let data, error, count;
      
      // Si limit es mayor a 100, no usar paginación (traer todos los registros)
      if (limit > 100) {
        console.log('CLIENTES - Solicitando todos los clientes sin paginación');
        const result = await query.order('name', { ascending: true });
        data = result.data;
        error = result.error;
        count = result.count;
      } else {
        // Paginación estándar
        const offset = (page - 1) * limit;
        console.log(`CLIENTES - Solicitando página ${page}, límite ${limit}, offset ${offset}`);
        
        const result = await query
          .order('name', { ascending: true })
          .range(offset, offset + limit - 1);
          
        data = result.data;
        error = result.error;
        count = result.count;
      }
      
      // 6. Manejar resultado
      if (error) {
        console.error('❌ CLIENTES - Error al obtener clientes:', error);
        return {
          success: false,
          error: `Error al obtener clientes: ${error.message}`
        };
      }
      
      // Asegurar que no hay valores undefined en los datos
      const cleanData = data?.map(client => {
        // Crear una copia limpia del cliente con valores null en lugar de undefined
        const cleanClient = { ...client };
        Object.keys(cleanClient).forEach(key => {
          if (cleanClient[key] === undefined) {
            cleanClient[key] = null;
          }
        });
        return cleanClient as Client;
      }) || [];
      
      console.log(`✅ CLIENTES - Se encontraron ${cleanData.length} clientes (total: ${count || 0})`);
      
      // 7. Devolver resultado exitoso
      return {
        success: true,
        data: cleanData,
        total: count || 0
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('❌ CLIENTES - Error inesperado en getClients:', errorMessage);
      return {
        success: false,
        error: `Error inesperado al obtener clientes: ${errorMessage}`
      };
    }
  }
  
  /**
   * Obtiene un cliente por su ID
   */
  async getClientById(clientId: string): Promise<ClientResult> {
    try {
      const user = supabaseAuthService.getCurrentUser();
      
      if (!user || !user.company_id) {
        return {
          success: false,
          error: 'Usuario no autenticado o empresa no seleccionada'
        };
      }
      
      // Convertir el ID de la empresa al UUID correcto
      const companyUuid = getCompanyUuid(user.company_id);
      
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .eq('company_id', companyUuid)
        .single();
        
      if (error) {
        console.error(`Error al obtener cliente ${clientId}:`, error);
        return {
          success: false,
          error: 'Error al obtener cliente'
        };
      }
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error(`Error en getClientById para ${clientId}:`, error);
      return {
        success: false,
        error: 'Error al obtener cliente'
      };
    }
  }
  
  /**
   * Obtiene un cliente por su número de identificación
   */
  async getClientByIdNumber(idNumber: string): Promise<ClientResult> {
    try {
      const user = supabaseAuthService.getCurrentUser();
      
      if (!user || !user.company_id) {
        return {
          success: false,
          error: 'Usuario no autenticado o empresa no seleccionada'
        };
      }
      
      // Convertir el ID de la empresa al UUID correcto
      const companyUuid = getCompanyUuid(user.company_id);
      
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('identification_number', idNumber)
        .eq('company_id', companyUuid)
        .eq('is_active', true)
        .maybeSingle();
        
      if (error) {
        console.error(`Error al obtener cliente por número ${idNumber}:`, error);
        return {
          success: false,
          error: 'Error al obtener cliente'
        };
      }
      
      if (!data) {
        return {
          success: false,
          error: 'Cliente no encontrado'
        };
      }
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error(`Error en getClientByIdNumber para ${idNumber}:`, error);
      return {
        success: false,
        error: 'Error al obtener cliente'
      };
    }
  }
  
  /**
   * Crea un nuevo cliente
   */
  async createClient(client: Omit<Client, 'id' | 'created_at' | 'updated_at'>): Promise<ClientResult> {
    try {
      const user = supabaseAuthService.getCurrentUser();
      
      if (!user || !user.company_id) {
        return {
          success: false,
          error: 'Usuario no autenticado o empresa no seleccionada'
        };
      }
      
      // Filtrar solo las propiedades que existen en la tabla de Supabase
      // Esto evita el error con columnas inexistentes como tax_status
      const { tax_status, ...clientWithoutTaxStatus } = client;
      
      // Convertir el ID de la empresa a un UUID válido para Supabase
      const companyUuid = getCompanyUuid(user.company_id);
      console.log(`DEBUG CLIENTES - Usando UUID para empresa ${user.company_id}: ${companyUuid}`);
      
      // Asegurarse de que el cliente tenga el company_id correcto en formato UUID
      const clientToCreate = {
        ...clientWithoutTaxStatus,
        company_id: companyUuid
      };
      
      // Verificar si el cliente ya existe
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('identification_number', client.identification_number)
        .eq('company_id', companyUuid)
        .eq('is_active', true)
        .maybeSingle();
        
      if (existingClient) {
        return {
          success: false,
          error: 'Ya existe un cliente con ese número de identificación'
        };
      }
      
      // Solo validar el tax_status si fue proporcionado
      if (tax_status && (tax_status === 'No inscrito' || tax_status === 'Desinscrito' || tax_status === 'Desinscrito oficio')) {
        return {
          success: false,
          error: `El ID consultado no está inscrito ante Hacienda. Estado: ${tax_status}`
        };
      }
      
      console.log('Creando cliente con datos:', clientToCreate);
      
      const { data, error } = await supabase
        .from('clients')
        .insert(clientToCreate)
        .select()
        .single();
        
      if (error) {
        console.error('Error al crear cliente:', error);
        return {
          success: false,
          error: `Error al crear cliente: ${error.message}`
        };
      }
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('Error en createClient:', error);
      return {
        success: false,
        error: 'Error al crear cliente'
      };
    }
  }
  
  /**
   * Actualiza un cliente existente
   */
  async updateClient(clientId: string, clientData: Partial<Client>): Promise<ClientResult> {
    try {
      const user = supabaseAuthService.getCurrentUser();
      
      if (!user || !user.company_id) {
        return {
          success: false,
          error: 'Usuario no autenticado o empresa no seleccionada'
        };
      }
      
      // Convertir el ID de la empresa a un UUID válido para Supabase
      const companyUuid = getCompanyUuid(user.company_id);
      console.log(`DEBUG CLIENTES - Usando UUID para empresa ${user.company_id}: ${companyUuid}`);
      
      // Obtener el cliente actual para verificar que pertenece a la empresa actual
      const { data: existingClient } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .eq('company_id', companyUuid)
        .single();
        
      if (!existingClient) {
        return {
          success: false,
          error: 'Cliente no encontrado o no pertenece a la empresa actual'
        };
      }
      
      // Verificar que el estatus tributario sea válido
      if (clientData.tax_status === 'No inscrito' || clientData.tax_status === 'Desinscrito' || clientData.tax_status === 'Desinscrito oficio') {
        return {
          success: false,
          error: `El ID consultado no está inscrito ante Hacienda. Estado: ${clientData.tax_status}`
        };
      }
      
      // Evitar cambiar el company_id
      const { company_id, ...dataToUpdate } = clientData;
      
      // Actualizar fecha de modificación
      dataToUpdate.updated_at = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('clients')
        .update(dataToUpdate)
        .eq('id', clientId)
        .select()
        .single();
        
      if (error) {
        console.error(`Error al actualizar cliente ${clientId}:`, error);
        return {
          success: false,
          error: 'Error al actualizar cliente'
        };
      }
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error(`Error en updateClient para ${clientId}:`, error);
      return {
        success: false,
        error: 'Error al actualizar cliente'
      };
    }
  }
  
  /**
   * Elimina un cliente (marcándolo como inactivo)
   */
  async deleteClient(clientId: string): Promise<ClientResult> {
    try {
      const user = supabaseAuthService.getCurrentUser();
      
      if (!user || !user.company_id) {
        return {
          success: false,
          error: 'Usuario no autenticado o empresa no seleccionada'
        };
      }
      
      // Convertir el ID de la empresa a un UUID válido para Supabase
      const companyUuid = getCompanyUuid(user.company_id);
      console.log(`DEBUG CLIENTES - Usando UUID para empresa ${user.company_id}: ${companyUuid}`);
      
      // Verificar que el cliente pertenece a la empresa actual
      const { data: existingClient } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .eq('company_id', companyUuid)
        .single();
        
      if (!existingClient) {
        return {
          success: false,
          error: 'Cliente no encontrado o no pertenece a la empresa actual'
        };
      }
      
      // En lugar de eliminar, marcar como inactivo
      const { data, error } = await supabase
        .from('clients')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', clientId)
        .select()
        .single();
        
      if (error) {
        console.error(`Error al eliminar cliente ${clientId}:`, error);
        return {
          success: false,
          error: 'Error al eliminar cliente'
        };
      }
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error(`Error en deleteClient para ${clientId}:`, error);
      return {
        success: false,
        error: 'Error al eliminar cliente'
      };
    }
  }
  
  /**
   * Busca clientes por diferentes criterios
   */
  async searchClients(criteria: {
    name?: string;
    idNumber?: string;
    email?: string;
    limit?: number;
  }): Promise<ClientSearchResult> {
    try {
      const user = supabaseAuthService.getCurrentUser();
      
      if (!user || !user.company_id) {
        return {
          success: false,
          error: 'Usuario no autenticado o empresa no seleccionada'
        };
      }
      
      let query = supabase
        .from('clients')
        .select('*')
        .eq('company_id', user.company_id)
        .eq('is_active', true);
        
      // Aplicar filtros según los criterios proporcionados
      if (criteria.name) {
        query = query.ilike('name', `%${criteria.name}%`);
      }
      
      if (criteria.idNumber) {
        query = query.eq('identification_number', criteria.idNumber);
      }
      
      if (criteria.email) {
        query = query.eq('email', criteria.email);
      }
      
      // Aplicar límite si se proporciona
      if (criteria.limit) {
        query = query.limit(criteria.limit);
      }
      
      const { data, error } = await query.order('name');
        
      if (error) {
        console.error('Error al buscar clientes:', error);
        return {
          success: false,
          error: 'Error al buscar clientes'
        };
      }
      
      return {
        success: true,
        data: data || []
      };
    } catch (error) {
      console.error('Error en searchClients:', error);
      return {
        success: false,
        error: 'Error al buscar clientes'
      };
    }
  }
}

// Exportar la instancia del servicio
export const supabaseClientService = new SupabaseClientService();
