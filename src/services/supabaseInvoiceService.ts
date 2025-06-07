import { supabase } from '../lib/supabase';
import { supabaseAuthService } from './supabaseAuthService';
import { getCompanyUuid } from './uuidMappingService';

// El mapeo de IDs de empresas a UUIDs y la función getCompanyUuid ahora están
// centralizados en uuidMappingService.ts para garantizar consistencia en toda la app

// Interfaz para representar una factura
export interface Invoice {
  id?: string;
  company_id: string;
  consecutive: string;
  key_document: string;
  client_id: string;
  issue_date: string;
  sale_condition: string;
  payment_method: string;
  currency: string;
  exchange_rate?: number;
  subtotal: number;
  discount_total?: number;
  tax_total?: number;
  total: number;
  status: string;
  hacienda_status?: string;
  hacienda_message?: string;
  xml_content?: string;
  pdf_path?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// Interfaz para representar una línea de factura
export interface InvoiceLine {
  id?: string;
  invoice_id: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percentage?: number;
  discount_amount?: number;
  subtotal: number;
  tax_rate?: number;
  tax_amount?: number;
  has_tax_exemption?: boolean;
  total: number;
  line_number: number;
  created_at?: string;
}

// Interfaz para los resultados de búsqueda de facturas
export interface InvoiceSearchResult {
  success: boolean;
  data?: Invoice[];
  error?: string;
  total?: number;
}

// Interfaz para el resultado de operaciones con facturas
export interface InvoiceResult {
  success: boolean;
  data?: Invoice;
  lines?: InvoiceLine[];
  error?: string;
}

// Interfaz para facturas almacenadas en invoice_data (formato simplificado)
export interface StoredInvoiceData {
  id: string;
  company_id: string;
  data: any; // Contiene todo el objeto de factura en formato JSON
  created_at?: string;
}

/**
 * Servicio para gestionar facturas en Supabase
 */
class SupabaseInvoiceService {
  /**
   * Obtiene todas las facturas de la empresa actual
   */
  async getInvoices(page = 1, limit = 20, filters: any = {}): Promise<InvoiceSearchResult> {
    try {
      const user = supabaseAuthService.getCurrentUser();
      
      if (!user || !user.company_id) {
        return {
          success: false,
          error: 'Usuario no autenticado o empresa no seleccionada'
        };
      }
      
      // Construir la consulta base
      let query = supabase
        .from('invoices')
        .select('*, clients(name, identification_number)', { count: 'exact' })
        .eq('company_id', user.company_id);
      
      // Aplicar filtros adicionales
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      
      if (filters.dateFrom) {
        query = query.gte('issue_date', filters.dateFrom);
      }
      
      if (filters.dateTo) {
        query = query.lte('issue_date', filters.dateTo);
      }
      
      if (filters.clientId) {
        query = query.eq('client_id', filters.clientId);
      }
      
      if (filters.consecutive) {
        query = query.ilike('consecutive', `%${filters.consecutive}%`);
      }
      
      // Calcular offset para paginación
      const offset = (page - 1) * limit;
      
      // Aplicar paginación y ordenamiento
      const { data, error, count } = await query
        .order('issue_date', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (error) {
        console.error('Error al obtener facturas:', error);
        return {
          success: false,
          error: 'Error al obtener facturas'
        };
      }
      
      return {
        success: true,
        data: data || [],
        total: count || 0
      };
    } catch (error) {
      console.error('Error en getInvoices:', error);
      return {
        success: false,
        error: 'Error al obtener facturas'
      };
    }
  }
  
  /**
   * Obtiene una factura por su ID, incluyendo sus líneas
   */
  async getInvoiceById(invoiceId: string): Promise<InvoiceResult> {
    try {
      const user = supabaseAuthService.getCurrentUser();
      
      if (!user || !user.company_id) {
        return {
          success: false,
          error: 'Usuario no autenticado o empresa no seleccionada'
        };
      }
      
      // Obtener la factura
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .eq('company_id', user.company_id)
        .single();
      
      if (invoiceError) {
        console.error(`Error al obtener factura ${invoiceId}:`, invoiceError);
        return {
          success: false,
          error: 'Error al obtener factura'
        };
      }
      
      if (!invoice) {
        return {
          success: false,
          error: 'Factura no encontrada o no pertenece a la empresa actual'
        };
      }
      
      // Obtener las líneas de la factura
      const { data: lines, error: linesError } = await supabase
        .from('invoice_lines')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('line_number');
      
      if (linesError) {
        console.error(`Error al obtener líneas de factura ${invoiceId}:`, linesError);
        return {
          success: false,
          error: 'Error al obtener líneas de factura'
        };
      }
      
      return {
        success: true,
        data: invoice,
        lines: lines || []
      };
    } catch (error) {
      console.error(`Error en getInvoiceById para ${invoiceId}:`, error);
      return {
        success: false,
        error: 'Error al obtener factura'
      };
    }
  }
  
  /**
   * Crea una nueva factura con sus líneas
   */
  async createInvoice(invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>, lines: Omit<InvoiceLine, 'id' | 'invoice_id' | 'created_at'>[]): Promise<InvoiceResult> {
    try {
      const user = supabaseAuthService.getCurrentUser();
      
      if (!user || !user.company_id) {
        return {
          success: false,
          error: 'Usuario no autenticado o empresa no seleccionada'
        };
      }
      
      // Asegurarse de que la factura tenga el company_id correcto
      const invoiceToCreate = {
        ...invoice,
        company_id: user.company_id,
        status: invoice.status || 'draft' // Estado predeterminado si no se especifica
      };
      
      // Iniciar una transacción
      const { data: createdInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert(invoiceToCreate)
        .select()
        .single();
      
      if (invoiceError) {
        console.error('Error al crear factura:', invoiceError);
        return {
          success: false,
          error: 'Error al crear factura'
        };
      }
      
      // Si no hay líneas, devolver la factura creada
      if (!lines || lines.length === 0) {
        return {
          success: true,
          data: createdInvoice,
          lines: []
        };
      }
      
      // Preparar las líneas para inserción
      const linesToInsert = lines.map(line => ({
        ...line,
        invoice_id: createdInvoice.id
      }));
      
      // Insertar las líneas
      const { data: createdLines, error: linesError } = await supabase
        .from('invoice_lines')
        .insert(linesToInsert)
        .select();
      
      if (linesError) {
        console.error('Error al crear líneas de factura:', linesError);
        
        // Si hay un error al crear las líneas, eliminar la factura
        await supabase
          .from('invoices')
          .delete()
          .eq('id', createdInvoice.id);
        
        return {
          success: false,
          error: 'Error al crear líneas de factura'
        };
      }
      
      return {
        success: true,
        data: createdInvoice,
        lines: createdLines || []
      };
    } catch (error) {
      console.error('Error en createInvoice:', error);
      return {
        success: false,
        error: 'Error al crear factura'
      };
    }
  }
  
  /**
   * Actualiza el estado de una factura
   */
  async updateInvoiceStatus(invoiceId: string, status: string, haciendaStatus?: string, haciendaMessage?: string): Promise<InvoiceResult> {
    try {
      const user = supabaseAuthService.getCurrentUser();
      
      if (!user || !user.company_id) {
        return {
          success: false,
          error: 'Usuario no autenticado o empresa no seleccionada'
        };
      }
      
      // Verificar que la factura pertenece a la empresa actual
      const { data: existingInvoice } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .eq('company_id', user.company_id)
        .single();
      
      if (!existingInvoice) {
        return {
          success: false,
          error: 'Factura no encontrada o no pertenece a la empresa actual'
        };
      }
      
      // Preparar datos para actualización
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };
      
      // Si se proporciona el estado de Hacienda, actualizarlo también
      if (haciendaStatus) {
        updateData.hacienda_status = haciendaStatus;
      }
      
      // Si se proporciona el mensaje de Hacienda, actualizarlo también
      if (haciendaMessage) {
        updateData.hacienda_message = haciendaMessage;
      }
      
      // Actualizar la factura
      const { data, error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoiceId)
        .select()
        .single();
      
      if (error) {
        console.error(`Error al actualizar estado de factura ${invoiceId}:`, error);
        return {
          success: false,
          error: 'Error al actualizar estado de factura'
        };
      }
      
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error(`Error en updateInvoiceStatus para ${invoiceId}:`, error);
      return {
        success: false,
        error: 'Error al actualizar estado de factura'
      };
    }
  }
  
  /**
   * Actualiza el contenido XML y la ruta del PDF de una factura
   */
  async updateInvoiceContent(invoiceId: string, xmlContent?: string, pdfPath?: string): Promise<InvoiceResult> {
    try {
      const user = supabaseAuthService.getCurrentUser();
      
      if (!user || !user.company_id) {
        return {
          success: false,
          error: 'Usuario no autenticado o empresa no seleccionada'
        };
      }
      
      // Verificar que la factura pertenece a la empresa actual
      const { data: existingInvoice } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .eq('company_id', user.company_id)
        .single();
      
      if (!existingInvoice) {
        return {
          success: false,
          error: 'Factura no encontrada o no pertenece a la empresa actual'
        };
      }
      
      // Preparar datos para actualización
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      
      // Si se proporciona el contenido XML, actualizarlo
      if (xmlContent) {
        updateData.xml_content = xmlContent;
      }
      
      // Si se proporciona la ruta del PDF, actualizarla
      if (pdfPath) {
        updateData.pdf_path = pdfPath;
      }
      
      // Actualizar la factura
      const { data, error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoiceId)
        .select()
        .single();
      
      if (error) {
        console.error(`Error al actualizar contenido de factura ${invoiceId}:`, error);
        return {
          success: false,
          error: 'Error al actualizar contenido de factura'
        };
      }
      
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error(`Error en updateInvoiceContent para ${invoiceId}:`, error);
      return {
        success: false,
        error: 'Error al actualizar contenido de factura'
      };
    }
  }
  
  /**
   * Actualiza las notas de una factura
   */
  async updateInvoiceNotes(invoiceId: string, notes: string): Promise<InvoiceResult> {
    try {
      const user = supabaseAuthService.getCurrentUser();
      
      if (!user || !user.company_id) {
        return {
          success: false,
          error: 'Usuario no autenticado o empresa no seleccionada'
        };
      }
      
      // Verificar que la factura pertenece a la empresa actual
      const { data: existingInvoice } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .eq('company_id', user.company_id)
        .single();
      
      if (!existingInvoice) {
        return {
          success: false,
          error: 'Factura no encontrada o no pertenece a la empresa actual'
        };
      }
      
      // Actualizar las notas de la factura
      const { data, error } = await supabase
        .from('invoices')
        .update({
          notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', invoiceId)
        .select()
        .single();
      
      if (error) {
        console.error(`Error al actualizar notas de factura ${invoiceId}:`, error);
        return {
          success: false,
          error: 'Error al actualizar notas de factura'
        };
      }
      
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error(`Error en updateInvoiceNotes para ${invoiceId}:`, error);
      return {
        success: false,
        error: 'Error al actualizar notas de factura'
      };
    }
  }
  
  /**
   * Obtiene el siguiente número consecutivo para facturas
   */
  async getNextConsecutive(documentType = '01'): Promise<string> {
    try {
      const user = supabaseAuthService.getCurrentUser();
      
      if (!user || !user.company_id) {
        throw new Error('Usuario no autenticado o empresa no seleccionada');
      }
      
      // Obtener la última factura de la empresa
      const { data, error } = await supabase
        .from('invoices')
        .select('consecutive')
        .eq('company_id', user.company_id)
        .order('consecutive', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 es el código de error cuando no hay resultados
        console.error('Error al obtener último consecutivo:', error);
        throw new Error('Error al obtener último consecutivo');
      }
      
      let nextNumber = 1;
      
      if (data && data.consecutive) {
        // Extraer el número del consecutivo (formato: 00000001)
        const currentNumber = parseInt(data.consecutive.slice(-8), 10);
        nextNumber = currentNumber + 1;
      }
      
      // Formatear el nuevo consecutivo
      // Formato: [Tipo Documento][ID Empresa][Sucursal][Terminal][Situación][Consecutivo]
      // Ejemplo: 01506070108000000001
      const paddedNumber = nextNumber.toString().padStart(8, '0');
      const consecutive = `${documentType}00001000000${paddedNumber}`;
      
      return consecutive;
    } catch (error) {
      console.error('Error en getNextConsecutive:', error);
      throw error;
    }
  }
  
  /**
   * Genera la clave de la factura siguiendo el formato de 50 dígitos requerido por Hacienda
   */
  async generateKeyDocument(consecutive: string): Promise<string> {
    try {
      const user = supabaseAuthService.getCurrentUser();
      
      if (!user || !user.company_id) {
        throw new Error('Usuario no autenticado o empresa no seleccionada');
      }
      
      // Extraer las partes del consecutivo (asumiendo formato: tipoDoc(2) + terminal(2) + sucursal(3) + consecutivo(13))
      const tipoDoc = consecutive.substring(0, 2);
      
      // Obtener el número de identificación de la empresa desde las variables de entorno
      // ya que no está disponible directamente en el objeto user
      const envConfig = await import('./envService').then(module => module.envService.getAll());
      const emisorNumero = envConfig.IDENTIFICATION_NUMBER || '3102928079';
      
      // Importar la función generateInvoiceKey desde invoiceService
      // para asegurar que se use el mismo formato en toda la aplicación
      const { generateInvoiceKey } = await import('./invoiceService');
      
      // Usar la función centralizada para generar la clave
      const keyDocument = generateInvoiceKey(emisorNumero, tipoDoc);
      
      return keyDocument;
    } catch (error) {
      console.error('Error en generateKeyDocument:', error);
      throw error;
    }
  }

  /**
   * MÉTODOS PARA TRABAJAR CON LA TABLA INVOICE_DATA (Formato simplificado)
   */
  
  /**
   * Guarda una factura en la tabla invoice_data (formato simplificado con JSONB)
   */
  async saveInvoiceData(invoice: any, companyId: string): Promise<{success: boolean; error?: any}> {
    try {
      // Convertir ID de empresa a UUID
      const companyUuid = getCompanyUuid(companyId);
      console.log(`Guardando factura para empresa ${companyId} (UUID: ${companyUuid})`);
      
      // Datos a insertar en la tabla invoice_data
      const invoiceData = {
        id: invoice.id,
        company_id: companyUuid,
        data: invoice // Guardamos toda la factura como JSON
      };
      
      const { error } = await supabase
        .from('invoice_data')
        .insert(invoiceData)
        .select()
        .single();
        
      if (error) {
        console.error('Error al guardar factura en tabla invoice_data:', error);
        return { success: false, error };
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error al guardar factura en invoice_data:', error);
      return { success: false, error };
    }
  }
  
  /**
   * Obtiene todas las facturas de una empresa desde invoice_data
   * @param companyId ID o UUID de la empresa
   * @returns Object con las facturas procesadas y posible error
   */
  async getInvoicesData(companyId: string): Promise<{invoices: any[]; error?: any}> {
    try {
      // Convertir ID de empresa a UUID
      const companyUuid = getCompanyUuid(companyId);
      console.log(`Obteniendo facturas para empresa ${companyId} (UUID: ${companyUuid})`);
      
      console.log(`[SUPABASE-INVOICE-SVC] Ejecutando consulta a invoice_data con company_id=${companyUuid}`);
      
      const { data, error } = await supabase
        .from('invoice_data')
        .select('*')
        .eq('company_id', companyUuid)
        .order('created_at', { ascending: false });
      
      // Registrar detalles de la respuesta  
      if (error) {
        console.error(`[SUPABASE-INVOICE-SVC] Error en consulta:`, error);
        return { invoices: [], error };
      }
      
      console.log(`[SUPABASE-INVOICE-SVC] Datos recibidos: ${data ? data.length : 0} registros`);
      if (data && data.length > 0) {
        console.log(`[SUPABASE-INVOICE-SVC] Primer registro (muestra):`, 
          JSON.stringify(data[0]).substring(0, 100) + '...');
      } else {
        console.log(`[SUPABASE-INVOICE-SVC] No se encontraron registros para company_id=${companyUuid}`);
      }
      
      // Extraer y procesar los datos JSON de cada registro
      const invoices = data ? data.map(item => {
        if (!item.data) {
          console.warn(`[SUPABASE-INVOICE-SVC] Registro sin propiedad 'data':`, item);
          return null;
        }

        // Obtener los datos originales de la factura
        const facturaOriginal = item.data;

        // Asegurar que tengamos un ID consistente para la factura
        // Priorizar el ID que aparece en la data de Supabase como se muestra en la imagen
        const consecutivoFactura = facturaOriginal.id || facturaOriginal.consecutive || 
                                 facturaOriginal.numeroConsecutivo || facturaOriginal.consecutivo;

        // Procesar y enriquecer los datos de la factura
        const facturaEnriquecida = {
          ...facturaOriginal,
          // Asegurar que el ID de la factura está disponible
          id: facturaOriginal.id || item.id,
          // Guardar el consecutivo (número de factura visible) desde el ID si no existe
          consecutivo: consecutivoFactura,
          // Datos específicos para el módulo de pagos
          medioPagoNombre: this.obtenerNombreMedioPago(facturaOriginal.medioPago),
          medioPagoCodigo: facturaOriginal.medioPago, // Guardar el código original también
          // Calcular y guardar el plazo de crédito en días
          plazoCreditoDias: this.calcularPlazoCreditoDias(facturaOriginal),
          // Fecha de emisión formateada
          fechaEmision: facturaOriginal.date || facturaOriginal.created_at || item.created_at,
          // Flag para facturas a crédito
          esCredito: facturaOriginal.condicionVenta === '02',
          // Otros campos útiles para el módulo de pagos
          estaPagada: facturaOriginal.infoPago?.pagada === true,
          fechaPago: facturaOriginal.infoPago?.fechaPago,
          // Crear un campo combinado para buscar y mostrar
          consecutivoUnificado: consecutivoFactura,
          
          // REGENERAR LA CLAVE SI ES UN TIQUETE O FACTURA ANTIGUA (CON FORMATO INCORRECTO)
          // Verificar si la clave tiene el formato incorrecto (identificable por longitud o estructura)
          clave: this.regenerarClaveSiNecesario(facturaOriginal)
        };

        return facturaEnriquecida;
      }).filter(Boolean) : [];
      
      console.log(`[SUPABASE-INVOICE-SVC] Facturas procesadas: ${invoices.length}`);
      return { invoices };
    } catch (error) {
      console.error('Error al obtener facturas de invoice_data:', error);
      return { invoices: [], error };
    }
  }

  /**
   * Obtiene el nombre del medio de pago a partir del código
   * @param codigo Código del medio de pago (01, 02, etc.)
   * @returns Nombre descriptivo del medio de pago
   */
  obtenerNombreMedioPago(codigo: string): string {
    switch (codigo) {
      case '01': return 'Efectivo';
      case '02': return 'Tarjeta';
      case '03': return 'Cheque';
      case '04': return 'Transferencia';
      case '05': return 'Recaudado por terceros';
      case '06': return 'SINPE MÓVIL';
      case '07': return 'Plataforma Digital';
      case '99': return 'Otros';
      default: return 'No especificado';
    }
  }

  /**
   * Calcula el plazo de crédito en días a partir de los datos de la factura
   * @param factura Datos de la factura
   * @returns Plazo de crédito en días (por defecto 30 si no se especifica)
   */
  calcularPlazoCreditoDias(factura: any): number {
    // Si no es a crédito, devolver 0
    if (factura.condicionVenta !== '02') {
      return 0;
    }

    // Verificar si tiene plazoCredito definido
    let plazo = factura.plazoCredito ? parseInt(factura.plazoCredito) : 30;
    
    // Si es NaN, usar 30 días por defecto
    if (isNaN(plazo)) {
      plazo = 30;
    }

    return plazo;
  }
  
  /**
   * Actualiza una factura existente en invoice_data
   */
  async updateInvoiceData(invoice: any, companyId: string): Promise<{success: boolean; error?: any}> {
    try {
      // Asegurarse de que estamos usando el UUID directo
      const companyUuid = companyId.includes('-') ? companyId : getCompanyUuid(companyId);
      console.log(`Actualizando factura ${invoice.id} para empresa con UUID: ${companyUuid}`);
      
      // Enriquecer la factura con datos adicionales antes de guardarla
      // 1. Calcular y agregar el plazo de crédito si no existe
      if (!invoice.plazoCreditoDias) {
        invoice.plazoCreditoDias = this.calcularPlazoCreditoDias(invoice);
      }
      
      // 2. Asegurar que tenga un consecutivo unificado
      if (!invoice.consecutivoUnificado) {
        const consecutivoFactura = invoice.id || invoice.consecutive || invoice.numeroConsecutivo || invoice.consecutivo;
        invoice.consecutivoUnificado = consecutivoFactura;
      }
      
      // 3. Agregar el nombre del medio de pago si no existe
      if (!invoice.medioPagoNombre && invoice.medioPago) {
        invoice.medioPagoNombre = this.obtenerNombreMedioPago(invoice.medioPago);
      }
      
      // Comprobar si es un pago de factura a crédito
      const esFacturaCredito = invoice.condicionVenta === '02'; // 02 = Crédito
      const estaPagada = invoice.infoPago?.pagada === true;
      
      // Si es una factura de crédito pagada, guardarla también en la tabla de créditos pagados
      if (esFacturaCredito && estaPagada) {
        console.log(`La factura ${invoice.id} es de crédito y está pagada. Guardando en tabla de créditos pagados...`);
        await this.guardarFacturaCreditoPagada(invoice, companyUuid);
      }
      
      console.log(`Guardando factura enriquecida con plazoCreditoDias=${invoice.plazoCreditoDias} y consecutivoUnificado=${invoice.consecutivoUnificado}`);
      
      // Actualizar la factura en la tabla principal
      const { error } = await supabase
        .from('invoice_data')
        .update({ data: invoice })
        .eq('company_id', companyUuid)
        .eq('data->id', invoice.id)
        .select();
        
      if (error) {
        console.error('Error al actualizar factura en invoice_data:', error);
        return { success: false, error };
      }
      
      if (error) {
        console.warn(`No se encontró la factura ${invoice.id} para actualizar. Puede que el ID o UUID sea incorrecto.`);
      } else {
        console.log(`Factura ${invoice.id} actualizada exitosamente en invoice_data.`);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error al actualizar factura en invoice_data:', error);
      return { success: false, error };
    }
  }

  /**
   * Regenera la clave numérica si tiene un formato incorrecto
   * @param facturaOriginal - Datos originales de la factura/tiquete
   * @returns Clave numérica correcta
   */
  regenerarClaveSiNecesario(facturaOriginal: any): string {
    // Si no hay clave o está vacía, devolver la original
    if (!facturaOriginal.claveNumerica) {
      return facturaOriginal.claveNumerica || '';
    }

    // Si la clave ya tiene el formato correcto (50 dígitos) devolver la original
    if (facturaOriginal.claveNumerica.length === 50) {
      return facturaOriginal.claveNumerica;
    }
    
    // Obtener los componentes necesarios para regenerar la clave
    const emisorNumero = facturaOriginal.emisor?.identificacion?.numero || '';
    const tipoDocumento = facturaOriginal.tipoDocumento || '01';
    
    // Extraer el consecutivo si existe en la factura original
    let consecutivo = '';
    if (facturaOriginal.consecutivo) {
      consecutivo = facturaOriginal.consecutivo;
    }
    
    // Si no hay emisor o consecutivo, no podemos regenerar la clave
    if (!emisorNumero || !consecutivo) {
      return facturaOriginal.claveNumerica || '';
    }
    
    try {
      // Intentar obtener el código de seguridad del localStorage
      const companyId = facturaOriginal.company_id || facturaOriginal.emisor?.identificacion?.numero || '';
      let codigoSeguridad = '';
      
      // En el navegador, intentar obtener del localStorage
      if (typeof localStorage !== 'undefined') {
        codigoSeguridad = localStorage.getItem(`company_${companyId}_security_code`) || '';
      }
      
      // Si no hay código de seguridad, generar uno nuevo de 8 dígitos
      if (!codigoSeguridad || codigoSeguridad.length !== 8) {
        codigoSeguridad = Math.floor(10000000 + Math.random() * 90000000).toString();
        // Almacenar en localStorage si está disponible
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(`company_${companyId}_security_code`, codigoSeguridad);
        }
      }
      
      // Fecha de la factura original o fecha actual
      const fechaStr = facturaOriginal.fecha || new Date().toISOString().slice(0, 10);
      const fecha = new Date(fechaStr);
      const dia = fecha.getDate().toString().padStart(2, '0');
      const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
      const año = fecha.getFullYear().toString().slice(2);
      const fechaFormateada = `${dia}${mes}${año}`;
      
      // Construir la clave con el formato correcto (50 dígitos)
      // Estructura: 506 (país) + fecha (6) + situación (1) + cédula emisor (12) + consecutivo (20) + código seguridad (8)
      const paisCodigo = '506';
      const situacion = '1'; // Normal
      const cedulaEmisorPadded = emisorNumero.padStart(12, '0');
      
      // Clave final de 50 dígitos
      const claveRegenerada = `${paisCodigo}${fechaFormateada}${situacion}${cedulaEmisorPadded}${consecutivo}${codigoSeguridad}`;
      
      // Verificar que tenga 50 dígitos
      if (claveRegenerada.length === 50) {
        console.log(`[SUPABASE-INVOICE-SVC] Clave regenerada para ${facturaOriginal.id || consecutivo}`);
        return claveRegenerada;
      } else {
        console.warn(`[SUPABASE-INVOICE-SVC] No se pudo regenerar correctamente la clave (longitud ${claveRegenerada.length})`);
        return facturaOriginal.claveNumerica || '';
      }
    } catch (error) {
      console.error('Error al regenerar clave:', error);
      return facturaOriginal.claveNumerica || '';
    }
  }

  /**
   * Obtiene el nombre del medio de pago a partir del código
   * @param {string|array} medioPago - Código o array de códigos del medio de pago
   * @returns {string} - Nombre del medio de pago
   */
  // La implementación principal de obtenerNombreMedioPago está en la línea 720

  /**
   * Guarda una factura de crédito pagada en la tabla de créditos pagados
   */
  async guardarFacturaCreditoPagada(invoice: any, companyUuid: string): Promise<{success: boolean; error?: any}> {
    try {
      // Verificar si la tabla existe, si no, crearla
      await this.verificarTablaFacturasCreditoPagadas();
      
      // Preparar los datos para la tabla
      const datosPago = {
        id: invoice.id,
        company_id: companyUuid,
        invoice_data: invoice,
        fecha_pago: invoice.infoPago.fechaPago || new Date().toISOString(),
        medio_pago: invoice.infoPago.medioPago,
        monto: invoice.total,
        moneda: invoice.moneda || 'CRC',
        created_at: new Date().toISOString(),
      };
      
      // Guardar en la tabla de créditos pagados
      const { error } = await supabase
        .from('creditos_pagados')
        .upsert(datosPago, { onConflict: 'id' })
        .select();
      
      if (error) {
        console.error('Error al guardar factura en creditos_pagados:', error);
        return { success: false, error };
      }
      
      console.log(`Factura ${invoice.id} guardada exitosamente en creditos_pagados.`);
      return { success: true };
    } catch (error) {
      console.error('Error al guardar factura en creditos_pagados:', error);
      return { success: false, error };
    }
  }
  
  /**
   * Verifica si la tabla de créditos pagados existe, si no, la crea
   * Nota: Esta es una solución temporal, lo ideal es crear la tabla directamente en Supabase
   */
  async verificarTablaFacturasCreditoPagadas(): Promise<void> {
    try {
      // Comprobar si la tabla existe haciendo una consulta simple
      const { error } = await supabase
        .from('creditos_pagados')
        .select('id')
        .limit(1);
      
      // Si no hay error, la tabla existe
      if (!error) return;
      
      // Si el error es que la tabla no existe, mostrar mensaje informativo
      console.log('La tabla creditos_pagados no existe o no está accesible.');
      console.log('Por favor, ejecuta el siguiente SQL en la consola de Supabase para crear la tabla:');
      console.log(`
-- SQL para crear la tabla de créditos pagados
CREATE TABLE IF NOT EXISTS creditos_pagados (
  id TEXT PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  invoice_data JSONB NOT NULL,
  fecha_pago TIMESTAMP WITH TIME ZONE,
  medio_pago TEXT,
  monto NUMERIC,
  moneda TEXT DEFAULT 'CRC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_creditos_pagados_company_id ON creditos_pagados(company_id);
CREATE INDEX IF NOT EXISTS idx_creditos_pagados_fecha_pago ON creditos_pagados(fecha_pago);
      `);
    } catch (error) {
      console.error('Error al verificar la tabla creditos_pagados:', error);
    }
  }
  
  /**
   * Búsqueda avanzada en el campo JSONB data de invoice_data
   */
  async searchInvoicesData(companyId: string, criteria: any): Promise<{invoices: any[]; error?: any}> {
    try {
      // Convertir ID de empresa a UUID
      const companyUuid = getCompanyUuid(companyId);
      console.log(`Buscando facturas para empresa ${companyId} (UUID: ${companyUuid})`);
      
      let query = supabase
        .from('invoice_data')
        .select('*')
        .eq('company_id', companyUuid);
      
      // Aplicar criterios de búsqueda en el campo JSONB data
      if (criteria.client) {
        query = query.ilike('data->>client', `%${criteria.client}%`);
      }
      
      if (criteria.status) {
        query = query.eq('data->>status', criteria.status);
      }
      
      if (criteria.dateFrom) {
        query = query.gte('data->>date', criteria.dateFrom);
      }
      
      if (criteria.dateTo) {
        query = query.lte('data->>date', criteria.dateTo);
      }
      
      const { data: resultData, error } = await query.order('created_at', { ascending: false });
      
      if (error) {
        return { invoices: [], error };
      }
      
      // Extraer los datos JSON de cada registro
      const invoices = resultData?.map(item => item.data) || [];
      return { invoices };
    } catch (error) {
      console.error('Error en búsqueda de facturas en invoice_data:', error);
      return { invoices: [], error };
    }
  }
  
  /**
   * Guardar múltiples facturas en Supabase (usado para sincronización en lote)
   */
  async saveInvoicesData(companyId: string, invoices: any[]): Promise<{success: boolean; error?: any}> {
    try {
      if (invoices.length === 0) {
        return { success: true };
      }
      
      // Convertir ID de empresa a UUID
      const companyUuid = getCompanyUuid(companyId);
      console.log(`Guardando facturas en lote para empresa ${companyId} (UUID: ${companyUuid})`);
      
      // Primero verificamos qué facturas ya existen para no duplicarlas
      const { data: existingData, error: fetchError } = await supabase
        .from('invoice_data')
        .select('id')
        .eq('company_id', companyUuid);
      
      if (fetchError) {
        console.error('Error al verificar facturas existentes:', fetchError);
        return { success: false, error: fetchError };
      }
      
      // Crear un set de IDs existentes para búsqueda rápida
      const existingIds = new Set(existingData?.map(item => item.id) || []);
      
      // Filtrar las facturas que no existen en Supabase
      const newInvoices = invoices.filter(invoice => !existingIds.has(invoice.id));
      const updatedInvoices = invoices.filter(invoice => existingIds.has(invoice.id));
      
      console.log(`Total facturas: ${invoices.length}, Nuevas: ${newInvoices.length}, Existentes: ${updatedInvoices.length}`);
      
      // Si hay facturas nuevas, las insertamos
      if (newInvoices.length > 0) {
        // Preparar datos para la inserción
        const newData = newInvoices.map(invoice => ({
          id: invoice.id,
          company_id: companyUuid,
          data: invoice
        }));
        
        // Insertar en lotes de 50 para evitar límites de tamaño de request
        for (let i = 0; i < newData.length; i += 50) {
          const batch = newData.slice(i, i + 50);
          const { error: insertError } = await supabase
            .from('invoice_data')
            .insert(batch);
          
          if (insertError) {
            console.error(`Error al insertar lote ${i/50 + 1}:`, insertError);
            // Seguimos con el siguiente lote a pesar del error
          }
        }
      }
      
      // Si hay facturas para actualizar, las actualizamos
      if (updatedInvoices.length > 0) {
        // Actualizar cada factura individualmente
        for (const invoice of updatedInvoices) {
          const { error: updateError } = await supabase
            .from('invoice_data')
            .update({ data: invoice })
            .eq('id', invoice.id)
            .eq('company_id', companyUuid);
          
          if (updateError) {
            console.error(`Error al actualizar factura ${invoice.id}:`, updateError);
            // Continuamos con la siguiente factura a pesar del error
          }
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error al guardar facturas en lote:', error);
      return { success: false, error };
    }
  }
}

// Exportar la instancia del servicio
export const supabaseInvoiceService = new SupabaseInvoiceService();
