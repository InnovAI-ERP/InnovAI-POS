import { supabase } from '../lib/supabase';
import { supabaseAuthService } from './supabaseAuthService';

/**
 * Interfaz para manejar los resultados de las operaciones con archivos
 */
export interface StorageResult {
  success: boolean;
  data?: any;
  error?: string;
  url?: string;
}

/**
 * Servicio para gestionar archivos en Supabase Storage
 */
class SupabaseStorageService {
  // Nombre del bucket para almacenar logos de empresas
  private readonly LOGO_BUCKET = 'company_logos';
  
  // Nombre del bucket para almacenar certificados de Hacienda
  private readonly CERT_BUCKET = 'certificates';
  
  // Nombre del bucket para almacenar facturas en PDF
  private readonly INVOICE_BUCKET = 'invoices';
  
  /**
   * Constructor: inicializa los buckets si no existen
   */
  constructor() {
    this.initializeBuckets()
      .then(() => console.log('Buckets inicializados correctamente'))
      .catch(err => console.error('Error al inicializar buckets:', err));
  }
  
  /**
   * Inicializa los buckets necesarios en Supabase Storage
   */
  private async initializeBuckets(): Promise<void> {
    try {
      // Verificar y crear el bucket para logos
      await this.createBucketIfNotExists(this.LOGO_BUCKET);
      
      // Verificar y crear el bucket para certificados
      await this.createBucketIfNotExists(this.CERT_BUCKET);
      
      // Verificar y crear el bucket para facturas
      await this.createBucketIfNotExists(this.INVOICE_BUCKET);
    } catch (error) {
      console.error('Error al inicializar buckets:', error);
      throw error;
    }
  }
  
