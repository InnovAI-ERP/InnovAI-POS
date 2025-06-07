import { useState, useEffect } from 'react';
import { supabaseInvoiceService } from '../services/supabaseInvoiceService';
import { useAuth } from './useAuth';
import { getCompanyUuid } from '../services/uuidMappingService';

export interface StoredInvoice {
  id: string;
  client: string;
  date: string;
  amount: string;
  status: 'Completada' | 'Pendiente' | 'Rechazada';
  items: number;
  claveNumerica: string;
  consecutive?: string; // Número consecutivo de la factura
  numeroConsecutivo?: string; // Alternativa para el consecutivo
  // Campos adicionales para análisis de datos
  condicionVenta: string;
  medioPago: string[];
  // Campo para plazo de crédito en días
  plazoCredito?: string;
  // Campos para moneda y tipo de cambio
  moneda?: string; // CRC, USD, EUR
  tipoCambio?: number; // Tipo de cambio aplicado
  // Información de exoneración si existe
  exoneracion?: {
    tipoDocumento: string;
    numeroDocumento: string;
    codigo_nombreInstitucion: string; // Código de la institución (01, 02, etc.)
    nombre_institucion: string; // Nombre completo de la institución para mostrar en la UI
    porcentajeExoneracion: number;
    montoExoneracion?: number;
  };
  // Información de pago para facturas a crédito
  infoPago?: {
    pagada: boolean;
    fechaPago?: string;
    medioPago?: string;
    cuentaBancaria?: string;
    banco?: string;
    notas?: string;
  };
  detalleServicio: {
    codigoCabys: string;
    detalle: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }[];
  // Otros cargos adicionales
  otrosCargos?: {
    tipoCargo: string;
    descripcionCargo?: string; // Made optional
    porcentaje?: number;       // Made optional
    montoCargo: number;
  }[];
  subtotal: number;
  impuesto: number;
  totalOtrosCargos?: number;
  total: number;
  xmlContent?: string;
  // Campos para información de correo electrónico
  emailInfo?: {
    destinatario: string;
    fechaEnvio: string;
    estadoEnvio: 'Enviado' | 'Fallido' | 'Pendiente';
    intentos: number;
    mensajeError?: string;
  };
}

