import { FileText, DollarSign, Users, BarChart3, ArrowUpRight, ArrowRight, Loader2, AlertTriangle, PlusCircle, Calendar, History, FilePlus, PieChart, TrendingUp } from 'lucide-react';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Dashboard = () => {
  const navigate = useNavigate();
  
  // Usar el hook personalizado para obtener estadísticas reales
  const { 
    invoicesCount, 
    monthlyIncome, 
    clientsCount, 
    productsCount, 
    recentInvoices,
    dailySales,
    loading, 
    error 
  } = useDashboardStats();

  // Función para formatear el porcentaje de cambio
  const formatPercentChange = (change: number): string => {
    const prefix = change >= 0 ? '+' : '';
    return `${prefix}${change}%`;
  };
  
  // Función para formatear moneda en colones
  const formatCurrency = (amount: number): string => {
    return `₡${amount.toLocaleString()}`;
  };
  
  // Los datos para el gráfico comparativo de ingresos vienen directamente de useDashboardStats
  // a través de dailySales, que incluye las ventas reales por día
  
  // Interfaz para datos de gráfico para mantener coherencia con componentes
  interface SalesDataPoint {
    name: string; // Formato: DD/MM
    actual: number;
    anterior: number;
  }
  
  // Convertir datos de dailySales al formato que espera el gráfico
  const salesData: SalesDataPoint[] = loading 
    ? [] 
    : dailySales.map((item: {day: string, actual: number, anterior: number}) => ({
        name: item.day, // Ya viene formateado como "DD/MM"
        actual: item.actual,
        anterior: item.anterior
      }));

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 title-primary">Dashboard</h1>
      <div className="text-right text-xs text-gray-400 -mt-5 mb-5">
        Última actualización: {new Date().toLocaleDateString()}
      </div>
      
      {/* Mensaje de error si hay problemas al cargar los datos */}
      {error && (
        <div className="glass-card p-4 border-l-4 border-red-500 bg-red-500/10">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-sm">Error al cargar datos: {error}</p>
          </div>
        </div>
      )}
      
      {/* Layout principal: Grid con 3 columnas en pantallas grandes */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Columnas 1-3: Estadísticas y datos principales */}
        <div className="lg:col-span-3 space-y-6">
          {/* Stats con datos reales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Facturas emitidas */}
            <div className="glass-card p-5 animate-glow">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-600 text-sm dark:text-gray-400">Facturas emitidas</p>
                  {loading ? (
                    <div className="flex items-center space-x-2 mt-1">
                      <Loader2 className="h-4 w-4 text-primary-400 animate-spin" />
                      <span className="text-sm text-gray-400">Cargando...</span>
                    </div>
                  ) : (
                    <p className="text-2xl font-bold mt-1">{invoicesCount.current}</p>
                  )}
                </div>
                <div className="p-2 rounded-md bg-primary-500/20 text-primary-400">
                  <FileText className="w-5 h-5" />
                </div>
              </div>
              <div className="flex items-center mt-3 text-xs">
                {loading ? (
                  <span className="text-gray-400">Calculando cambio...</span>
                ) : (
                  <>
                    <span className={invoicesCount.percentChange >= 0 ? "text-green-500" : "text-red-500"}>
                      {formatPercentChange(invoicesCount.percentChange)}
                    </span>
                    {invoicesCount.percentChange >= 0 ? (
                      <ArrowUpRight className="w-3 h-3 text-green-500 ml-1" />
                    ) : (
                      <ArrowUpRight className="w-3 h-3 text-red-500 ml-1 transform rotate-90" />
                    )}
                    <span className="ml-1.5 text-gray-500 dark:text-gray-400">vs. mes anterior</span>
                  </>
                )}
              </div>
            </div>
            
            {/* Ingresos mensuales */}
            <div className="glass-card p-5 animate-glow">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-600 text-sm dark:text-gray-400">Ingresos mensuales</p>
                  {loading ? (
                    <div className="flex items-center space-x-2 mt-1">
                      <Loader2 className="h-4 w-4 text-green-400 animate-spin" />
                      <span className="text-sm text-gray-400">Cargando...</span>
                    </div>
                  ) : (
                    <p className="text-2xl font-bold mt-1">₡{monthlyIncome.current.toLocaleString()}</p>
                  )}
                </div>
                <div className="p-2 rounded-md bg-green-500/20 text-green-500">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="flex items-center mt-3 text-xs">
                {loading ? (
                  <span className="text-gray-400">Calculando cambio...</span>
                ) : (
                  <>
                    <span className={monthlyIncome.percentChange >= 0 ? "text-green-500" : "text-red-500"}>
                      {formatPercentChange(monthlyIncome.percentChange)}
                    </span>
                    {monthlyIncome.percentChange >= 0 ? (
                      <ArrowUpRight className="w-3 h-3 text-green-500 ml-1" />
                    ) : (
                      <ArrowUpRight className="w-3 h-3 text-red-500 ml-1 transform rotate-90" />
                    )}
                    <span className="ml-1.5 text-gray-500 dark:text-gray-400">vs. mes anterior</span>
                  </>
                )}
              </div>
            </div>
            
            {/* Clientes */}
            <div className="glass-card p-5 animate-glow">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-600 text-sm dark:text-gray-400">
                    Clientes 
                    {!loading && (
                      <span className={clientsCount.percentChange >= 0 ? "ml-1 text-green-500" : "ml-1 text-red-500"}>
                        ({formatPercentChange(clientsCount.percentChange)})
                      </span>
                    )}
                  </p>
                  {loading ? (
                    <div className="flex items-center space-x-2 mt-1">
                      <Loader2 className="h-4 w-4 text-orange-400 animate-spin" />
                      <span className="text-sm text-gray-400">Cargando...</span>
                    </div>
                  ) : (
                    <p className="text-2xl font-bold mt-1">{clientsCount.current}</p>
                  )}
                </div>
                <div className="p-2 rounded-md bg-orange-500/20 text-orange-500">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="flex items-center mt-3 text-xs">
                {loading ? (
                  <span className="text-gray-400">Calculando cambio...</span>
                ) : (
                  <>
                    <span className={clientsCount.percentChange >= 0 ? "text-green-500" : "text-red-500"}>
                      {formatPercentChange(clientsCount.percentChange)}
                    </span>
                    {clientsCount.percentChange >= 0 ? (
                      <ArrowUpRight className="w-3 h-3 text-green-500 ml-1" />
                    ) : (
                      <ArrowUpRight className="w-3 h-3 text-red-500 ml-1 transform rotate-90" />
                    )}
                    <span className="ml-1.5 text-gray-500 dark:text-gray-400">vs. mes anterior</span>
                  </>
                )}
              </div>
            </div>
            
            {/* Productos */}
            <div className="glass-card p-5 animate-glow">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-600 text-sm dark:text-gray-400">
                    Productos
                    {!loading && (
                      <span className={productsCount.percentChange >= 0 ? "ml-1 text-green-500" : "ml-1 text-red-500"}>
                        ({formatPercentChange(productsCount.percentChange)})
                      </span>
                    )}
                  </p>
                  {loading ? (
                    <div className="flex items-center space-x-2 mt-1">
                      <Loader2 className="h-4 w-4 text-purple-400 animate-spin" />
                      <span className="text-sm text-gray-400">Cargando...</span>
                    </div>
                  ) : (
                    <p className="text-2xl font-bold mt-1">{productsCount.current}</p>
                  )}
                </div>
                <div className="p-2 rounded-md bg-purple-500/20 text-purple-500">
                  <BarChart3 className="w-5 h-5" />
                </div>
              </div>
              <div className="flex items-center mt-3 text-xs">
                {loading ? (
                  <span className="text-gray-400">Calculando cambio...</span>
                ) : (
                  <>
                    <span className={productsCount.percentChange >= 0 ? "text-green-500" : "text-red-500"}>
                      {formatPercentChange(productsCount.percentChange)}
                    </span>
                    {productsCount.percentChange >= 0 ? (
                      <ArrowUpRight className="w-3 h-3 text-green-500 ml-1" />
                    ) : (
                      <ArrowUpRight className="w-3 h-3 text-red-500 ml-1 transform rotate-90" />
                    )}
                    <span className="ml-1.5 text-gray-500 dark:text-gray-400">vs. mes anterior</span>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* Gráfico de tendencia de ingresos */}
          <div className="glass-card p-5 animate-glow">
            <h2 className="text-xl font-semibold mb-4 title-secondary flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-blue-500" />
              Tendencia de Ingresos Diarios
            </h2>
            
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 text-primary-400 animate-spin" />
                <span className="ml-2">Cargando datos del gráfico...</span>
              </div>
            ) : salesData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <AlertTriangle className="h-12 w-12 mb-2 text-gray-300" />
                <p className="text-center">No hay datos de ventas para mostrar en el período actual.</p>
                <p className="text-center text-sm mt-1">Los datos aparecerán aquí cuando se registren facturas.</p>
              </div>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={salesData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: '#777', fontSize: 12 }} 
                      tickLine={{ stroke: '#777' }}
                    />
                    <YAxis 
                      tick={{ fill: '#777', fontSize: 12 }} 
                      tickFormatter={(value) => `₡${(value/1000).toFixed(0)}K`}
                      tickLine={{ stroke: '#777' }}
                    />
                    <Tooltip 
                      formatter={(value) => [`₡${Number(value).toLocaleString()}`, '']}
                      labelFormatter={(value) => `Día ${value.split('/')[0]}`}
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 159, 67, 0.3)',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="actual" 
                      name="Mes actual" 
                      stroke="#FF9F43" 
                      strokeWidth={3}
                      activeDot={{ r: 8, fill: '#FF9F43', stroke: 'white', strokeWidth: 2 }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="anterior" 
                      name="Mes anterior" 
                      stroke="#00B9CC" 
                      strokeWidth={2}
                      strokeDasharray="5 5" 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              <p>Comparativa de ingresos diarios entre el mes actual y el anterior.</p>
            </div>
          </div>
          
          {/* Recent invoices */}
          <div className="glass-card p-5 animate-glow">
        <h2 className="text-xl font-semibold mb-3 title-secondary">Facturas recientes</h2>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 text-primary-400 animate-spin" />
            <span className="ml-2">Cargando facturas recientes...</span>
          </div>
        ) : error ? (
          <div className="flex items-center text-red-400 py-4">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <p>No se pudieron cargar las facturas</p>
          </div>
        ) : recentInvoices.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>No hay facturas recientes para mostrar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left pb-3 text-gray-400 text-sm">ID</th>
                  <th className="text-left pb-3 text-gray-400 text-sm">Cliente</th>
                  <th className="text-left pb-3 text-gray-400 text-sm">Fecha</th>
                  <th className="text-left pb-3 text-gray-400 text-sm">Monto</th>
                  <th className="text-left pb-3 text-gray-400 text-sm">Estado</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((invoice, index) => (
                  <tr 
                    key={index} 
                    className="border-b border-gray-200 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/20"
                    onClick={() => navigate('/historial')}
                  >
                    <td className="py-2.5">{invoice.id}</td>
                    <td className="py-2.5">{invoice.client}</td>
                    <td className="py-2.5">{new Date(invoice.date).toLocaleDateString()}</td>
                    <td className="py-2.5">{invoice.amount}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-1 rounded-md text-xs
                        ${invoice.status === 'Completada' ? 'bg-green-500/20 text-green-400' : ''}
                        ${invoice.status === 'Pendiente' ? 'bg-orange-500/20 text-orange-400' : ''}
                        ${invoice.status === 'Rechazada' ? 'bg-red-500/20 text-red-400' : ''}
                      `}>
                        {invoice.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        <button 
          className="mt-4 flex items-center text-primary-400 text-sm hover:underline"
          onClick={() => navigate('/historial')}
        >
          Ver todas las facturas
          <ArrowRight className="w-4 h-4 ml-1" />
        </button>
          </div>
        </div>
        
        {/* Columna 4: Acciones rápidas en formato vertical */}
        <div className="lg:col-span-1">
          <div className="glass-card p-5 animate-glow sticky top-20">
            <h2 className="text-xl font-semibold mb-5 title-secondary flex items-center">
              <PlusCircle className="w-5 h-5 mr-2 text-orange-500" />
              Acciones rápidas
            </h2>
            <div className="flex flex-col space-y-3">
              {[
                { 
                  title: 'Nuevo Tiquete', 
                  description: 'Crear un nuevo tiquete electrónico', 
                  icon: <PlusCircle className="w-5 h-5" />, 
                  color: 'bg-primary-500/20 text-primary-400',
                  path: '/crear-tiquete'
                },
                { 
                  title: 'Nueva Factura', 
                  description: 'Crear una nueva factura electrónica', 
                  icon: <FilePlus className="w-5 h-5" />, 
                  color: 'bg-blue-500/20 text-blue-400',
                  path: '/crear-factura'
                },
                { 
                  title: 'Ver Pagos', 
                  description: 'Revisar el historial de pagos', 
                  icon: <History className="w-5 h-5" />, 
                  color: 'bg-secondary-500/20 text-secondary-400',
                  path: '/pagos'
                },
                { 
                  title: 'Ver Reportes', 
                  description: 'Consultar reportes y estadísticas', 
                  icon: <PieChart className="w-5 h-5" />, 
                  color: 'bg-orange-500/20 text-orange-400',
                  path: '/reportes'
                },
                { 
                  title: 'Ver Calendario', 
                  description: 'Administrar facturas programadas', 
                  icon: <Calendar className="w-5 h-5" />, 
                  color: 'bg-purple-500/20 text-purple-400',
                  path: '/calendario'
                }
              ].map((action, index) => (
                <button
                  key={index}
                  className="flex items-center p-3 rounded-lg border border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:bg-white/50 dark:hover:bg-gray-800/20 transition-all"
                  onClick={() => navigate(action.path)}
                >
                  <div className={`p-2 rounded-md mr-3 ${action.color}`}>
                    {action.icon}
                  </div>
                  <div className="text-left">
                    <h3 className="font-medium text-sm">{action.title}</h3>
                    <p className="text-xs text-gray-400">{action.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
