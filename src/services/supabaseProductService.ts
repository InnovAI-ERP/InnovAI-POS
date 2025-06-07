import { supabase } from '../lib/supabase';
import { supabaseAuthService } from './supabaseAuthService';
import { getCompanyUuid } from './uuidMappingService';

// Interfaz para representar un producto
export interface Product {
  id?: string;
  company_id: string;
  code: string;
  name: string;
  description?: string;
  unit_price: number;
  tax_rate: number;
  has_tax_exemption?: boolean;
  unit_measure?: string;
  sku?: string;
  barcode?: string;
  stock?: number;
  min_stock?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  // Nuevos campos
  tipo_producto?: 'bien' | 'servicio';
  costo_unitario?: number;
  margen_ganancia?: number;
  numero_vin_serie?: string;
  registro_medicamento?: string;
  forma_farmaceutica?: 'tabletas' | 'jarabe' | 'cápsulas' | 'crema' | 'inyectable';
  // Campos para clasificación de tarifa 0%
  clasificacion_tarifa_0?: 'tarifa_exenta' | 'tarifa_0_no_sujeto' | 'transitorio_0';
  // Campos para otros impuestos
  otro_impuesto?: '02' | '03' | '04' | '05' | '06' | '07' | '08' | '12' | '99' | '';
  porcentaje_otro_impuesto?: number;
  tarifa_otro_impuesto?: number;
}

// Interfaz para los resultados de búsqueda de productos
export interface ProductSearchResult {
  success: boolean;
  data?: Product[];
  error?: string;
  total?: number;
}

// Interfaz para el resultado de operaciones con productos
export interface ProductResult {
  success: boolean;
  data?: Product;
  error?: string;
}

/**
 * Servicio para gestionar productos en Supabase
 */
class SupabaseProductService {
  /**
   * Obtiene todos los productos de la empresa actual
   */
  async getProducts(page = 1, limit = 20, searchTerm = ''): Promise<ProductSearchResult> {
    console.log('ℹ️ PRODUCTOS - Iniciando obtención de productos...');
    try {
      // 1. Verificar autenticación y empresa seleccionada
      const user = supabaseAuthService.getCurrentUser();
      console.log('PRODUCTOS - Usuario actual:', user ? `ID: ${user.id}, Company: ${user.company_id}` : 'No hay usuario');
      
      if (!user || !user.company_id) {
        console.warn('⚠️ PRODUCTOS - Error: No hay usuario o empresa seleccionada');
        return {
          success: false,
          error: 'Usuario no autenticado o empresa no seleccionada'
        };
      }
      
      // 2. Convertir el ID de la empresa al UUID correcto
      const companyUuid = getCompanyUuid(user.company_id);
      console.log(`✅ PRODUCTOS - Usando UUID para empresa ${user.company_id}: ${companyUuid}`);
      
      // 3. Intentar una consulta simple para verificar la conexión
      const { count: testCount, error: testError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyUuid);
      
      if (testError) {
        console.error('❌ PRODUCTOS - Error crítico de conexión con Supabase:', testError);
        return {
          success: false,
          error: `Error de conexión con la base de datos: ${testError.message}`
        };
      }
      
      console.log(`✅ PRODUCTOS - Conexión a Supabase correcta. Existen ${testCount || 0} productos en total.`);
      
      // 4. Construir la consulta principal
      let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .eq('company_id', companyUuid)
        .eq('is_active', true);
        
      // Aplicar filtro de búsqueda si se proporciona
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
        console.log(`PRODUCTOS - Aplicando filtro de búsqueda: "${searchTerm}"`);
      }
      
      // 5. Ejecutar consulta (con o sin paginación)
      let data, error, count;
      
      // Si limit es mayor a 100, no usar paginación (traer todos los registros)
      if (limit > 100) {
        console.log('PRODUCTOS - Solicitando todos los productos sin paginación');
        const result = await query.order('name', { ascending: true });
        data = result.data;
        error = result.error;
        count = result.count;
      } else {
        // Paginación estándar
        const offset = (page - 1) * limit;
        console.log(`PRODUCTOS - Solicitando página ${page}, límite ${limit}, offset ${offset}`);
        
        const result = await query
          .order('name', { ascending: true })
          .range(offset, offset + limit - 1);
          
        data = result.data;
        error = result.error;
        count = result.count;
      }
      
      // 6. Manejar resultado
      if (error) {
        console.error('❌ PRODUCTOS - Error al obtener productos:', error);
        return {
          success: false,
          error: `Error al obtener productos: ${error.message}`
        };
      }
      
      // Asegurar que no hay valores undefined en los datos
      const cleanData = data?.map(product => {
        // Crear una copia limpia del producto con valores null en lugar de undefined
        const cleanProduct = { ...product };
        Object.keys(cleanProduct).forEach(key => {
          if (cleanProduct[key] === undefined) {
            cleanProduct[key] = null;
          }
        });
        return cleanProduct as Product;
      }) || [];
      
      console.log(`✅ PRODUCTOS - Se encontraron ${cleanData.length} productos (total: ${count || 0})`);
      
      // 7. Devolver resultado exitoso
      return {
        success: true,
        data: cleanData,
        total: count || 0
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('❌ PRODUCTOS - Error inesperado en getProducts:', errorMessage);
      return {
        success: false,
        error: `Error inesperado al obtener productos: ${errorMessage}`
      };
    }
  }
  
