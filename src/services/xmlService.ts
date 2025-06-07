import { create } from 'xmlbuilder2';
import { Invoice } from '../types/invoice';

/**
 * Servicio para la generación de documentos XML para facturación electrónica v4.4
 * Este servicio centraliza la lógica de creación de XML siguiendo los estándares de Hacienda CR
 */

/**
 * Genera el XML para factura electrónica según los estándares de la versión 4.4 de Hacienda CR
 * @param invoice Datos de la factura
 * @returns String con el contenido XML formateado
 */
export const generateXML = (invoice: Invoice): string => {
  // Validar y sanitizar los datos de la factura/tiquete
  invoice = validateAndSanitizeInvoice(invoice);
  try {
    // Verificar que el objeto invoice tenga todos los campos necesarios
    if (!invoice || !invoice.numeroConsecutivo || !invoice.clave || !invoice.emisor) {
      console.error('Error: Datos de factura/tiquete incompletos', invoice);
      throw new Error('Datos de factura/tiquete incompletos');
    }
    
    // Determinar si es un tiquete electrónico basado en el número consecutivo
    const isTiquete = invoice.numeroConsecutivo.startsWith('04');
    console.log(`Generando XML para ${isTiquete ? 'tiquete' : 'factura'} con consecutivo: ${invoice.numeroConsecutivo}`);
    
    const doc = create({ version: '1.0', encoding: 'utf-8' });
    
    let rootNode; // Declarar rootNode
    
    // Crear el elemento raíz (TiqueteElectronico o FacturaElectronica) y asignarlo a rootNode
    if (isTiquete) {
      rootNode = doc.ele('TiqueteElectronico', { // Asignar aquí
        'xmlns': 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/tiqueteElectronico',
        'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xmlns:vc': 'http://www.w3.org/2007/XMLSchema-versioning',
        'xsi:schemaLocation': 
          'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/tiqueteElectronico schema.xsd'
      });
      console.log('Creando XML para TiqueteElectronico con namespace correcto para v4.4');
    } else {
      rootNode = doc.ele('FacturaElectronica', { // Asignar aquí
        'xmlns': 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica',
        'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xmlns:vc': 'http://www.w3.org/2007/XMLSchema-versioning',
        'xsi:schemaLocation': 
          'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica schema.xsd'
      });
      console.log('Creando XML para FacturaElectronica con namespace correcto para v4.4');
    }

    // ---- Encabezado --------------------------------------------------
    rootNode.ele('Clave').txt(invoice.clave);
    
    // Nuevo campo obligatorio en v4.4: ProveedorSistemas
    rootNode.ele('ProveedorSistemas').txt(invoice.proveedorSistemas || '3102928079');
    
    // Nuevo campo obligatorio en v4.4: CodigoActividadEmisor
    rootNode.ele('CodigoActividadEmisor').txt(invoice.emisor.actividadEconomica || '741203');
    
    // Campo obligatorio en v4.4 para facturas, pero NO para tiquetes: CodigoActividadReceptor
    if (!isTiquete && invoice.receptor?.economic_activity_code) {
      rootNode.ele('CodigoActividadReceptor').txt(invoice.receptor.economic_activity_code);
    }
    
    rootNode.ele('NumeroConsecutivo').txt(invoice.numeroConsecutivo);
    rootNode.ele('FechaEmision').txt(invoice.fechaEmision);

    // Esta es una versión inicial. Completaré el resto de la generación de XML en próximas actualizaciones.
    
    return doc.end({ prettyPrint: true });
  } catch (error) {
    console.error('Error al generar XML:', error);
    throw new Error(`Error al generar XML: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
};

/**
 * Validate and sanitize invoice data
 * @param invoice Invoice data
 */
const validateAndSanitizeInvoice = (invoice: Invoice): Invoice => {
  // Crear una copia profunda para no modificar el objeto original
  const sanitizedInvoice = JSON.parse(JSON.stringify(invoice)) as Invoice;
  
  // Validar y corregir detalleServicio
  if (sanitizedInvoice.detalleServicio && Array.isArray(sanitizedInvoice.detalleServicio)) {
    sanitizedInvoice.detalleServicio = sanitizedInvoice.detalleServicio.map((item, index) => {
      // Asegurarse de que exista un ID válido
      if (!item.id || typeof item.id !== 'number') {
        item.id = index + 1;
      }
      
      // Validar y convertir cantidad a número
      if (typeof item.cantidad !== 'number') {
        const cantidadNum = parseFloat(String(item.cantidad));
        if (!isNaN(cantidadNum)) {
          item.cantidad = cantidadNum;
        } else {
          item.cantidad = 1; // Valor por defecto
        }
      }
      
      // Validar y convertir precioUnitario a número
      if (typeof item.precioUnitario !== 'number') {
        const precioNum = parseFloat(String(item.precioUnitario));
        if (!isNaN(precioNum)) {
          item.precioUnitario = precioNum;
        } else {
          item.precioUnitario = 0; // Valor por defecto
        }
      }
      
      // Asegurarse de que existe unidadMedida
      if (!item.unidadMedida || item.unidadMedida.trim() === '') {
        item.unidadMedida = 'Unid'; // Valor por defecto
      }
      
      return item;
    });
  }
  
  return sanitizedInvoice;
};

/**
 * Genera un string XML a partir del documento
 * @param doc Documento XML
 * @returns String XML formateado
 */
export const generateXmlString = (doc: any, shouldSign: boolean = true): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const xmlString = doc.end({ prettyPrint: true });
      if (shouldSign) {
        // En este punto se podría integrar la lógica de firmado del XML
        // Por ahora solo devolvemos el string sin firmar
        resolve(xmlString);
      } else {
        resolve(xmlString);
      }
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Descarga el XML como archivo
 * @param xmlString Contenido del XML
 * @param consecutivo Número consecutivo de la factura
 */
export function downloadXML(xmlString: string, consecutivo: string) {
  const blob = new Blob([xmlString], { type: 'application/xml;charset=utf-8' });
  // Determinar si es un tiquete electrónico basado en el número consecutivo
  const isTiquete = consecutivo.startsWith('04');
  const filePrefix = isTiquete ? 'tiquete' : 'factura';
  
  try {
    // Usar la API del navegador para descargar archivos
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filePrefix}_${consecutivo}.xml`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    console.log(`XML guardado como ${filePrefix}_${consecutivo}.xml`);
  } catch (error) {
    console.error('Error al descargar el XML:', error);
    throw new Error(`Error al descargar XML: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}
