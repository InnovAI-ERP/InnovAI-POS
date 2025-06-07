import { useState, useEffect } from 'react';
import { Search, FileText, Download, Eye, Trash, ArrowDownUp, Filter, AlertCircle, Mail, MailCheck, MailX } from 'lucide-react';
import { useInvoiceHistory, StoredInvoice } from '../hooks/useInvoiceHistory';

const InvoiceHistory = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterEmailStatus, setFilterEmailStatus] = useState('all');
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedInvoice, setSelectedInvoice] = useState<StoredInvoice | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Usar el hook para obtener las facturas almacenadas
  const { invoices, loading, updateInvoiceStatus, updateInvoiceEmailInfo, deleteInvoice } = useInvoiceHistory();
  
  // Añadir información de correo electrónico a las facturas existentes (solo para demostración)
  useEffect(() => {
    if (!loading && invoices.length > 0) {
      // Verificar si ya se han añadido datos de correo (para evitar duplicados)
      const needsEmailInfo = invoices.some(inv => !inv.emailInfo);
      
      if (needsEmailInfo) {
        // Añadir información de correo a algunas facturas
        invoices.forEach((invoice, index) => {
          if (!invoice.emailInfo && index < 5) { // Solo a las primeras 5 facturas
            const estadoOptions: Array<'Enviado' | 'Fallido' | 'Pendiente'> = ['Enviado', 'Fallido', 'Pendiente'];
            const randomEstado = estadoOptions[Math.floor(Math.random() * estadoOptions.length)];
            
            const emailInfo = {
              destinatario: invoice.client.includes('@') ? 
                invoice.client : 
                `cliente_${invoice.id.replace(/\D/g, '')}@ejemplo.com`,
              fechaEnvio: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toISOString(), // Fecha aleatoria en la última semana
              estadoEnvio: randomEstado,
              intentos: Math.floor(Math.random() * 3) + 1,
              mensajeError: randomEstado === 'Fallido' ? 'Error de conexión con el servidor de correo' : undefined
            };
            
            updateInvoiceEmailInfo(invoice.id, emailInfo);
          }
        });
      }
    }
  }, [loading, invoices, updateInvoiceEmailInfo]);
  
  // Usar siempre las facturas reales del sistema
  const invoiceData = invoices;
  
  // Filter and sort invoices
  const filteredInvoices = invoiceData
    .filter(invoice => {
      // Filter by search term
      const matchesSearch = 
        invoice.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
        invoice.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (invoice.emailInfo?.destinatario && invoice.emailInfo.destinatario.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Filter by invoice status
      const matchesStatus = 
        filterStatus === 'all' || 
        invoice.status.toLowerCase() === filterStatus.toLowerCase();
      
      // Filter by email status
      const matchesEmailStatus = 
        filterEmailStatus === 'all' || 
        !invoice.emailInfo || 
        (filterEmailStatus === 'enviado' && invoice.emailInfo.estadoEnvio === 'Enviado') ||
        (filterEmailStatus === 'fallido' && invoice.emailInfo.estadoEnvio === 'Fallido') ||
        (filterEmailStatus === 'pendiente' && invoice.emailInfo.estadoEnvio === 'Pendiente') ||
        (filterEmailStatus === 'no-enviado' && !invoice.emailInfo);
      
      return matchesSearch && matchesStatus && matchesEmailStatus;
    })
    .sort((a, b) => {
      // Sort by selected field
      let comparison = 0;
      
      switch (sortField) {
        case 'id':
          comparison = a.id.localeCompare(b.id);
          break;
        case 'client':
          comparison = a.client.localeCompare(b.client);
          break;
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'amount':
          comparison = parseFloat(a.amount.replace(/[^\d.-]/g, '')) - parseFloat(b.amount.replace(/[^\d.-]/g, ''));
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'email':
          // Ordenar por estado de correo electrónico
          const emailStatusA = a.emailInfo?.estadoEnvio || 'No enviado';
          const emailStatusB = b.emailInfo?.estadoEnvio || 'No enviado';
          comparison = emailStatusA.localeCompare(emailStatusB);
          break;
        default:
          comparison = 0;
      }
      
      // Apply sort direction
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  
  // Handle sort toggle
  const handleSort = (field: string) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl title-primary">Historial de Facturas</h1>
      </div>
      
      {/* Filters and Search */}
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar por número, cliente o correo..." 
              className="form-input pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select 
                className="form-select pl-10 min-w-32"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">Todos los estados</option>
                <option value="completada">Completada</option>
                <option value="pendiente">Pendiente</option>
                <option value="rechazada">Rechazada</option>
              </select>
            </div>
            
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select 
                className="form-select pl-10 min-w-32"
                value={filterEmailStatus}
                onChange={(e) => setFilterEmailStatus(e.target.value)}
              >
                <option value="all">Todos los correos</option>
                <option value="enviado">Enviados</option>
                <option value="pendiente">Pendientes</option>
                <option value="fallido">Fallidos</option>
                <option value="no-enviado">No enviados</option>
              </select>
            </div>
            
            <button className="btn-ghost">
              <ArrowDownUp className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Ordenar</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Invoices Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th 
                  className="table-header cursor-pointer hover:bg-primary-600/40 transition-colors"
                  onClick={() => handleSort('id')}
                >
                  <div className="flex items-center space-x-1">
                    <span className="table-title"># Factura</span>
                    {sortField === 'id' && (
                      <ArrowDownUp className={`w-3 h-3 ${sortDirection === 'desc' ? 'transform rotate-180' : ''}`} />
                    )}
                  </div>
                </th>
                <th 
                  className="table-header cursor-pointer hover:bg-primary-600/40 transition-colors"
                  onClick={() => handleSort('client')}
                >
                  <div className="flex items-center space-x-1">
                    <span className="table-title">Cliente</span>
                    {sortField === 'client' && (
                      <ArrowDownUp className={`w-3 h-3 ${sortDirection === 'desc' ? 'transform rotate-180' : ''}`} />
                    )}
                  </div>
                </th>
                <th 
                  className="table-header cursor-pointer hover:bg-primary-600/40 transition-colors"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center space-x-1">
                    <span className="table-title">Fecha</span>
                    {sortField === 'date' && (
                      <ArrowDownUp className={`w-3 h-3 ${sortDirection === 'desc' ? 'transform rotate-180' : ''}`} />
                    )}
                  </div>
                </th>
                <th className="table-header table-title">Items</th>
                <th 
                  className="table-header cursor-pointer hover:bg-primary-600/40 transition-colors"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center space-x-1">
                    <span className="table-title">Monto</span>
                    {sortField === 'amount' && (
                      <ArrowDownUp className={`w-3 h-3 ${sortDirection === 'desc' ? 'transform rotate-180' : ''}`} />
                    )}
                  </div>
                </th>
                <th 
                  className="table-header cursor-pointer hover:bg-primary-600/40 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Estado</span>
                    {sortField === 'status' && (
                      <ArrowDownUp className={`w-3 h-3 ${sortDirection === 'desc' ? 'transform rotate-180' : ''}`} />
                    )}
                  </div>
                </th>
                <th 
                  className="table-header cursor-pointer hover:bg-primary-600/40 transition-colors"
                  onClick={() => handleSort('email')}
                >
                  <div className="flex items-center space-x-1">
                    <span className="table-title">Correo</span>
                    {sortField === 'email' && (
                      <ArrowDownUp className={`w-3 h-3 ${sortDirection === 'desc' ? 'transform rotate-180' : ''}`} />
                    )}
                  </div>
                </th>
                <th className="table-header">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((invoice, index) => (
                  <tr key={index} className="table-row">
                    <td className="table-cell font-medium">{invoice.id}</td>
                    <td className="table-cell">{invoice.client}</td>
                    <td className="table-cell">{new Date(invoice.date).toLocaleDateString()}</td>
                    <td className="table-cell">{invoice.items}</td>
                    <td className="table-cell">{invoice.amount}</td>
                    <td className="table-cell">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        invoice.status === 'Completada' ? 'bg-green-500/20 text-green-400' :
                        invoice.status === 'Pendiente' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="table-cell">
                      {invoice.emailInfo ? (
                        <div className="flex items-center">
                          {invoice.emailInfo.estadoEnvio === 'Enviado' ? (
                            <MailCheck className="w-4 h-4 text-green-400 mr-1" />
                          ) : invoice.emailInfo.estadoEnvio === 'Fallido' ? (
                            <MailX className="w-4 h-4 text-red-400 mr-1" />
                          ) : (
                            <Mail className="w-4 h-4 text-yellow-400 mr-1" />
                          )}
                          <span className="text-xs truncate max-w-24" title={invoice.emailInfo.destinatario}>
                            {invoice.emailInfo.destinatario}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No enviado</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="flex space-x-1">
                        <button 
                          className="p-1.5 rounded-md bg-primary-500/20 text-primary-400 hover:bg-primary-500/40 transition-colors"
                          title="Ver factura"
                          onClick={() => {
                            setSelectedInvoice({
                              ...invoice,
                              condicionVenta: invoice.condicionVenta || '01', // Default to "Contado"
                              medioPago: invoice.medioPago || ['01'], // Default to "Efectivo" 
                              detalleServicio: invoice.detalleServicio || [], // Empty array for services detail
                              subtotal: invoice.subtotal || 0,
                              impuesto: invoice.impuesto || 0,
                              total: invoice.total || parseFloat(invoice.amount.replace(/[^\d.-]/g, '')),
                              status: invoice.status as "Completada" | "Pendiente" | "Rechazada",
                              emailInfo: invoice.emailInfo
                            });
                            setIsModalOpen(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-1.5 rounded-md bg-secondary-500/20 text-secondary-400 hover:bg-secondary-500/40 transition-colors"
                          title="Descargar PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-1.5 rounded-md bg-purple-500/20 text-purple-400 hover:bg-purple-500/40 transition-colors"
                          title="Descargar XML"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-1.5 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-colors"
                          title="Eliminar"
                          onClick={() => {
                            if (window.confirm('¿Está seguro que desea eliminar esta factura?')) {
                              deleteInvoice(invoice.id);
                            }
                          }}
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="table-cell text-center py-8 text-gray-400">
                    No se encontraron facturas que coincidan con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700">
          <div className="text-sm text-gray-400">
            Mostrando <span className="font-medium text-white">{filteredInvoices.length}</span> de <span className="font-medium text-white">{invoices.length}</span> facturas
          </div>
          
          <div className="flex space-x-1">
            <button className="px-3 py-1 rounded-md bg-dark-400 hover:bg-dark-300 text-gray-300 text-sm transition-colors">
              Anterior
            </button>
            <button className="px-3 py-1 rounded-md bg-primary-500 text-white text-sm transition-colors">
              1
            </button>
            <button className="px-3 py-1 rounded-md bg-dark-400 hover:bg-dark-300 text-gray-300 text-sm transition-colors">
              2
            </button>
            <button className="px-3 py-1 rounded-md bg-dark-400 hover:bg-dark-300 text-gray-300 text-sm transition-colors">
              3
            </button>
            <button className="px-3 py-1 rounded-md bg-dark-400 hover:bg-dark-300 text-gray-300 text-sm transition-colors">
              Siguiente
            </button>
          </div>
        </div>
      </div>
      
      {/* Invoice Preview Modal */}
      {isModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-4xl max-h-[90vh] overflow-y-auto p-0">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Factura {selectedInvoice.id}</h2>
              <button 
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                onClick={() => setIsModalOpen(false)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-lg font-medium mb-2">Información General</h3>
                  <div className="space-y-2">
                    <p><span className="text-gray-400">Cliente:</span> {selectedInvoice.client}</p>
                    <p><span className="text-gray-400">Fecha:</span> {new Date(selectedInvoice.date).toLocaleDateString()}</p>
                    <p><span className="text-gray-400">Estado:</span> 
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ml-2 ${
                        selectedInvoice.status === 'Completada' ? 'bg-green-500/20 text-green-400' :
                        selectedInvoice.status === 'Pendiente' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {selectedInvoice.status}
                      </span>
                    </p>
                    <p><span className="text-gray-400">Monto Total:</span> {selectedInvoice.amount}</p>
                  </div>
                </div>
                                <div>
                  <h3 className="text-lg font-medium mb-2">Detalles Técnicos</h3>
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 break-all"><span className="text-gray-300">Clave Numérica:</span> {selectedInvoice.claveNumerica}</p>
                    <p><span className="text-gray-400">Condición de Venta:</span> {
                      selectedInvoice.condicionVenta === '01' ? 'Contado' : 
                      selectedInvoice.condicionVenta === '02' ? 'Crédito' : 
                      selectedInvoice.condicionVenta
                    }</p>
                    <p><span className="text-gray-400">Medio de Pago:</span> {
                      selectedInvoice.medioPago?.map(medio => 
                        medio === '01' ? 'Efectivo' :
                        medio === '02' ? 'Tarjeta' :
                        medio === '03' ? 'Cheque' :
                        medio === '04' ? 'Transferencia' : medio
                      ).join(', ')
                    }</p>
                    {/* Mostrar moneda y tipo de cambio si están disponibles */}
                    <p>
                      <span className="text-gray-400">Moneda:</span> 
                      <span className="ml-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-md text-xs font-medium">
                        {/* Mostrar etiqueta de moneda basándonos en la moneda de la factura */}
                        {selectedInvoice.moneda === 'USD' ? 'Dólares (USD)' : 
                         selectedInvoice.moneda === 'EUR' ? 'Euros (EUR)' : 
                         'Colones (CRC)'}
                      </span>
                    </p>
                    {selectedInvoice.moneda !== 'CRC' && (
                      <p>
                        <span className="text-gray-400">Tipo de Cambio:</span> 
                        <span className="ml-1">
                          {selectedInvoice.tipoCambio ? 
                            `₡${typeof selectedInvoice.tipoCambio === 'number' ? 
                              selectedInvoice.tipoCambio.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 
                              parseFloat(selectedInvoice.tipoCambio).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 
                            'No disponible'}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Información de Correo Electrónico */}
              {selectedInvoice.emailInfo && (
                <div className="border-t border-gray-700 pt-4">
                  <h3 className="text-lg font-medium mb-2">Información de Envío por Correo</h3>
                  <div className="glass-card p-4 space-y-2">
                    <div className="flex items-center">
                      {selectedInvoice.emailInfo.estadoEnvio === 'Enviado' ? (
                        <MailCheck className="w-5 h-5 text-green-400 mr-2" />
                      ) : selectedInvoice.emailInfo.estadoEnvio === 'Fallido' ? (
                        <MailX className="w-5 h-5 text-red-400 mr-2" />
                      ) : (
                        <Mail className="w-5 h-5 text-yellow-400 mr-2" />
                      )}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        selectedInvoice.emailInfo.estadoEnvio === 'Enviado' ? 'bg-green-500/20 text-green-400' :
                        selectedInvoice.emailInfo.estadoEnvio === 'Pendiente' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {selectedInvoice.emailInfo.estadoEnvio}
                      </span>
                    </div>
                    <p><span className="text-gray-400">Destinatario:</span> {selectedInvoice.emailInfo.destinatario}</p>
                    <p><span className="text-gray-400">Fecha de Envío:</span> {new Date(selectedInvoice.emailInfo.fechaEnvio).toLocaleString()}</p>
                    <p><span className="text-gray-400">Intentos:</span> {selectedInvoice.emailInfo.intentos}</p>
                    {selectedInvoice.emailInfo.mensajeError && (
                      <div>
                        <p className="text-gray-400">Mensaje de Error:</p>
                        <p className="text-red-400 text-sm bg-red-400/10 p-2 rounded mt-1">{selectedInvoice.emailInfo.mensajeError}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div>
                <h3 className="text-lg font-medium mb-2">Detalle de Servicios</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left">
                        <th className="table-header">Código</th>
                        <th className="table-header">Descripción</th>
                        <th className="table-header">Cantidad</th>
                        <th className="table-header">Precio Unit.</th>
                        <th className="table-header">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.detalleServicio?.map((item, idx) => (
                        <tr key={idx} className="table-row">
                          <td className="table-cell">{item.codigoCabys}</td>
                          <td className="table-cell">{item.detalle}</td>
                          <td className="table-cell">{item.cantidad}</td>
                          <td className="table-cell">₡{item.precioUnitario.toLocaleString()}</td>
                          <td className="table-cell">₡{item.subtotal.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-700">
                        <td colSpan={4} className="table-cell text-right font-medium">Subtotal:</td>
                        <td className="table-cell font-medium">₡{selectedInvoice.subtotal?.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="table-cell text-right font-medium">Impuesto:</td>
                        <td className="table-cell font-medium">₡{selectedInvoice.impuesto?.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="table-cell text-right font-medium">Total:</td>
                        <td className="table-cell font-medium">₡{selectedInvoice.total?.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-700 flex justify-end space-x-3">
              <button 
                className="btn-ghost"
                onClick={() => setIsModalOpen(false)}
              >
                Cerrar
              </button>
              {selectedInvoice.emailInfo ? (
                <button 
                  className="btn-primary flex items-center"
                  onClick={() => {
                    // Simular reenvío de correo
                    const newEmailInfo = {
                      ...selectedInvoice.emailInfo,
                      fechaEnvio: new Date().toISOString(),
                      intentos: selectedInvoice.emailInfo?.intentos ? selectedInvoice.emailInfo.intentos + 1 : 1,
                      estadoEnvio: 'Pendiente' as 'Enviado' | 'Fallido' | 'Pendiente'
                    };
                    updateInvoiceEmailInfo(selectedInvoice.id, newEmailInfo);
                    alert('Correo reenviado. El estado se actualizará en breve.');
                    
                    // Simular actualización automática del estado después de un tiempo
                    setTimeout(() => {
                      const resultado = Math.random() > 0.3 ? 'Enviado' : 'Fallido';
                      const mensajeError = resultado === 'Fallido' ? 'Error de conexión con el servidor de correo' : undefined;
                      
                      updateInvoiceEmailInfo(selectedInvoice.id, {
                        ...newEmailInfo,
                        estadoEnvio: resultado as 'Enviado' | 'Fallido' | 'Pendiente',
                        mensajeError
                      });
                    }, 3000);
                  }}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Reenviar Correo
                </button>
              ) : (
                <button 
                  className="btn-primary flex items-center"
                  onClick={() => {
                    // Simular envío inicial de correo
                    const emailInfo = {
                      destinatario: selectedInvoice.client.includes('@') ? 
                        selectedInvoice.client : 
                        `cliente_${selectedInvoice.id.replace(/\D/g, '')}@ejemplo.com`,
                      fechaEnvio: new Date().toISOString(),
                      estadoEnvio: 'Pendiente' as 'Enviado' | 'Fallido' | 'Pendiente',
                      intentos: 1
                    };
                    updateInvoiceEmailInfo(selectedInvoice.id, emailInfo);
                    alert('Correo enviado. El estado se actualizará en breve.');
                    
                    // Simular actualización automática del estado después de un tiempo
                    setTimeout(() => {
                      const resultado = Math.random() > 0.3 ? 'Enviado' : 'Fallido';
                      const mensajeError = resultado === 'Fallido' ? 'Error de conexión con el servidor de correo' : undefined;
                      
                      updateInvoiceEmailInfo(selectedInvoice.id, {
                        ...emailInfo,
                        estadoEnvio: resultado as 'Enviado' | 'Fallido' | 'Pendiente',
                        mensajeError
                      });
                    }, 3000);
                  }}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Enviar por Correo
                </button>
              )}
              <button className="btn-secondary flex items-center">
                <Download className="w-4 h-4 mr-2" />
                Descargar PDF
              </button>
              <button className="btn-secondary flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Descargar XML
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Loading state */}
      {loading && (
        <div className="glass-card p-8 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mb-4"></div>
          <p className="text-gray-400">Cargando facturas...</p>
        </div>
      )}
      
      {/* Empty state */}
      {!loading && invoices.length === 0 && (
        <div className="glass-card p-8 flex flex-col items-center justify-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-400 text-center">No hay facturas guardadas en el sistema.</p>
          <p className="text-gray-500 text-center text-sm mt-2">Las facturas que generes aparecerán aquí automáticamente.</p>
        </div>
      )}
    </div>
  );
};

export default InvoiceHistory;