export function useInvoiceHistory() {
  const [invoices, setInvoices] = useState<StoredInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentCompany } = useAuth(); // Obtener la empresa actual del contexto de autenticación

  // Función auxiliar para cargar desde localStorage (devuelve las facturas en lugar de establecerlas directamente)
  const loadFromLocalStorage = (): StoredInvoice[] => {
    try {
      // Buscar facturas en varias claves posibles de localStorage
      const possibleKeys = ['invoices', 'invoice_history', 'invoiceData', 'invoiceHistory', 'facturasLocal'];
      
      for (const key of possibleKeys) {
        const storedData = localStorage.getItem(key);
        if (storedData) {
          try {
            const parsed = JSON.parse(storedData);
            
            // Si es un array, asumimos que son facturas
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.log(`Encontradas ${parsed.length} facturas en localStorage con clave: ${key}`);
              return parsed;
            } 
            // Si es un objeto, podría contener un array de facturas
            else if (typeof parsed === 'object' && parsed !== null) {
              // Caso 1: Objeto con propiedad 'invoices'
              if (parsed.invoices && Array.isArray(parsed.invoices)) {
                console.log(`Encontradas ${parsed.invoices.length} facturas en localStorage.${key}.invoices`);
                return parsed.invoices;
              }
              // Caso 2: Objeto con propiedad 'data'
              else if (parsed.data && Array.isArray(parsed.data)) {
                console.log(`Encontradas ${parsed.data.length} facturas en localStorage.${key}.data`);
                return parsed.data;
              }
              // Caso 3: Mapa de facturas donde las claves son IDs
              else if (Object.keys(parsed).length > 0) {
                const values = Object.values(parsed);
                if (values.length > 0 && typeof values[0] === 'object') {
                  // Verificar si parece ser una factura
                  const invoiceFields = ['id', 'date', 'total', 'client', 'items', 'status'];
                  const firstItem = values[0] as any;
                  const hasInvoiceFields = invoiceFields.some(field => firstItem?.hasOwnProperty(field));
                  
                  if (hasInvoiceFields) {
                    console.log(`Encontradas ${values.length} facturas en mapa de localStorage.${key}`);
                    return values as StoredInvoice[];
                  }
                }
              }
            }
          } catch (parseError) {
            console.log(`Error al parsear datos de ${key}:`, parseError);
            // Continuar con la siguiente clave
          }
        }
      }
      
      console.log('No se encontraron facturas en localStorage');
      return [];
    } catch (e) {
      console.error('Error al cargar facturas desde localStorage:', e);
      return [];
    }
  };

  // Cargar facturas al iniciar
  useEffect(() => {
    const loadInvoices = async () => {
      try {
        setLoading(true);
        
        // Intentar cargar desde ambas fuentes para garantizar que se muestren todas las facturas
        let allInvoices: StoredInvoice[] = [];
        
        // 1. Cargar desde Supabase usando el UUID correcto de INNOVA
        try {
          // Usar el UUID correcto de INNOVA desde nuestro servicio centralizado
          const companyUuid = getCompanyUuid('innova'); // Siempre usar INNOVA para garantizar consistencia
          console.log('Cargando facturas desde Supabase con UUID:', companyUuid);
          
          const { invoices: fetchedInvoices, error } = await supabaseInvoiceService.getInvoicesData(companyUuid);
          
          if (error) {
            console.error('Error al cargar facturas desde Supabase:', error);
          } else {
            console.log(`Cargadas ${fetchedInvoices.length} facturas desde Supabase`);
            allInvoices = [...fetchedInvoices];
          }
        } catch (supabaseError) {
          console.error('Error en la consulta a Supabase:', supabaseError);
        }
        
        // 2. Cargar desde localStorage y combinar con las de Supabase
        try {
          console.log('Intentando cargar facturas adicionales desde localStorage...');
          const localInvoices = loadFromLocalStorage();
          
          if (localInvoices && localInvoices.length > 0) {
            // Identificar facturas que ya existen en Supabase para no duplicarlas
            const existingIds = new Set(allInvoices.map(inv => inv.id));
            const newLocalInvoices = localInvoices.filter(inv => !existingIds.has(inv.id));
            
            if (newLocalInvoices.length > 0) {
              console.log(`Añadiendo ${newLocalInvoices.length} facturas adicionales desde localStorage`);
              allInvoices = [...allInvoices, ...newLocalInvoices];
            }
          }
        } catch (localError) {
          console.error('Error al cargar facturas desde localStorage:', localError);
        }
        
        // Establecer todas las facturas combinadas
        console.log(`Total de facturas cargadas: ${allInvoices.length}`);
        setInvoices(allInvoices);
      } catch (error) {
        console.error('Error al cargar facturas:', error);
        // En caso de error completo, intentar cargar solo desde localStorage como último recurso
        const localInvoices = loadFromLocalStorage();
        if (localInvoices && localInvoices.length > 0) {
          setInvoices(localInvoices);
        }
      } finally {
        setLoading(false);
      }
    };

    loadInvoices();
  }, [currentCompany?.id]);

  // Guardar facturas en localStorage como respaldo cuando cambian
  useEffect(() => {
    if (!loading && invoices.length > 0) {
      // Guardar en localStorage como respaldo
      localStorage.setItem('invoices', JSON.stringify(invoices));
    }
  }, [loading, invoices]);

  // Añadir una nueva factura
  const addInvoice = (invoice: StoredInvoice) => {
    console.log('⚠️ AÑADIENDO NUEVA FACTURA AL HISTORIAL:', invoice.id);
    
    // 1. Primero verificar si las facturas ya existen en localStorage
    const existingInvoicesJSON = localStorage.getItem('invoices');
    let existingInvoices: StoredInvoice[] = [];
    
    try {
      if (existingInvoicesJSON) {
        existingInvoices = JSON.parse(existingInvoicesJSON);
        console.log(`🔍 Facturas existentes en localStorage: ${existingInvoices.length}`);
      }
    } catch (parseError) {
      console.error('Error al parsear facturas existentes:', parseError);
      // Si hay error de parseo, iniciar con array vacío
      existingInvoices = [];
    }
    
    // 2. Añadir la nueva factura al inicio del array
    const updatedInvoices = [invoice, ...existingInvoices];
    
    // 3. Guardar directamente en localStorage de forma garantizada
    try {
      localStorage.setItem('invoices', JSON.stringify(updatedInvoices));
      console.log(`✅ Factura ${invoice.id} guardada en localStorage. Total facturas: ${updatedInvoices.length}`);
    } catch (storageError) {
      console.error('Error al guardar en localStorage:', storageError);
    }
    
    // 4. Actualizar el estado de React
    setInvoices(updatedInvoices);
    
    // 5. Intentar guardar en Supabase
    const saveToSupabase = async () => {
      try {
        // Siempre usar el UUID correcto de INNOVA desde nuestro servicio centralizado
        const companyUuid = getCompanyUuid('innova');
        console.log(`🔄 Guardando factura ${invoice.id} en Supabase con UUID:`, companyUuid);
        
        const { error } = await supabaseInvoiceService.saveInvoiceData(invoice, 'innova');
        
        if (error) {
          console.error(`❌ Error al guardar factura ${invoice.id} en Supabase:`, error);
        } else {
          console.log(`✅ Factura ${invoice.id} guardada en Supabase con éxito.`);
        }
      } catch (error) {
        console.error(`❌ Error al procesar guardado de factura ${invoice.id}:`, error);
      }
    };
    
    // Ejecutar la función asíncrona
    saveToSupabase();
  };

  // Actualizar el estado de una factura
  const updateInvoiceStatus = (
    invoiceId: string, 
    newStatus: 'Completada' | 'Pendiente' | 'Rechazada'
  ) => {
    setInvoices(prev => prev.map(invoice => 
      invoice.id === invoiceId 
        ? { ...invoice, status: newStatus } 
        : invoice
    ));
    
    // Actualizar en Supabase
    if (currentCompany?.id) {
      const updateSupabase = async () => {
        try {
          const companyUuid = getCompanyUuid('innova');
          const { data, error } = await supabaseInvoiceService.updateInvoiceStatus(
            companyUuid,
            invoiceId,
            newStatus
          );
          
          if (error) {
            console.error('Error al actualizar estado en Supabase:', error);
          }
        } catch (error) {
          console.error('Error:', error);
        }
      };
      
      updateSupabase();
    }
  };

  // Actualizar la información de correo de una factura
  const updateInvoiceEmailInfo = (
    invoiceId: string,
    emailInfo: StoredInvoice['emailInfo']
  ) => {
    setInvoices(prev => prev.map(invoice => 
      invoice.id === invoiceId 
        ? { ...invoice, emailInfo } 
        : invoice
    ));
    
    // Actualizar en Supabase
    if (currentCompany?.id) {
      const updateSupabase = async () => {
        try {
          const companyUuid = getCompanyUuid('innova');
          const { data, error } = await supabaseInvoiceService.updateInvoiceEmailInfo(
            companyUuid,
            invoiceId,
            emailInfo
          );
          
          if (error) {
            console.error('Error al actualizar info de correo en Supabase:', error);
          }
        } catch (error) {
          console.error('Error:', error);
        }
      };
      
      updateSupabase();
    }
  };

  // Eliminar una factura
  const deleteInvoice = (invoiceId: string) => {
    setInvoices(prev => prev.filter(invoice => invoice.id !== invoiceId));
    
    // Eliminar de Supabase
    if (currentCompany?.id) {
      const deleteFromSupabase = async () => {
        try {
          const companyUuid = getCompanyUuid('innova');
          const { data, error } = await supabaseInvoiceService.deleteInvoiceData(
            companyUuid,
            invoiceId
          );
          
          if (error) {
            console.error('Error al eliminar factura de Supabase:', error);
          }
        } catch (error) {
          console.error('Error:', error);
        }
      };
      
      deleteFromSupabase();
    }
  };

  // Obtener datos para el dashboard
  const getDashboardData = () => {
    const data = invoices || [];
    
    // Total de ventas
    const totalSales = data.reduce((sum, inv) => 
      sum + (typeof inv.total === 'number' ? inv.total : parseFloat(inv.total || '0')), 0);
    
    // Facturas completadas
    const completed = data.filter(inv => inv.status === 'Completada').length;
    // Facturas pendientes
    const pending = data.filter(inv => inv.status === 'Pendiente').length;
    // Facturas rechazadas
    const rejected = data.filter(inv => inv.status === 'Rechazada').length;
    
    // Facturas por día (últimos 30 días)
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const invoicesByDay = data
      .filter(inv => {
        const invDate = new Date(inv.date);
        return invDate >= thirtyDaysAgo && invDate <= today;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Servicios más vendidos (top 5)
    const servicesCount: Record<string, number> = {};
    data.forEach(inv => {
      if (inv.detalleServicio) {
        inv.detalleServicio.forEach(serv => {
          const serviceName = serv.detalle || serv.codigoCabys || 'Sin nombre';
          servicesCount[serviceName] = (servicesCount[serviceName] || 0) + serv.cantidad;
        });
      }
    });
    
    const topServices = Object.entries(servicesCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
    
    return {
      totalSales,
      invoiceCount: data.length,
      invoiceStatus: { completed, pending, rejected },
      invoicesByDay,
      topServices
    };
  };

  // Sincronizar todas las facturas con Supabase
  const syncToSupabase = async () => {
    if (currentCompany?.id && invoices.length > 0) {
      setLoading(true);
      
      try {
        const companyUuid = getCompanyUuid('innova');
        console.log(`Sincronizando ${invoices.length} facturas con Supabase...`);
        
        // Obtener facturas existentes en Supabase para evitar duplicados
        const { invoices: existingInvoices, error: fetchError } = 
          await supabaseInvoiceService.getInvoicesData(companyUuid);
        
        if (fetchError) {
          console.error('Error al obtener facturas existentes:', fetchError);
          return;
        }
        
        const existingIds = new Set(existingInvoices.map(inv => inv.id));
        const newInvoices = invoices.filter(inv => !existingIds.has(inv.id));
        
        console.log(`Encontradas ${newInvoices.length} facturas nuevas para sincronizar`);
        
        // Enviar facturas nuevas a Supabase
        for (const invoice of newInvoices) {
          const { data, error } = await supabaseInvoiceService.createInvoiceData({
            ...invoice,
            company_id: companyUuid
          });
          
          if (error) {
            console.error(`Error al sincronizar factura ${invoice.id}:`, error);
          } else {
            console.log(`Factura ${invoice.id} sincronizada correctamente`);
          }
        }
        
        console.log('Sincronización completada');
      } catch (error) {
        console.error('Error durante la sincronización:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  return {
    invoices,
    loading,
    addInvoice,
    updateInvoiceStatus,
    updateInvoiceEmailInfo,
    deleteInvoice,
    getDashboardData,
    syncToSupabase
  };
}
