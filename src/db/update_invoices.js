// Script para actualizar facturas existentes en Supabase
// Agrega información de plazo de crédito y consecutivo unificado a todas las facturas

// Importar servicios necesarios
import { supabase } from '../lib/supabase';
import { getCompanyUuid } from '../services/uuidMappingService';
import { supabaseInvoiceService } from '../services/supabaseInvoiceService';

// Nota: Ya no necesitamos definir estas funciones aquí, usaremos las del servicio

/**
 * Actualiza todas las facturas existentes en Supabase utilizando el servicio supabaseInvoiceService
 */
async function actualizarFacturasExistentes() {
  console.log('Iniciando actualización de facturas existentes en Supabase...');
  
  try {
    // 1. Primero, obtenemos la lista de todas las empresas
    console.log('Obteniendo lista de empresas...');
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name');
    
    if (companiesError) {
      console.error('Error al obtener empresas:', companiesError);
      return { success: false, error: companiesError };
    }
    
    console.log(`Se encontraron ${companies.length} empresas`);
    
    // 2. Para cada empresa, actualizamos sus facturas
    for (const company of companies) {
      console.log(`Procesando facturas para empresa: ${company.name} (ID: ${company.id})`);
      
      // Obtener todas las facturas de la empresa
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoice_data')
        .select('*')
        .eq('company_id', company.id);
      
      if (invoicesError) {
        console.error(`Error al obtener facturas de empresa ${company.name}:`, invoicesError);
        continue; // Continuar con la siguiente empresa
      }
      
      console.log(`Se encontraron ${invoices ? invoices.length : 0} facturas para ${company.name}`);
      
      // Procesar cada factura
      if (invoices && invoices.length > 0) {
        let actualizadas = 0;
        
        for (const invoiceRecord of invoices) {
          if (!invoiceRecord.data) {
            console.warn(`Factura sin datos en registro ID: ${invoiceRecord.id}`);
            continue;
          }
          
          const facturaOriginal = invoiceRecord.data;
          
          // Actualizar la factura usando el servicio completo que aplicará toda la lógica necesaria
          // El servicio se encargará de:
          // 1. Calcular y agregar el plazo de crédito si no existe
          // 2. Asegurar que tenga un consecutivo unificado
          // 3. Agregar el nombre del medio de pago si no existe
          const resultado = await supabaseInvoiceService.updateInvoiceData(facturaOriginal, company.id);
          
          if (resultado.success) {
            actualizadas++;
            console.log(`Factura ${facturaOriginal.id} actualizada correctamente usando el servicio`); 
          } else {
            console.error(`Error al actualizar factura ${facturaOriginal.id}:`, resultado.error);
          }
        }
        
        console.log(`Se actualizaron ${actualizadas} facturas para la empresa ${company.name}`);
      }
    }
    
    console.log('Actualización de facturas completada con éxito');
    return { success: true, message: 'Facturas actualizadas correctamente' };
  } catch (error) {
    console.error('Error durante la actualización de facturas:', error);
    return { success: false, error };
  }
}

// Exponer la función para ejecutarla desde la consola del navegador
window.actualizarFacturasExistentes = actualizarFacturasExistentes;

// Exportar la función para importarla como módulo ES
export { actualizarFacturasExistentes };
