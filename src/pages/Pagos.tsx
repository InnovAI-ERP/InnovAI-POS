import React, { useState, useEffect, useRef } from 'react';
import { CreditCard, Wallet, Building, ArrowDown, ArrowUp, Search, Banknote, DollarSign, Calendar, X, Loader2, AlertTriangle, FileText } from 'lucide-react';
import { Check } from 'lucide-react';
import { supabaseInvoiceService } from '../services/supabaseInvoiceService';
import { StoredInvoice } from '../hooks/useInvoiceHistory';
import { getCompanyUuid } from '../services/uuidMappingService';

// Enums para agrupar tipos de medios de pago
enum MedioPagoGrupo {
  CAJA = 'Efectivo',
  AFILIADOS = 'Tarjetas',
  BANCOS = 'Transferencias',
  OTROS = 'Otros Medios',
}

// Enums para agrupar condiciones de venta
enum CondicionVentaGrupo {
  CONTADO = 'Contado',
  CREDITO = 'Crédito',
  OTROS = 'Otros',
}

// Enums para filtros de tiempo
enum FiltroTiempo {
  HOY = 'Hoy',
  SEMANA = 'Esta Semana',
  MES = 'Este Mes',
  TRIMESTRE = 'Este Trimestre',
  ANIO = 'Este Año',
  TODO = 'Todo',
}

// Interface para plazos de crédito
interface PlazoCredito {
  dias: number;
  nombre: string;
  totalCRC: number;
  totalUSD: number;
  totalEUR: number;
  facturas: StoredInvoice[];
}

// Interface para la información bancaria
interface CuentaBancaria {
  id: string;
  numero: string;
  banco: string;
  moneda: string;
  tipo: 'Corriente' | 'Ahorros' | 'Digital';
}

// Interface para el formulario de pago
interface FormularioPago {
  pagada: boolean;
  medioPago: string;
  fechaPago: string;
  cuentaBancaria?: string;
  banco?: string;
  notas?: string;
}

// Interface para el resumen de pagos
interface ResumenPagos {
  totalCRC: number;
  totalUSD: number;
  totalEUR: number;
  porMedioPago: {
    [key in MedioPagoGrupo]: {
      CRC: number;
      USD: number;
      EUR: number;
    }
  };
  porCondicionVenta: {
    [key in CondicionVentaGrupo]: {
      CRC: number;
      USD: number;
      EUR: number;
    }
  };
  porPlazoCredito: PlazoCredito[];
  facturasPorCliente: {
    [clienteId: string]: {
      nombre: string;
      plazos: {
        [plazo: number]: {
          totalCRC: number;
          totalUSD: number;
          totalEUR: number;
          facturas: StoredInvoice[];
        }
      }
    }
  };
  facturasPagadas: StoredInvoice[];
}

