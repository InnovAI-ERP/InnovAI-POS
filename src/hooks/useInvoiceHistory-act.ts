import { useState, useEffect } from 'react';
import { supabaseInvoiceService } from '../services/supabaseInvoiceService';
import { useAuth } from './useAuth';

export interface StoredInvoice {
  id: string;
  client: string;
  date: string;
  amount: string;
  status: 'Completada' | 'Pendiente' | 'Rechazada';
  items: number;
  claveNumerica: string;
  // Campos adicionales para análisis de datos
  condicionVenta: string;
  medioPago: string[];
  detalleServicio: {
    codigoCabys: string;
    detalle: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }[];
  subtotal: number;
  impuesto: number;
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

  // Cargar facturas desde Supabase (tabla invoice_data) al iniciar
  useEffect(() => {
    const loadInvoices = async () => {
      try {
        setLoading(true);
        
        // Si hay una empresa seleccionada, cargar desde Supabase
        if (currentCompany?.id) {
          console.log('Cargando facturas desde Supabase para la empresa:', currentCompany.id);
          
          const { invoices: fetchedInvoices, error } = await supabaseInvoiceService.getInvoicesData(currentCompany.id);
          
          if (error) {
            console.error('Error al cargar facturas desde Supabase:', error);
            // Si hay error con Supabase, intentar cargar desde localStorage como respaldo
            loadFromLocalStorage();
          } else {
            console.log(`Cargadas ${fetchedInvoices.length} facturas desde Supabase`);
            setInvoices(fetchedInvoices);
          }
        } else {
          // Si no hay empresa seleccionada, cargar desde localStorage
          console.log('No hay empresa seleccionada, cargando desde localStorage');
          loadFromLocalStorage();
        }
      } catch (error) {
        console.error('Error al cargar facturas:', error);
        loadFromLocalStorage();
      } finally {
        setLoading(false);
      }
    };
    
    // Función auxiliar para cargar desde localStorage
    const loadFromLocalStorage = () => {
      try {
        const storedInvoices = localStorage.getItem('invoices');
        if (storedInvoices) {
          setInvoices(JSON.parse(storedInvoices));
          console.log('Facturas cargadas desde localStorage');
        }
      } catch (e) {
        console.error('Error al cargar facturas desde localStorage:', e);
      }
    };

    loadInvoices();
  }, [currentCompany?.id]);

  // Guardar facturas en localStorage como respaldo cuando cambian
  useEffect(() => {
    if (!loading) {
      // Guardar en localStorage como respaldo
      localStorage.setItem('invoices', JSON.stringify(invoices));
    }
  }, [invoices, loading]);

  // Añadir una nueva factura al historial y guardarla en Supabase
  const addInvoice = async (invoice: StoredInvoice) => {
    if (!invoice || !invoice.id) {
      console.error('Error: Intentando añadir una factura inválida al historial', invoice);
      return;
    }
    
    console.log('Añadiendo factura al historial:', invoice.id);
    // Verificar si la factura ya existe para evitar duplicados
    setInvoices(prev => {
      const exists = prev.some(inv => inv.id === invoice.id);
      if (exists) {
        console.log('La factura ya existe en el historial, no se añadirá duplicado');
        return prev;
      }
      
      const newInvoices = [invoice, ...prev];
      console.log(`Factura añadida. Total de facturas en historial: ${newInvoices.length}`);
      return newInvoices;
    });
    
    // Si hay una empresa seleccionada, guardar la factura en Supabase
    if (currentCompany?.id) {
      try {
        console.log('Guardando factura en Supabase:', invoice.id);
        const { success, error } = await supabaseInvoiceService.saveInvoiceData(invoice, currentCompany.id);
        
        if (!success) {
          console.error('Error al guardar factura en Supabase:', error);
        } else {
          console.log('Factura guardada en Supabase correctamente');
        }
      } catch (error) {
        console.error('Error al guardar factura en Supabase:', error);
      }
    }
  };

  // Actualizar el estado de una factura
  const updateInvoiceStatus = async (id: string, status: 'Completada' | 'Pendiente' | 'Rechazada') => {
    // Actualizar en el estado local
    setInvoices(prev => {
      const updatedInvoices = prev.map(invoice => 
        invoice.id === id ? { ...invoice, status } : invoice
      );
      
      // Si hay una empresa seleccionada, actualizar en Supabase
      if (currentCompany?.id) {
        // Encontrar la factura actualizada
        const updatedInvoice = updatedInvoices.find(inv => inv.id === id);
        if (updatedInvoice) {
          // Actualizar en segundo plano sin esperar
          supabaseInvoiceService.updateInvoiceData(updatedInvoice, currentCompany.id)
            .then(({ success, error }) => {
              if (!success) {
                console.error('Error al actualizar estado de factura en Supabase:', error);
              } else {
                console.log('Estado de factura actualizado en Supabase correctamente');
              }
            })
            .catch(err => console.error('Error inesperado al actualizar factura:', err));
        }
      }
      
      return updatedInvoices;
    });
  };

