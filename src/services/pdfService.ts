import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { Invoice } from '../types/invoice';
import { saveAs } from 'file-saver';

/**
 * Servicio para la generación de documentos PDF para facturación electrónica
 * Este servicio utiliza los mismos datos que el XML para garantizar consistencia.
 */

// Helper functions
const formatCurrency = (amount: number, currency: string = 'CRC', showSymbol: boolean = false): string => {
  // Determinar el símbolo de la moneda
  let symbol = '';
  if (showSymbol) {
    if (currency === 'USD') {
      symbol = '$';
    } else if (currency === 'EUR') {
      symbol = '€';
    } else if (currency === 'CRC') {
      symbol = '₡';
    }
  }
  
  // Formatear el número con el formato de Costa Rica
  const formattedNumber = new Intl.NumberFormat('es-CR', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).format(amount);
  
  // Agregar el símbolo correspondiente solo si se solicita
  return `${symbol}${formattedNumber}`;
};

const getCondicionVentaText = (codigo: string): string => {
  const condiciones: Record<string, string> = {
    '01': 'Contado', '02': 'Crédito', '03': 'Consignación', '04': 'Apartado',
    '05': 'Arrendamiento con opción de compra', '06': 'Arrendamiento en función financiera',
    '07': 'Cobro a favor de un tercero', '08': 'Servicios prestados al Estado',
    '09': 'Pago de servicios prestado al Estado', '10': 'Venta a crédito en IVA hasta 90 días (Artículo 27, LIVA)',
    '11': 'Pago de venta a crédito en IVA hasta 90 días (Artículo 27, LIVA)',
    '12': 'Venta Mercancía No Nacionalizada', '13': 'Venta Bienes Usados No Contribuyente',
    '14': 'Arrendamiento Operativo', '15': 'Arrendamiento Financiero', '99': 'Otros'
  };
  return condiciones[codigo] || codigo;
};

const getCurrencyName = (codigo: string): string => {
  const monedas: Record<string, string> = { 'CRC': 'Colones', 'USD': 'Dólares', 'EUR': 'Euros' };
  return monedas[codigo] || codigo;
};

const getMedioPagoText = (codigo: string): string => {
  const mediosPago: Record<string, string> = {
    '01': 'Efectivo', '02': 'Tarjeta', '03': 'Cheque', '04': 'Transferencia – depósito bancario',
    '05': 'Recaudado por terceros', '06': 'SINPE MOVIL', '07': 'Plataforma Digital', '99': 'Otros'
  };
  return mediosPago[codigo] || codigo;
};

/**
 * Función para obtener el nombre completo de una institución a partir de su código
 */
const getNombreInstitucionExoneracion = (codigo: string): string => {
  const instituciones: Record<string, string> = {
    '01': 'Poder Ejecutivo',
    '02': 'Poder Legislativo',
    '03': 'Poder Judicial',
    '04': 'Tribunal Supremo de Elecciones',
    '05': 'Instituciones descentralizadas no empresariales',
    '06': 'Empresas Públicas no Financieras',
    '07': 'Instituciones Públicas Financieras',
    '08': 'Gobiernos Locales',
    '09': 'Universidades Públicas',
    '10': 'Instituciones de Seguridad Social',
    '11': 'Empresas privadas autorizadas',
    '12': 'Organizaciones Religiosas acreditadas',
    '13': 'Misiones Diplomáticas, Organismos Internacionales',
    '14': 'Adultos mayores',
    '15': 'Actividad agropecuaria',
    '16': 'Servicios de salud privados',
    '17': 'Transporte terrestre de personas',
    '18': 'Exportación o reimportación',
    '19': 'Zona franca',
    '20': 'Vehículo eléctrico',
    '21': 'Personas físicas con actividad agropecuaria',
    '22': 'Servicio de educación privada',
    '23': 'Proyectos de interés sanitario',
    '24': 'Proyecto Forestal',
    '25': 'Escuelas y colegios científicos',
    '99': 'Otros'
  };
  return instituciones[codigo] || 'Institución no especificada';
};

/**
 * Función para obtener la descripción de un tipo de documento de exoneración
 */
const getTipoDocumentoExoneracionTexto = (tipoDocumento: string): string => {
  const tiposDocumento: Record<string, string> = {
    '01': 'Compras autorizadas',
    '02': 'Ventas exentas a diplomáticos',
    '03': 'Autorizado por ley especial',
    '04': 'Exenciones Dirección General de Hacienda',
    '05': 'Transitorio V',
    '06': 'Transitorio IX',
    '07': 'Transitorio XVII',
    '99': 'Otros'
  };
  return tiposDocumento[tipoDocumento] || 'Tipo de documento no especificado';
};

/**
 * Generate a PDF invoice document with enhanced visual appeal.
 * @param invoice Invoice data
 * @returns jsPDF document instance
 */
export const generatePDF = (invoice: Invoice): jsPDF => {
  try {
    // Determinar si es un tiquete electrónico basado en el número consecutivo
    const isTiquete = invoice.numeroConsecutivo.startsWith('04');
    console.log(`Generando PDF para ${isTiquete ? 'tiquete' : 'factura'} con consecutivo: ${invoice.numeroConsecutivo}`);
    
    // Create a new jsPDF instance
    // Nota: Usar orientación portrait para facturas normales y landscape para facturas con muchas líneas
    // Tamaño de página A4
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });
    
    // Definir colores y estilos
    const primaryColor = '#007BFF';  // Color principal para títulos y encabezados
    const secondaryColor = '#6C757D';  // Color secundario para textos menos importantes
    const borderColor = '#DEE2E6';  // Color de bordes
    const successColor = '#28A745';  // Color para importes positivos o estados exitosos
    
    // Añadir la lógica para generar el PDF completo con todos los datos de la factura
    
    // Cabecera con logos y título
    // Esta es una versión inicial del servicio de generación de PDF.
    // Se implementará la generación completa del documento en una actualización posterior.
    
    return doc;
  } catch (error) {
    console.error('Error al generar PDF:', error);
    throw new Error(`Error al generar PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
};

/**
 * Convierte un documento PDF en un Blob sin descargarlo.
 * @param pdfDoc Documento PDF generado
 * @returns Blob del PDF
 */
export const generatePdfBlob = (pdfDoc: jsPDF): Blob => {
  try {
    return pdfDoc.output('blob');
  } catch (error) {
    console.error('Error al convertir PDF a Blob:', error);
    throw new Error(
      `Error al convertir PDF a Blob: ${
        error instanceof Error ? error.message : 'Error desconocido'
      }`
    );
  }
};

/**
 * Descarga el PDF como archivo
 * @param pdfDoc Documento PDF generado
 * @param consecutivo Número consecutivo de la factura
 * @returns Blob del PDF generado
 */
export const downloadPDF = (pdfDoc: jsPDF, consecutivo: string): Blob => {
  try {
    // Determinar si es un tiquete electrónico basado en el número consecutivo
    const isTiquete = consecutivo.startsWith('04');
    const filePrefix = isTiquete ? 'tiquete' : 'factura';
    
    // Generar el blob del PDF
    const pdfBlob = pdfDoc.output('blob');
    
    // Descargar el archivo
    saveAs(pdfBlob, `${filePrefix}_${consecutivo}.pdf`);
    
    console.log(`PDF guardado como ${filePrefix}_${consecutivo}.pdf`);
    return pdfBlob;
  } catch (error) {
    console.error('Error al descargar el PDF:', error);
    throw new Error(`Error al descargar PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
};
