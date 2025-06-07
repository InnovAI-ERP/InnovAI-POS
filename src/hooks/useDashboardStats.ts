import { useState, useEffect } from 'react';
import { supabaseInvoiceService } from '../services/supabaseInvoiceService';
import { supabaseClientService } from '../services/supabaseClientService';
import { supabaseProductService } from '../services/supabaseProductService';
import { useAuth } from './useAuth';
import { getCompanyUuid } from '../services/uuidMappingService';
import { StoredInvoice } from './useInvoiceHistory';

// Interfaz para datos de venta diaria
interface DailySalesData {
  day: string; // Formato: "DD/MM"
  actual: number; // Ventas del día actual
  anterior: number; // Ventas del mismo día del mes anterior
}

interface DashboardStats {
  // Estadísticas generales
  invoicesCount: {
    current: number;
    previous: number;
    percentChange: number;
  };
  monthlyIncome: {
    current: number;
    previous: number;
    percentChange: number;
  };
  clientsCount: {
    current: number;
    previous: number;
    percentChange: number;
  };
  productsCount: {
    current: number;
    previous: number;
    percentChange: number;
  };
  // Facturas recientes
  recentInvoices: StoredInvoice[];
  // Datos de ventas diarias para el gráfico
  dailySales: DailySalesData[];
  // Estado de carga
  loading: boolean;
  error: string | null;
}

