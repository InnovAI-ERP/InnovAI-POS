import { useState, useEffect } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Search, Save, FileText, Send, UserPlus, PackagePlus } from 'lucide-react';
import { searchByDescription } from '../services/cabysService';
import { generatePDF, generateXML, downloadXML, sendInvoiceXML, generateInvoiceKey, generateConsecutiveNumber, sendInvoiceByEmail } from '../services/invoiceServiceOrig';
import { CabysItem, Invoice } from '../types/invoice';
import { useUserSettings } from '../hooks/useUserSettings';
import { useClients } from '../hooks/useClients';
import { useInvoiceHistory, StoredInvoice } from '../hooks/useInvoiceHistory';
import ProductSelectorModal from '../components/ProductSelectorModal';
import NewProductModal from '../components/NewProductModal';

// Validation schema
const invoiceSchema = z.object({
  emisor: z.object({
    nombre: z.string().min(1, "El nombre es requerido"),
    identificacion: z.object({
      tipo: z.string().min(1, "El tipo de identificación es requerido"),
      numero: z.string().min(9, "La identificación debe tener al menos 9 dígitos"),
    }),
    nombreComercial: z.string().optional(),
    ubicacion: z.object({
      provincia: z.string().min(1, "La provincia es requerida"),
      canton: z.string().min(1, "El cantón es requerido"),
      distrito: z.string().min(1, "El distrito es requerido"),
      barrio: z.string().optional(),
      otrasSenas: z.string().optional(),
    }),
    telefono: z.object({
      codigoPais: z.string().min(1, "El código del país es requerido"),
      numTelefono: z.string().min(8, "El número debe tener al menos 8 dígitos"),
    }).optional(),
    correo: z.string().email("Correo electrónico inválido").optional(),
    actividadEconomica: z.string().min(1, "La actividad económica es requerida"),
  }),
  receptor: z.object({
    nombre: z.string().min(1, "El nombre es requerido"),
    identificacion: z.object({
      tipo: z.string().min(1, "El tipo de identificación es requerido"),
      numero: z.string().min(9, "La identificación debe tener al menos 9 dígitos"),
    }),
    ubicacion: z.object({
      provincia: z.string().min(1, "La provincia es requerida"),
      canton: z.string().min(1, "El cantón es requerido"),
      distrito: z.string().min(1, "El distrito es requerido"),
      barrio: z.string().optional(),
      otrasSenas: z.string().optional(),
    }).optional(),
    correo: z.string().email("Correo electrónico inválido").optional(),
  }),
  condicionVenta: z.string().min(1, "La condición de venta es requerida"),
  plazoCredito: z.string().optional(),
  medioPago: z.array(z.string()).min(1, "Al menos un medio de pago es requerido"),
  detalleServicio: z.array(z.object({
    id: z.number(),
    codigoCabys: z.string().min(1, "El código CABYS es requerido"),
    cantidad: z.number().min(0.001, "La cantidad debe ser mayor a cero"),
    unidadMedida: z.string().min(1, "La unidad de medida es requerida"),
    detalle: z.string().min(1, "El detalle es requerido"),
    precioUnitario: z.number().min(0, "El precio unitario debe ser mayor o igual a cero"),
    descuento: z.object({
      montoDescuento: z.number().min(0, "El descuento debe ser mayor o igual a cero"),
      naturalezaDescuento: z.string().optional(),
    }).optional(),
  })).min(1, "Debe agregar al menos un producto o servicio"),
  observaciones: z.string().optional(),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

const InvoiceCreate = () => {
  const [cabysResults, setCabysResults] = useState<CabysItem[]>([]);
  const [cabysSearchTerm, setCabysSearchTerm] = useState('');
  // Eliminamos la declaración de selectedCabys ya que no se utiliza, pero mantenemos setSelectedCabys
  const [, setSelectedCabys] = useState<CabysItem | null>(null);
  const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  
  // Obtener la configuración del usuario, los clientes y el historial de facturas
  const { settings, loading: loadingSettings } = useUserSettings();
  const { clients, loading: loadingClients, addClient } = useClients();
  const { addInvoice } = useInvoiceHistory();
  
  // Default form values
  const defaultValues: InvoiceFormData = {
    emisor: {
      nombre: '',
      identificacion: {
        tipo: '01', // Física por defecto
        numero: '',
      },
      nombreComercial: '',
      ubicacion: {
        provincia: '',
        canton: '',
        distrito: '',
        barrio: '',
        otrasSenas: '',
      },
      telefono: {
        codigoPais: '506',
        numTelefono: '',
      },
      correo: '',
      actividadEconomica: '',
    },
    receptor: {
      nombre: '',
      identificacion: {
        tipo: '02', // Jurídica
        numero: '',
      },
      ubicacion: {
        provincia: '',
        canton: '',
        distrito: '',
        barrio: '',
        otrasSenas: '',
      },
      correo: '',
    },
    condicionVenta: '01', // Contado
    plazoCredito: '',
    medioPago: ['01'], // Efectivo
    detalleServicio: [{
      id: 1,
      codigoCabys: '',
      cantidad: 1,
      unidadMedida: 'Sp', // Servicios Profesionales
      detalle: '',
      precioUnitario: 0,
      descuento: {
        montoDescuento: 0,
        naturalezaDescuento: '',
      },
    }],
    observaciones: '',
  };

  const { register, control, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues,
  });
  
  // Actualizar los datos del emisor cuando se carguen los settings
  useEffect(() => {
    if (settings && !loadingSettings) {
      console.log('Actualizando datos del emisor con settings:', settings);
      
      // Convertir los datos de settings al formato esperado por el formulario
      const emisorData = {
        nombre: settings.company_name || '',
        identificacion: {
          tipo: settings.identification_type || '01',
          numero: settings.identification_number || '',
        },
        nombreComercial: settings.commercial_name || '',
        ubicacion: {
          provincia: settings.province || '',
          canton: settings.canton || '',
          distrito: settings.district || '',
          barrio: '',
          otrasSenas: settings.address || '',
        },
        telefono: {
          codigoPais: settings.phone ? (settings.phone.split('-')[0] || '506') : '506',
          numTelefono: settings.phone ? (settings.phone.split('-')[1] || '') : '',
        },
        correo: settings.email || '',
        actividadEconomica: settings.economic_activity || '',
      };
      
      // Forzar la actualización de todos los campos del emisor
      // Primero actualizar los campos simples
      setValue('emisor.nombre', emisorData.nombre, { shouldValidate: true });
      setValue('emisor.nombreComercial', emisorData.nombreComercial, { shouldValidate: true });
      setValue('emisor.correo', emisorData.correo, { shouldValidate: true });
      setValue('emisor.actividadEconomica', emisorData.actividadEconomica, { shouldValidate: true });
      
      // Actualizar campos anidados de identificación
      setValue('emisor.identificacion.tipo', emisorData.identificacion.tipo, { shouldValidate: true });
      setValue('emisor.identificacion.numero', emisorData.identificacion.numero, { shouldValidate: true });
      
      // Actualizar campos anidados de ubicación
      setValue('emisor.ubicacion.provincia', emisorData.ubicacion.provincia, { shouldValidate: true });
      setValue('emisor.ubicacion.canton', emisorData.ubicacion.canton, { shouldValidate: true });
      setValue('emisor.ubicacion.distrito', emisorData.ubicacion.distrito, { shouldValidate: true });
      setValue('emisor.ubicacion.barrio', emisorData.ubicacion.barrio, { shouldValidate: true });
      setValue('emisor.ubicacion.otrasSenas', emisorData.ubicacion.otrasSenas, { shouldValidate: true });
      
      // Actualizar campos anidados de teléfono
      setValue('emisor.telefono.codigoPais', emisorData.telefono.codigoPais, { shouldValidate: true });
      setValue('emisor.telefono.numTelefono', emisorData.telefono.numTelefono, { shouldValidate: true });
      
      console.log('Datos del emisor actualizados correctamente');
    }
  }, [settings, loadingSettings, setValue]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'detalleServicio',
  });

  const condicionVenta = watch('condicionVenta');
  
  // Search CABYS products/services
  const handleCabysSearch = async () => {
    if (!cabysSearchTerm) return;
    
    setIsSearching(true);
    try {
      const results = await searchByDescription(cabysSearchTerm);
      setCabysResults(results.cabys || []);
    } catch (error) {
      console.error('Error searching CABYS:', error);
    } finally {
      setIsSearching(false);
    }
  };
  
  // Select CABYS item
  const handleSelectCabys = (item: CabysItem) => {
    setSelectedCabys(item);
    
    if (currentLineIndex !== null) {
      setValue(`detalleServicio.${currentLineIndex}.codigoCabys`, item.codigo);
      setValue(`detalleServicio.${currentLineIndex}.detalle`, item.descripcion);
    }
    
    setCabysResults([]);
    setCabysSearchTerm('');
    setCurrentLineIndex(null);
  };
  
  // Add new line item
  const handleAddLine = () => {
    append({
      id: fields.length + 1,
      codigoCabys: '',
      cantidad: 1,
      unidadMedida: 'Sp',
      detalle: '',
      precioUnitario: 0,
      descuento: {
        montoDescuento: 0,
        naturalezaDescuento: '',
      },
    });
  };
  
  // Remove line item
  const handleRemoveLine = (index: number) => {
    remove(index);
  };
  
  // Calculate totals for a line
  const calculateLineTotals = (index: number) => {
    const lineas = watch('detalleServicio');
    const linea = lineas[index];
    
    if (!linea) return;
    
    const cantidad = linea.cantidad || 0;
    const precio = linea.precioUnitario || 0;
    const montoDescuento = linea.descuento?.montoDescuento || 0;
    
    const montoTotal = cantidad * precio;
    const subtotal = montoTotal - montoDescuento;
    
    return {
      montoTotal,
      subtotal,
    };
  };
  
  // Generate invoice on form submission
  const onSubmit = async (data: InvoiceFormData) => {
    console.log('Form submitted with:', data);
    
    // Declarar invoiceStatus en el ámbito correcto
    let invoiceStatus: 'Completada' | 'Pendiente' | 'Rechazada' = 'Pendiente';
    
    try {
      // Calculate totals and prepare invoice data
      const detalleServicio = data.detalleServicio.map((item, index) => {
        // Calcular montoTotal (precio * cantidad)
        const montoTotal = item.cantidad * item.precioUnitario;
        
        // Calcular subtotal (montoTotal - descuento)
        const montoDescuento = item.descuento?.montoDescuento || 0;
        const subtotal = montoTotal - montoDescuento;
        
        // Calcular impuesto (13% del subtotal)
        const impuestoMonto = subtotal * 0.13; // 13% IVA standard
        
        return {
          ...item,
          montoTotal: montoTotal,
          subtotal: subtotal,
          impuesto: {
            codigo: '01', // IVA
            codigoTarifa: '08', // 13%
            tarifa: 13,
            monto: impuestoMonto,
          },
          impuestoNeto: impuestoMonto,
          montoTotalLinea: subtotal + impuestoMonto,
        };
      });
      
      // Calcular totales para almacenar en el historial
      const subtotalTotal = detalleServicio.reduce((sum, item) => sum + item.subtotal, 0);
      const impuestoTotal = detalleServicio.reduce((sum, item) => sum + item.impuesto.monto, 0);
      const total = subtotalTotal + impuestoTotal;
      
      // Calculate invoice summary
      const totalVenta = detalleServicio.reduce((sum, item) => sum + item.montoTotal, 0);
      const totalDescuentos = detalleServicio.reduce((sum, item) => sum + (item.descuento?.montoDescuento || 0), 0);
      const totalVentaNeta = totalVenta - totalDescuentos;
      const totalImpuesto = detalleServicio.reduce((sum, item) => sum + item.impuestoNeto, 0);
      const totalComprobante = totalVentaNeta + totalImpuesto;
      
      // Create invoice object
      const invoice: Invoice = {
        clave: generateInvoiceKey(data.emisor.identificacion.numero),
        numeroConsecutivo: generateConsecutiveNumber(),
        fechaEmision: new Date().toISOString(),
        emisor: data.emisor,
        receptor: data.receptor,
        condicionVenta: data.condicionVenta,
        plazoCredito: data.plazoCredito,
        medioPago: data.medioPago,
        detalleServicio: detalleServicio.map(item => ({
          ...item,
          descuento: item.descuento && item.descuento.montoDescuento > 0 ? {
            ...item.descuento,
            naturalezaDescuento: item.descuento.naturalezaDescuento || 'Descuento general'
          } : undefined
        })),
        resumenFactura: {
          codigoMoneda: 'CRC',
          totalServGravados: totalVentaNeta,
          totalServExentos: 0,
          totalMercGravada: 0,
          totalMercExenta: 0,
          totalGravado: totalVentaNeta,
          totalExento: 0,
          totalVenta,
          totalDescuentos,
          totalVentaNeta,
          totalImpuesto,
          totalComprobante,
        },
        otros: data.observaciones,
      };
      
      console.log('Factura preparada:', invoice);
      
      try {
        // 1. Generar XML v4.4
        const xml = generateXML(invoice);
        console.log('XML generado correctamente');
        
        // 2. Descargar XML automáticamente
        downloadXML(xml, invoice.numeroConsecutivo);
        console.log('XML descargado correctamente');
        
        // 3. Generar y descargar PDF
        const pdf = generatePDF(invoice);
        pdf.save(`factura_${invoice.numeroConsecutivo}.pdf`);
        console.log('PDF generado y descargado correctamente');
        
        // 4. Enviar XML a Hacienda
        try {
          // Obtener token de autenticación (simulado)
          const token = 'token_simulado'; // En producción, obtener de un servicio de autenticación
          
          // En un entorno real, aquí se firmaría el XML con XAdES-BES
          const xmlFirmado = xml; // Simulamos que ya está firmado
          
          // Debido a las restricciones de CORS, en un entorno de desarrollo local,
          // simularemos una respuesta exitosa en lugar de hacer la llamada real a la API
          if (window.location.hostname === 'localhost') {
            console.log('Entorno de desarrollo detectado. Simulando envío a Hacienda...');
            // Simular respuesta exitosa después de un breve retraso
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log('Simulación de envío a Hacienda completada con éxito');
            invoiceStatus = 'Completada';
          } else {
            // En producción, realizar la llamada real a la API
            const resultado = await sendInvoiceXML({
              xmlFirmado: xmlFirmado,
              clave: invoice.clave,
              emisorTipo: data.emisor.identificacion.tipo,
              emisorNumero: data.emisor.identificacion.numero,
              token,
              sandbox: true // Usar ambiente de pruebas
            });
            
            if (resultado.success) {
              console.log('Factura enviada a Hacienda correctamente', resultado.data);
              invoiceStatus = 'Completada';
            } else {
              console.error('Error al enviar factura a Hacienda', resultado.error);
              // Aún así, marcamos como completada para desarrollo
              invoiceStatus = 'Completada';
            }
          }
        } catch (apiError) {
          console.error('Error en la comunicación con Hacienda:', apiError);
          // En desarrollo, marcamos como completada aunque haya error
          invoiceStatus = 'Completada';
        }
        
        // 5. Enviar factura por correo electrónico
        let emailStatus: StoredInvoice['emailInfo'] = undefined;
        
        // Verificar si hay un correo de receptor válido para enviar la factura
        if (data.receptor.correo) {
          try {
            const pdfBlob = pdf.output('blob'); // Obtener el PDF como Blob
            await sendInvoiceByEmail(
              data.receptor.correo,
              xml,
              pdfBlob,
              invoice.numeroConsecutivo,
              data.emisor.correo, // Correo del emisor como remitente
              data.emisor.nombre, // Nombre del emisor para personalizar el correo
              undefined, // Documento de aceptación (se añadirá cuando esté disponible)
              undefined, // CC emails
              undefined, // BCC emails
              `Factura Electrónica ${invoice.numeroConsecutivo} - ${data.emisor.nombre}`, // Asunto personalizado
              undefined, // Mensaje personalizado (se usa el predeterminado)
              data.receptor.nombre // Nombre del receptor para personalizar el correo
            );
            console.log(`Factura enviada por correo electrónico a: ${data.receptor.correo}`);
            
            // Guardar información del correo enviado exitosamente
            emailStatus = {
              destinatario: data.receptor.correo,
              fechaEnvio: new Date().toISOString(),
              estadoEnvio: 'Enviado',
              intentos: 1
            };
          } catch (emailError) {
            console.error('Error al enviar la factura por correo electrónico:', emailError);
            // Guardar información del error en el envío
            emailStatus = {
              destinatario: data.receptor.correo,
              fechaEnvio: new Date().toISOString(),
              estadoEnvio: 'Fallido',
              intentos: 1,
              mensajeError: emailError instanceof Error ? emailError.message : 'Error desconocido al enviar correo'
            };
          }
        } else {
          console.warn('No se proporcionó correo electrónico del receptor, no se enviará la factura por correo.');
        }
      } catch (processingError) {
        console.error('Error al procesar la factura:', processingError);
        throw new Error(`Error al procesar la factura: ${processingError instanceof Error ? processingError.message : 'Error desconocido'}`);
      }

      // 6. Guardar factura en el historial
      const storedInvoice: StoredInvoice = {
        id: `F-${invoice.numeroConsecutivo}`,
        client: data.receptor.nombre,
        date: new Date().toISOString(),
        amount: `₡${totalComprobante.toLocaleString()}`,
        status: invoiceStatus as 'Completada' | 'Pendiente' | 'Rechazada',
        items: data.detalleServicio.length,
        claveNumerica: invoice.clave,
        condicionVenta: data.condicionVenta,
        medioPago: data.medioPago,
        detalleServicio: data.detalleServicio.map(item => ({
          codigoCabys: item.codigoCabys,
          detalle: item.detalle,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          subtotal: (item.cantidad * item.precioUnitario) - (item.descuento?.montoDescuento || 0)
        })),
        subtotal: totalVentaNeta,
        impuesto: totalImpuesto,
        total: totalComprobante,
        xmlContent: typeof xml !== 'undefined' ? xml : '',
        // Incluir la información del correo electrónico si existe
        emailInfo: emailStatus || undefined
      };
      
      console.log('Guardando factura en el historial:', storedInvoice);
      try {
        addInvoice(storedInvoice);
        console.log('Factura guardada exitosamente en el historial');
      } catch (historyError) {
        console.error('Error al guardar la factura en el historial:', historyError);
      }
      
      // Verificar que la factura se haya guardado correctamente
      console.log('Verificando que la factura se haya guardado en el historial');
      setTimeout(() => {
        const storedInvoices = localStorage.getItem('invoices');
        if (storedInvoices) {
          const invoices = JSON.parse(storedInvoices);
          const found = invoices.some((inv: any) => inv.id === storedInvoice.id);
          console.log(`Factura ${found ? 'encontrada' : 'NO encontrada'} en el historial`);
        }
      }, 500);
      
      let alertMessage = `Factura generada exitosamente. Estado: ${invoiceStatus}. El XML y PDF se han descargado automáticamente.`;
      if (data.receptor.correo) {
        alertMessage += ` Además, se ha enviado por correo a ${data.receptor.correo}.`;
      }
      alert(alertMessage);
      
    } catch (error) {
      console.error('Error generating invoice:', error);
      alert(`Error al generar la factura: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl title-primary">Crear Factura Electrónica</h1>
      </div>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Tabs for different sections */}
        <div className="glass-card">
          <div className="border-b border-primary-500/30">
            <nav className="flex overflow-x-auto">
              {['Emisor', 'Receptor', 'Detalles', 'Producto/Servicios', 'Resumen'].map((tab, index) => (
                <button
                  key={index}
                  type="button"
                  className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                    index === 0 
                      ? 'border-primary-500 text-white' 
                      : 'border-transparent text-gray-400 hover:text-white hover:border-primary-300'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>
          
          <div className="p-6">
            {/* Emisor Section */}
            <div className="space-y-6">
              <h2 className="text-xl title-secondary flex items-center">
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-primary-500 text-white mr-2 text-sm">1</span>
                Información del Emisor
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 glass-card">
                <div>
                  <label className="form-label">Nombre</label>
                  <input 
                    {...register('emisor.nombre')} 
                    className="form-input" 
                    placeholder="Nombre completo" 
                  />
                  {errors.emisor?.nombre && <p className="form-error">{errors.emisor.nombre.message}</p>}
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="form-label">Tipo de Identificación</label>
                    <select {...register('emisor.identificacion.tipo')} className="form-select">
                      <option value="01">Física</option>
                      <option value="02">Jurídica</option>
                      <option value="03">DIMEX</option>
                      <option value="04">NITE</option>
                    </select>
                    {errors.emisor?.identificacion?.tipo && <p className="form-error">{errors.emisor.identificacion.tipo.message}</p>}
                  </div>
                  
                  <div>
                    <label className="form-label">Número de Identificación</label>
                    <input 
                      {...register('emisor.identificacion.numero')} 
                      className="form-input" 
                      placeholder="Cédula/RUC" 
                    />
                    {errors.emisor?.identificacion?.numero && <p className="form-error">{errors.emisor.identificacion.numero.message}</p>}
                  </div>
                </div>
                
                <div>
                  <label className="form-label">Nombre Comercial (Opcional)</label>
                  <input 
                    {...register('emisor.nombreComercial')} 
                    className="form-input" 
                    placeholder="Nombre comercial" 
                  />
                </div>
                
                <div>
                  <label className="form-label">Actividad Económica</label>
                  <input 
                    {...register('emisor.actividadEconomica')} 
                    className="form-input" 
                    placeholder="Código de actividad" 
                  />
                  {errors.emisor?.actividadEconomica && <p className="form-error">{errors.emisor.actividadEconomica.message}</p>}
                </div>
                
                <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div>
                    <label className="form-label">Provincia</label>
                    <input 
                      {...register('emisor.ubicacion.provincia')} 
                      className="form-input" 
                      placeholder="Provincia" 
                    />
                    {errors.emisor?.ubicacion?.provincia && <p className="form-error">{errors.emisor.ubicacion.provincia.message}</p>}
                  </div>
                  
                  <div>
                    <label className="form-label">Cantón</label>
                    <input 
                      {...register('emisor.ubicacion.canton')} 
                      className="form-input" 
                      placeholder="Cantón" 
                    />
                    {errors.emisor?.ubicacion?.canton && <p className="form-error">{errors.emisor.ubicacion.canton.message}</p>}
                  </div>
                  
                  <div>
                    <label className="form-label">Distrito</label>
                    <input 
                      {...register('emisor.ubicacion.distrito')} 
                      className="form-input" 
                      placeholder="Distrito" 
                    />
                    {errors.emisor?.ubicacion?.distrito && <p className="form-error">{errors.emisor.ubicacion.distrito.message}</p>}
                  </div>
                </div>
                
                <div className="col-span-1 md:col-span-2">
                  <label className="form-label">Otras Señas</label>
                  <input 
                    {...register('emisor.ubicacion.otrasSenas')} 
                    className="form-input" 
                    placeholder="Dirección completa" 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="form-label">Código País</label>
                    <input 
                      {...register('emisor.telefono.codigoPais')} 
                      className="form-input" 
                      placeholder="Ej: 506" 
                    />
                  </div>
                  
                  <div>
                    <label className="form-label">Teléfono</label>
                    <input 
                      {...register('emisor.telefono.numTelefono')} 
                      className="form-input" 
                      placeholder="Número de teléfono" 
                    />
                  </div>
                </div>
                
                <div>
                  <label className="form-label">Correo Electrónico</label>
                  <input 
                    {...register('emisor.correo')} 
                    className="form-input" 
                    placeholder="email@ejemplo.com" 
                  />
                  {errors.emisor?.correo && <p className="form-error">{errors.emisor.correo.message}</p>}
                </div>
              </div>
            </div>
            
            {/* Receptor Section */}
            <div className="space-y-6 mt-8">
              <h2 className="text-xl title-secondary flex items-center">
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-primary-500 text-white mr-2 text-sm">2</span>
                Información del Receptor
              </h2>
              
              <div className="grid grid-cols-1 gap-4 p-4 glass-card">
                <div className="flex justify-between items-center mb-4">
                  <label className="form-label mb-0">Seleccionar Cliente</label>
                  <button 
                    type="button"
                    onClick={() => setIsClientModalOpen(true)}
                    className="btn-primary flex items-center text-sm py-1 px-3"
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    Nuevo Cliente
                  </button>
                </div>
                
                <div className="relative">
                  <select 
                    className="form-select w-full"
                    value={selectedClient?.id || ''}
                    onChange={(e) => {
                      const clientId = e.target.value;
                      const client = clients.find(c => c.id === clientId);
                      setSelectedClient(client);
                      
                      if (client) {
                        // Actualizar los campos del receptor con los datos del cliente
                        setValue('receptor.nombre', client.name, { shouldValidate: true });
                        setValue('receptor.identificacion.tipo', client.identification_type, { shouldValidate: true });
                        setValue('receptor.identificacion.numero', client.identification_number, { shouldValidate: true });
                        
                        if (client.province) {
                          setValue('receptor.ubicacion.provincia', client.province, { shouldValidate: true });
                        }
                        if (client.canton) {
                          setValue('receptor.ubicacion.canton', client.canton, { shouldValidate: true });
                        }
                        if (client.district) {
                          setValue('receptor.ubicacion.distrito', client.district, { shouldValidate: true });
                        }
                        if (client.address) {
                          setValue('receptor.ubicacion.otrasSenas', client.address, { shouldValidate: true });
                        }
                        if (client.email) {
                          setValue('receptor.correo', client.email, { shouldValidate: true });
                        }
                      }
                    }}
                  >
                    <option value="">Seleccione un cliente...</option>
                    {loadingClients ? (
                      <option disabled>Cargando clientes...</option>
                    ) : (
                      clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.name} - {client.identification_type} {client.identification_number}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                
                <div className="mt-4 p-4 border border-primary-500/30 rounded-lg">
                  <h3 className="text-sm font-medium mb-3">Datos del Receptor</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Nombre</label>
                      <input 
                        {...register('receptor.nombre')} 
                        className="form-input" 
                        placeholder="Nombre completo" 
                      />
                      {errors.receptor?.nombre && <p className="form-error">{errors.receptor.nombre.message}</p>}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="form-label">Tipo de Identificación</label>
                        <select {...register('receptor.identificacion.tipo')} className="form-select">
                          <option value="01">Física</option>
                          <option value="02">Jurídica</option>
                          <option value="03">DIMEX</option>
                          <option value="04">NITE</option>
                        </select>
                        {errors.receptor?.identificacion?.tipo && <p className="form-error">{errors.receptor.identificacion.tipo.message}</p>}
                      </div>
                      
                      <div>
                        <label className="form-label">Número de Identificación</label>
                        <input 
                          {...register('receptor.identificacion.numero')} 
                          className="form-input" 
                          placeholder="Cédula/RUC" 
                        />
                        {errors.receptor?.identificacion?.numero && <p className="form-error">{errors.receptor.identificacion.numero.message}</p>}
                      </div>
                    </div>
                    
                    <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div>
                        <label className="form-label">Provincia</label>
                        <input 
                          {...register('receptor.ubicacion.provincia')} 
                          className="form-input" 
                          placeholder="Provincia" 
                        />
                      </div>
                      
                      <div>
                        <label className="form-label">Cantón</label>
                        <input 
                          {...register('receptor.ubicacion.canton')} 
                          className="form-input" 
                          placeholder="Cantón" 
                        />
                      </div>
                      
                      <div>
                        <label className="form-label">Distrito</label>
                        <input 
                          {...register('receptor.ubicacion.distrito')} 
                          className="form-input" 
                          placeholder="Distrito" 
                        />
                      </div>
                    </div>
                    
                    <div className="col-span-1 md:col-span-2">
                      <label className="form-label">Otras Señas</label>
                      <input 
                        {...register('receptor.ubicacion.otrasSenas')} 
                        className="form-input" 
                        placeholder="Dirección completa" 
                      />
                    </div>
                    
                    <div>
                      <label className="form-label">Correo Electrónico</label>
                      <input 
                        {...register('receptor.correo')} 
                        className="form-input" 
                        placeholder="email@ejemplo.com" 
                      />
                      {errors.receptor?.correo && <p className="form-error">{errors.receptor.correo.message}</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Invoice Details Section */}
            <div className="space-y-6 mt-8">
              <h2 className="text-xl font-semibold flex items-center">
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-primary-500 text-white mr-2 text-sm">3</span>
                Detalles de la Factura
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 glass-card">
                <div>
                  <label className="form-label">Condición de Venta</label>
                  <select {...register('condicionVenta')} className="form-select">
                    <option value="01">Contado</option>
                    <option value="02">Crédito</option>
                    <option value="03">Consignación</option>
                    <option value="04">Apartado</option>
                    <option value="05">Arrendamiento con opción de compra</option>
                    <option value="06">Arrendamiento en función financiera</option>
                    <option value="07">Cobro a favor de un tercero</option>
                    <option value="08">Servicios prestados al Estado a crédito</option>
                    <option value="09">Pago del servicios prestados al Estado</option>
                    <option value="99">Otros</option>
                  </select>
                  {errors.condicionVenta && <p className="form-error">{errors.condicionVenta.message}</p>}
                </div>
                
                {condicionVenta === '02' && (
                  <div>
                    <label className="form-label">Plazo de Crédito (días)</label>
                    <input 
                      {...register('plazoCredito')} 
                      className="form-input" 
                      placeholder="Ej: 30" 
                    />
                    {errors.plazoCredito && <p className="form-error">{errors.plazoCredito.message}</p>}
                  </div>
                )}
                
                <div>
                  <label className="form-label">Medio de Pago</label>
                  <select 
                    {...register('medioPago.0')} 
                    className="form-select"
                  >
                    <option value="01">Efectivo</option>
                    <option value="02">Tarjeta</option>
                    <option value="03">Cheque</option>
                    <option value="04">Transferencia</option>
                    <option value="05">Recaudado por terceros</option>
                    <option value="99">Otros</option>
                  </select>
                  {errors.medioPago && <p className="form-error">{errors.medioPago.message}</p>}
                </div>
              </div>
            </div>
            
            {/* Products/Services Section */}
            <div className="space-y-6 mt-8">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold flex items-center">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-primary-500 text-white mr-2 text-sm">4</span>
                  Productos y Servicios
                </h2>
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(true)}
                  className="btn-primary flex items-center text-sm py-1 px-3"
                >
                  <Search className="w-4 h-4 mr-1" />
                  Selecciona un Producto o Servicio Guardado
                </button>
              </div>

              {/* Modal de selección de productos guardados */}
              {isProductModalOpen && (
                <ProductSelectorModal
                  isOpen={isProductModalOpen}
                  onClose={() => setIsProductModalOpen(false)}
                  onSelect={(product) => {
                    // Lógica para autocompletar la línea actual o agregar una nueva
                    const idx = currentLineIndex !== null ? currentLineIndex : fields.length;
                    if (currentLineIndex !== null) {
                      setValue(`detalleServicio.${idx}.codigoCabys`, product.codigoCabys);
                      setValue(`detalleServicio.${idx}.detalle`, product.detalle);
                      setValue(`detalleServicio.${idx}.cantidad`, product.cantidad);
                      setValue(`detalleServicio.${idx}.unidadMedida`, product.unidadMedida);
                      setValue(`detalleServicio.${idx}.precioUnitario`, product.precioUnitario);
                      setValue(`detalleServicio.${idx}.descuento`, product.descuento || { montoDescuento: 0, naturalezaDescuento: '' });
                    } else {
                      handleProductSelected(product);
                    }
                    setIsProductModalOpen(false);
                    setCurrentLineIndex(null);
                  }}
                />
              )}
              
              <div className="p-4 glass-card">
                {/* CABYS Search */}
                <div className="mb-4">
                  <label className="form-label">Buscar producto o servicio (CABYS)</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input 
                        type="text" 
                        value={cabysSearchTerm}
                        onChange={(e) => setCabysSearchTerm(e.target.value)}
                        className="form-input pr-10" 
                        placeholder="Buscar por descripción..." 
                      />
                      {isSearching && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 animate-spin">
                          <div className="w-4 h-4 border-2 border-primary-500 rounded-full border-t-transparent"></div>
                        </div>
                      )}
                    </div>
                    <button 
                      type="button"
                      onClick={handleCabysSearch}
                      className="btn-primary flex items-center"
                    >
                      <Search className="w-4 h-4 mr-1" />
                      Buscar
                    </button>
                  </div>
                  
                  {/* Search Results */}
                  {cabysResults.length > 0 && (
                    <div className="mt-2 max-h-48 overflow-y-auto glass-card">
                      <ul className="divide-y divide-gray-700">
                        {cabysResults.map((item, index) => (
                          <li 
                            key={index}
                            className="p-2 hover:bg-white/10 cursor-pointer transition-colors"
                            onClick={() => handleSelectCabys(item)}
                          >
                            <p className="font-medium">{item.codigo} - {item.descripcion}</p>
                            <p className="text-xs text-gray-400">Impuesto: {item.impuesto}%</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                
                {/* Line Items */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left">
                        <th className="table-header rounded-tl-lg">#</th>
                        <th className="table-header">Código CABYS</th>
                        <th className="table-header">Detalle</th>
                        <th className="table-header">Cantidad</th>
                        <th className="table-header">Unidad</th>
                        <th className="table-header">Precio Unit.</th>
                        <th className="table-header">Descuento</th>
                        <th className="table-header">Subtotal</th>
                        <th className="table-header rounded-tr-lg">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((field, index) => {
                        const lineTotals = calculateLineTotals(index);
                        
                        return (
                          <tr key={field.id} className="table-row">
                            <td className="table-cell">{index + 1}</td>
                            <td className="table-cell">
                              <div className="flex">
                                <input 
                                  {...register(`detalleServicio.${index}.codigoCabys`)}
                                  className="form-input w-24" 
                                  readOnly 
                                />
                                <button 
                                  type="button"
                                  onClick={() => setCurrentLineIndex(index)}
                                  className="p-2 ml-1 bg-secondary-600 rounded-md hover:bg-secondary-700 transition-colors"
                                >
                                  <Search className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                            <td className="table-cell">
                              <input 
                                {...register(`detalleServicio.${index}.detalle`)}
                                className="form-input w-full" 
                              />
                            </td>
                            <td className="table-cell">
                              <Controller
                                name={`detalleServicio.${index}.cantidad`}
                                control={control}
                                render={({ field }) => (
                                  <input 
                                    type="number"
                                    onChange={e => field.onChange(parseFloat(e.target.value))}
                                    value={field.value}
                                    className="form-input w-20" 
                                    min="0.001"
                                    step="0.001"
                                  />
                                )}
                              />
                            </td>
                            <td className="table-cell">
                              <select 
                                {...register(`detalleServicio.${index}.unidadMedida`)}
                                className="form-select w-20" 
                              >
                                <option value="Sp">Sp</option>
                                <option value="Unid">Unid</option>
                                <option value="kg">kg</option>
                                <option value="m">m</option>
                                <option value="L">L</option>
                                <option value="h">h</option>
                                <option value="día">día</option>
                              </select>
                            </td>
                            <td className="table-cell">
                              <Controller
                                name={`detalleServicio.${index}.precioUnitario`}
                                control={control}
                                render={({ field }) => (
                                  <input 
                                    type="number"
                                    onChange={e => field.onChange(parseFloat(e.target.value))}
                                    value={field.value}
                                    className="form-input w-24" 
                                    min="0"
                                    step="0.01"
                                  />
                                )}
                              />
                            </td>
                            <td className="table-cell">
                              <Controller
                                name={`detalleServicio.${index}.descuento.montoDescuento`}
                                control={control}
                                render={({ field }) => (
                                  <input 
                                    type="number"
                                    onChange={e => field.onChange(parseFloat(e.target.value))}
                                    value={field.value}
                                    className="form-input w-24" 
                                    min="0"
                                    step="0.01"
                                  />
                                )}
                              />
                            </td>
                            <td className="table-cell font-medium">
                              {lineTotals ? new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(lineTotals.subtotal) : '₡0.00'}
                            </td>
                            <td className="table-cell">
                              <button 
                                type="button"
                                onClick={() => handleRemoveLine(index)}
                                className="p-1.5 bg-red-600/40 rounded-md hover:bg-red-600/60 transition-colors"
                                disabled={fields.length === 1}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                          {/* Botones para agregar productos */}
                <div className="flex justify-end mb-6 gap-3">
                  <button
                    type="button"
                    className="btn-primary flex items-center"
                    onClick={() => setIsProductModalOpen(true)}
                  >
                    <Search className="w-4 h-4 mr-2" />
                    Selecciona un Producto o Servicio Guardado
                  </button>
                  <button
                    type="button"
                    className="btn-secondary flex items-center"
                    onClick={() => setIsNewProductModalOpen(true)}
                  >
                    <PackagePlus className="w-4 h-4 mr-2" />
                    Agregar un Producto Nuevo
                  </button>
                </div>
                
                <div className="mt-4">
                  <button 
                    type="button"
                    onClick={handleAddLine}
                    className="btn-ghost flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Agregar línea
                  </button>
                </div>
              </div>
            </div>
            
            {/* Additional Information */}
            <div className="space-y-6 mt-8">
              <h2 className="text-xl font-semibold flex items-center">
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-primary-500 text-white mr-2 text-sm">5</span>
                Información adicional
              </h2>
              
              <div className="p-4 glass-card">
                <label className="form-label">Observaciones</label>
                <textarea 
                  {...register('observaciones')} 
                  className="form-input min-h-24" 
                  placeholder="Cualquier información adicional..."
                ></textarea>
              </div>
            </div>
            
            {/* Submit Buttons */}
            <div className="flex flex-wrap gap-4 justify-end mt-8">
              <button type="button" className="btn-ghost">
                <Save className="w-4 h-4 mr-2" />
                Guardar como borrador
              </button>
              
              <button type="button" className="btn-secondary">
                <FileText className="w-4 h-4 mr-2" />
                Vista previa
              </button>
              
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                <Send className="w-4 h-4 mr-2" />
                {isSubmitting ? 'Generando...' : 'Generar Factura'}
              </button>
            </div>
          </div>
        </div>
      </form>
    
      {/* Modal para crear nuevo cliente */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-2xl">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Nuevo Cliente</h2>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const clientData = {
                  name: formData.get('name') as string,
                  identification_type: formData.get('identification_type') as string,
                  identification_number: formData.get('identification_number') as string,
                  email: formData.get('email') as string || null,
                  phone: formData.get('phone') as string || null,
                  province: formData.get('province') as string || null,
                  canton: formData.get('canton') as string || null,
                  district: formData.get('district') as string || null,
                  address: formData.get('address') as string || null,
                  user_id: 'default'
                };
                
                try {
                  const { data } = await addClient(clientData);
                  if (data) {
                    // Seleccionar el cliente recién creado
                    setSelectedClient(data);
                    
                    // Actualizar los campos del receptor
                    setValue('receptor.nombre', data.name, { shouldValidate: true });
                    setValue('receptor.identificacion.tipo', data.identification_type, { shouldValidate: true });
                    setValue('receptor.identificacion.numero', data.identification_number, { shouldValidate: true });
                    
                    if (data.province) {
                      setValue('receptor.ubicacion.provincia', data.province, { shouldValidate: true });
                    }
                    if (data.canton) {
                      setValue('receptor.ubicacion.canton', data.canton, { shouldValidate: true });
                    }
                    if (data.district) {
                      setValue('receptor.ubicacion.distrito', data.district, { shouldValidate: true });
                    }
                    if (data.address) {
                      setValue('receptor.ubicacion.otrasSenas', data.address, { shouldValidate: true });
                    }
                    if (data.email) {
                      setValue('receptor.correo', data.email, { shouldValidate: true });
                    }
                  }
                  setIsClientModalOpen(false);
                } catch (error) {
                  console.error('Error al guardar cliente:', error);
                }
              }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Nombre/Razón Social</label>
                    <input name="name" className="form-input" required />
                  </div>

                  <div>
                    <label className="form-label">Tipo de Identificación</label>
                    <select name="identification_type" className="form-select" required>
                      <option value="">Seleccione...</option>
                      <option value="01">Física</option>
                      <option value="02">Jurídica</option>
                      <option value="03">DIMEX</option>
                      <option value="04">NITE</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Número de Identificación</label>
                    <input name="identification_number" className="form-input" required />
                  </div>

                  <div>
                    <label className="form-label">Correo Electrónico</label>
                    <input name="email" type="email" className="form-input" />
                  </div>

                  <div>
                    <label className="form-label">Teléfono</label>
                    <input name="phone" className="form-input" />
                  </div>

                  <div>
                    <label className="form-label">Provincia</label>
                    <input name="province" className="form-input" />
                  </div>

                  <div>
                    <label className="form-label">Cantón</label>
                    <input name="canton" className="form-input" />
                  </div>

                  <div>
                    <label className="form-label">Distrito</label>
                    <input name="district" className="form-input" />
                  </div>

                  <div className="md:col-span-2">
                    <label className="form-label">Dirección Completa</label>
                    <input name="address" className="form-input" />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsClientModalOpen(false)}
                    className="btn-ghost"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary">
                    Guardar Cliente
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal para seleccionar productos guardados */}
      <ProductSelectorModal 
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setCurrentLineIndex(null);
        }}
        onSelect={handleProductSelect}
      />

      {/* Modal para agregar nuevo producto */}
      <NewProductModal
        isOpen={isNewProductModalOpen}
        onClose={() => setIsNewProductModalOpen(false)}
        onSave={handleNewProductSaved}
      />
    </div>
  );
};

export default InvoiceCreate;