  // Actualizar la información de correo electrónico de una factura
  const updateInvoiceEmailInfo = async (id: string, emailInfo: StoredInvoice['emailInfo']) => {
    // Actualizar en el estado local
    setInvoices(prev => {
      const updatedInvoices = prev.map(invoice => 
        invoice.id === id ? { ...invoice, emailInfo } : invoice
      );
      
      // Si hay una empresa seleccionada, actualizar en Supabase
      if (currentCompany?.id) {
        // Encontrar la factura actualizada
        const updatedInvoice = updatedInvoices.find(inv => inv.id === id);
        if (updatedInvoice) {
          // Actualizar en segundo plano sin esperar
          supabaseInvoiceService.updateInvoiceData(updatedInvoice, currentCompany.id)
            .then(({ success, error }) => {
              if (!success) {
                console.error('Error al actualizar información de correo en Supabase:', error);
              } else {
                console.log('Información de correo actualizada en Supabase correctamente');
              }
            })
            .catch(err => console.error('Error inesperado al actualizar factura:', err));
        }
      }
      
      return updatedInvoices;
    });
  };

  // Eliminar una factura
  const deleteInvoice = async (id: string) => {
    // Eliminar del estado local
    setInvoices(prev => prev.filter(invoice => invoice.id !== id));
    
    // Si hay una empresa seleccionada, eliminar también de Supabase
    if (currentCompany?.id) {
      try {
        console.log('Eliminando factura de Supabase:', id);
        const { success, error } = await supabaseInvoiceService.deleteInvoiceData(id, currentCompany.id);
        
        if (!success) {
          console.error('Error al eliminar factura de Supabase:', error);
        } else {
          console.log('Factura eliminada de Supabase correctamente');
        }
      } catch (error) {
        console.error('Error al eliminar factura de Supabase:', error);
      }
    }
  };

  // Obtener datos para dashboard
  const getDashboardData = () => {
    if (invoices.length === 0) return null;

    // Total de ventas
    const totalVentas = invoices.reduce((sum, inv) => sum + inv.total, 0);
    
    // Facturas por estado
    const facturasPorEstado = {
      completadas: invoices.filter(inv => inv.status === 'Completada').length,
      pendientes: invoices.filter(inv => inv.status === 'Pendiente').length,
      rechazadas: invoices.filter(inv => inv.status === 'Rechazada').length,
    };
    
    // Facturas por condición de venta
    const facturasPorCondicion = {
      contado: invoices.filter(inv => inv.condicionVenta === '01').length,
      credito: invoices.filter(inv => inv.condicionVenta === '02').length,
    };
    
    // Servicios más vendidos
    const servicios = invoices.flatMap(inv => inv.detalleServicio);
    const serviciosPorCodigo: Record<string, { detalle: string, cantidad: number, total: number }> = {};
    
    servicios.forEach(serv => {
      if (!serviciosPorCodigo[serv.codigoCabys]) {
        serviciosPorCodigo[serv.codigoCabys] = {
          detalle: serv.detalle,
          cantidad: 0,
          total: 0
        };
      }
      
      serviciosPorCodigo[serv.codigoCabys].cantidad += serv.cantidad;
      serviciosPorCodigo[serv.codigoCabys].total += serv.subtotal;
    });
    
    // Convertir a array y ordenar por cantidad
    const serviciosMasVendidos = Object.entries(serviciosPorCodigo)
      .map(([codigo, data]) => ({
        codigo,
        detalle: data.detalle,
        cantidad: data.cantidad,
        total: data.total
      }))
      .sort((a, b) => b.cantidad - a.cantidad);
    
    // Clientes con más compras
    const clientesPorCompras: Record<string, { nombre: string, facturas: number, total: number }> = {};
    
    invoices.forEach(inv => {
      if (!clientesPorCompras[inv.client]) {
        clientesPorCompras[inv.client] = {
          nombre: inv.client,
          facturas: 0,
          total: 0
        };
      }
      
      clientesPorCompras[inv.client].facturas += 1;
      clientesPorCompras[inv.client].total += inv.total;
    });
    
    // Convertir a array y ordenar por total
    const clientesTop = Object.values(clientesPorCompras)
      .sort((a, b) => b.total - a.total);
    
    return {
      totalVentas,
      facturasPorEstado,
      facturasPorCondicion,
      serviciosMasVendidos: serviciosMasVendidos.slice(0, 5), // Top 5
      clientesTop: clientesTop.slice(0, 5) // Top 5
    };
  };

  /**
   * Sincroniza todas las facturas de localStorage a Supabase
   * Útil para migración inicial o sincronización manual
   */
  const syncToSupabase = async (): Promise<{success: boolean; totalSync: number; errors: number}> => {
    if (!currentCompany?.id || invoices.length === 0) {
      return { success: false, totalSync: 0, errors: 0 };
    }

    try {
      console.log(`Iniciando sincronización de ${invoices.length} facturas con Supabase...`);
      const { success, error } = await supabaseInvoiceService.saveInvoicesData(currentCompany.id, invoices);
      
      if (!success) {
        console.error('Error en la sincronización masiva:', error);
        return { success: false, totalSync: 0, errors: invoices.length };
      }
      
      console.log(`Sincronización completada. ${invoices.length} facturas sincronizadas.`);
      return { success: true, totalSync: invoices.length, errors: 0 };
    } catch (error) {
      console.error('Error en syncToSupabase:', error);
      return { success: false, totalSync: 0, errors: invoices.length };
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