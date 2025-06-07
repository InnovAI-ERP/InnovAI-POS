import { X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Invoice } from '../types/invoice';
import { getUserSecurityCode } from '../services/sequenceService';

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  totals?: any;
}

const InvoicePreviewModal = ({ isOpen, onClose, invoice, totals }: InvoicePreviewModalProps) => {
  if (!isOpen || !invoice) return null;
  
  // Estado para almacenar la clave validada
  const [displayClave, setDisplayClave] = useState<string>('');
  
  // Función para obtener el texto del tipo de otro impuesto
  const getTipoOtroImpuesto = (codigo: string): string => {
    const tiposOtroImpuesto: Record<string, string> = {
      '02': 'ISC',
      '03': 'IUC',
      '04': 'IEBA',
      '05': 'IVEBS',
      '06': 'IPT',
      '07': 'IVA Esp.',
      '08': 'IVA BU',
      '12': 'IEC',
      '99': 'Otros'
    };
    return tiposOtroImpuesto[codigo] || codigo;
  };

  // Función para obtener el texto del tipo de otro cargo
  const getTipoOtroCargo = (codigo: string): string => {
    const tiposCargo: Record<string, string> = {
      '01': 'Servicios Especiales',
      '02': 'Servicios de Transporte',
      '03': 'Gastos de Embalaje',
      '04': 'Seguro de Transporte',
      '05': 'Comisiones',
      '06': 'Cargos por Intereses',
      '07': 'Cargos por Ajuste',
      '99': 'Otros Cargos'
    };
    return tiposCargo[codigo] || codigo;
  };

  // Verificar que la clave tenga el formato correcto según la lógica de sequenceService
  useEffect(() => {
    const validateKey = async () => {
      if (invoice) {
        // Verificar si la clave tiene los 50 dígitos requeridos
        if (invoice.clave && invoice.clave.length !== 50) {
          console.warn(`La clave tiene ${invoice.clave.length} dígitos, se esperan 50 dígitos.`);
        }
        
        // Establecer la clave para mostrarla en la interfaz
        setDisplayClave(invoice.clave || 'No disponible');
        if (invoice.emisor?.identificacion?.numero) {
          try {
            // Obtener el código de seguridad almacenado para este usuario/compañía
            const companyId = localStorage.getItem('currentCompanyId') || 'default';
            const securityCode = await getUserSecurityCode(companyId);
            
            // Verificar si la clave tiene el código de seguridad correcto
            const keySecurityCode = invoice.clave.slice(-8);
            
            if (keySecurityCode !== securityCode) {
              console.warn(`El código de seguridad en la clave (${keySecurityCode}) no coincide con el código almacenado (${securityCode})`);
              console.warn('Esto podría indicar que la clave no fue generada para esta empresa');
            }
          } catch (error) {
            console.error('Error al verificar el código de seguridad:', error);
          }
        }
      }
    };
    
    validateKey();
  }, [invoice]);

  // Determinar si es factura o tiquete basado en el número consecutivo
  const isTiquete = invoice.numeroConsecutivo?.startsWith('04');
  const documentType = isTiquete ? 'Tiquete' : 'Factura';
  
  // Validar el formato del número consecutivo (debe tener 20 dígitos)
  useEffect(() => {
    if (invoice.numeroConsecutivo) {
      if (invoice.numeroConsecutivo.length !== 20) {
        console.warn(`El número consecutivo tiene formato incorrecto: ${invoice.numeroConsecutivo}`);
        console.warn(`Longitud del consecutivo: ${invoice.numeroConsecutivo.length}, debería ser 20 dígitos`);
      }
      
      // Verificar que el tipo de documento en el número consecutivo sea coherente
      const tipoDocEnConsecutivo = invoice.numeroConsecutivo.substring(0, 2);
      if ((isTiquete && tipoDocEnConsecutivo !== '04') || (!isTiquete && tipoDocEnConsecutivo !== '01')) {
        console.warn(`El tipo de documento en el consecutivo (${tipoDocEnConsecutivo}) no coincide con el tipo de documento esperado (${isTiquete ? '04' : '01'})`);
      }
    }
  }, [invoice.numeroConsecutivo, isTiquete]);

  // Obtener los totales del invoice si no se proporcionaron explícitamente
  // Asegurar que siempre tengamos un objeto totals válido incluso si viene undefined
  const invoiceTotals = totals || invoice.resumenFactura || {
    totalComprobante: 0,
    totalVentaNeta: 0,
    totalImpuesto: 0,
    totalDescuentos: 0,
    totalExonerado: 0
  };
  
  // Formatear montos para mostrar
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CR', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };
  
  // Calcular subtotal (suma de todas las lineas)
  const calcularSubtotal = () => {
    return invoice.detalleServicio.reduce((total, item) => {
      return total + (item.subtotal || 0);
    }, 0);
  };
  
  // Calcular el total de impuestos (suma de todas las lineas)
  const calcularTotalImpuestos = () => {
    return invoice.detalleServicio.reduce((total, item) => {
      return total + (item.impuesto?.monto || 0);
    }, 0);
  };
  
  // Calcular el total de descuentos (suma de todos los descuentos)
  const calcularTotalDescuentos = () => {
    return invoice.detalleServicio.reduce((total, item) => {
      return total + (item.descuento?.montoDescuento || 0);
    }, 0);
  };
  
  // Calcular el total de exoneraciones
  const calcularTotalExoneraciones = () => {
    return invoice.detalleServicio.reduce((total, item) => {
      if (!item.impuesto?.exoneracion) return total;
      
      if (typeof item.impuesto.exoneracion.montoExoneracion === 'number' && item.impuesto.exoneracion.montoExoneracion > 0) {
        return total + item.impuesto.exoneracion.montoExoneracion;
      } else if (typeof item.impuesto.exoneracion.porcentajeExoneracion === 'number') {
        if (item.impuesto.exoneracion.porcentajeExoneracion === 100) {
          return total + (item.impuesto.monto || 0);
        } else {
          const porcentaje = item.impuesto.exoneracion.porcentajeExoneracion / 100;
          return total + ((item.impuesto.monto || 0) * porcentaje);
        }
      }
      return total;
    }, 0);
  };
  
  // Calcular todos los totales
  const subtotal = calcularSubtotal();
  const totalImpuestos = calcularTotalImpuestos();
  const totalDescuentos = calcularTotalDescuentos();
  const totalExoneraciones = calcularTotalExoneraciones();
  const hayExoneraciones = totalExoneraciones > 0;
  
  // Calcular el total de otros cargos si existen
  const calcularTotalOtrosCargos = () => {
    if (!invoice.otrosCargos || invoice.otrosCargos.length === 0) return 0;
    return invoice.otrosCargos.reduce((total, cargo) => {
      return total + (cargo.montoCargo || 0);
    }, 0);
  };
  
  const totalOtrosCargos = calcularTotalOtrosCargos();
  const hayOtrosCargos = totalOtrosCargos > 0;
  
  // Calcular el total final usando la fórmula: Total = Subtotal - Descuento + Impuesto - Exoneracion + OtrosCargos
  const calcularTotalFinal = () => {
    // Fórmula actualizada incluyendo Otros Cargos
    return subtotal - totalDescuentos + totalImpuestos - totalExoneraciones + totalOtrosCargos;
  };
  
  const totalFinal = calcularTotalFinal();

  // Formatear fecha
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CR');
  };

  // Mapeo de condición de venta
  const condicionVentaMap: Record<string, string> = {
    '01': 'Contado',
    '02': 'Crédito',
    '03': 'Consignación',
    '04': 'Apartado',
    '05': 'Arrendamiento con opción de compra',
    '06': 'Arrendamiento en función financiera',
    '07': 'Cobro a favor de un tercero',
    '08': 'Servicios prestados al Estado',
    '09': 'Pago de servicios prestado al Estado',
    '10': 'Venta a crédito en IVA hasta 90 días (Artículo 27, LIVA)',
    '11': 'Pago de venta a crédito en IVA hasta 90 días (Artículo 27, LIVA)',
    '12': 'Venta Mercancía No Nacionalizada',
    '13': 'Venta Bienes Usados No Contribuyente',
    '14': 'Arrendamiento Operativo',
    '15': 'Arrendamiento Financiero',
    '99': 'Otros'
  };

  // Mapeo de medio de pago
  const medioPagoMap: Record<string, string> = {
    '01': 'Efectivo',
    '02': 'Tarjeta',
    '03': 'Cheque',
    '04': 'Transferencia – depósito bancario',
    '05': 'Recaudado por terceros',
    '06': 'SINPE MOVIL',
    '07': 'Plataforma Digital',
    '99': 'Otros'
  };

  return (
    <div className="modal-overlay z-50" style={{backgroundColor: 'rgba(0, 0, 0, 0.7)'}}>
      <div className="modal max-w-4xl shadow-xl rounded-lg" style={{backgroundColor: '#f5f5f5', color: '#111', padding: '20px'}}>
        <div className="flex justify-between items-center mb-4" style={{borderBottom: '1px solid #ddd', paddingBottom: '10px'}}>
          <h2 style={{fontSize: '1.25rem', fontWeight: 'bold', color: '#111'}}>{documentType} {invoice.numeroConsecutivo}</h2>
          <button 
            onClick={onClose} 
            style={{padding: '6px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '4px'}}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem', color: '#333'}}>
          {/* Información General */}
          <div style={{backgroundColor: '#fff', padding: '15px', borderRadius: '5px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)'}}>
            <h3 style={{fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '10px', color: '#111'}}>Información General</h3>
            <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
              <div>
                <span style={{color: '#555', marginRight: '4px'}}>Cliente: </span>
                <span style={{fontWeight: '500'}}>{invoice.receptor.nombre}</span>
              </div>
              <div>
                <span style={{color: '#555', marginRight: '4px'}}>Fecha: </span>
                <span style={{fontWeight: '500'}}>{formatDate(invoice.fechaEmision)}</span>
              </div>
              <div>
                <span style={{color: '#555', marginRight: '4px'}}>Estado: </span>
                <span style={{display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '500', backgroundColor: '#fef9c3', color: '#854d0e'}}>
                  Pendiente
                </span>
              </div>
              <div>
                <span style={{color: '#555', marginRight: '4px'}}>Monto Total: </span>
                <span style={{fontWeight: 'bold'}}>{formatCurrency(invoiceTotals?.totalComprobante || 0)}</span>
              </div>
            </div>
          </div>

          {/* Detalles Técnicos */}
          <div style={{backgroundColor: '#fff', padding: '15px', borderRadius: '5px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)'}}>
            <h3 style={{fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '10px', color: '#111'}}>Detalles Técnicos</h3>
            <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
              <div style={{fontSize: '0.75rem', color: '#444', wordBreak: 'break-all'}}>
                <p><strong>Clave numérica:</strong> <span style={{fontFamily: 'monospace', wordBreak: 'break-all'}}>{displayClave}</span></p>
                {displayClave && displayClave.length !== 50 && (
                  <p className="text-sm text-red-500">
                    La clave no tiene el formato de 50 dígitos requerido por Hacienda.
                    {displayClave && <span> Longitud actual: {displayClave.length} dígitos.</span>}
                  </p>
                )}
              </div>
              <div>
                <span style={{color: '#555', marginRight: '4px'}}>Condición de Venta: </span>
                <span style={{fontWeight: '500'}}>{condicionVentaMap[invoice.condicionVenta] || invoice.condicionVenta}</span>
              </div>
              <div>
                <span style={{color: '#555', marginRight: '4px'}}>Medio de Pago: </span>
                <span style={{fontWeight: '500'}}>
                  {invoice.medioPago.map(mp => medioPagoMap[mp] || mp).join(', ')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Detalle de Servicios */}
        <div style={{marginTop: '32px'}}>
          <h3 style={{fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '10px', color: '#111'}}>Detalle de Productos y Servicios</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{backgroundColor: '#fff', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
              <thead style={{backgroundColor: '#eee', borderBottom: '2px solid #ddd'}}>
                <tr>
                  <th className="text-left py-2 px-2" style={{color: '#333', fontWeight: 'bold', width: '8%'}}>Código</th>
                  <th className="text-left py-2 px-2" style={{color: '#333', fontWeight: 'bold', width: '24%'}}>Descripción</th>
                  <th className="text-left py-2 px-2" style={{color: '#333', fontWeight: 'bold', width: '8%'}}>Cantidad</th>
                  <th className="text-left py-2 px-2" style={{color: '#333', fontWeight: 'bold', width: '10%'}}>Precio Unit.</th>
                  <th className="text-left py-2 px-2" style={{color: '#333', fontWeight: 'bold', width: '8%'}}>Tipo IVA</th>
                  <th className="text-left py-2 px-2" style={{color: '#333', fontWeight: 'bold', width: '10%'}}>Exoneración</th>
                  <th className="text-left py-2 px-2" style={{color: '#333', fontWeight: 'bold', width: '12%'}}>Otros Imp.</th>
                  <th className="text-left py-2 px-2" style={{color: '#333', fontWeight: 'bold', width: '8%'}}>Descuento</th>
                  <th className="text-right py-2 px-2" style={{color: '#333', fontWeight: 'bold', width: '10%'}}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {invoice.detalleServicio.map((item, index) => {
                  // Obtener información de IVA
                  const tipoIVA = item.impuesto ? `${item.impuesto.tarifa}%` : 'Exento';
                  
                  // Calcular subtotal (precio * cantidad - descuento)
                  const subtotal = item.subtotal || 0;
                  
                  // Obtener descuento si existe
                  const descuento = item.descuento?.montoDescuento || 0;
                  
                  // Obtener información de exoneración
                  const tieneExoneracion = item.impuesto?.exoneracion !== undefined;
                  let exoneracionInfo: React.ReactNode = '-';
                  
                  if (tieneExoneracion && item.impuesto?.exoneracion) {
                    const tipoDoc = item.impuesto.exoneracion.tipoDocumento;
                    const porcentaje = item.impuesto.exoneracion.porcentajeExoneracion;
                    const montoExon = item.impuesto.exoneracion.montoExoneracion || 0;
                    
                    // Mapeo de tipos de documento de exoneración
                    const tiposDocExoneracion: Record<string, string> = {
                      '01': 'DGT',
                      '02': 'Diplomáticos', 
                      '03': 'Ley esp.',
                      '04': 'DGH Aut. Gen.',
                      '05': 'Trans. V', 
                      '06': 'ICT', 
                      '07': 'Trans. XVII',
                      '08': 'Z. Franca',
                      '09': 'Export. Art 11',
                      '10': 'Municipales',
                      '11': 'DGH Aut. Local',
                      '99': 'Otros'
                    };
                    
                    exoneracionInfo = (
                      <div style={{backgroundColor: '#f0fdf4', padding: '3px 5px', borderRadius: '4px', border: '1px solid #dcfce7'}}>
                        <div style={{fontWeight: '700', color: '#059669'}}>{porcentaje}%</div>
                        <div style={{fontSize: '0.7rem', color: '#166534'}}>{tipoDoc && tiposDocExoneracion[tipoDoc] || tipoDoc || 'N/A'}</div>
                        <div style={{fontSize: '0.7rem', fontWeight: '500', color: '#059669'}}>{formatCurrency(montoExon)}</div>
                      </div>
                    );
                  }
                  
                  // Formatear la unidad de medida para mostrarla correctamente
                  const unidadMedida = item.unidadMedida || 'Sp';
                  
                  return (
                    <tr key={index} style={{borderBottom: '1px solid #ddd', backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9'}}>
                      <td className="py-2 px-2" style={{color: '#333', fontSize: '0.85rem'}}>{item.codigoCabys}</td>
                      <td className="py-2 px-2" style={{color: '#333'}}>{item.detalle}</td>
                      <td className="py-2 px-2" style={{color: '#333'}}>
                        <span>{item.cantidad}</span>
                        <span style={{marginLeft: '3px', fontSize: '0.8rem', color: '#555'}}>{unidadMedida}</span>
                      </td>
                      <td className="py-2 px-2" style={{color: '#333'}}>{formatCurrency(item.precioUnitario)}</td>
                      <td className="py-2 px-2" style={{color: '#333'}}>{tipoIVA}</td>
                      <td className="py-2 px-2" style={{color: '#333'}}>{exoneracionInfo}</td>
                      <td className="py-2 px-2" style={{color: '#333'}}>
                        {item.otroImpuesto ? (
                          <div style={{backgroundColor: '#fbf3e4', padding: '3px 5px', borderRadius: '4px', border: '1px solid #f2e0c4'}}>
                            <div style={{fontWeight: '700', color: '#b45309'}}>{getTipoOtroImpuesto(item.otroImpuesto)}</div>
                            {item.porcentajeOtroImpuesto !== undefined && (
                              <div style={{fontSize: '0.7rem', color: '#92400e'}}>{item.porcentajeOtroImpuesto}%</div>
                            )}
                            {item.tarifaOtroImpuesto !== undefined && (
                              <div style={{fontSize: '0.7rem', fontWeight: '500', color: '#b45309'}}>{formatCurrency(item.tarifaOtroImpuesto)}</div>
                            )}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="py-2 px-2" style={{color: '#333'}}>
                        {descuento > 0 ? formatCurrency(descuento) : '-'}
                      </td>
                      <td className="text-right py-2 px-2" style={{color: '#333', fontWeight: '500'}}>{formatCurrency(subtotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Otros Cargos */}
        {invoice.otrosCargos && invoice.otrosCargos.length > 0 && (
          <div style={{marginTop: '32px'}}>
            <h3 style={{fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '10px', color: '#111'}}>Otros Cargos</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{backgroundColor: '#fff', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
                <thead style={{backgroundColor: '#eee', borderBottom: '2px solid #ddd'}}>
                  <tr>
                    <th className="text-left py-2 px-2" style={{color: '#333', fontWeight: 'bold', width: '20%'}}>Tipo Cargo</th>
                    <th className="text-left py-2 px-2" style={{color: '#333', fontWeight: 'bold', width: '50%'}}>Descripción</th>
                    <th className="text-right py-2 px-2" style={{color: '#333', fontWeight: 'bold', width: '15%'}}>Porcentaje</th>
                    <th className="text-right py-2 px-2" style={{color: '#333', fontWeight: 'bold', width: '15%'}}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.otrosCargos.map((cargo, index) => (
                    <tr key={`otro-cargo-${index}`} style={{borderBottom: '1px solid #ddd', backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9'}}>
                      <td className="py-2 px-2" style={{color: '#333', fontSize: '0.85rem'}}>{getTipoOtroCargo(cargo.tipoCargo)}</td>
                      <td className="py-2 px-2" style={{color: '#333'}}>{cargo.descripcionCargo}</td>
                      <td className="text-right py-2 px-2" style={{color: '#333'}}>{cargo.porcentaje ? `${cargo.porcentaje.toFixed(2)}%` : '-'}</td>
                      <td className="text-right py-2 px-2" style={{color: '#333', fontWeight: '500'}}>{formatCurrency(cargo.montoCargo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}



        {/* Totales */}
        <div style={{marginTop: '24px', display: 'flex', justifyContent: 'flex-end'}}>
          <div style={{width: '280px', backgroundColor: '#fff', padding: '15px', borderRadius: '5px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px'}}>
              <span style={{color: '#555'}}>Subtotal:</span>
              <span style={{color: '#333'}}>{formatCurrency(subtotal)}</span>
            </div>
            {/* Mostrar descuentos si hay */}
            {totalDescuentos > 0 && (
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px'}}>
                <span style={{color: '#555'}}>Descuentos:</span>
                <span style={{color: '#333'}}>{formatCurrency(totalDescuentos)}</span>
              </div>
            )}
            {/* Mostrar otros cargos si hay */}
            {hayOtrosCargos && (
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px'}}>
                <span style={{color: '#555'}}>Total Otros Cargos:</span>
                <span style={{color: '#333'}}>{formatCurrency(totalOtrosCargos)}</span>
              </div>
            )}
            {/* Mostrar siempre el impuesto completo (sin restar exoneración) */}
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px'}}>
              <span style={{color: '#555'}}>Impuestos:</span>
              <span style={{color: '#333', fontWeight: '500'}}>{formatCurrency(totalImpuestos)}</span>
            </div>
            {/* Sección de Exoneración */}
            {hayExoneraciones && (
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px', backgroundColor: '#f0fdf4', padding: '6px 8px', borderRadius: '4px', border: '1px solid #dcfce7'}}>
                <span style={{color: '#059669', fontWeight: '600'}}>Exoneración:</span>
                <span style={{color: '#059669', fontWeight: '700'}}>-{formatCurrency(totalExoneraciones)}</span>
              </div>
            )}
            

            {/* Total final basado en la fórmula: Total = Subtotal - Descuento + Impuesto - Exoneracion + OtrosCargos */}
            <div style={{display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #ddd', paddingTop: '8px', marginTop: '8px'}}>
              <span style={{fontWeight: '600', color: '#333'}}>Total:</span>
              <span style={{fontWeight: 'bold', color: '#333'}}>{formatCurrency(totalFinal)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePreviewModal;
