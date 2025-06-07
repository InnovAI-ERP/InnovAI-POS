import { saveAs } from 'file-saver';
import axios from 'axios';
import { format } from 'date-fns';
import { Invoice } from '../types/invoice';
import { emailConfig } from '../config/emailConfig';
import { sendInvoiceEmail, blobToBase64 } from './emailService';

// Importar los servicios especializados
import * as xmlService from './xmlService';
import * as pdfService from './pdfService';

/**
 * Helper function para formatear moneda
 */
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

/**
 * Validar y sanitizar los datos de la factura
 * Asegura que todos los campos requeridos estén presentes y con formato correcto
 */
const validateAndSanitizeInvoice = (invoice: Invoice): Invoice => {
  // Copia para no mutar el original
  const validatedInvoice = { ...invoice };
  
  // Asegurar que exista summary y que tenga todos los campos requeridos
  if (!validatedInvoice.summary) {
    validatedInvoice.summary = {
      currency: 'CRC',
      subtotal: 0,
      totalDiscount: 0,
      totalSalesTax: 0,
      totalOtherCharges: 0,
      total: 0,
      totalTaxed: 0,
      totalExempt: 0,
      totalExonerated: 0
    };
  }
  
  // Calcular totales basados en los items
  let subtotal = 0;
  let totalDiscount = 0;
  let totalSalesTax = 0;
  let totalOtherCharges = 0;
  let totalTaxed = 0;
  let totalExempt = 0;
  let totalExonerated = 0;
  
  if (validatedInvoice.items) {
    validatedInvoice.items.forEach(item => {
      // Cálculos de línea
      const lineSubtotal = item.quantity * item.unitPrice;
      const lineDiscount = item.discount || 0;
      subtotal += lineSubtotal;
      totalDiscount += lineDiscount;
      
      // Procesar impuestos
      if (item.taxes && item.taxes.length > 0) {
        item.taxes.forEach(tax => {
          if (tax.taxExemption) {
            if (tax.taxExemption.taxExemptionType === '01') { // Exento
              totalExempt += lineSubtotal - lineDiscount;
            } else { // Exonerado
              totalExonerated += lineSubtotal - lineDiscount;
              totalSalesTax += (lineSubtotal - lineDiscount) * (tax.rate - (tax.rate * tax.taxExemption.percentageExoneration / 100)) / 100;
            }
          } else {
            totalTaxed += lineSubtotal - lineDiscount;
            totalSalesTax += (lineSubtotal - lineDiscount) * tax.rate / 100;
          }
        });
      } else {
        // Sin impuestos = exento
        totalExempt += lineSubtotal - lineDiscount;
      }
    });
  }
  
  // Actualizar los totales calculados
  validatedInvoice.summary.subtotal = Math.round(subtotal * 100) / 100;
  validatedInvoice.summary.totalDiscount = Math.round(totalDiscount * 100) / 100;
  validatedInvoice.summary.totalSalesTax = Math.round(totalSalesTax * 100) / 100;
  validatedInvoice.summary.totalOtherCharges = Math.round(totalOtherCharges * 100) / 100;
  validatedInvoice.summary.totalTaxed = Math.round(totalTaxed * 100) / 100;
  validatedInvoice.summary.totalExempt = Math.round(totalExempt * 100) / 100;
  validatedInvoice.summary.totalExonerated = Math.round(totalExonerated * 100) / 100;
  
  // Calcular total general
  validatedInvoice.summary.total = Math.round((subtotal - totalDiscount + totalSalesTax + totalOtherCharges) * 100) / 100;
  
  return validatedInvoice;
};

/**
 * Genera el código de seguridad para la factura
 * Usa un código único por compañía que se almacena en localStorage
 */
export const getSecurityCode = (companyId: string): string => {
  const storageKey = `company_${companyId}_security_code`;
  let securityCode = localStorage.getItem(storageKey);
  
  // Si no existe, generar uno nuevo
  if (!securityCode) {
    // Generar código de 8 dígitos
    securityCode = Math.floor(10000000 + Math.random() * 90000000).toString();
    localStorage.setItem(storageKey, securityCode);
  }
  
  return securityCode;
};

/**
 * Genera la clave numérica de 50 dígitos para factura electrónica
 */
export const generateInvoiceKey = (
  country: string,
  date: Date,
  id: string,
  consecutiveNumber: string,
  situacion: string,
  securityCode: string
): string => {
  const formattedDate = format(date, 'ddMMyy');
  const paddedId = id.padStart(12, '0');
  const paddedConsecutive = consecutiveNumber.padStart(10, '0');
  
  // Clave = país(3) + fecha(6) + cedula(12) + consecutivo(10) + situacion(1) + codigoSeguridad(8) + 00
  return `${country}${formattedDate}${paddedId}${paddedConsecutive}${situacion}${securityCode}00`;
};

/**
 * Genera un número consecutivo para la factura
 */
export const generateConsecutiveNumber = (
  officeCode: string,
  terminalCode: string,
  documentType: string,
  sequence: number
): string => {
  const paddedOffice = officeCode.padStart(3, '0');
  const paddedTerminal = terminalCode.padStart(5, '0');
  const paddedSequence = sequence.toString().padStart(10, '0');
  
  return `${paddedOffice}${paddedTerminal}${documentType}${paddedSequence}`;
};

/**
 * Descarga el XML generado
 */
export const downloadXML = (xmlString: string, fileName: string): void => {
  const blob = new Blob([xmlString], { type: 'application/xml' });
  saveAs(blob, fileName);
};

/**
 * Envía el XML a Hacienda
 */
