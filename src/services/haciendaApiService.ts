import { Invoice } from '../types/invoice';
import { envService } from './envService';
import { tokenManager, getAccessToken, refreshAccessToken } from './haciendaAuthService';
import { generateInvoiceKey } from './invoiceService';
import { generateXML as generateInvoiceXml } from './xmlService';
import { signXml, loadSignatureKeys } from './signatureService';
import { sendInvoiceXML } from './invoiceService';

/** Sube el certificado o llave criptográfica a localStorage */
export async function uploadCertificate(file: File): Promise<boolean> {
  try {
    const data = await file.text();
    localStorage.setItem('user_certificate', data);
    return true;
  } catch (err) {
    console.error('Error subiendo certificado:', err);
    return false;
  }
}

/** Solicita un token de autenticación */
export async function requestToken() {
  const result = await getAccessToken();
  return result.accessToken;
}

/** Refresca el token de autenticación */
export async function refreshToken(refresh: string) {
  const result = await refreshAccessToken(refresh);
  return result.accessToken;
}

/** Crea la clave numérica para factura o tiquete */
export function createClave(
  country: string,
  date: Date,
  id: string,
  consecutive: string,
  situacion: string,
  security: string
) {
  return generateInvoiceKey(country, date, id, consecutive, situacion, security);
}

/** Genera el XML de factura electrónica o tiquete electrónico */
export function createInvoiceXML(invoice: Invoice) {
  return generateInvoiceXml(invoice);
}

/** Genera un XML para mensaje de aceptación simple */
export function createAcceptanceMessageXML(params: {
  clave: string;
  consecutivo: string;
  fecha: string;
  emisor: { tipo: string; numero: string };
  receptor: { tipo: string; numero: string };
  mensaje: '1' | '2' | '3';
}) {
  return `<?xml version="1.0" encoding="utf-8"?>\n<MensajeReceptor>\n  <Clave>${params.clave}</Clave>\n  <NumeroCedulaEmisor>${params.emisor.numero}</NumeroCedulaEmisor>\n  <FechaEmisionDoc>${params.fecha}</FechaEmisionDoc>\n  <Mensaje>${params.mensaje}</Mensaje>\n  <NumeroCedulaReceptor>${params.receptor.numero}</NumeroCedulaReceptor>\n  <NumeroConsecutivoReceptor>${params.consecutivo}</NumeroConsecutivoReceptor>\n</MensajeReceptor>`;
}

/** Firma el XML proporcionado */
export async function signXML(xml: string) {
  const keys = await loadSignatureKeys();
  return signXml(xml, keys);
}

/** Envía un documento XML firmado a Hacienda */
export async function sendXMLToHacienda(xmlFirmado: string) {
  const apiUrl = envService.get('HACIENDA_API_URL');
  const token = await tokenManager.getValidToken();
  return sendInvoiceXML(xmlFirmado, apiUrl, token);
}