  /**
   * Crea un bucket si no existe
   */
  private async createBucketIfNotExists(bucketName: string): Promise<void> {
    try {
      // Verificar si el bucket existe
      const { data: buckets } = await supabase.storage.listBuckets();
      
      const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
      
      if (!bucketExists) {
        // Crear el bucket con acceso público
        const { error } = await supabase.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: 10485760 // 10MB
        });
        
        if (error) {
          console.error(`Error al crear bucket ${bucketName}:`, error);
          throw error;
        }
        
        console.log(`Bucket ${bucketName} creado correctamente`);
      } else {
        console.log(`Bucket ${bucketName} ya existe`);
      }
    } catch (error) {
      console.error(`Error al crear bucket ${bucketName}:`, error);
      throw error;
    }
  }
  
  /**
   * Sube un logo de empresa a Supabase Storage
   */
  async uploadCompanyLogo(companyId: string, logo: File | Blob, fileName?: string): Promise<StorageResult> {
    try {
      const user = supabaseAuthService.getCurrentUser();
      
      if (!user) {
        return {
          success: false,
          error: 'Usuario no autenticado'
        };
      }
      
      // Nombre del archivo en el bucket (usar ID de empresa como nombre)
      const storagePath = `${companyId}/logo`;
      
      // Subir el archivo
      const { data, error } = await supabase.storage
        .from(this.LOGO_BUCKET)
        .upload(storagePath, logo, {
          upsert: true, // Sobrescribir si ya existe
          contentType: 'image/png' // Tipo de contenido predeterminado
        });
      
      if (error) {
        console.error(`Error al subir logo de empresa ${companyId}:`, error);
        return {
          success: false,
          error: 'Error al subir logo de empresa'
        };
      }
      
      // Obtener la URL pública del logo
      const { data: urlData } = supabase.storage
        .from(this.LOGO_BUCKET)
        .getPublicUrl(storagePath);
      
      // Registrar el logo en la tabla company_logos
      await this.registerLogoInDatabase(companyId, storagePath, fileName || 'logo.png');
      
      return {
        success: true,
        data,
        url: urlData.publicUrl
      };
    } catch (error) {
      console.error(`Error en uploadCompanyLogo para ${companyId}:`, error);
      return {
        success: false,
        error: 'Error al subir logo de empresa'
      };
    }
  }
  
  /**
   * Registra un logo en la base de datos
   */
  private async registerLogoInDatabase(companyId: string, storagePath: string, fileName: string): Promise<void> {
    try {
      // Verificar si ya existe un registro para este logo
      const { data: existingLogo } = await supabase
        .from('company_logos')
        .select('id')
        .eq('company_id', companyId)
        .maybeSingle();
      
      if (existingLogo) {
        // Actualizar el registro existente
        await supabase
          .from('company_logos')
          .update({
            storage_path: storagePath,
            filename: fileName,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingLogo.id);
      } else {
        // Crear un nuevo registro
        await supabase
          .from('company_logos')
          .insert({
            company_id: companyId,
            storage_path: storagePath,
            filename: fileName
          });
      }
    } catch (error) {
      console.error(`Error al registrar logo en base de datos para ${companyId}:`, error);
      throw error;
    }
  }
  
  /**
   * Obtiene el logo de una empresa
   */
  async getCompanyLogo(companyId: string): Promise<StorageResult> {
    try {
      // Ruta del logo en el bucket
      const storagePath = `${companyId}/logo`;
      
      // Obtener la URL pública del logo
      const { data: urlData } = supabase.storage
        .from(this.LOGO_BUCKET)
        .getPublicUrl(storagePath);
      
      // Verificar si el logo existe
      const { data, error } = await supabase.storage
        .from(this.LOGO_BUCKET)
        .download(storagePath);
      
      if (error) {
        console.error(`Error al obtener logo de empresa ${companyId}:`, error);
        return {
          success: false,
          error: 'Logo no encontrado'
        };
      }
      
      return {
        success: true,
        data,
        url: urlData.publicUrl
      };
    } catch (error) {
      console.error(`Error en getCompanyLogo para ${companyId}:`, error);
      return {
        success: false,
        error: 'Error al obtener logo de empresa'
      };
    }
  }
  
  /**
   * Elimina el logo de una empresa
   */
  async deleteCompanyLogo(companyId: string): Promise<StorageResult> {
    try {
      const user = supabaseAuthService.getCurrentUser();
      
      if (!user) {
        return {
          success: false,
          error: 'Usuario no autenticado'
        };
      }
      
      // Ruta del logo en el bucket
      const storagePath = `${companyId}/logo`;
      
      // Eliminar el archivo
      const { error } = await supabase.storage
        .from(this.LOGO_BUCKET)
        .remove([storagePath]);
      
      if (error) {
        console.error(`Error al eliminar logo de empresa ${companyId}:`, error);
        return {
          success: false,
          error: 'Error al eliminar logo de empresa'
        };
      }
      
      // Eliminar el registro de la base de datos
      await supabase
        .from('company_logos')
        .delete()
        .eq('company_id', companyId);
      
      return {
        success: true
      };
    } catch (error) {
      console.error(`Error en deleteCompanyLogo para ${companyId}:`, error);
      return {
        success: false,
        error: 'Error al eliminar logo de empresa'
      };
    }
  }
  
  /**
   * Sube un certificado de Hacienda a Supabase Storage
   */
  async uploadCertificate(companyId: string, certificate: File | Blob, fileName: string, pin?: string): Promise<StorageResult> {
    try {
      const user = supabaseAuthService.getCurrentUser();
      
      if (!user) {
        return {
          success: false,
          error: 'Usuario no autenticado'
        };
      }
      
      // Nombre del archivo en el bucket
      const storagePath = `${companyId}/${fileName}`;
      
      // Subir el archivo
      const { data, error } = await supabase.storage
        .from(this.CERT_BUCKET)
        .upload(storagePath, certificate, {
          upsert: true // Sobrescribir si ya existe
        });
      
      if (error) {
        console.error(`Error al subir certificado para empresa ${companyId}:`, error);
        return {
          success: false,
          error: 'Error al subir certificado'
        };
      }
      
      // Obtener la URL del certificado (no pública por seguridad)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(this.CERT_BUCKET)
        .createSignedUrl(storagePath, 60 * 60 * 24); // URL válida por 24 horas
      
      if (signedUrlError) {
        console.error(`Error al generar URL firmada para certificado de empresa ${companyId}:`, signedUrlError);
      }
      
      // Registrar el certificado en la base de datos
      await this.registerCertificateInDatabase(companyId, storagePath, fileName, pin);
      
      return {
        success: true,
        data,
        url: signedUrlData?.signedUrl
      };
    } catch (error) {
      console.error(`Error en uploadCertificate para ${companyId}:`, error);
      return {
        success: false,
        error: 'Error al subir certificado'
      };
    }
  }
  
  /**
   * Registra un certificado en la base de datos
   */
  private async registerCertificateInDatabase(companyId: string, storagePath: string, fileName: string, pin?: string): Promise<void> {
    try {
      // Verificar si ya existe un registro para este certificado
      const { data: existingCert } = await supabase
        .from('certificates')
        .select('id')
        .eq('company_id', companyId)
        .maybeSingle();
      
      if (existingCert) {
        // Actualizar el registro existente
        await supabase
          .from('certificates')
          .update({
            storage_path: storagePath,
            filename: fileName,
            pin,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingCert.id);
      } else {
        // Crear un nuevo registro
        await supabase
          .from('certificates')
          .insert({
            company_id: companyId,
            storage_path: storagePath,
            filename: fileName,
            pin
          });
      }
    } catch (error) {
      console.error(`Error al registrar certificado en base de datos para ${companyId}:`, error);
      throw error;
    }
  }
  
  /**
   * Sube una factura en PDF a Supabase Storage
   */
  async uploadInvoicePdf(companyId: string, invoiceId: string, pdf: File | Blob): Promise<StorageResult> {
    try {
      const user = supabaseAuthService.getCurrentUser();
      
      if (!user) {
        return {
          success: false,
          error: 'Usuario no autenticado'
        };
      }
      
      // Nombre del archivo en el bucket
      const storagePath = `${companyId}/${invoiceId}.pdf`;
      
      // Subir el archivo
      const { data, error } = await supabase.storage
        .from(this.INVOICE_BUCKET)
        .upload(storagePath, pdf, {
          upsert: true, // Sobrescribir si ya existe
          contentType: 'application/pdf'
        });
      
      if (error) {
        console.error(`Error al subir PDF de factura ${invoiceId}:`, error);
        return {
          success: false,
          error: 'Error al subir PDF de factura'
        };
      }
      
      // Obtener la URL pública del PDF
      const { data: urlData } = supabase.storage
        .from(this.INVOICE_BUCKET)
        .getPublicUrl(storagePath);
      
      // Actualizar la referencia del PDF en la tabla de facturas
      await supabase
        .from('invoices')
        .update({
          pdf_path: storagePath,
          updated_at: new Date().toISOString()
        })
        .eq('id', invoiceId);
      
      return {
        success: true,
        data,
        url: urlData.publicUrl
      };
    } catch (error) {
      console.error(`Error en uploadInvoicePdf para factura ${invoiceId}:`, error);
      return {
        success: false,
        error: 'Error al subir PDF de factura'
      };
    }
  }
  
  /**
   * Obtiene una factura en PDF
   */
  async getInvoicePdf(invoiceId: string): Promise<StorageResult> {
    try {
      // Obtener la ruta del PDF de la base de datos
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('pdf_path, company_id')
        .eq('id', invoiceId)
        .single();
      
      if (invoiceError || !invoice || !invoice.pdf_path) {
        console.error(`Error al obtener ruta de PDF para factura ${invoiceId}:`, invoiceError);
        return {
          success: false,
          error: 'PDF no encontrado'
        };
      }
      
      // Obtener la URL pública del PDF
      const { data: urlData } = supabase.storage
        .from(this.INVOICE_BUCKET)
        .getPublicUrl(invoice.pdf_path);
      
      // Descargar el PDF
      const { data, error } = await supabase.storage
        .from(this.INVOICE_BUCKET)
        .download(invoice.pdf_path);
      
      if (error) {
        console.error(`Error al descargar PDF de factura ${invoiceId}:`, error);
        return {
          success: false,
          error: 'Error al descargar PDF de factura'
        };
      }
      
      return {
        success: true,
        data,
        url: urlData.publicUrl
      };
    } catch (error) {
      console.error(`Error en getInvoicePdf para ${invoiceId}:`, error);
      return {
        success: false,
        error: 'Error al obtener PDF de factura'
      };
    }
  }
}

// Exportar la instancia del servicio
export const supabaseStorageService = new SupabaseStorageService();