const Pagos: React.FC = () => {
  // Estados para manejo de la interfaz y mensajes
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [filtroActual, setFiltroActual] = useState<FiltroTiempo>(FiltroTiempo.MES);
  const [ordenAscendente, setOrdenAscendente] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  
  // Estados para gestionar facturas y su visualización
  const [facturas, setFacturas] = useState<StoredInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumen, setResumen] = useState<ResumenPagos>({
    totalCRC: 0,
    totalUSD: 0,
    totalEUR: 0,
    porMedioPago: {
      [MedioPagoGrupo.CAJA]: { CRC: 0, USD: 0, EUR: 0 },
      [MedioPagoGrupo.AFILIADOS]: { CRC: 0, USD: 0, EUR: 0 },
      [MedioPagoGrupo.BANCOS]: { CRC: 0, USD: 0, EUR: 0 },
      [MedioPagoGrupo.OTROS]: { CRC: 0, USD: 0, EUR: 0 },
    },
    porCondicionVenta: {
      [CondicionVentaGrupo.CONTADO]: { CRC: 0, USD: 0, EUR: 0 },
      [CondicionVentaGrupo.CREDITO]: { CRC: 0, USD: 0, EUR: 0 },
      [CondicionVentaGrupo.OTROS]: { CRC: 0, USD: 0, EUR: 0 },
    },
    porPlazoCredito: [],
    facturasPorCliente: {},
    facturasPagadas: [],
  });
  
  // Estado para el modal de pago
  const [modalPagoVisible, setModalPagoVisible] = useState(false);
  const [facturaSeleccionada, setFacturaSeleccionada] = useState<StoredInvoice | null>(null);
  const [formularioPago, setFormularioPago] = useState<FormularioPago>({
    pagada: true,
    medioPago: '01',
    fechaPago: new Date().toISOString().split('T')[0],
  });
  
  // Estado para controlar componente desmontado
  const isMounted = useRef(true);
  
  // Cuentas bancarias disponibles (ejemplo)
  const cuentasBancariasDisponibles: CuentaBancaria[] = [
    { id: '1', numero: '123456789', banco: 'Banco Nacional', moneda: 'CRC', tipo: 'Corriente' },
    { id: '2', numero: '987654321', banco: 'BAC', moneda: 'USD', tipo: 'Corriente' },
  ];
  
  // Calcular totales para mostrar en la interfaz
  const total = {
    CRC: resumen.totalCRC,
    USD: resumen.totalUSD,
    EUR: resumen.totalEUR,
  };

  // Función para obtener el rango de fechas según el filtro usando la fecha actual
  const getRangoFechas = (filtro: FiltroTiempo): { desde: Date; hasta: Date } => {
    // Obtener la fecha actual
    const ahora = new Date();
    
    // La fecha hasta es siempre el final del día actual
    const hasta = new Date(ahora);
    hasta.setHours(23, 59, 59, 999);
    
    // Inicializar desde como el inicio del día actual
    let desde = new Date(ahora);
    desde.setHours(0, 0, 0, 0);
    
    switch (filtro) {
      case FiltroTiempo.HOY:
        // Desde ya está configurado como el inicio del día actual
        break;
        
      case FiltroTiempo.SEMANA:
        // Retroceder hasta el inicio de la semana actual (7 días atrás)
        desde.setDate(desde.getDate() - 7);
        break;
        
      case FiltroTiempo.MES:
        // Retroceder hasta el inicio del mes actual
        desde.setDate(1);
        break;
        
      case FiltroTiempo.TODO:
      default:
        // Fecha muy antigua para incluir todas las facturas
        desde = new Date(2000, 0, 1);
        break;
    }
    
    console.log(`Filtro: ${filtro}, desde: ${desde.toLocaleDateString()}, hasta: ${hasta.toLocaleDateString()}`);
    return { desde, hasta };
  };
  
  // Función para formatear montos monetarios
  const formatMoneda = (monto: number, moneda: string): string => {
    const opciones: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: moneda,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    };
    
    return new Intl.NumberFormat('es-CR', opciones).format(monto);
  };

  // Determinar el grupo de medio de pago basado en códigos
  // La función puede recibir un string (código) o una factura completa
  const getMedioPagoGrupo = (input: string | StoredInvoice | undefined): MedioPagoGrupo => {
    // Determinar el código de medio de pago
    let codigoMedioPago: string | undefined;
    
    if (typeof input === 'string') {
      // Si es un string, usar directamente como código
      codigoMedioPago = input;
    } else if (input && typeof input === 'object') {
      // Si es una factura, extraer el código
      codigoMedioPago = input.medioPago || input.infoPago?.medioPago;
    } else {
      // Si es undefined o null
      return MedioPagoGrupo.OTROS;
    }
    
    if (!codigoMedioPago) return MedioPagoGrupo.OTROS;
    
    // Clasificación según los códigos proporcionados
    switch (codigoMedioPago) {
      case '01': // Efectivo
        return MedioPagoGrupo.CAJA;
      case '02': // Tarjeta
        return MedioPagoGrupo.AFILIADOS;
      case '04': // Transferencia
      case '06': // SINPE MÓVIL
        return MedioPagoGrupo.BANCOS;
      case '03': // Cheque
        return MedioPagoGrupo.OTROS;
      case '05': // Recaudado por terceros
        return MedioPagoGrupo.OTROS;
      case '07': // Plataforma Digital
        return MedioPagoGrupo.OTROS;
      case '99': // Otros
        return MedioPagoGrupo.OTROS;
      default:
        return MedioPagoGrupo.OTROS;
    }
  };
  
  // Obtener el nombre del medio de pago directamente (para mostrar en la UI)
  const getNombreMedioPago = (input: string | StoredInvoice | undefined): string => {
    // Determinar el código o nombre del medio de pago
    let codigoMedioPago: string | undefined;
    
    if (typeof input === 'string') {
      // Si es un string, usar directamente como código
      codigoMedioPago = input;
    } else if (input && typeof input === 'object') {
      // Si es una factura, primero intentar usar el nombre enriquecido
      if (input.medioPagoNombre) {
        return input.medioPagoNombre;
      }
      // Si no hay nombre, usar el código
      const medioPago = input.medioPago || input.infoPago?.medioPago;
      codigoMedioPago = typeof medioPago === 'string' ? medioPago : undefined;
    }
    
    if (!codigoMedioPago) return 'No especificado';
    
    switch (codigoMedioPago) {
      case '01': return 'Efectivo';
      case '02': return 'Tarjeta';
      case '03': return 'Cheque';
      case '04': return 'Transferencia';
      case '05': return 'Recaudado por terceros';
      case '06': return 'SINPE MÓVIL';
      case '07': return 'Plataforma Digital';
      case '99': return 'Otros';
      default: return 'No especificado';
    }
  };
  
  // Determinar el grupo de condición de venta basado en códigos
  const getCondicionVentaGrupo = (codigoCondicionVenta: string | undefined): CondicionVentaGrupo => {
    if (!codigoCondicionVenta) return CondicionVentaGrupo.OTROS;
    
    // Códigos según documentación del Ministerio de Hacienda
    if (codigoCondicionVenta === '01') {
      return CondicionVentaGrupo.CONTADO; // Contado
    } else if (codigoCondicionVenta === '02') {
      return CondicionVentaGrupo.CREDITO; // Crédito
    } else {
      return CondicionVentaGrupo.OTROS; // Otras condiciones
    }
  };
  
  // Calcular plazo en días para facturas a crédito
  const calcularPlazoCredito = (factura: StoredInvoice): number => {
    if (!factura.condicionVenta || factura.condicionVenta !== '02') {
      return 0; // No es a crédito
    }
    
    if (factura.infoPago?.pagada) {
      return 0; // Ya está pagada
    }
    
    // Usar el plazoCreditoDias si viene de Supabase (campo enriquecido)
    if (factura.plazoCreditoDias && !isNaN(factura.plazoCreditoDias)) {
      const plazoOriginal = factura.plazoCreditoDias;
      
      // Si el plazo original es 15 días o menos, siempre va al grupo 1
      if (plazoOriginal <= 15) {
        return 1; // Próximo a vencer (0-15 días)
      }
    }
    
    // Verificar si tiene plazoCredito definido
    let plazo = factura.plazoCredito ? parseInt(factura.plazoCredito) : 30;
    if (isNaN(plazo)) plazo = 30; // Valor predeterminado si no es un número válido
    
    // Usar fechaEmision si existe (campo enriquecido), si no usar date
    const fechaEmision = new Date(factura.fechaEmision || factura.date);
    const hoy = new Date();
    
    // Calcular días transcurridos desde la emisión
    const diasTranscurridos = Math.floor(
      (hoy.getTime() - fechaEmision.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Determinar los días restantes
    const diasRestantes = plazo - diasTranscurridos;
    
    console.log(`Factura ${factura.consecutivoUnificado || factura.id}: Plazo=${plazo}, Transcurridos=${diasTranscurridos}, Restantes=${diasRestantes}`);
    
    // Clasificar en grupos según los días restantes y el plazo original de la factura
    if (diasRestantes <= 0) {
      // Vencido
      if (diasRestantes >= -15) {
        return -1; // Vencido recientemente (hasta 15 días)
      } else if (diasRestantes >= -30) {
        return -2; // Vencido (15-30 días)
      } else {
        return -3; // Muy vencido (más de 30 días)
      }
    } else {
      // No vencido - SIEMPRE asignar al grupo 1 si el plazo original es 15 o menos
      if (plazo <= 15) {
        return 1; // Siempre grupo 1 si el plazo original es 15 días o menos (ej. 8 días)
      } else if (diasRestantes <= 15) {
        return 1; // Próximo a vencer (15 días o menos)
      } else if (diasRestantes <= 30) {
        return 2; // Vence en 15-30 días
      } else {
        return 3; // Vence en más de 30 días
      }
    }
  };
  
  // Función para expandir o colapsar un grupo
  // Esta función se usará en futuras implementaciones para grupos colapsables
  /*
  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      if (prev.includes(groupId)) {
        return prev.filter(id => id !== groupId);
      } else {
        return [...prev, groupId];
      }
    });
  };
  */


  // Función para cargar datos de facturas
  const cargarDatos = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Obtener UUID de la empresa
      const companyUuid = getCompanyUuid('default');
      
      // Obtener facturas desde Supabase
      const { invoices, error: fetchError } = await supabaseInvoiceService.getInvoicesData(companyUuid);
      
      if (fetchError) {
        throw new Error(`Error al cargar facturas: ${fetchError.message}`);
      }
      
      // Inicializar objeto de resumen vacío con todos los plazos
      const resumenVacio: ResumenPagos = {
        totalCRC: 0,
        totalUSD: 0,
        totalEUR: 0,
        porMedioPago: {
          [MedioPagoGrupo.CAJA]: { CRC: 0, USD: 0, EUR: 0 },
          [MedioPagoGrupo.AFILIADOS]: { CRC: 0, USD: 0, EUR: 0 },
          [MedioPagoGrupo.BANCOS]: { CRC: 0, USD: 0, EUR: 0 },
          [MedioPagoGrupo.OTROS]: { CRC: 0, USD: 0, EUR: 0 },
        },
        porCondicionVenta: {
          [CondicionVentaGrupo.CONTADO]: { CRC: 0, USD: 0, EUR: 0 },
          [CondicionVentaGrupo.CREDITO]: { CRC: 0, USD: 0, EUR: 0 },
          [CondicionVentaGrupo.OTROS]: { CRC: 0, USD: 0, EUR: 0 },
        },
        porPlazoCredito: [
          { dias: 15, nombre: 'Próximos a vencer (0-15 días)', totalCRC: 0, totalUSD: 0, totalEUR: 0, facturas: [] },
          { dias: 30, nombre: 'Vencen pronto (16-30 días)', totalCRC: 0, totalUSD: 0, totalEUR: 0, facturas: [] },
          { dias: 60, nombre: 'Vencen a largo plazo (>30 días)', totalCRC: 0, totalUSD: 0, totalEUR: 0, facturas: [] },
          { dias: -15, nombre: 'Vencidos recientemente (0-15 días)', totalCRC: 0, totalUSD: 0, totalEUR: 0, facturas: [] },
          { dias: -30, nombre: 'Vencidos (16-30 días)', totalCRC: 0, totalUSD: 0, totalEUR: 0, facturas: [] },
          { dias: -60, nombre: 'Muy vencidos (>30 días)', totalCRC: 0, totalUSD: 0, totalEUR: 0, facturas: [] },
        ],
        facturasPorCliente: {},
        facturasPagadas: [],
      };
      
      if (!invoices || invoices.length === 0) {
        setFacturas([]);
        setResumen(resumenVacio);
        setLoading(false);
        return;
      }

      // Aseguramos que todas las facturas a crédito estén disponibles independientemente del filtro de fecha
      
      // Aplicar filtro de tiempo
      const { desde, hasta } = getRangoFechas(filtroActual);
      
      // Asegurar que todas las facturas tengan un consecutivo unificado para usar en toda la aplicación
      invoices.forEach(factura => {
        // Unificar el campo consecutivo para usarlo en toda la aplicación
        if (!factura.consecutivoUnificado) {
          factura.consecutivoUnificado = factura.consecutivo || factura.consecutive || factura.numeroConsecutivo || `ID-${factura.id.substring(0, 8)}`;
        }
      });

      // Filtrar facturas por fecha y búsqueda (solo para las que no son a crédito o están pagadas)
      let facturasFiltradas = invoices.filter(factura => {
        // Si es factura a crédito sin pagar, no aplicamos filtro de fecha
        if (factura.condicionVenta === '02' && !factura.infoPago?.pagada) {
          return true; // Siempre incluir facturas a crédito sin pagar
        }

        // Para el resto de facturas, aplicar el filtro de fecha
        const fechaFactura = new Date(factura.date);
        const cumpleFiltroTiempo = fechaFactura >= desde && fechaFactura <= hasta;
        
        // Filtrar por término de búsqueda si existe
        if (busqueda) {
          const terminoBusqueda = busqueda.toLowerCase();
          const clienteIncluye = (factura.client || '').toLowerCase().includes(terminoBusqueda);
          const consecutivoIncluye = (factura.consecutivoUnificado || '').toLowerCase().includes(terminoBusqueda);
          
          return cumpleFiltroTiempo && (clienteIncluye || consecutivoIncluye);
        }
        
        return cumpleFiltroTiempo;
      });
      
      // Ordenar facturas por fecha
      facturasFiltradas.sort((a, b) => {
        const fechaA = new Date(a.date).getTime();
        const fechaB = new Date(b.date).getTime();
        return ordenAscendente ? fechaA - fechaB : fechaB - fechaA;
      });
      
      // Actualizar estado
      if (isMounted.current) {
        setFacturas(facturasFiltradas);
        calcularResumen(facturasFiltradas);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al cargar datos';
      if (isMounted.current) {
        setError(errorMessage);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  // Función para calcular el resumen de facturas
  const calcularResumen = (facturas: StoredInvoice[]) => {
    // Inicializar resumen
    const nuevoResumen: ResumenPagos = {
      totalCRC: 0,
      totalUSD: 0,
      totalEUR: 0,
      porMedioPago: {
        [MedioPagoGrupo.CAJA]: { CRC: 0, USD: 0, EUR: 0 },
        [MedioPagoGrupo.AFILIADOS]: { CRC: 0, USD: 0, EUR: 0 },
        [MedioPagoGrupo.BANCOS]: { CRC: 0, USD: 0, EUR: 0 },
        [MedioPagoGrupo.OTROS]: { CRC: 0, USD: 0, EUR: 0 },
      },
      porCondicionVenta: {
        [CondicionVentaGrupo.CONTADO]: { CRC: 0, USD: 0, EUR: 0 },
        [CondicionVentaGrupo.CREDITO]: { CRC: 0, USD: 0, EUR: 0 },
        [CondicionVentaGrupo.OTROS]: { CRC: 0, USD: 0, EUR: 0 },
      },
      porPlazoCredito: [],
      facturasPorCliente: {},
      // Array para almacenar facturas pagadas agrupadas por fecha
      facturasPagadas: [],
    };
    
    // Mapeo para plazos de crédito
    const mapeoPlazos: { [key: number]: PlazoCredito } = {
      1: { dias: 15, nombre: 'Próximos a vencer (0-15 días)', totalCRC: 0, totalUSD: 0, totalEUR: 0, facturas: [] },
      2: { dias: 30, nombre: 'Vencen pronto (16-30 días)', totalCRC: 0, totalUSD: 0, totalEUR: 0, facturas: [] },
      3: { dias: 60, nombre: 'Vencen a largo plazo (>30 días)', totalCRC: 0, totalUSD: 0, totalEUR: 0, facturas: [] },
      [-1]: { dias: -15, nombre: 'Vencidos recientemente (0-15 días)', totalCRC: 0, totalUSD: 0, totalEUR: 0, facturas: [] },
      [-2]: { dias: -30, nombre: 'Vencidos (16-30 días)', totalCRC: 0, totalUSD: 0, totalEUR: 0, facturas: [] },
      [-3]: { dias: -60, nombre: 'Muy vencidos (>30 días)', totalCRC: 0, totalUSD: 0, totalEUR: 0, facturas: [] },
    };
    
    // Procesar cada factura
    facturas.forEach(factura => {
      // Determinar moneda y monto
      const moneda = factura.moneda || 'CRC';
      const monto = Number(factura.total) || 0;
      
      // Sumar al total general según moneda
      if (moneda === 'CRC') {
        nuevoResumen.totalCRC += monto;
      } else if (moneda === 'USD') {
        nuevoResumen.totalUSD += monto;
      } else if (moneda === 'EUR') {
        nuevoResumen.totalEUR += monto;
      }
      
      // Determinar grupo de medio de pago y condición de venta
      // Pasamos la factura completa para aprovechar los datos enriquecidos
      const medioPagoGrupo = getMedioPagoGrupo(factura);
      const condicionVentaGrupo = getCondicionVentaGrupo(factura.condicionVenta);
      
      // Si la factura está pagada
      if (factura.infoPago?.pagada) {
        // Agregar a la lista de facturas pagadas
        nuevoResumen.facturasPagadas.push(factura);
        
        // Agregar al resumen por medio de pago (para facturas pagadas se usa el medio de pago con el que se pagaron)
        if (moneda === 'CRC') {
          nuevoResumen.porMedioPago[medioPagoGrupo].CRC += monto;
        } else if (moneda === 'USD') {
          nuevoResumen.porMedioPago[medioPagoGrupo].USD += monto;
        } else if (moneda === 'EUR') {
          nuevoResumen.porMedioPago[medioPagoGrupo].EUR += monto;
        }
        
        return; // No continuar procesando esta factura
      }
      
      // Para facturas no pagadas
      
      // Solo agregar a resumen por medio de pago si es de contado
      if (condicionVentaGrupo === CondicionVentaGrupo.CONTADO) {
        if (moneda === 'CRC') {
          nuevoResumen.porMedioPago[medioPagoGrupo].CRC += monto;
        } else if (moneda === 'USD') {
          nuevoResumen.porMedioPago[medioPagoGrupo].USD += monto;
        } else if (moneda === 'EUR') {
          nuevoResumen.porMedioPago[medioPagoGrupo].EUR += monto;
        }
      }
      
      // Sumar a resumen por condición de venta
      if (moneda === 'CRC') {
        nuevoResumen.porCondicionVenta[condicionVentaGrupo].CRC += monto;
      } else if (moneda === 'USD') {
        nuevoResumen.porCondicionVenta[condicionVentaGrupo].USD += monto;
      } else if (moneda === 'EUR') {
        nuevoResumen.porCondicionVenta[condicionVentaGrupo].EUR += monto;
      }
      
      // Inicializar plazoCodigo a 0 por defecto
      let plazoCodigo = 0;
      
      // Si es a crédito, procesar para plazos de crédito
      if (condicionVentaGrupo === CondicionVentaGrupo.CREDITO) {
        plazoCodigo = calcularPlazoCredito(factura);
        
        if (plazoCodigo !== 0 && mapeoPlazos[plazoCodigo]) {
          const plazo = mapeoPlazos[plazoCodigo];
          
          // Sumar monto según moneda
          if (moneda === 'CRC') {
            plazo.totalCRC += monto;
          } else if (moneda === 'USD') {
            plazo.totalUSD += monto;
          } else if (moneda === 'EUR') {
            plazo.totalEUR += monto;
          }
          
          // Agregar factura al plazo
          plazo.facturas.push(factura);
        }
      }
      
      // Procesar facturas por cliente - Solo procesar si es a crédito y tiene un plazo válido
      if (condicionVentaGrupo === CondicionVentaGrupo.CREDITO && plazoCodigo !== 0 && mapeoPlazos[plazoCodigo]) {
        const plazo = mapeoPlazos[plazoCodigo];
        const clienteId = factura.client || 'sin_id';
        const clienteNombre = factura.client || 'Sin nombre';
        
        if (!nuevoResumen.facturasPorCliente[clienteId]) {
          nuevoResumen.facturasPorCliente[clienteId] = {
            nombre: clienteNombre,
            plazos: {},
          };
        }
        
        if (!nuevoResumen.facturasPorCliente[clienteId].plazos[plazo.dias]) {
          nuevoResumen.facturasPorCliente[clienteId].plazos[plazo.dias] = {
            totalCRC: 0,
            totalUSD: 0,
            totalEUR: 0,
            facturas: [],
          };
        }
        
        // Sumar monto al plazo del cliente
        if (moneda === 'CRC') {
          nuevoResumen.facturasPorCliente[clienteId].plazos[plazo.dias].totalCRC += monto;
        } else if (moneda === 'USD') {
          nuevoResumen.facturasPorCliente[clienteId].plazos[plazo.dias].totalUSD += monto;
        } else if (moneda === 'EUR') {
          nuevoResumen.facturasPorCliente[clienteId].plazos[plazo.dias].totalEUR += monto;
        }
        
        // Agregar factura al plazo del cliente
        nuevoResumen.facturasPorCliente[clienteId].plazos[plazo.dias].facturas.push(factura);
      }
    });
    
    // Convertir el mapeo de plazos a array y ordenar - NO filtrar por facturas para mostrar todos los plazos
    nuevoResumen.porPlazoCredito = Object.values(mapeoPlazos)
      .sort((a, b) => a.dias - b.dias);
    
    // Actualizar estado del resumen
    setResumen(nuevoResumen);
  };

  // Efecto para cargar datos al montar el componente
  useEffect(() => {
    // Prevenimos que se ejecute más de una vez durante desarrollo por StrictMode
    if (isMounted.current) {
      cargarDatos();
    } else {
      isMounted.current = true;
    }
    
    // No hay necesidad de limpieza aquí ya que solo se ejecuta una vez
  }, []); // Sin dependencias para que solo se ejecute al montar
  
  // Efecto separado para manejar cambios en los filtros
  useEffect(() => {
    // Evitar la primera ejecución
    if (isMounted.current) {
      // Usar un temporizador para evitar múltiples llamadas rápidas
      const timer = setTimeout(() => {
        cargarDatos();
      }, 300); // Pequeño retraso para evitar múltiples llamadas
      
      return () => clearTimeout(timer);
    }
  }, [filtroActual, ordenAscendente, busqueda]);

  // Efecto para limpiar al desmontar
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Función para abrir el modal de pago
  const abrirModalPago = (factura: StoredInvoice) => {
    setFacturaSeleccionada(factura);
    setFormularioPago({
      pagada: true,
      medioPago: factura.infoPago?.medioPago || '01',
      fechaPago: new Date().toISOString().split('T')[0],
    });
    setModalPagoVisible(true);
  };
    
  // Función para cerrar el modal de pago
  const cerrarModalPago = () => {
    setModalPagoVisible(false);
    setFacturaSeleccionada(null);
  };
    
  // Función para cambiar datos del formulario de pago
  const cambiarFormularioPago = (campo: string, valor: any) => {
    setFormularioPago(prev => ({
      ...prev,
      [campo]: valor,
    }));
  };
    
  // Función para guardar un pago
  const guardarPago = async () => {
    if (!facturaSeleccionada) return;
    setLoading(true);
    setError(null);
    
    try {
      // Obtener UUID de la empresa
      const companyUuid = getCompanyUuid('default');
      
      // Preparar datos del pago
      const datosPago = {
        ...facturaSeleccionada,
        infoPago: {
          ...formularioPago,
          fechaRegistro: new Date().toISOString(),
        },
      };
      
      // Guardar cambios en Supabase
      const { error: updateError } = await supabaseInvoiceService.updateInvoiceData(
        companyUuid,
        facturaSeleccionada.id,
        datosPago
      );
      
      if (updateError) {
        throw new Error(`Error al guardar el pago: ${updateError.message}`);
      }
      
      // Mostrar mensaje de éxito y cerrar modal
      setMensajeExito(`Pago registrado correctamente para la factura ${facturaSeleccionada.consecutivoUnificado || facturaSeleccionada.id}`);
      cerrarModalPago();
      
      // Recargar datos
      await cargarDatos();
      
      // Limpiar mensaje de éxito después de 5 segundos
      setTimeout(() => {
        if (isMounted.current) {
          setMensajeExito(null);
        }
      }, 5000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al guardar el pago';
      if (isMounted.current) {
        setError(errorMessage);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  // Componente para mostrar mensaje de éxito flotante
  const MensajeExito = () => {
    if (!mensajeExito) return null;
    
    return (
      <div className="fixed bottom-5 right-5 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center">
        <Check className="w-5 h-5 mr-2" />
        {mensajeExito}
      </div>
    );
  };

  // Renderizado de pantalla de carga
  if (loading) {
    return (
      <div className="container mx-auto p-4 h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin text-primary-500" />
          <p className="text-gray-600 dark:text-gray-300">Cargando datos de facturas...</p>
        </div>
      </div>
    );
  }

  // Renderizado de mensajes de error
  if (error) {
    return (
      <div className="container mx-auto p-4 h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto bg-red-50 dark:bg-red-900/20 p-6 rounded-lg shadow-md">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-red-500" />
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Error al cargar datos</h2>
          <p className="text-red-500 dark:text-red-400">{error}</p>
          <button
            onClick={cargarDatos}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }
  
  // Ya no hacemos un return temprano si no hay facturas, para mantener la interfaz navegable

  // Renderizar vista principal
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Módulo de Pagos</h1>
      
      {/* Modal de Registro de Pagos */}
      {modalPagoVisible && facturaSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl p-6 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-medium text-gray-800 dark:text-white flex items-center">
                <DollarSign className="w-5 h-5 mr-2 text-green-500" />
                Registrar Pago
              </h2>
              <button
                onClick={cerrarModalPago}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                <strong>Cliente:</strong> {facturaSeleccionada.client || 'Sin nombre'}
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                <strong>Consecutivo:</strong> {facturaSeleccionada.consecutive || facturaSeleccionada.numeroConsecutivo || 'N/A'}
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                <strong>Fecha Emisión:</strong> {new Date(facturaSeleccionada.date).toLocaleDateString()}
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                <strong>Monto:</strong> {formatMoneda(Number(facturaSeleccionada.total) || 0, facturaSeleccionada.moneda || 'CRC')}
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="pagada"
                  checked={formularioPago.pagada}
                  onChange={e => cambiarFormularioPago('pagada', e.target.checked)}
                  className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="pagada" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Deuda cancelada en su totalidad
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Medio de Pago
                </label>
                <select
                  value={formularioPago.medioPago}
                  onChange={e => cambiarFormularioPago('medioPago', e.target.value)}
                  className="block w-full p-2 text-sm border border-gray-300 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-white focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="01">Efectivo</option>
                  <option value="02">Tarjeta</option>
                  <option value="03">Cheque</option>
                  <option value="04">Transferencia</option>
                  <option value="05">Recaudado por terceros</option>
                  <option value="06">SINPE MÓVIL</option>
                  <option value="07">Plataforma Digital</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Fecha de Pago
                </label>
                <input
                  type="date"
                  value={formularioPago.fechaPago}
                  onChange={e => cambiarFormularioPago('fechaPago', e.target.value)}
                  className="block w-full p-2 text-sm border border-gray-300 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-white focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              
              {(formularioPago.medioPago === '04' || formularioPago.medioPago === '06') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Banco
                    </label>
                    <input
                      type="text"
                      value={formularioPago.banco || ''}
                      onChange={e => cambiarFormularioPago('banco', e.target.value)}
                      placeholder="Banco Nacional, BAC, etc."
                      className="block w-full p-2 text-sm border border-gray-300 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-white focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Cuenta o Referencia
                    </label>
                    <select
                      id="cuentaBancaria"
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      value={formularioPago.cuentaBancaria || ''}
                      onChange={(e) => cambiarFormularioPago('cuentaBancaria', e.target.value)}
                    >
                      <option value="">Seleccione una cuenta bancaria</option>
                      {cuentasBancariasDisponibles.map(cuenta => (
                        <option key={cuenta.id} value={cuenta.id}>
                          {cuenta.banco} - {cuenta.numero} ({cuenta.moneda})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notas adicionales
                </label>
                <textarea
                  value={formularioPago.notas || ''}
                  onChange={e => cambiarFormularioPago('notas', e.target.value)}
                  placeholder="Información adicional sobre el pago"
                  className="block w-full p-2 text-sm border border-gray-300 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-white focus:ring-primary-500 focus:border-primary-500"
                  rows={2}
                />
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={cerrarModalPago}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none"
              >
                Cancelar
              </button>
              <button
                onClick={guardarPago}
                disabled={!formularioPago.pagada}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none ${formularioPago.pagada ? 'bg-primary-600 hover:bg-primary-700' : 'bg-gray-400 cursor-not-allowed'}`}
              >
                <Check className="w-4 h-4 inline-block mr-1" />
                Guardar Pago
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Mensaje de éxito flotante */}
      {mensajeExito && (
        <div className="fixed bottom-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50 shadow-md">
          <div className="flex items-center">
            <Check className="w-5 h-5 mr-2" />
            <span>{mensajeExito}</span>
            <button onClick={() => setMensajeExito(null)} className="ml-4">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      
      {/* Mensaje de error */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50 shadow-md">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-4">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      
      {/* Indicador de carga */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg flex items-center">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin mr-3" />
            <span className="text-gray-700 dark:text-gray-200">Cargando datos...</span>
          </div>
        </div>
      )}
      
      {/* Filtros y controles */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          {/* Filtro por período */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-blue-500" />
              Filtrar por período:
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.values(FiltroTiempo).map((filtro) => (
                <button
                  key={filtro}
                  onClick={() => setFiltroActual(filtro)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    filtroActual === filtro
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {filtro}
                </button>
              ))}
            </div>
          </div>
          
          {/* Buscar y ordenar */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOrdenAscendente(!ordenAscendente)}
              className="p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              title={ordenAscendente ? 'Mostrar más recientes primero' : 'Mostrar más antiguos primero'}
            >
              {ordenAscendente ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            </button>
            
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar factura..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-10 pr-4 py-2 w-full md:w-64 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Mensaje informativo cuando no hay facturas */}
      {facturas.length === 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 mb-6 rounded-lg border border-blue-200 dark:border-blue-700 shadow-sm">
          <div className="flex items-center">
            <FileText className="w-6 h-6 text-blue-500 mr-3" />
            <div>
              <h3 className="text-md font-medium text-blue-600 dark:text-blue-400">No hay facturas en este período</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">No se encontraron facturas para mostrar con el filtro actual. Puede cambiar el período para ver otros resultados.</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 rounded-lg shadow-sm">
          <div className="flex items-center">
            <Banknote className="w-8 h-8 text-blue-500 mr-3" />
            <div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">Total en Colones</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatMoneda(resumen.totalCRC, 'CRC')}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 rounded-lg shadow-sm">
          <div className="flex items-center">
            <DollarSign className="w-8 h-8 text-green-500 mr-3" />
            <div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">Total en Dólares</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatMoneda(resumen.totalUSD, 'USD')}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 rounded-lg shadow-sm">
          <div className="flex items-center">
            <Building className="w-8 h-8 text-purple-500 mr-3" />
            <div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">Total en Euros</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatMoneda(resumen.totalEUR, 'EUR')}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* El primer Resumen por Medio de Pago ha sido eliminado para evitar duplicación */}
      
      {/* Tabla de Resumen por Condición de Venta */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm mb-8">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center">
            <CreditCard className="w-5 h-5 mr-2 text-purple-500" />
            Resumen por Condición de Venta
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700">
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Condición</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Colones (CRC)</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Dólares (USD)</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Euros (EUR)</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {Object.entries(resumen.porCondicionVenta).map(([condicion, montos]) => (
                <tr key={condicion} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-200">{condicion}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 dark:text-gray-300">{formatMoneda(montos.CRC, 'CRC')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 dark:text-gray-300">{formatMoneda(montos.USD, 'USD')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 dark:text-gray-300">{formatMoneda(montos.EUR, 'EUR')}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 dark:bg-gray-700 font-semibold">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">TOTAL</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-800 dark:text-gray-200">{formatMoneda(resumen.totalCRC, 'CRC')}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-800 dark:text-gray-200">{formatMoneda(resumen.totalUSD, 'USD')}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-800 dark:text-gray-200">{formatMoneda(resumen.totalEUR, 'EUR')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Control de búsqueda */}
      <div className="relative flex-1 w-full md:max-w-md mb-6">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-primary-500 dark:text-primary-400" />
        <input
          type="text"
          placeholder="Buscar por cliente o consecutivo..."
          className="border border-gray-200 dark:border-gray-700 rounded-full pl-10 pr-10 py-2.5 w-full text-sm shadow-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary-300 dark:focus:ring-primary-700 focus:outline-none transition-all duration-200"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        {busqueda && (
          <button 
            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-gray-100 dark:bg-gray-700 rounded-full w-5 h-5 flex items-center justify-center text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            onClick={() => setBusqueda('')}
            aria-label="Limpiar búsqueda"
          >
            ×
          </button>
        )}
      </div>
      
      {/* Sección de Medios de Pago */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm mb-8">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center">
            <Wallet className="w-5 h-5 mr-2 text-blue-500" />
            Resumen por Medio de Pago
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Incluye facturas de contado y facturas de crédito ya pagadas
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700">
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Medio de Pago</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Colones (CRC)</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Dólares (USD)</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Euros (EUR)</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {Object.entries(resumen.porMedioPago).map(([medioPago, montos]) => {
                // Siempre mostrar todos los medios de pago
                const hayMontos = montos.CRC > 0 || montos.USD > 0 || montos.EUR > 0;
                
                // Determinar el icono adecuado para cada medio de pago
                let Icon = Banknote;
                let iconColor = "text-blue-500";
                
                switch(medioPago) {
                  case MedioPagoGrupo.CAJA:
                    Icon = Banknote;
                    iconColor = "text-green-500";
                    break;
                  case MedioPagoGrupo.AFILIADOS:
                    Icon = CreditCard;
                    iconColor = "text-purple-500";
                    break;
                  case MedioPagoGrupo.BANCOS:
                    Icon = Building;
                    iconColor = "text-blue-500";
                    break;
                  default:
                    Icon = Wallet;
                    iconColor = "text-gray-500";
                }
                
                return (
                  <tr key={medioPago} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 ${iconColor}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{medioPago}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 dark:text-gray-300 font-medium">{formatMoneda(montos.CRC, 'CRC')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 dark:text-gray-300 font-medium">{formatMoneda(montos.USD, 'USD')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 dark:text-gray-300 font-medium">{formatMoneda(montos.EUR, 'EUR')}</td>
                  </tr>
                );
              })}
              <tr className="bg-gray-50 dark:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800 dark:text-gray-200">TOTAL</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-800 dark:text-gray-200">{formatMoneda(resumen.totalCRC, 'CRC')}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-800 dark:text-gray-200">{formatMoneda(resumen.totalUSD, 'USD')}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-800 dark:text-gray-200">{formatMoneda(resumen.totalEUR, 'EUR')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Sección de Condición de Venta */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm mb-8">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center">
            <Building className="w-5 h-5 mr-2 text-indigo-500" />
            Resumen por Condición de Venta
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700">
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Condición</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Colones (CRC)</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Dólares (USD)</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Euros (EUR)</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {Object.entries(resumen.porCondicionVenta).map(([condicion, montos]) => {
                // Siempre mostrar todas las condiciones de venta
                const hayMontos = montos.CRC > 0 || montos.USD > 0 || montos.EUR > 0;
                
                return (
                  <tr key={condicion} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-200">{condicion}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 dark:text-gray-300">{formatMoneda(montos.CRC, 'CRC')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 dark:text-gray-300">{formatMoneda(montos.USD, 'USD')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 dark:text-gray-300">{formatMoneda(montos.EUR, 'EUR')}</td>
                  </tr>
                );
              })}
              <tr className="bg-gray-50 dark:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800 dark:text-gray-200">TOTAL</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-800 dark:text-gray-200">{formatMoneda(resumen.totalCRC, 'CRC')}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-800 dark:text-gray-200">{formatMoneda(resumen.totalUSD, 'USD')}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-800 dark:text-gray-200">{formatMoneda(resumen.totalEUR, 'EUR')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Facturación a Crédito por Cobrar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm mb-8">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center">
            <CreditCard className="w-5 h-5 mr-2 text-orange-500" />
            Facturación a Crédito por Cobrar
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Facturas a crédito pendientes de pago agrupadas por plazo
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700">
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Plazo</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Colones (CRC)</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Dólares (USD)</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Euros (EUR)</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Facturas</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {resumen.porPlazoCredito.map(plazo => {
                // Siempre mostrar la fila, independientemente de los montos
                
                // Determinar color de fondo según el estado (vencido o no)
                const esVencido = plazo.dias < 0;
                const rowClass = esVencido ? 'hover:bg-red-50 dark:hover:bg-red-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700';
                const textClass = esVencido ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200';
                
                return (
                  <tr key={plazo.nombre} className={rowClass}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${textClass}`}>{plazo.nombre}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 dark:text-gray-300">{formatMoneda(plazo.totalCRC, 'CRC')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 dark:text-gray-300">{formatMoneda(plazo.totalUSD, 'USD')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 dark:text-gray-300">{formatMoneda(plazo.totalEUR, 'EUR')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-700 dark:text-gray-300">{plazo.facturas.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Listado detallado de facturas a crédito */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-3">Detalle de facturas</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">
                  <th className="py-2 px-4 text-left text-gray-800 dark:text-white">Consecutivo</th>
                  <th className="py-2 px-4 text-left text-gray-800 dark:text-white">Cliente</th>
                  <th className="py-2 px-4 text-left text-gray-800 dark:text-white">Fecha</th>
                  <th className="py-2 px-4 text-right text-gray-800 dark:text-white">Monto</th>
                  <th className="py-2 px-4 text-center text-gray-800 dark:text-white">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {facturas.filter(f => !f.infoPago?.pagada && f.condicionVenta === '02').map(factura => (
                  <tr key={factura.id} className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="py-2 px-4 text-gray-800 dark:text-white">{factura.consecutivoUnificado || 'N/A'}</td>
                    <td className="py-2 px-4 text-gray-800 dark:text-white">{factura.client || 'Sin nombre'}</td>
                    <td className="py-2 px-4 text-gray-800 dark:text-white">{new Date(factura.date).toLocaleDateString()}</td>
                    <td className="py-2 px-4 text-right text-gray-800 dark:text-white">{formatMoneda(Number(factura.total) || 0, factura.moneda || 'CRC')}</td>
                    <td className="py-2 px-4 text-center">
                      <button 
                        onClick={() => abrirModalPago(factura)}
                        className="inline-flex items-center px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      >
                        <DollarSign className="w-4 h-4 mr-1" />
                        Registrar Pago
                      </button>
                    </td>
                  </tr>
                ))}
                
                {facturas.filter(f => !f.infoPago?.pagada && f.condicionVenta === '02').length === 0 && (
                  <tr className="border-t border-gray-200">
                    <td colSpan={5} className="py-4 text-center text-gray-500 dark:text-gray-400">
                      No hay facturas a crédito pendientes de pago en el periodo seleccionado. Cambie el filtro de tiempo para ver otros períodos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Facturas Pagadas */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm mb-8">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center">
            <Check className="w-5 h-5 mr-2 text-green-500" />
            Facturas Pagadas
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Facturas con pagos registrados y completados
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700">
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Factura</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cliente</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Monto</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fecha de Pago</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Medio de Pago</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {resumen.facturasPagadas.map(factura => (
                  <tr key={factura.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-200">{factura.consecutivoUnificado || factura.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{factura.client || 'No especificado'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 dark:text-gray-300">
                      {formatMoneda(Number(factura.total) || 0, factura.moneda || 'CRC')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-700 dark:text-gray-300">
                      {factura.infoPago?.fechaPago ? new Date(factura.infoPago.fechaPago).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-700 dark:text-gray-300">
                      {/* Usar el campo medioPagoNombre si existe (campo enriquecido) */}
                      {factura.medioPagoNombre || (
                        <>
                          {factura.infoPago?.medioPago === '01' && 'Efectivo'}
                          {factura.infoPago?.medioPago === '02' && 'Tarjeta'}
                          {factura.infoPago?.medioPago === '03' && 'Cheque'}
                          {factura.infoPago?.medioPago === '04' && 'Transferencia'}
                          {factura.infoPago?.medioPago === '05' && 'Recaudado por terceros'}
                          {factura.infoPago?.medioPago === '06' && 'SINPE MÓVIL'}
                          {factura.infoPago?.medioPago === '07' && 'Plataforma Digital'}
                          {factura.infoPago?.medioPago === '99' && 'Otros'}
                          {!factura.infoPago?.medioPago && 'No especificado'}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              {resumen.facturasPagadas.length === 0 && (
                <tr className="border-t border-gray-200">
                  <td colSpan={5} className="py-4 text-center text-gray-500 dark:text-gray-400">
                    No hay facturas pagadas en el periodo seleccionado. Cambie el filtro de tiempo para ver otros períodos.
                  </td>
                </tr>
              )}
              </tbody>
            </table>
          </div>
      </div>
      

      
      {/* Modal de Registro de Pagos */}
      {modalPagoVisible && facturaSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl p-6 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-medium text-gray-800 dark:text-white flex items-center">
                <DollarSign className="w-5 h-5 mr-2 text-green-500" />
                Registrar Pago
              </h2>
              <button
                onClick={cerrarModalPago}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                <strong>Cliente:</strong> {facturaSeleccionada.client || 'Sin nombre'}
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                <strong>Consecutivo:</strong> {facturaSeleccionada.consecutive || facturaSeleccionada.numeroConsecutivo || 'N/A'}
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                <strong>Fecha Emisión:</strong> {new Date(facturaSeleccionada.date).toLocaleDateString()}
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                <strong>Monto:</strong> {formatMoneda(Number(facturaSeleccionada.total) || 0, facturaSeleccionada.moneda || 'CRC')}
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="pagada"
                  checked={formularioPago.pagada}
                  onChange={e => cambiarFormularioPago('pagada', e.target.checked)}
                  className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="pagada" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Deuda cancelada en su totalidad
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Medio de Pago
                </label>
                <select
                  value={formularioPago.medioPago}
                  onChange={e => cambiarFormularioPago('medioPago', e.target.value)}
                  className="block w-full p-2 text-sm border border-gray-300 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-white focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="01">Efectivo</option>
                  <option value="02">Tarjeta</option>
                  <option value="03">Cheque</option>
                  <option value="04">Transferencia</option>
                  <option value="05">Recaudado por terceros</option>
                  <option value="06">SINPE MÓVIL</option>
                  <option value="07">Plataforma Digital</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Fecha de Pago
                </label>
                <input
                  type="date"
                  value={formularioPago.fechaPago}
                  onChange={e => cambiarFormularioPago('fechaPago', e.target.value)}
                  className="block w-full p-2 text-sm border border-gray-300 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-white focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              
              {(formularioPago.medioPago === '04' || formularioPago.medioPago === '06') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Banco
                    </label>
                    <input
                      type="text"
                      value={formularioPago.banco || ''}
                      onChange={e => cambiarFormularioPago('banco', e.target.value)}
                      placeholder="Banco Nacional, BAC, etc."
                      className="block w-full p-2 text-sm border border-gray-300 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-white focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Cuenta o Referencia
                    </label>
                    <select
                      id="cuentaBancaria"
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      value={formularioPago.cuentaBancaria || ''}
                      onChange={(e) => cambiarFormularioPago('cuentaBancaria', e.target.value)}
                      disabled={formularioPago.medioPago !== '04'}
                    >
                      <option value="">Seleccione una cuenta bancaria</option>
                      {cuentasBancariasDisponibles.map(cuenta => (
                        <option key={cuenta.id} value={cuenta.id}>
                          {cuenta.banco} - {cuenta.numero} ({cuenta.moneda})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notas adicionales
                </label>
                <textarea
                  value={formularioPago.notas || ''}
                  onChange={e => cambiarFormularioPago('notas', e.target.value)}
                  placeholder="Información adicional sobre el pago"
                  className="block w-full p-2 text-sm border border-gray-300 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-white focus:ring-primary-500 focus:border-primary-500"
                  rows={2}
                />
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={cerrarModalPago}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none"
              >
                Cancelar
              </button>
              <button
                onClick={guardarPago}
                disabled={!formularioPago.pagada}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none ${formularioPago.pagada ? 'bg-primary-600 hover:bg-primary-700' : 'bg-gray-400 cursor-not-allowed'}`}
              >
                <Check className="w-4 h-4 inline-block mr-1" />
                Guardar Pago
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pagos;