export const sendInvoiceXML = async (
  xmlString: string, 
  apiUrl: string,
  apiToken: string
): Promise<any> => {
  try {
    const response = await axios.post(
      apiUrl, 
      { xml: btoa(xmlString) },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error al enviar el XML a Hacienda:', error);
    throw new Error(`Error al enviar el XML a Hacienda: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
};

/**
 * Envía la factura por email
 */
export const sendInvoiceByEmail = async (
  invoice: Invoice,
  xmlBlob: Blob,
  pdfBlob: Blob,
  recipientEmail?: string
): Promise<boolean> => {
  try {
    // Convertir blobs a base64
    const xmlBase64 = await blobToBase64(xmlBlob);
    const pdfBase64 = await blobToBase64(pdfBlob);
    
    // Determinar el tipo de documento
    const docType = invoice.documentType === '01' ? 'Factura' : 'Tiquete';
    const isTiquete = invoice.documentType === '03';
    
    // Determinar el email del destinatario
    const to = recipientEmail || (isTiquete ? emailConfig.defaultEmail : invoice.receiver?.email);
    
    if (!to) {
      throw new Error('No se especificó un correo electrónico de destinatario');
    }
    
    // Preparar datos del email
    const emailData = {
      to,
      subject: `${docType} Electrónica ${invoice.consecutiveNumber}`,
      message: `Adjunto encontrará su ${docType} Electrónica número ${invoice.consecutiveNumber}.`,
      attachments: [
        {
          filename: `${docType}_${invoice.consecutiveNumber}.xml`,
          content: xmlBase64.split(',')[1],
          encoding: 'base64',
          contentType: 'application/xml'
        },
        {
          filename: `${docType}_${invoice.consecutiveNumber}.pdf`,
          content: pdfBase64.split(',')[1],
          encoding: 'base64',
          contentType: 'application/pdf'
        }
      ]
    };
    
    // Enviar email
    await sendInvoiceEmail(emailData);
    return true;
  } catch (error) {
    console.error('Error al enviar la factura por email:', error);
    throw new Error(`Error al enviar la factura por email: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
};

/**
 * Función puente para generateXML (usa xmlService)
 */
export const generateXML = (invoice: Invoice): string => {
  return xmlService.generateXML(validateAndSanitizeInvoice(invoice));
};

/**
 * Función puente para generatePDF (usa pdfService)
 */
export const generatePDF = (invoice: Invoice): any => {
  return pdfService.generatePDF(validateAndSanitizeInvoice(invoice));
};

/**
 * Procesar una factura electrónica completa (XML y PDF) v4.4
 * @param invoice Datos de la factura
 * @returns Objeto con el XML y PDF generados
 */
export const processInvoice = async (invoice: Invoice): Promise<{ xmlString: string, pdfDoc: any, invoiceData: Invoice }> => {
  try {
    console.log('Iniciando procesamiento de factura electrónica v4.4');
    
    // Validar y sanitizar los datos de la factura
    const validatedInvoice = validateAndSanitizeInvoice(invoice);
    
    // Generar el XML primero (esto asegura que todos los cálculos y validaciones se realicen)
    console.log('Generando XML de la factura...');
    const xmlString = xmlService.generateXML(validatedInvoice);
    
    // Generar el PDF usando los mismos datos validados
    console.log('Generando PDF de la factura con los mismos datos...');
    const pdfDoc = pdfService.generatePDF(validatedInvoice);
    
    return {
      xmlString,
      pdfDoc,
      invoiceData: validatedInvoice
    };
  } catch (error) {
    console.error('Error al procesar la factura:', error);
    throw new Error(`Error al procesar la factura: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
};

/**
 * Procesa una factura electrónica completa y la envía a Hacienda y/o por correo
 * @param invoice Datos de la factura
 * @param options Opciones adicionales (descargar, enviar a Hacienda, enviar por email)
 * @returns Resultado del procesamiento
 */
export const processAndSendInvoice = async (
  invoice: Invoice,
  options: {
    download?: boolean;
    sendToHacienda?: boolean;
    sendEmail?: boolean;
    recipientEmail?: string;
    apiUrl?: string;
    apiToken?: string;
  } = {}
): Promise<{
  success: boolean;
  xmlString?: string;
  pdfBlob?: Blob;
  haciendaResponse?: any;
  emailSent?: boolean;
}> => {
  try {
    // Determinar el tipo de documento
    const docType = invoice.documentType === '01' ? 'Factura' : 'Tiquete';
    
    // Procesar la factura (XML y PDF)
    const { xmlString, pdfDoc, invoiceData } = await processInvoice(invoice);
    
    // Convertir PDF a blob
    const pdfBlob = await pdfService.generatePdfBlob(pdfDoc);
    
    let result = {
      success: true,
      xmlString,
      pdfBlob
    };
    
    // Descargar archivos si es necesario
    if (options.download) {
      downloadXML(xmlString, `${docType}_${invoice.consecutiveNumber}.xml`);
      pdfService.downloadPDF(pdfDoc, `${docType}_${invoice.consecutiveNumber}.pdf`);
    }
    
    // Enviar a Hacienda si es necesario
    if (options.sendToHacienda && options.apiUrl && options.apiToken) {
      result = {
        ...result,
        haciendaResponse: await sendInvoiceXML(xmlString, options.apiUrl, options.apiToken)
      };
    }
    
    // Enviar por email si es necesario
    if (options.sendEmail) {
      const xmlBlob = new Blob([xmlString], { type: 'application/xml' });
      result = {
        ...result,
        emailSent: await sendInvoiceByEmail(invoiceData, xmlBlob, pdfBlob, options.recipientEmail)
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error en el procesamiento completo de la factura:', error);
    throw new Error(`Error en el procesamiento completo de la factura: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
};
