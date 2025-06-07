/**
 * Configuración del servicio de correo electrónico
 * Este archivo contiene la configuración necesaria para el servicio de correo electrónico
 * basado en EmailJS para enviar correos directamente desde el frontend.
 */

// Configuración del servicio de correo electrónico
export const emailConfig = {
  // Configuración de EmailJS
  emailjs: {
    serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID || '',
    templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '',
    userId: import.meta.env.VITE_EMAILJS_USER_ID || '',
    accessToken: import.meta.env.VITE_EMAILJS_ACCESS_TOKEN || '',
  },
  // Configuración de la API (para compatibilidad con versiones anteriores)
  api: {
    url: import.meta.env.VITE_EMAIL_API_URL || '/api/send-email',
    key: import.meta.env.VITE_EMAIL_API_KEY || '',
  },
  // Configuración del remitente por defecto
  defaultSender: {
    email: import.meta.env.VITE_EMAIL_FROM || 'ejemplo@correo.com', // Correo electrónico del remitente por defecto
    name: import.meta.env.VITE_EMAIL_FROM_NAME || 'Sistema de Facturación', // Nombre del remitente por defecto
  },
  // Configuración para incluir el documento de aceptación de Hacienda
  includeAcceptanceDoc: import.meta.env.VITE_INCLUDE_ACCEPTANCE_DOC === 'true' || false,
};

/**
 * Función para validar la configuración de correo electrónico
 * @returns true si la configuración es válida, false en caso contrario
 */
export const validateEmailConfig = (): boolean => {
  const { defaultSender } = emailConfig;
  
  // Verificar que se haya proporcionado un correo electrónico de remitente por defecto
  if (!defaultSender.email) {
    console.error('Error: No se ha configurado el correo electrónico del remitente por defecto');
    return false;
  }
  
  return true;
};