/**
 * Servicio de correo electrónico para el envío de facturas
 * Este servicio utiliza EmailJS para enviar correos electrónicos desde el frontend
 * sin necesidad de un servidor backend.
 */

import { emailConfig } from '../config/emailConfig';

// Interfaz para la configuración de EmailJS
interface EmailJSConfig {
  serviceId: string;
  templateId: string;
  userId: string;
  publicKey: string; // Añadido campo para la public key
  accessToken?: string;
}

// Configuración de EmailJS
export const emailJSConfig: EmailJSConfig = {
  serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID || '',
  templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '',
  userId: import.meta.env.VITE_EMAILJS_USER_ID || '',
  publicKey: 'LdSOr1WR1AR8_-paQ', // Public key proporcionada
  accessToken: import.meta.env.VITE_EMAILJS_ACCESS_TOKEN || undefined,
};

/**
 * Inicializa EmailJS con la configuración proporcionada
 */
export const initEmailJS = (): void => {
  // Importación dinámica de EmailJS para evitar problemas con SSR
  import('@emailjs/browser').then((emailjs) => {
    emailjs.init({
      publicKey: emailJSConfig.publicKey, // Usar la publicKey directamente
      privateKey: emailJSConfig.accessToken, // Opcional
    });
    console.log('EmailJS inicializado correctamente con public key');
  }).catch(error => {
    console.error('Error al inicializar EmailJS:', error);
  });
};

/**
 * Envía una factura por correo electrónico utilizando EmailJS
 * @param recipientEmail Correo electrónico del receptor
 * @param recipientName Nombre del receptor (opcional)
 * @param invoiceNumber Número de factura
 * @param pdfBase64 PDF de la factura en formato Base64
 * @param xmlBase64 XML de la factura en formato Base64
 * @param acceptanceDocBase64 Documento de aceptación de Hacienda en formato Base64 (opcional)
 * @param customSubject Asunto personalizado (opcional)
 * @param customMessage Mensaje personalizado (opcional)
 * @param ccEmails Lista de correos para copia (opcional)
 */
export const sendInvoiceEmail = async (
  recipientEmail: string,
  recipientName: string = '',
  invoiceNumber: string,
  pdfBase64: string,
  xmlBase64: string,
  acceptanceDocBase64?: string,
  customSubject?: string,
  customMessage?: string,
  ccEmails?: string[],
): Promise<{ success: boolean; message: string }> => {
  // Validar que el correo del receptor sea válido
  if (!recipientEmail || !recipientEmail.includes('@')) {
    console.error('Error: Correo del receptor inválido o no proporcionado');
    return { success: false, message: 'Correo del receptor inválido o no proporcionado' };
  }

  try {
    // Importación dinámica de EmailJS
    const emailjs = await import('@emailjs/browser');

    // Determinar si es un tiquete electrónico basado en el número consecutivo
    const isTiquete = invoiceNumber.startsWith('04');
    const documentType = isTiquete ? 'Tiquete Electrónico' : 'Factura Electrónica';

    // Preparar los datos para la plantilla
    const templateParams = {
      to_email: recipientEmail,
      to_name: recipientName,
      from_name: emailConfig.defaultSender.name,
      from_email: emailConfig.defaultSender.email,
      subject: customSubject || `${documentType} ${invoiceNumber} - ${emailConfig.defaultSender.name}`,
      message: customMessage || `Adjunto encontrará su ${documentType.toLowerCase()} en formatos PDF y XML.`,
      invoice_number: invoiceNumber,
      cc_emails: ccEmails ? ccEmails.join(',') : '',
      pdf_attachment: pdfBase64,
      xml_attachment: xmlBase64,
      acceptance_doc_attachment: acceptanceDocBase64 || '',
      include_acceptance_doc: emailConfig.includeAcceptanceDoc && !!acceptanceDocBase64,
    };

    console.log(`Enviando correo a: ${recipientEmail} para ${documentType} ${invoiceNumber}`);

    // Enviar el correo electrónico
    const response = await emailjs.send(
      emailJSConfig.serviceId,
      emailJSConfig.templateId,
      templateParams,
      emailJSConfig.publicKey, // Usar publicKey en lugar de userId
      emailJSConfig.accessToken
    );

    console.log('Correo enviado correctamente:', response);
    return { 
      success: true, 
      message: `${documentType} enviada correctamente a ${recipientEmail}` 
    };
  } catch (error) {
    console.error('Error al enviar el correo:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Error desconocido al enviar el correo' 
    };
  }
};

/**
 * Convierte un Blob a una cadena Base64
 * @param blob El Blob a convertir
 * @returns Promesa que resuelve a una cadena Base64
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // Eliminar el prefijo 'data:application/pdf;base64,' o similar
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Error al convertir Blob a Base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Actualiza la configuración de EmailJS
 * @param config Nueva configuración
 */
export const updateEmailJSConfig = (config: Partial<EmailJSConfig>): void => {
  Object.assign(emailJSConfig, config);
  // Reinicializar EmailJS con la nueva configuración
  initEmailJS();
};