  /**
   * Obtiene un producto por su ID
   */
  async getProductById(productId: string): Promise<ProductResult> {
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
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('company_id', companyUuid)
        .single();
        
      if (error) {
        console.error(`Error al obtener producto ${productId}:`, error);
        return {
          success: false,
          error: 'Error al obtener producto'
        };
      }
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error(`Error en getProductById para ${productId}:`, error);
      return {
        success: false,
        error: 'Error al obtener producto'
      };
    }
  }
  
  /**
   * Obtiene un producto por su código
   */
  async getProductByCode(code: string): Promise<ProductResult> {
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
        .from('products')
        .select('*')
        .eq('code', code)
        .eq('company_id', companyUuid)
        .eq('is_active', true)
        .maybeSingle();
        
      if (error) {
        console.error(`Error al obtener producto por código ${code}:`, error);
        return {
          success: false,
          error: 'Error al obtener producto'
        };
      }
      
      if (!data) {
        return {
          success: false,
          error: 'Producto no encontrado'
        };
      }
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error(`Error en getProductByCode para ${code}:`, error);
      return {
        success: false,
        error: 'Error al obtener producto'
      };
    }
  }
  
  /**
   * Crea un nuevo producto
   */
  async createProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<ProductResult> {
    try {
      const user = supabaseAuthService.getCurrentUser();
      
      if (!user || !user.company_id) {
        return {
          success: false,
          error: 'Usuario no autenticado o empresa no seleccionada'
        };
      }
      
      // Convertir el ID de la empresa a UUID usando el servicio de mapeo
      const companyUuid = getCompanyUuid(user.company_id);
      console.log(`✅ createProduct - Usando UUID para empresa ${user.company_id}: ${companyUuid}`);
      
      // Asegurarse de que el producto tenga el company_id correcto
      const productToCreate = {
        ...product,
        company_id: companyUuid
      };
      
      // Verificar si el producto ya existe
      const { data: existingProduct } = await supabase
        .from('products')
        .select('id')
        .eq('code', product.code)
        .eq('company_id', companyUuid)
        .eq('is_active', true)
        .maybeSingle();
        
      if (existingProduct) {
        return {
          success: false,
          error: 'Ya existe un producto con ese código'
        };
      }
      
      const { data, error } = await supabase
        .from('products')
        .insert(productToCreate)
        .select()
        .single();
        
      if (error) {
        console.error('Error al crear producto:', error);
        return {
          success: false,
          error: 'Error al crear producto'
        };
      }
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('Error en createProduct:', error);
      return {
        success: false,
        error: 'Error al crear producto'
      };
    }
  }
  
  /**
   * Actualiza un producto existente
   */
  async updateProduct(productId: string, productData: Partial<Product>): Promise<ProductResult> {
    try {
      const user = supabaseAuthService.getCurrentUser();
      
      if (!user || !user.company_id) {
        return {
          success: false,
          error: 'Usuario no autenticado o empresa no seleccionada'
        };
      }
      
      // Convertir el ID de la empresa a UUID usando el servicio de mapeo
      const companyUuid = getCompanyUuid(user.company_id);
      console.log(`✅ updateProduct - Usando UUID para empresa ${user.company_id}: ${companyUuid}`);
      
      // Obtener el producto actual para verificar que pertenece a la empresa actual
      const { data: existingProduct } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('company_id', companyUuid)
        .single();
        
      if (!existingProduct) {
        return {
          success: false,
          error: 'Producto no encontrado o no pertenece a la empresa actual'
        };
      }
      
      // Evitar cambiar el company_id
      const { company_id, ...dataToUpdate } = productData;
      
      // Actualizar fecha de modificación
      dataToUpdate.updated_at = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('products')
        .update(dataToUpdate)
        .eq('id', productId)
        .select()
        .single();
        
      if (error) {
        console.error(`Error al actualizar producto ${productId}:`, error);
        return {
          success: false,
          error: 'Error al actualizar producto'
        };
      }
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error(`Error en updateProduct para ${productId}:`, error);
      return {
        success: false,
        error: 'Error al actualizar producto'
      };
    }
  }
  
  /**
   * Elimina un producto (marcándolo como inactivo)
   */
  async deleteProduct(productId: string): Promise<ProductResult> {
    try {
      const user = supabaseAuthService.getCurrentUser();
      
      if (!user || !user.company_id) {
        return {
          success: false,
          error: 'Usuario no autenticado o empresa no seleccionada'
        };
      }
      
      // Verificar que el producto pertenece a la empresa actual
      const { data: existingProduct } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('company_id', user.company_id)
        .single();
        
      if (!existingProduct) {
        return {
          success: false,
          error: 'Producto no encontrado o no pertenece a la empresa actual'
        };
      }
      
      // En lugar de eliminar, marcar como inactivo
      const { data, error } = await supabase
        .from('products')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .select()
        .single();
        
      if (error) {
        console.error(`Error al eliminar producto ${productId}:`, error);
        return {
          success: false,
          error: 'Error al eliminar producto'
        };
      }
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error(`Error en deleteProduct para ${productId}:`, error);
      return {
        success: false,
        error: 'Error al eliminar producto'
      };
    }
  }
  
  /**
   * Busca productos por diferentes criterios
   */
  async searchProducts(criteria: {
    name?: string;
    code?: string;
    barcode?: string;
    limit?: number;
  }): Promise<ProductSearchResult> {
    try {
      const user = supabaseAuthService.getCurrentUser();
      
      if (!user || !user.company_id) {
        return {
          success: false,
          error: 'Usuario no autenticado o empresa no seleccionada'
        };
      }
      
      let query = supabase
        .from('products')
        .select('*')
        .eq('company_id', user.company_id)
        .eq('is_active', true);
        
      // Aplicar filtros según los criterios proporcionados
      if (criteria.name) {
        query = query.ilike('name', `%${criteria.name}%`);
      }
      
      if (criteria.code) {
        query = query.eq('code', criteria.code);
      }
      
      if (criteria.barcode) {
        query = query.eq('barcode', criteria.barcode);
      }
      
      // Aplicar límite si se proporciona
      if (criteria.limit) {
        query = query.limit(criteria.limit);
      }
      
      const { data, error } = await query.order('name');
        
      if (error) {
        console.error('Error al buscar productos:', error);
        return {
          success: false,
          error: 'Error al buscar productos'
        };
      }
      
      return {
        success: true,
        data: data || []
      };
    } catch (error) {
      console.error('Error en searchProducts:', error);
      return {
        success: false,
        error: 'Error al buscar productos'
      };
    }
  }
  
  /**
   * Actualiza el stock de un producto
   */
  async updateStock(productId: string, quantity: number, isAddition = true): Promise<ProductResult> {
    try {
      const user = supabaseAuthService.getCurrentUser();
      
      if (!user || !user.company_id) {
        return {
          success: false,
          error: 'Usuario no autenticado o empresa no seleccionada'
        };
      }
      
      // Obtener el producto actual
      const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('company_id', user.company_id)
        .single();
        
      if (!product) {
        return {
          success: false,
          error: 'Producto no encontrado o no pertenece a la empresa actual'
        };
      }
      
      // Calcular el nuevo stock
      const currentStock = product.stock || 0;
      const newStock = isAddition ? currentStock + quantity : currentStock - quantity;
      
      // Actualizar el stock
      const { data, error } = await supabase
        .from('products')
        .update({
          stock: newStock >= 0 ? newStock : 0, // Evitar stocks negativos
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .select()
        .single();
        
      if (error) {
        console.error(`Error al actualizar stock del producto ${productId}:`, error);
        return {
          success: false,
          error: 'Error al actualizar stock del producto'
        };
      }
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error(`Error en updateStock para ${productId}:`, error);
      return {
        success: false,
        error: 'Error al actualizar stock del producto'
      };
    }
  }
}

// Exportar la instancia del servicio
export const supabaseProductService = new SupabaseProductService();
