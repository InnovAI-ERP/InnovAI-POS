/**
 * Ejemplo de configuración del servicio de correo electrónico para producción
 * Este archivo muestra cómo configurar el servicio de correo para enviar facturas y tiquetes electrónicos
 */

import { configureEmailService, sendInvoiceByEmail } from '../services/invoiceServiceOrig';

/**
 * Configuración del servicio de correo para Gmail
 * Nota: Para Gmail, es recomendable usar una "Contraseña de aplicación" en lugar de la contraseña normal
 * Puedes crear una contraseña de aplicación en: https://myaccount.google.com/apppasswords
 */
export const configureGmailService = () => {
  // Configurar el servicio de correo con Gmail
  configureEmailService(
    {
      // Configuración del servidor SMTP de Gmail
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true para puerto 465, false para otros puertos
      user: 'tu_correo@gmail.com', // Tu correo de Gmail
      password: 'tu_contraseña_de_aplicacion' // Tu contraseña de aplicación
    },
    {
      // Información del remitente
      name: 'Tu Empresa', // Nombre que aparecerá como remitente
      email: 'tu_correo@gmail.com' // Debe ser el mismo que el usuario SMTP
    },
    true // Incluir documento de aceptación de Hacienda
  );

  console.log('Servicio de correo configurado correctamente con Gmail');
};

/**
 * Configuración del servicio de correo para Outlook/Office 365
 */
export const configureOutlookService = () => {
  // Configurar el servicio de correo con Outlook
  configureEmailService(
    {
      // Configuración del servidor SMTP de Outlook
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      user: 'tu_correo@outlook.com', // Tu correo de Outlook
      password: 'tu_contraseña' // Tu contraseña
    },
    {
      // Información del remitente
      name: 'Tu Empresa',
      email: 'tu_correo@outlook.com' // Debe ser el mismo que el usuario SMTP
    },
    true // Incluir documento de aceptación de Hacienda
  );

  console.log('Servicio de correo configurado correctamente con Outlook');
};

/**
 * Ejemplo de envío de factura por correo electrónico
 * @param recipientEmail Correo del receptor
 * @param xmlContent Contenido XML de la factura
 * @param pdfBlob PDF de la factura
 * @param invoiceNumber Número de factura
 * @param acceptanceDocBlob Documento de aceptación de Hacienda (opcional)
 */
export const sendInvoiceExample = async (
  recipientEmail: string,
  xmlContent: string,
  pdfBlob: Blob,
  invoiceNumber: string,
  acceptanceDocBlob?: Blob
) => {
  try {
    // Enviar la factura por correo electrónico
    await sendInvoiceByEmail(
      recipientEmail,
      xmlContent,
      pdfBlob,
      invoiceNumber,
      undefined, // Usar el correo del remitente configurado
      undefined, // Usar el nombre del remitente configurado
      acceptanceDocBlob,
      ['copia@empresa.com'], // Correo en copia (CC)
      ['registro@empresa.com'], // Correo en copia oculta (BCC)
      `Factura Electrónica ${invoiceNumber} - Tu Empresa`, // Asunto personalizado
      `
        <html>
          <body style="font-family: Arial, sans-serif; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
              <div style="text-align: center; margin-bottom: 20px;">
                <h1 style="color: #0066cc;">Tu Empresa</h1>
              </div>
              <p>Estimado cliente,</p>
              <p>Adjunto encontrará su factura electrónica en formatos XML y PDF.</p>
              <p>También se incluye el documento de aceptación de Hacienda.</p>
              <p>Si tiene alguna pregunta sobre esta factura, no dude en contactarnos.</p>
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                <p style="font-size: 12px; color: #666;">
                  Este correo es generado automáticamente, por favor no responda a este mensaje.<br>
                  Tu Empresa S.A. | Tel: +506 2222-3333 | info@tuempresa.com
                </p>
              </div>
            </div>
          </body>
        </html>
      ` // Mensaje HTML personalizado
    );

    console.log(`Factura ${invoiceNumber} enviada correctamente a ${recipientEmail}`);
  } catch (error) {
    console.error('Error al enviar la factura por correo:', error);
  }
};