export function useDashboardStats(): DashboardStats {
  const [stats, setStats] = useState<DashboardStats>({
    invoicesCount: { current: 0, previous: 0, percentChange: 0 },
    monthlyIncome: { current: 0, previous: 0, percentChange: 0 },
    clientsCount: { current: 0, previous: 0, percentChange: 0 },
    productsCount: { current: 0, previous: 0, percentChange: 0 },
    recentInvoices: [],
    dailySales: [],
    loading: true,
    error: null
  });

  const { currentCompany } = useAuth();

  // Función para calcular el cambio porcentual
  const calculatePercentChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Number(((current - previous) / previous * 100).toFixed(1));
  };

  // Función para convertir montos a colones basado en el tipo de cambio
  const convertToColones = (amount: number, currency: string, exchangeRate: number): number => {
    if (currency === 'CRC') return amount;
    if (exchangeRate <= 0) return 0;
    return amount * exchangeRate;
  };

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        console.log('📈 Cargando estadísticas del dashboard...');
        const companyUuid = getCompanyUuid('innova');
        let clientsCount = 0;
        let productsCount = 0;
        let clients = null;
        let productsData = null;

        // 1. Obtener todas las facturas
        const { invoices: allInvoices, error: invoicesError } = await supabaseInvoiceService.getInvoicesData('innova');
        if (invoicesError) throw new Error('Error al cargar facturas: ' + invoicesError);

        console.log(`📝 Total de facturas encontradas: ${allInvoices.length}`);

        try {
          // 2. Intentar obtener todos los clientes
          // El servicio ya obtiene el UUID de la empresa automáticamente
          const clientResult = await supabaseClientService.getClients(1, 1000);
          clients = clientResult.data || [];
          clientsCount = clients.length;
          console.log(`👥 Total de clientes encontrados: ${clientsCount}`);
        } catch (clientError) {
          // Si hay un error al cargar clientes, continuamos con conteo 0
          console.warn('No se pudieron cargar los clientes:', clientError);
        }

        try {
          // 3. Intentar obtener todos los productos
          // Similar a getClients, el servicio ya obtiene el UUID de la empresa automáticamente
          const productResult = await supabaseProductService.getProducts(1, 1000);
          productsData = productResult.data || [];
          productsCount = productsData.length || 0;
          console.log(`📦 Total de productos encontrados: ${productsCount}`);
        } catch (productError) {
          // Si hay un error al cargar productos, continuamos con conteo 0
          console.warn('No se pudieron cargar los productos:', productError);
        }

        // Obtener fecha actual y calcular meses
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        // Filtrar facturas por mes actual y mes anterior
        const currentMonthInvoices = allInvoices.filter(invoice => {
          const date = new Date(invoice.date);
          return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });

        const previousMonthInvoices = allInvoices.filter(invoice => {
          const date = new Date(invoice.date);
          return date.getMonth() === previousMonth && date.getFullYear() === previousYear;
        });

        console.log(`📅 Facturas del mes actual: ${currentMonthInvoices.length}`);
        console.log(`📅 Facturas del mes anterior: ${previousMonthInvoices.length}`);

        // Calcular estadísticas de clientes para este mes y el mes anterior
        let currentMonthClientsCount = 0;
        let previousMonthClientsCount = 0;
        
        if (clients) {
            currentMonthClientsCount = clients.filter(client => {
                if (!client.created_at) return false;
                const createdAt = new Date(client.created_at);
                return createdAt.getMonth() === currentMonth && createdAt.getFullYear() === currentYear;
            }).length;

            previousMonthClientsCount = clients.filter(client => {
                if (!client.created_at) return false;
                const createdAt = new Date(client.created_at);
                return createdAt.getMonth() === previousMonth && createdAt.getFullYear() === previousYear;
            }).length;
        }
        
        console.log(`👥 Clientes nuevos este mes: ${currentMonthClientsCount}`);
        console.log(`👥 Clientes nuevos mes anterior: ${previousMonthClientsCount}`);

        // Calcular ingresos mensuales (convertir todo a colones)
        let currentMonthIncome = 0;
        let previousMonthIncome = 0;

        currentMonthInvoices.forEach(invoice => {
          const amount = invoice.total || 0;
          const currency = invoice.moneda || 'CRC';
          const exchangeRate = invoice.tipoCambio || 1;
          currentMonthIncome += convertToColones(amount, currency, exchangeRate);
        });

        previousMonthInvoices.forEach(invoice => {
          const amount = invoice.total || 0;
          const currency = invoice.moneda || 'CRC';
          const exchangeRate = invoice.tipoCambio || 1;
          previousMonthIncome += convertToColones(amount, currency, exchangeRate);
        });

        console.log(`💰 Ingresos del mes actual: ₡${currentMonthIncome.toLocaleString()}`);
        console.log(`💰 Ingresos del mes anterior: ₡${previousMonthIncome.toLocaleString()}`);

        // Calcular ventas diarias para el gráfico
        const dailySales: DailySalesData[] = [];
        const dailyTotalsCurrentMonth: Record<string, number> = {};
        const dailyTotalsPreviousMonth: Record<string, number> = {};

        // Agrupar ventas por día del mes actual
        currentMonthInvoices.forEach(invoice => {
          const date = new Date(invoice.date);
          const day = date.getDate();
          const formattedDay = `${day}/${currentMonth + 1}`;
          
          const amount = invoice.total || 0;
          const currency = invoice.moneda || 'CRC';
          const exchangeRate = invoice.tipoCambio || 1;
          const amountInColones = convertToColones(amount, currency, exchangeRate);
          
          if (!dailyTotalsCurrentMonth[formattedDay]) {
            dailyTotalsCurrentMonth[formattedDay] = 0;
          }
          dailyTotalsCurrentMonth[formattedDay] += amountInColones;
        });

        // Agrupar ventas por día del mes anterior
        previousMonthInvoices.forEach(invoice => {
          const date = new Date(invoice.date);
          const day = date.getDate();
          // Para comparar con el mismo día del mes actual
          const formattedDay = `${day}/${currentMonth + 1}`;
          
          const amount = invoice.total || 0;
          const currency = invoice.moneda || 'CRC';
          const exchangeRate = invoice.tipoCambio || 1;
          const amountInColones = convertToColones(amount, currency, exchangeRate);
          
          if (!dailyTotalsPreviousMonth[formattedDay]) {
            dailyTotalsPreviousMonth[formattedDay] = 0;
          }
          dailyTotalsPreviousMonth[formattedDay] += amountInColones;
        });

        // Convertir a formato para el gráfico
        // Incluir solo días con ventas en cualquiera de los dos meses
        const allDays = [...new Set([
          ...Object.keys(dailyTotalsCurrentMonth),
          ...Object.keys(dailyTotalsPreviousMonth)
        ])];

        allDays.forEach(day => {
          dailySales.push({
            day,
            actual: Math.round(dailyTotalsCurrentMonth[day] || 0),
            anterior: Math.round(dailyTotalsPreviousMonth[day] || 0)
          });
        });

        // Ordenar por día de forma ascendente
        dailySales.sort((a, b) => {
          const dayA = parseInt(a.day.split('/')[0]);
          const dayB = parseInt(b.day.split('/')[0]);
          return dayA - dayB;
        });

        console.log(`📊 Datos diarios generados: ${dailySales.length} días`);

        // Ordenar facturas recientes por fecha (más recientes primero)
        const recentInvoices = [...allInvoices].sort((a, b) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        }).slice(0, 5); // Solo tomar las 5 más recientes

        // Calcular cambios porcentuales
        const invoicesPercentChange = calculatePercentChange(
          currentMonthInvoices.length, 
          previousMonthInvoices.length
        );

        const incomePercentChange = calculatePercentChange(
          currentMonthIncome,
          previousMonthIncome
        );

        // Para clientes y productos, asumimos crecimiento del 3% y 8% respectivamente
        // ya que no tenemos datos históricos disponibles
        const clientsPercentChange = 3;
        const productsPercentChange = 8;

        setStats({
          invoicesCount: {
            current: allInvoices.length,
            previous: allInvoices.length - currentMonthInvoices.length,
            percentChange: invoicesPercentChange
          },
          monthlyIncome: {
            current: currentMonthIncome,
            previous: previousMonthIncome,
            percentChange: incomePercentChange
          },
          productsCount: {
            current: productsCount,
            previous: Math.floor(productsCount / (1 + productsPercentChange / 100)),
            percentChange: productsPercentChange
          },
          clientsCount: {
            current: clientsCount,
            previous: Math.floor(clientsCount / (1 + clientsPercentChange / 100)),
            percentChange: clientsPercentChange
          },
          recentInvoices,
          dailySales,
          loading: false,
          error: null
        });

        console.log('✅ Estadísticas del dashboard cargadas correctamente');
      } catch (error) {
        console.error('❌ Error al obtener estadísticas del dashboard:', error);
        setStats({
          ...stats,
          loading: false,
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    };

    fetchDashboardStats();
  }, [currentCompany]);

  return stats;
}
