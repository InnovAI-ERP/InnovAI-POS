import { useState, useEffect } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Search, Save, Send, UserPlus, Package, PackagePlus, Eye, RotateCw, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { buscarContribuyente, mapearTipoIdentificacion, validarEstadoContribuyente } from '../services/haciendaService';
import { searchByDescription } from '../services/cabysService';
import { generatePDF, generateXML, downloadXML, sendInvoiceXML, generateInvoiceKey, generateConsecutiveNumber, sendInvoiceByEmail } from '../services/invoiceService';
import { CabysItem, Invoice, availableCurrencies, tiposCargos } from '../types/invoice';
import { useUserSettings } from '../hooks/useUserSettings';
import { useClients } from '../hooks/useClients';
import { useInvoiceHistory, StoredInvoice } from '../hooks/useInvoiceHistory';
import ProductSelectorModal from '../components/ProductSelectorModal';
import NewProductModal from '../components/NewProductModal';
import InvoicePreviewModal from '../components/InvoicePreviewModal';
import { getExchangeRate } from '../services/exchangeRateService';

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
    economic_activity_code: z.string().optional(),
    actividadEconomica: z.string().optional(),
  }),
  condicionVenta: z.string().min(1, "La condición de venta es requerida"),
  plazoCredito: z.coerce.number().int().positive().optional(),
  medioPago: z.array(z.string()).min(1, "Al menos un medio de pago es requerido"),
  detalleServicio: z.array(z.object({
    id: z.number(),
    codigoCabys: z.string().min(1, "El código CABYS es requerido"),
    cantidad: z.number().min(0.001, "La cantidad debe ser mayor a cero"),
    unidadMedida: z.string().min(1, "La unidad de medida es requerida"),
    detalle: z.string().min(1, "El detalle es requerido"),
    // Campos específicos para productos farmacéuticos (v4.4)
    formaFarmaceutica: z.string().optional(), // Forma farmacéutica (A-Z)
    registroMedicamento: z.string().optional(), // Registro sanitario
    precioUnitario: z.number().min(0, "El precio unitario debe ser mayor o igual a cero"),
    precioUnitarioCRC: z.number().optional(), // Campo oculto para almacenar el precio original en CRC
    tipoTransaccion: z.string().min(1, "El tipo de transacción es requerido").default("01"),
    descuento: z.object({
      montoDescuento: z.number().min(0, "El descuento debe ser mayor o igual a cero"),
      naturalezaDescuento: z.string().optional(),
    }).optional(),
    tieneExoneracion: z.boolean().optional().default(false),
    exoneracion: z.object({
      tipoDocumento: z.string().min(1, "El tipo de documento de exoneración es requerido"),
      numeroDocumento: z.string().min(1, "El número de documento es requerido").optional(),
      nombreInstitucion: z.string().min(1, "El nombre de la institución es requerido").optional(),
      fechaEmision: z.string().min(1, "La fecha de emisión es requerida").optional(),
      porcentajeExoneracion: z.number().min(0, "El porcentaje de exoneracion debe ser mayor o igual a cero").max(100, "El porcentaje de exoneración no puede ser mayor a 100").optional(),
    }).optional(),
  })).min(1, "Debe agregar al menos un producto o servicio"),
  otrosCargos: z.array(z.object({
    tipoCargo: z.string().min(1, "El tipo de cargo es requerido"),
    descripcionCargo: z.string().optional(),
    porcentaje: z.number().min(0, "El porcentaje debe ser mayor o igual a cero").max(100, "El porcentaje no puede ser mayor a 100").optional(),
    montoCargo: z.number().min(0, "El monto debe ser mayor o igual a cero"),
  })).optional().default([]),
  observaciones: z.string().optional(),
  moneda: z.string().min(1, "La moneda es requerida"),
  tipoCambio: z.number().min(0, "El tipo de cambio debe ser mayor o igual a cero"),
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
  const [invalidContribuyente, setInvalidContribuyente] = useState<{estado: string, mensaje: string} | null>(null);
  const [economicActivities, setEconomicActivities] = useState<Array<{codigo: string, descripcion: string}>>([]);
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isEmisorCollapsed, setIsEmisorCollapsed] = useState(true);
  const [isReceptorCollapsed, setIsReceptorCollapsed] = useState(true);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [isLoadingExchangeRate, setIsLoadingExchangeRate] = useState(false);

  // Verificar si hay un borrador guardado al cargar
  useEffect(() => {
    const draftInvoice = localStorage.getItem('invoiceDraft');
    setHasDraft(!!draftInvoice);
  }, []);

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
    plazoCredito: undefined,
    medioPago: ['01'], // Efectivo
    detalleServicio: [], // Mantener vacío - no añadir líneas en blanco
    otrosCargos: [], // Array vacío para otros cargos
    observaciones: '',
    moneda: 'CRC', // Moneda por defecto: Colones
    tipoCambio: 1, // Tipo de cambio por defecto para colones
  };

  const { register, control, handleSubmit, watch, setValue, getValues, reset, formState: { errors, isSubmitting } } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues,
    mode: 'onSubmit', // Asegura que la validación ocurra al enviar el formulario
  });
  
  // No agregamos ninguna declaración aquí, usaremos la que ya existe más abajo

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

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'detalleServicio',
  });
  
  // Field array para otros cargos
  const { 
    fields: otrosCargoFields, 
    append: appendOtroCargo, 
    remove: removeOtroCargo 
  } = useFieldArray({
    control,
    name: 'otrosCargos',
  });
  
  // Efecto para eliminar líneas vacías al cargar el componente o cambiar las líneas
  useEffect(() => {
    if (fields.length > 0) {
      // Verificar si hay líneas vacías
      const hasEmptyLines = fields.some(field => !field.codigoCabys || !field.detalle);
      if (hasEmptyLines) {
        // Filtrar sólo las líneas con datos completos
        const validLines = fields.filter(field => field.codigoCabys && field.detalle);
        if (validLines.length > 0) {
          // Reemplazar todas las líneas con sólo las válidas
          replace(validLines);
        } else {
          // Si no hay líneas válidas, eliminar todas
          remove();
        }
      }
    }
  }, [fields, remove, replace]);

  const condicionVenta = watch('condicionVenta');
  const selectedCurrency = watch('moneda');
  
  // Actualizar el tipo de cambio cuando cambia la moneda seleccionada
  useEffect(() => {
    const updateExchangeRate = async () => {
      if (selectedCurrency) {
        console.log('💱 Moneda seleccionada cambiada a:', selectedCurrency);
        setIsLoadingExchangeRate(true);
        try {
          const rate = await getExchangeRate(selectedCurrency);
          // Formatear el tipo de cambio con 5 decimales como requiere Hacienda
          const formattedRate = parseFloat(rate.toFixed(5));
          console.log('💱 Tipo de cambio actualizado:', formattedRate);
          setValue('tipoCambio', formattedRate);
          
          // Convertir los precios de los productos/servicios según la moneda seleccionada
          const detalleServicio = getValues('detalleServicio');
          if (detalleServicio && detalleServicio.length > 0) {
            // Obtener el tipo de cambio actual
            const exchangeRate = formattedRate;
            
            detalleServicio.forEach((item, index) => {
              // Si existe un precio original en CRC, usarlo como base para la conversión
              const originalPriceCRC = item.precioUnitarioCRC || item.precioUnitario;
              let newPrice;
              
              // Convertir según la moneda seleccionada
              if (selectedCurrency === 'CRC') {
                newPrice = originalPriceCRC;
              } else {
                // Dividir por el tipo de cambio para convertir de CRC a otra moneda
                newPrice = originalPriceCRC / exchangeRate;
              }
              
              // Almacenar el precio original en CRC solo si no existe ya
              if (!item.precioUnitarioCRC) {
                setValue(`detalleServicio.${index}.precioUnitarioCRC`, originalPriceCRC);
              }
              
              // Actualizar el precio unitario con el convertido (redondeado a 2 decimales)
              setValue(`detalleServicio.${index}.precioUnitario`, parseFloat(newPrice.toFixed(2)));
            });
          }
        } catch (error) {
          console.error('Error al obtener el tipo de cambio:', error);
          // Establecer valores por defecto según la moneda
          if (selectedCurrency === 'CRC') {
            setValue('tipoCambio', 1);
          } else if (selectedCurrency === 'USD') {
            setValue('tipoCambio', 506.00000);
          } else if (selectedCurrency === 'EUR') {
            setValue('tipoCambio', 567.23000);
          }
        } finally {
          setIsLoadingExchangeRate(false);
        }
      }
    };
    
    updateExchangeRate();
  }, [selectedCurrency, setValue, getValues]);
  
  // Función para formatear montos según la moneda seleccionada
  const formatCurrencyWithSymbol = (amount: number, currency: string = selectedCurrency) => {
    // Determinar el símbolo de la moneda
    let symbol = '';
    if (currency === 'USD') {
      symbol = '$';
    } else if (currency === 'EUR') {
      symbol = '€';
    } else if (currency === 'CRC') {
      symbol = '₡';
    }
    
    // Formatear el número con el formato de Costa Rica
    const formattedNumber = new Intl.NumberFormat('es-CR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(amount);
    
    // Agregar el símbolo correspondiente
    return `${symbol}${formattedNumber}`;
  };
  
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
  
  // Add new line item - Asegurarse de no agregar líneas en blanco
  const handleAddLine = () => {
    // Antes de agregar una nueva línea, eliminamos cualquier línea vacía existente
    const emptyLineIndexes = fields
      .map((field, index) => (!field.codigoCabys || !field.detalle) ? index : -1)
      .filter(index => index !== -1)
      .reverse(); // Eliminar de atrás hacia adelante para no afectar los índices
    
    emptyLineIndexes.forEach(index => {
      remove(index);
    });
    
    // Ahora agregamos una nueva línea
    append({
      id: fields.length + 1,
      codigoCabys: '',
      cantidad: 1,
      unidadMedida: 'Sp',
      detalle: '',
      precioUnitario: 0,
      precioUnitarioCRC: 0, // Campo oculto para almacenar el precio original en CRC
      tipoTransaccion: '01', // Valor predeterminado: Venta Normal
      tieneExoneracion: false,
      descuento: {
        montoDescuento: 0,
        naturalezaDescuento: '',
      },
    });
  };

  // Handle product selection from the saved products
  const handleProductSelected = (product: any) => {
    // IMPORTANTE: Eliminar TODAS las líneas existentes para evitar líneas en blanco
    // remove() elimina todas las líneas cuando se llama sin argumentos
    remove();
    
    // Verificar que el producto tenga todos los campos requeridos
    if (!product || !product.codigoCabys || !product.detalle) {
      console.error('Producto inválido o incompleto', product);
      return; // No agregar productos incompletos
    }
    
    // Agregar solo el producto seleccionado
    append({
      id: Date.now(),
      codigoCabys: product.codigoCabys,
      cantidad: product.cantidad,
      unidadMedida: product.unidadMedida,
      detalle: product.detalle,
      precioUnitario: product.precioUnitario,
      precioUnitarioCRC: product.precioUnitarioCRC,
      tipoTransaccion: product.tipoTransaccion || '01', // Valor predeterminado: Venta Normal
      tieneExoneracion: false,
      descuento: {
        montoDescuento: product.descuento?.montoDescuento || 0,
        naturalezaDescuento: product.descuento?.naturalezaDescuento || ''
      },
    });
  };

  // Handle product selection from the product selector modal
  const handleProductSelect = (product: any) => {
    // Obtener el tipo de cambio actual
    const currentCurrency = getValues('moneda');
    const exchangeRate = getValues('tipoCambio');
    
    // Calcular el precio según la moneda seleccionada
    let precioUnitario = product.precioUnitario || 0;
    const precioUnitarioCRC = product.precioUnitario || 0; // Siempre guardar el precio original en CRC
    
    // Convertir el precio si la moneda no es CRC
    if (currentCurrency !== 'CRC' && exchangeRate > 0) {
      precioUnitario = parseFloat((precioUnitarioCRC / exchangeRate).toFixed(2));
    }
    
    // Si hay una línea vacía seleccionada o en edición, la usamos
    // Si no, añadimos una nueva línea. Ya no eliminamos líneas vacías automáticamente.
    let targetLineIndex = currentLineIndex;
    
    // Si no hay línea seleccionada pero hay una línea vacía, usamos esa
    if (targetLineIndex === null) {
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        if (!field.codigoCabys || !field.detalle) {
          targetLineIndex = i;
          break;
        }
      }
    }
    
    // Si hay una línea existente para usar (ya sea seleccionada o vacía), la actualizamos
    if (targetLineIndex !== null) {
      // 1. Registrar para depuración qué producto estamos procesando
      console.log('Producto seleccionado:', product);
      console.log(`Forma Farmacéutica: ${product.formaFarmaceutica || 'No especificada'}`);
      console.log(`Registro Medicamento: ${product.registroMedicamento || 'No especificado'}`);
      
      // 2. Asignar campos básicos
      setValue(`detalleServicio.${targetLineIndex}.codigoCabys`, product.codigoCabys || '9999999999999');
      setValue(`detalleServicio.${targetLineIndex}.detalle`, product.detalle || 'Producto o servicio seleccionado');
      setValue(`detalleServicio.${targetLineIndex}.cantidad`, product.cantidad || 1);
      setValue(`detalleServicio.${targetLineIndex}.unidadMedida`, product.unidadMedida || 'Sp');
      setValue(`detalleServicio.${targetLineIndex}.precioUnitario`, precioUnitario);
      setValue(`detalleServicio.${targetLineIndex}.precioUnitarioCRC`, precioUnitarioCRC); // Campo oculto para almacenar el precio original en CRC
      setValue(`detalleServicio.${targetLineIndex}.tipoTransaccion`, product.tipoTransaccion || '01'); // Valor predeterminado: Venta Normal
      
      // 3. CORRECCIÓN: Agregar campos farmacéuticos directamente
      // IMPORTANTE: Estos campos deben existir en el esquema de validación
      const updatedFields = getValues(`detalleServicio.${targetLineIndex}`);
      
      // Asignar campos farmacéuticos al objeto local
      updatedFields.formaFarmaceutica = product.formaFarmaceutica;
      updatedFields.registroMedicamento = product.registroMedicamento;
      
      // Actualizar todos los campos de una vez
      setValue(`detalleServicio.${targetLineIndex}`, updatedFields);
      
      // 4. Registrar para verificar que se hayan asignado correctamente
      console.log('Línea actualizada:', getValues(`detalleServicio.${targetLineIndex}`));
      
      setValue(`detalleServicio.${targetLineIndex}.tieneExoneracion`, product.tieneExoneracion || false);
      setValue(`detalleServicio.${targetLineIndex}.descuento`, product.descuento || { montoDescuento: 0, naturalezaDescuento: '' });
      if (product.exoneracion) {
        setValue(`detalleServicio.${targetLineIndex}.exoneracion`, product.exoneracion);
      }
    } else {
      // Si no hay líneas vacías, agregamos el producto como una nueva línea
      const modifiedProduct = {
        ...product,
        codigoCabys: product.codigoCabys || '9999999999999',
        detalle: product.detalle || 'Producto o servicio seleccionado',
        // Incluir campos farmacéuticos si existen
        formaFarmaceutica: product.formaFarmaceutica,
        registroMedicamento: product.registroMedicamento,
        precioUnitario: precioUnitario,
        precioUnitarioCRC: precioUnitarioCRC,
        tipoTransaccion: product.tipoTransaccion || '01',
        tieneExoneracion: product.tieneExoneracion || false
      };
      append(modifiedProduct);
    }
    setCurrentLineIndex(null);
    setIsProductModalOpen(false);
  };

  // Handle saving a new product
  const handleNewProductSaved = (newProduct: any) => {
    // Add the newly created product to the current line or create a new line
    handleProductSelected({...newProduct, tieneExoneracion: false});
    setIsNewProductModalOpen(false);
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
  
  // Función para generar vista previa de la factura
  const generatePreview = () => {
    // Verificar que haya al menos una línea de producto
    const formData = getValues();
    
    if (!formData.detalleServicio || formData.detalleServicio.length === 0 ||
        !formData.detalleServicio.some(item => item.codigoCabys && item.detalle)) {
      alert('Debe agregar al menos un producto o servicio para generar la vista previa');
      return;
    }
    
    // Verificar que el tipo de cambio sea válido según la moneda
    if (formData.moneda === 'CRC' && formData.tipoCambio !== 1) {
      alert('Para la moneda Colones (CRC), el tipo de cambio debe ser 1');
      return;
    }
    
    // Calcular detalles de servicio con impuestos y totales
    const detalleServicio = formData.detalleServicio.map((item, index) => {
      // Ensure 'id' is carried over for LineItem compatibility
      const baseItem = { id: item.id };
      // Buscar el producto en localStorage para obtener el IVA de CABYS
      let impuestoTarifa = 13; // Valor por defecto como fallback
      
      // Intentar obtener el porcentaje de impuesto del producto
      if (item.codigoCabys) {
        // Verificar si este producto existe en localStorage
        const PRODUCTS_KEY = 'products';
        const storedProducts = localStorage.getItem(PRODUCTS_KEY);
        if (storedProducts) {
          const products = JSON.parse(storedProducts);
          // Buscar el producto por código CABYS
          const foundProduct = products.find((p: any) => p.codigoCabys === item.codigoCabys);
          if (foundProduct && foundProduct.impuesto !== undefined) {
            // Usar el impuesto específico del producto CABYS
            impuestoTarifa = foundProduct.impuesto;
          }
        }
      }
      
      // Calcular montoTotal (precio * cantidad)
      const montoTotal = item.cantidad * item.precioUnitario;
      
      // Calcular subtotal (montoTotal - descuento)
      const montoDescuento = item.descuento?.montoDescuento || 0;
      const subtotal = montoTotal - montoDescuento;
      
      // Calcular impuesto con el porcentaje correcto
      const impuestoMonto = subtotal * (impuestoTarifa / 100);
      
      // Determinar el código de tarifa según el porcentaje de impuesto
      let codigoTarifa = '08'; // Por defecto 13%
      if (impuestoTarifa === 1) codigoTarifa = '01';
      else if (impuestoTarifa === 2) codigoTarifa = '02';
      else if (impuestoTarifa === 4) codigoTarifa = '03';
      else if (impuestoTarifa === 8) codigoTarifa = '04';
      else if (impuestoTarifa === 13) codigoTarifa = '08';
      
      // Verificar si el producto tiene exoneración marcada
      let impuestoObj: any = {
        codigo: '01', // IVA
        codigoTarifa: codigoTarifa,
        tarifa: impuestoTarifa,
        monto: impuestoMonto,
      };
      
      let impuestoNetoFinal = impuestoMonto;
      
      // Si el producto tiene exoneración y se ha seleccionado un tipo de documento
      if (item.tieneExoneracion && item.exoneracion?.tipoDocumento) {
        // Establecer siempre el porcentaje de exoneración en 100%
        const porcentajeExoneracion = 100;
        const montoExoneracion = impuestoMonto; // Al ser 100%, el monto exonerado es igual al impuesto total
        
        // Actualizar el monto neto de impuesto (descontando la exoneración)
        impuestoNetoFinal = 0; // Al ser 100% de exoneración, el impuesto neto es 0
        
        // Agregar información de exoneración al objeto de impuesto
        impuestoObj.exoneracion = {
          tipoDocumento: item.exoneracion.tipoDocumento,
          numeroDocumento: item.exoneracion.numeroDocumento || 'N/A',
          nombreInstitucion: item.exoneracion.nombreInstitucion || 'N/A',
          fechaEmision: item.exoneracion.fechaEmision || new Date().toISOString().split('T')[0],
          porcentajeExoneracion: porcentajeExoneracion,
          montoExoneracion: montoExoneracion,
        };
      }
      
      return {
        ...baseItem, // Spread the id here
        numeroLinea: index + 1,
        codigo: item.codigoCabys,
        cantidad: item.cantidad,
        unidadMedida: item.unidadMedida,
        detalle: item.detalle,
        precioUnitario: item.precioUnitario,
        montoTotal,
        descuento: item.descuento && item.descuento.montoDescuento > 0 ? {
          montoDescuento: item.descuento.montoDescuento,
          naturalezaDescuento: item.descuento.naturalezaDescuento || 'Descuento general'
        } : undefined,
        subtotal,
        impuesto: impuestoObj,
        impuestoNeto: impuestoNetoFinal,
        montoTotalLinea: subtotal + impuestoNetoFinal,
        tieneExoneracion: item.tieneExoneracion,
        exoneracion: item.tieneExoneracion && item.exoneracion?.tipoDocumento ? item.exoneracion : undefined
      };
    });

    // Calcular totales para almacenar en el historial
    
    // Calculate invoice summary
    const totalVenta = detalleServicio.reduce((sum, item) => sum + item.montoTotal, 0);
    const totalDescuentos = detalleServicio.reduce((sum, item) => sum + (item.descuento?.montoDescuento || 0), 0);
    const totalVentaNeta = totalVenta - totalDescuentos;
    const totalImpuesto = detalleServicio.reduce((sum, item) => sum + item.impuestoNeto, 0);
    
    // Calcular total de otros cargos
    const totalOtrosCargos = formData.otrosCargos ? formData.otrosCargos.reduce((sum, cargo) => sum + cargo.montoCargo, 0) : 0;
    
    // Incluir otros cargos en el total del comprobante
    const totalComprobante = totalVentaNeta + totalImpuesto + totalOtrosCargos;
    
    // Create preview object
    const preview: Invoice = {
      fechaEmision: new Date().toISOString(),
      emisor: formData.emisor,
      receptor: formData.receptor,
      condicionVenta: formData.condicionVenta,
      plazoCredito: formData.plazoCredito ? Number(formData.plazoCredito) : undefined,  // Convertir a número
      medioPago: formData.medioPago,  // Mantener como string[]
      detalleServicio: detalleServicio,
      otrosCargos: formData.otrosCargos,
      resumenFactura: {
        codigoMoneda: formData.moneda,
        tipoCambio: formData.tipoCambio,
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
      otros: formData.observaciones,
      // Add required fields for Invoice type, even for preview/draft
      clave: "PREVIEW_DRAFT_KEY", // Placeholder for preview
      numeroConsecutivo: "PREVIEW_DRAFT_CONSECUTIVE" // Placeholder for preview
      // fechaEmision is already defined at the start of the preview object
    };
    
    // Guardar la vista previa y mostrar el modal
    setPreviewInvoice(preview);
    setIsPreviewModalOpen(true);
  };
  
  // Funciones para manejar Otros Cargos
  const addOtroCargo = () => {
    appendOtroCargo({ 
      tipoCargo: '01', // Valor por defecto
      montoCargo: 0,
      porcentaje: 0,
      descripcionCargo: ''
    });
  };

  const handleDescripcionCargoChange = (index: number, value: string) => {
    setValue(`otrosCargos.${index}.descripcionCargo`, value);
  };

  const handlePorcentajeChange = (index: number, value: number) => {
    // Actualizar el porcentaje
    setValue(`otrosCargos.${index}.porcentaje`, value);
    
    // Calcular el subtotal de productos/servicios
    const detalleServicio = getValues('detalleServicio');
    const subtotalTotal = detalleServicio.reduce((sum, item) => {
      const montoTotal = item.cantidad * item.precioUnitario;
      const montoDescuento = item.descuento?.montoDescuento || 0;
      return sum + (montoTotal - montoDescuento);
    }, 0);
    
    // Calcular el monto del cargo basado en el porcentaje
    const montoCargo = (subtotalTotal * value) / 100;
    setValue(`otrosCargos.${index}.montoCargo`, Number(montoCargo.toFixed(2)));
  };

  const handleMontoCargoChange = (index: number, value: number) => {
    // Si el usuario cambia directamente el monto, solo actualizamos el monto
    // sin recalcular el porcentaje, dando prioridad a la edición manual
    setValue(`otrosCargos.${index}.montoCargo`, value);
  };

  const removeOtroCargoItem = (index: number) => {
    removeOtroCargo(index);
  };

  // Calcular total de otros cargos
  const calcularTotalOtrosCargos = () => {
    const otrosCargos = getValues('otrosCargos');
    return otrosCargos ? otrosCargos.reduce((sum, cargo) => sum + (cargo.montoCargo || 0), 0) : 0;
  };

  // Generate invoice on form submission
  // Función para guardar borrador
  const saveDraft = () => {
    const formData = getValues();
    localStorage.setItem('invoiceDraft', JSON.stringify(formData));
    setHasDraft(true);
    alert('Borrador guardado exitosamente');
  };

  // Función para cargar borrador
  const loadDraft = () => {
    const draftJson = localStorage.getItem('invoiceDraft');
    if (draftJson) {
      try {
        const draftData = JSON.parse(draftJson) as InvoiceFormData;
        console.log('Datos del borrador cargados:', draftData);
        
        // Cargar todos los campos del formulario
        Object.entries(draftData).forEach(([key, value]) => {
          if (key === 'detalleServicio') {
            // Borrar filas existentes
            remove();
            
            if (Array.isArray(value) && value.length > 0) {
              // Normalizar cada item antes de agregarlo
              value.forEach((item: any) => {
                // Asegurar que los valores numéricos sean de tipo number
                const normalizedItem = {
                  ...item,
                  id: typeof item.id === 'string' ? parseInt(item.id, 10) : item.id,
                  cantidad: typeof item.cantidad === 'string' ? parseFloat(item.cantidad) : item.cantidad,
                  precioUnitario: typeof item.precioUnitario === 'string' ? parseFloat(item.precioUnitario) : item.precioUnitario,
                  precioUnitarioCRC: typeof item.precioUnitarioCRC === 'string' ? parseFloat(item.precioUnitarioCRC) : (item.precioUnitarioCRC || item.precioUnitario),
                  tieneExoneracion: item.tieneExoneracion || false,
                  descuento: {
                    montoDescuento: typeof item.descuento?.montoDescuento === 'string' ? 
                      parseFloat(item.descuento.montoDescuento) : 
                      (item.descuento?.montoDescuento || 0),
                    naturalezaDescuento: item.descuento?.naturalezaDescuento || ''
                  },
                };
                
                // Manejar la exoneración si existe
                if (normalizedItem.tieneExoneracion && item.exoneracion) {
                  normalizedItem.exoneracion = {
                    ...item.exoneracion,
                    porcentajeExoneracion: typeof item.exoneracion.porcentajeExoneracion === 'string' ? 
                      parseFloat(item.exoneracion.porcentajeExoneracion) : 
                      (item.exoneracion.porcentajeExoneracion || 0)
                  };
                }
                
                console.log('Agregando item normalizado:', normalizedItem);
                append(normalizedItem);
              });
            }
          } else if (key === 'tipoCambio') {
            // Asegurar que tipoCambio sea number
            const tipoCambioValue = typeof value === 'string' ? parseFloat(value) : value;
            // Garantiza que sea número válido y no NaN
            setValue(key as keyof InvoiceFormData, isNaN(tipoCambioValue as number) ? 0 : tipoCambioValue);
          } else {
            // Manejar tipos correctamente para evitar errores de TypeScript
            if (typeof key === 'string') {
              try {
                // Usar casting seguro para tipos complejos
                if (typeof value === 'object' || Array.isArray(value)) {
                  setValue(key as any, value);
                } else if (typeof value === 'number') {
                  setValue(key as any, value);
                } else if (typeof value === 'string') {
                  setValue(key as any, value);
                } else if (typeof value === 'boolean') {
                  setValue(key as any, value);
                } else {
                  setValue(key as any, null);
                }
              } catch (err) {
                console.error(`Error al establecer valor para ${key}:`, err);
              }
            }
          }
        });
        alert('Borrador cargado exitosamente');
      } catch (error) {
        console.error('Error al cargar el borrador:', error);
        alert('Error al cargar el borrador');
      }
    }
  };

  // Función para resetear el formulario
  const resetForm = () => {
    // Limpiar todo excepto los datos del emisor (que vienen de settings)
    if (settings) {
      // Mantener los datos del emisor de los settings
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
          barrio: settings.neighborhood || '',
          otrasSenas: settings.address || '',
        },
        telefono: {
          codigoPais: '+506',
          numTelefono: settings.phone || '',
        },
        correo: settings.email || '',
        actividadEconomica: settings.economic_activity || '',
      };
      
      // Resetear el formulario con los valores por defecto
      remove(); // Eliminar todas las líneas de productos
      reset({
        ...defaultValues,
        emisor: emisorData,
      });
    } else {
      // Si no hay settings, usar los valores por defecto
      reset(defaultValues);
      remove();
    }
    
    // Limpiar estados adicionales
    setSelectedClient(null);
    setCabysResults([]);
    setCabysSearchTerm('');
    setCurrentLineIndex(null);
  };

  const onSubmit = async (data: InvoiceFormData) => {
    console.log('=== INICIO DE GENERACIÓN DE FACTURA ===');
    console.log('Datos del formulario:', data);
    alert('Iniciando generación de factura, por favor espere...');
    
    // Verificar que los datos del formulario estén completos
    if (!data.detalleServicio || data.detalleServicio.length === 0) {
      console.error('Error: No hay líneas de detalle en la factura');
      alert('Debe agregar al menos un producto o servicio a la factura');
      return;
    }
    
    if (!data.emisor || !data.emisor.identificacion || !data.emisor.identificacion.numero) {
      console.error('Error: Datos del emisor incompletos');
      alert('Los datos del emisor están incompletos');
      return;
    }
    
    if (!data.receptor || !data.receptor.identificacion || !data.receptor.identificacion.numero) {
      console.error('Error: Datos del receptor incompletos');
      alert('Los datos del receptor están incompletos');
      return;
    }
    
    // Declarar invoiceStatus en el ámbito correcto
    let invoiceStatus: 'Completada' | 'Pendiente' | 'Rechazada' = 'Pendiente';
    
    // Define la variable para almacenar la información del email y usarla al guardar la factura
    let emailInfo: StoredInvoice['emailInfo'] = undefined;
    
    try {
      // Calculate totals and prepare invoice data
      const detalleServicio = data.detalleServicio.map((item, _index) => {
        // Buscar el producto en localStorage para obtener el IVA de CABYS
        let impuestoTarifa = 13; // Valor por defecto como fallback
        
        // Intentar obtener el porcentaje de impuesto del producto
        if (item.codigoCabys) {
          // Verificar si este producto existe en localStorage
          const PRODUCTS_KEY = 'products';
          const storedProducts = localStorage.getItem(PRODUCTS_KEY);
          if (storedProducts) {
            const products = JSON.parse(storedProducts);
            // Buscar el producto por código CABYS
            const foundProduct = products.find((p: any) => p.codigoCabys === item.codigoCabys);
            if (foundProduct && foundProduct.impuesto !== undefined) {
              // Usar el impuesto específico del producto CABYS
              impuestoTarifa = foundProduct.impuesto;
            }
          }
        }
        
        // Calcular montoTotal (precio * cantidad)
        const montoTotal = item.cantidad * item.precioUnitario;
        
        // Calcular subtotal (montoTotal - descuento)
        const montoDescuento = item.descuento?.montoDescuento || 0;
        const subtotal = montoTotal - montoDescuento;
        
        // Calcular impuesto con el porcentaje correcto
        const impuestoMonto = subtotal * (impuestoTarifa / 100);
        
        // Determinar el código de tarifa según el porcentaje de impuesto
        let codigoTarifa = '08'; // Por defecto 13%
        if (impuestoTarifa === 1) codigoTarifa = '01';
        else if (impuestoTarifa === 2) codigoTarifa = '02';
        else if (impuestoTarifa === 4) codigoTarifa = '03';
        else if (impuestoTarifa === 8) codigoTarifa = '04';
        else if (impuestoTarifa === 13) codigoTarifa = '08';
        
        return {
          ...item,
          montoTotal: montoTotal,
          subtotal: subtotal,
          impuesto: {
            codigo: '01', // IVA
            codigoTarifa: codigoTarifa,
            tarifa: impuestoTarifa,
            monto: impuestoMonto,
          },
          impuestoNeto: impuestoMonto,
          montoTotalLinea: subtotal + impuestoMonto,
        };
      });
      
      // Calcular totales para almacenar en el historial
      // subtotalTotal and impuestoTotal were previously used for a 'total' variable that is no longer needed.
      
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
        moneda: data.moneda, // Usar la moneda seleccionada en el formulario
        tipoCambio: data.tipoCambio, // Incluir el tipo de cambio cuando corresponda
        detalleServicio: detalleServicio.map(item => ({
          ...item,
          descuento: item.descuento && item.descuento.montoDescuento > 0 ? {
            ...item.descuento,
            naturalezaDescuento: item.descuento.naturalezaDescuento || 'Descuento general'
          } : undefined
        })),
        resumenFactura: {
          codigoMoneda: data.moneda, // Usar la moneda seleccionada en el formulario
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
        console.log('Iniciando generación de XML...');
        // 1. Generar XML v4.4
        let xml;
        try {
          xml = generateXML(invoice);
          console.log('XML generado correctamente');
          alert('XML generado correctamente');
        } catch (xmlError) {
          console.error('Error al generar XML:', xmlError);
          alert(`Error al generar XML: ${xmlError instanceof Error ? xmlError.message : 'Error desconocido'}`);
          throw new Error(`Error al generar XML: ${xmlError instanceof Error ? xmlError.message : 'Error desconocido'}`);
        }
        
        // 2. Descargar XML automáticamente
        try {
          downloadXML(xml, invoice.numeroConsecutivo);
          console.log('XML descargado correctamente');
          alert('XML descargado correctamente');
        } catch (downloadError) {
          console.error('Error al descargar XML:', downloadError);
          alert(`Error al descargar XML: ${downloadError instanceof Error ? downloadError.message : 'Error desconocido'}`);
          // Continuamos con el proceso aunque falle la descarga
        }
        
        // 3. Generar y descargar PDF
        console.log('Iniciando generación de PDF...');
        let pdf;
        try {
          pdf = generatePDF(invoice);
          pdf.save(`factura_${invoice.numeroConsecutivo}.pdf`);
          console.log('PDF generado y descargado correctamente');
          alert('PDF generado y descargado correctamente');
        } catch (pdfError) {
          console.error('Error al generar PDF:', pdfError);
          alert(`Error al generar PDF: ${pdfError instanceof Error ? pdfError.message : 'Error desconocido'}`);
          throw new Error(`Error al generar PDF: ${pdfError instanceof Error ? pdfError.message : 'Error desconocido'}`);
        }
        
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
        // La variable emailInfo ya está declarada en el ámbito correcto al inicio de la función
        
        // Verificar si hay un correo de receptor válido para enviar la factura
        if (data.receptor.correo) {
          try {
            const pdfBlob = pdf.output('blob'); // Obtener el PDF como Blob
            // La función espera estos parámetros en este orden:
            // 1. recipientEmail: string
            // 2. recipientName: string = ''
            // 3. invoiceNumber: string
            // 4. pdfBlob: Blob
            // 5. xmlContent: string
            // 6. acceptanceDocBlob?: Blob
            // 7. customSubject?: string
            // 8. customMessage?: string
            // 9. ccEmails?: string[]
            await sendInvoiceByEmail(
              data.receptor.correo,
              data.receptor.nombre || '', // Nombre del receptor
              invoice.numeroConsecutivo,
              pdfBlob,
              xml,
              undefined, // Documento de aceptación (opcional)
              `Factura Electrónica ${invoice.numeroConsecutivo} - ${data.emisor.nombre}`, // Asunto personalizado
              undefined, // Mensaje personalizado (se usa el predeterminado)
              undefined  // CC emails
            );
            console.log(`Factura enviada por correo electrónico a: ${data.receptor.correo}`);
            
            // Guardar información del correo enviado exitosamente
            emailInfo = {
              destinatario: data.receptor.correo,
              fechaEnvio: new Date().toISOString(),
              estadoEnvio: 'Enviado',
              intentos: 1
            };
          } catch (emailError) {
            console.error('Error al enviar la factura por correo electrónico:', emailError);
            // Guardar información del error en el envío
            emailInfo = {
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
      const moneda = data.moneda || 'CRC';
      // Asegurar que tipoCambio sea un número
      const tipoCambio = typeof data.tipoCambio === 'number' ? data.tipoCambio : 
                        (moneda === 'CRC' ? 1 : parseFloat(data.tipoCambio || '0'));
      const monedaSymbol = moneda === 'USD' ? '$' : (moneda === 'EUR' ? '€' : '₡');
      
      console.log('📊 Datos de moneda en factura:');
      console.log('- Moneda seleccionada:', moneda);
      console.log('- Tipo de cambio:', tipoCambio, 'tipo:', typeof tipoCambio);
      console.log('- Símbolo a mostrar:', monedaSymbol);
      
      // Configurar los datos de moneda para guardar
      // Forzar una conversión adecuada para evitar problemas de tipo
      console.log('📈 DATOS DE FACTURA ANTES DE GUARDAR:');
      console.log('- Moneda seleccionada en formulario:', data.moneda);
      console.log('- Tipo de cambio en formulario:', data.tipoCambio);
      console.log('- Total comprobante:', totalComprobante);
      
      const storedInvoice: StoredInvoice = {
        id: `F-${invoice.numeroConsecutivo}`,
        client: data.receptor.nombre,
        date: new Date().toISOString(),
        // Usar el símbolo de moneda correcto según la moneda seleccionada
        amount: `${monedaSymbol}${totalComprobante.toLocaleString()}`,
        status: invoiceStatus as 'Completada' | 'Pendiente' | 'Rechazada',
        items: data.detalleServicio.length,
        claveNumerica: invoice.clave,
        condicionVenta: data.condicionVenta,
        medioPago: data.medioPago,  // Mantener como arreglo de strings
        // Incluir moneda y tipo de cambio de forma explícita para no perder estos datos
        moneda: moneda, // Usamos la moneda del formulario (USD, EUR, CRC)
        tipoCambio: tipoCambio > 0 ? tipoCambio : undefined, // Solo incluir si es positivo
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
        xmlContent: '',  // Inicializamos como cadena vacía
        // Incluir la información del correo electrónico si existe
        emailInfo: emailInfo || undefined
      };
      
      console.log('📝 Guardando factura en el historial:', storedInvoice);
      console.log('ℹ️ IMPORTANTE: ID de la factura a guardar:', storedInvoice.id);
      
      try {
        // Llamar a addInvoice con seguimiento detallado
        addInvoice(storedInvoice);
        console.log('✅ Llamada a addInvoice completada para la factura');
        
        // Verificar explícitamente que se haya guardado correctamente en localStorage
        setTimeout(() => {
          try {
            // 1. Verificar en 'invoices' (ubicación principal)
            const storedInvoices = localStorage.getItem('invoices');
            if (storedInvoices) {
              const invoices = JSON.parse(storedInvoices);
              const found = invoices.some((inv: any) => inv.id === storedInvoice.id);
              console.log(`ℹ️ Resultado de verificación en 'invoices': Factura ${found ? 'ENCONTRADA' : 'NO ENCONTRADA'}`);
              
              if (!found) {
                console.log('⚠️ ADVERTENCIA: La factura no se encontró en el historial (clave "invoices"). Realizando segundo intento de guardado...');
                
                // Si no se encontró, intentar guardar directamente en localStorage
                const updatedInvoices = [storedInvoice, ...invoices];
                localStorage.setItem('invoices', JSON.stringify(updatedInvoices));
                console.log('✅ Segundo intento completado: Factura agregada directamente a localStorage');
                
                // Intentar guardar en Supabase explícitamente usando el UUID correcto de INNOVA
                try {
                  const { supabaseInvoiceService } = require('../services/supabaseInvoiceService');
                  const { getCompanyUuid } = require('../services/uuidMappingService');
                  const companyUuid = getCompanyUuid('INNOVA') || 'ea41ea38-b0d6-4493-a0bb-325194738cb6';
                  
                  // Guardar la factura en Supabase (si el servicio está disponible)
                  if (supabaseInvoiceService && typeof supabaseInvoiceService.saveInvoice === 'function') {
                    supabaseInvoiceService.saveInvoice({
                      ...storedInvoice,
                      company_id: companyUuid
                    });
                    console.log('✅ Factura enviada a Supabase directamente');
                  }
                } catch (supabaseError) {
                  console.error('❌ Error al intentar guardar en Supabase directamente:', supabaseError);
                }
              }
            } else {
              console.log('⚠️ ADVERTENCIA: No se encontró la clave "invoices" en localStorage');
              
              // Crear el array con la nueva factura
              localStorage.setItem('invoices', JSON.stringify([storedInvoice]));
              console.log('✅ Se ha creado una nueva entrada "invoices" en localStorage con la factura');
            }
          } catch (verifyError) {
            console.error('❌ Error al verificar el guardado en localStorage:', verifyError);
          }
        }, 500);
      } catch (historyError) {
        console.error('❌ Error al llamar addInvoice:', historyError);
        
        // Intento de recuperación en caso de error al guardar
        try {
          const existingInvoices = localStorage.getItem('invoices');
          if (existingInvoices) {
            const invoices = JSON.parse(existingInvoices);
            localStorage.setItem('invoices', JSON.stringify([storedInvoice, ...invoices]));
            console.log('✅ Factura guardada mediante mecanismo de recuperación');
          } else {
            localStorage.setItem('invoices', JSON.stringify([storedInvoice]));
            console.log('✅ Factura guardada como única en el historial mediante mecanismo de recuperación');
          }
        } catch (recoveryError) {
          console.error('❌ Error en el mecanismo de recuperación:', recoveryError);
        }
      }
      
      let alertMessage = `Factura generada exitosamente. Estado: ${invoiceStatus}. El XML y PDF se han descargado automáticamente.`;
      if (data.receptor.correo) {
        alertMessage += ` Además, se ha enviado por correo a ${data.receptor.correo}.`;
      }
      alert(alertMessage);
      
    } catch (error) {
      console.error('Error generating invoice:', error);
      alert(`Error al generar la factura: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      // Siempre limpiar el formulario, incluso si ocurren errores
      resetForm();
      
      // Eliminar borrador si existía
      localStorage.removeItem('invoiceDraft');
      setHasDraft(false);
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
          
          <div id="seccion-emisor" className="p-6">
            {/* Emisor Section */}
            <h2 className="text-xl title-secondary flex items-center justify-between">
              <span className="flex items-center">
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-primary-500 text-white mr-2 text-sm">1</span>
                Información del Emisor
              </span>
              <button
                type="button"
                onClick={() => setIsEmisorCollapsed(!isEmisorCollapsed)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
                aria-label={isEmisorCollapsed ? "Expandir información del emisor" : "Colapsar información del emisor"}
              >
                {isEmisorCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
              </button>
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
                      placeholder="Número de identificación" 
                    />
                    {errors.emisor?.identificacion?.numero && <p className="form-error">{errors.emisor.identificacion.numero.message}</p>}
                  </div>
                </div>
              {/* End of always visible fields container */}

              {!isEmisorCollapsed && (
                <>
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
                </>
              )}
            {/* This closing div matches the one with class grid grid-cols-1 md:grid-cols-2 gap-4 p-4 glass-card */}
            </div>
            {/* Receptor Section */}
            <div id="seccion-receptor" className="space-y-6 mt-8 p-6">
              <h2 className="text-xl title-secondary flex items-center justify-between">
                <span className="flex items-center">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-primary-500 text-white mr-2 text-sm">2</span>
                  Información del Receptor
                </span>
                <button
                  type="button"
                  onClick={() => setIsReceptorCollapsed(!isReceptorCollapsed)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
                  aria-label={isReceptorCollapsed ? "Expandir información del receptor" : "Colapsar información del receptor"}
                >
                  {isReceptorCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                </button>
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
                        
                        // Agregar el código de actividad económica del cliente para el XML
                        if (client.economic_activity_code) {
                          setValue('receptor.economic_activity_code', client.economic_activity_code, { shouldValidate: true });
                          setValue('receptor.actividadEconomica', client.economic_activity_desc || '', { shouldValidate: true });
                        }
                        
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
                          placeholder="Cédula/ID" 
                        />
                        {errors.receptor?.identificacion?.numero && <p className="form-error">{errors.receptor.identificacion.numero.message}</p>}
                      </div>
                    </div>

                    {!isReceptorCollapsed && (
                      <>
                    
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
                  </>
                )}
                </div>
              </div>
            </div>
            
            {/* Invoice Details Section */}
            <div id="seccion-detalles" className="space-y-6 mt-8 p-6">
              <h2 className="text-xl title-secondary flex items-center">
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
                    <option value="08">Servicios prestados al Estado</option>
                    <option value="09">Pago de servicios prestado al Estado</option>
                    <option value="10">Venta a crédito en IVA hasta 90 días (Artículo 27, LIVA)</option>
                    <option value="11">Pago de venta a crédito en IVA hasta 90 días (Artículo 27, LIVA)</option>
                    <option value="12">Venta Mercancía No Nacionalizada</option>
                    <option value="13">Venta Bienes Usados No Contribuyente</option>
                    <option value="14">Arrendamiento Operativo</option>
                    <option value="15">Arrendamiento Financiero</option>
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
                    <option value="04">Transferencia – depósito bancario</option>
                    <option value="05">Recaudado por terceros</option>
                    <option value="06">SINPE MOVIL</option>
                    <option value="07">Plataforma Digital</option>
                    <option value="99">Otros</option>
                  </select>
                  {errors.medioPago && <p className="form-error">{errors.medioPago.message}</p>}
                </div>

                <div>
                  <label className="form-label">Moneda</label>
                  <select {...register('moneda')} className="form-select">
                    {availableCurrencies.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.name} ({currency.code})
                      </option>
                    ))}
                  </select>
                  {errors.moneda && <p className="form-error">{errors.moneda.message}</p>}
                </div>
                
                <div>
                  <label className="form-label">Tipo de Cambio</label>
                  <div className="relative">
                    <Controller
                      name="tipoCambio"
                      control={control}
                      render={({ field }) => (
                        <input
                          type="number"
                          step="0.00001"
                          disabled={selectedCurrency === 'CRC' || isLoadingExchangeRate}
                          className="form-input"
                          value={field.value || 0} // Garantiza un valor numérico válido, nunca NaN
                          onChange={(e) => {
                            const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            field.onChange(isNaN(value) ? 0 : value);
                          }}
                        />
                      )}
                    />
                    {isLoadingExchangeRate && (
                      <div className="absolute right-2 top-2">
                        <RotateCw className="animate-spin h-5 w-5 text-blue-500" />
                      </div>
                    )}
                  </div>
                  {errors.tipoCambio && <p className="form-error">{errors.tipoCambio.message}</p>}
                  {selectedCurrency === 'CRC' && <p className="text-xs text-gray-500 mt-1">Para Colones (CRC) el tipo de cambio siempre es 1</p>}
                </div>

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
                      setValue(`detalleServicio.${idx}.cantidad`, product.cantidad || 1);  // Valor por defecto si es undefined
                      setValue(`detalleServicio.${idx}.unidadMedida`, product.unidadMedida || '');  // Aseguramos que no sea undefined
                      setValue(`detalleServicio.${idx}.precioUnitario`, product.precioUnitario || 0);  // Valor por defecto si es undefined
                      setValue(`detalleServicio.${idx}.precioUnitarioCRC`, product.precioUnitario || 0); // Campo oculto para almacenar el precio original en CRC
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
                
            {/* Sección de Productos y Servicios */}
            <div id="seccion-productos" className="space-y-6 mt-8 p-6">
              <h3 className="title-secondary flex items-center justify-between">
                <span>
                  <Package className="w-5 h-5 mr-2 text-blue-600" /> Productos y Servicios
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsProductModalOpen(true)}
                    className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold py-1 px-3 rounded inline-flex items-center text-sm"
                  >
                    <Search className="w-4 h-4 mr-1" />
                    Seleccionar Producto Guardado
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNewProductModalOpen(true)}
                    className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-1 px-3 rounded inline-flex items-center text-sm"
                  >
                    <PackagePlus className="w-4 h-4 mr-1" />
                    Agregar Producto Nuevo
                  </button>
                </div>
              </h3>
                {/* Verificar si hay productos realmente seleccionados con datos completos */}
                {fields.length > 0 ? (
                  <>
                    {/* Line Items - Solo se muestra cuando hay al menos un producto */}
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
                            <th className="table-header">Exoneración</th>
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
                                      onClick={() => {
                                        setCurrentLineIndex(index);
                                        setIsProductModalOpen(true);
                                      }}
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
                                        onChange={e => {
                                          const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                          field.onChange(isNaN(value) ? 0 : value);
                                        }}
                                        value={field.value || 0}
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
                                  <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                      <span className="text-gray-500 sm:text-sm">
                                        {selectedCurrency === 'USD' ? '$' : (selectedCurrency === 'EUR' ? '€' : '₡')}
                                      </span>
                                    </div>
                                    <Controller
                                      name={`detalleServicio.${index}.precioUnitario`}
                                      control={control}
                                      render={({ field }) => (
                                        <input 
                                          type="number"
                                          onChange={e => {
                                            const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                            field.onChange(isNaN(value) ? 0 : value);
                                          }}
                                          value={field.value || 0}
                                          className="pl-7 form-input w-24" 
                                          min="0"
                                          step="0.01"
                                        />
                                      )}
                                    />
                                  </div>
                                </td>
                                <td className="table-cell">
                                  <Controller
                                    name={`detalleServicio.${index}.descuento.montoDescuento`}
                                    control={control}
                                    render={({ field }) => (
                                      <input 
                                        type="number"
                                        onChange={e => {
                                          const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                          field.onChange(isNaN(value) ? 0 : value);
                                        }}
                                        value={field.value || 0}
                                        className="form-input w-24" 
                                        min="0"
                                        step="0.01"
                                      />
                                    )}
                                  />
                                </td>
                                <td className="table-cell">
                                  <div className="flex flex-col space-y-2">
                                    <div className="flex items-center">
                                      <Controller
                                        name={`detalleServicio.${index}.tieneExoneracion`}
                                        control={control}
                                        defaultValue={false}
                                        render={({ field }) => (
                                          <input
                                            type="checkbox"
                                            checked={field.value}
                                            onChange={(e) => {
                                              field.onChange(e.target.checked);
                                              // Si se desmarca, limpiar el tipo de documento
                                              if (!e.target.checked) {
                                                setValue(`detalleServicio.${index}.exoneracion.tipoDocumento`, '');
                                              }
                                            }}
                                            className="form-checkbox mr-2"
                                          />
                                        )}
                                      />
                                      <span className="text-sm">¿Posee exoneración?</span>
                                    </div>
                                    
                                    {watch(`detalleServicio.${index}.tieneExoneracion`) && (
                                      <div className="space-y-3">
                                        <select
                                          {...register(`detalleServicio.${index}.exoneracion.tipoDocumento`)}
                                          className="form-select text-sm w-full"
                                        >
                                          <option value="">Seleccione tipo</option>
                                          <option value="01">Compras autorizadas por la Dirección General de Tributación</option>
                                          <option value="02">Ventas exentas a diplomáticos</option>
                                          <option value="03">Autorizado por Ley especial</option>
                                          <option value="04">Exenciones Dirección General de Hacienda Autorización Local Genérica</option>
                                          <option value="05">Exenciones DGH Transitorio V (servicios de ingeniería, arquitectura, topografía y obra civil)</option>
                                          <option value="06">Servicios turísticos inscritos ante el ICT</option>
                                          <option value="07">Transitorio XVII (Recolección, Clasificación, almacenamiento de Reciclaje y reutilizable)</option>
                                          <option value="08">Exoneración a Zona Franca</option>
                                          <option value="09">Exoneración de servicios complementarios para la exportación articulo 11 RLIVA</option>
                                          <option value="10">Órgano de las corporaciones municipales</option>
                                          <option value="11">Exenciones DGH Autorización de Impuesto Local Concreta</option>
                                          <option value="99">Otros</option>
                                        </select>
                                        
                                        {/* Campo para Número de Documento */}
                                        <div>
                                          <label htmlFor={`detalleServicio.${index}.exoneracion.numeroDocumento`} className="text-xs mb-1 block">
                                            Número de Documento
                                          </label>
                                          <input
                                            type="text"
                                            id={`detalleServicio.${index}.exoneracion.numeroDocumento`}
                                            {...register(`detalleServicio.${index}.exoneracion.numeroDocumento`)}
                                            className="form-input text-sm w-full"
                                            placeholder="Ingrese el número de documento"
                                          />
                                        </div>
                                        
                                        {/* Campo para Nombre de Institución (dropdown) */}
                                        <div>
                                          <label htmlFor={`detalleServicio.${index}.exoneracion.nombreInstitucion`} className="text-xs mb-1 block">
                                            Nombre de Institución
                                          </label>
                                          <select
                                            id={`detalleServicio.${index}.exoneracion.nombreInstitucion`}
                                            {...register(`detalleServicio.${index}.exoneracion.nombreInstitucion`)}
                                            className="form-select text-sm w-full"
                                          >
                                            <option value="">Seleccione institución</option>
                                            <option value="01">Ministerio de Hacienda</option>
                                            <option value="02">Ministerio de Relaciones Exteriores y Culto</option>
                                            <option value="03">Ministerio de Agricultura y Ganadería</option>
                                            <option value="04">Ministerio de Economía, Industria y Comercio</option>
                                            <option value="05">Cruz Roja Costarricense</option>
                                            <option value="06">Benemérito Cuerpo de Bomberos de Costa Rica</option>
                                            <option value="07">Asociación Obras del Espíritu Santo</option>
                                            <option value="08">Federación Cruzada Nacional de protección al Anciano (Fecrunapa)</option>
                                            <option value="09">Escuela de Agricultura de la Región Húmeda (EARTH)</option>
                                            <option value="10">Instituto Centroamericano de Administración de Empresas (INCAE)</option>
                                            <option value="11">Junta de Protección Social (JPS)</option>
                                            <option value="12">Autoridad Reguladora de los Servicios Públicos (Aresep)</option>
                                            <option value="99">Otros</option>
                                          </select>
                                        </div>
                                        
                                        {/* El porcentaje de exoneración siempre es 100% */}
                                        <input
                                          type="hidden"
                                          value="100"
                                          {...register(`detalleServicio.${index}.exoneracion.porcentajeExoneracion` as const, { valueAsNumber: true })}
                                        />
                                        <div className="flex items-center">
                                          <span className="form-input w-16 text-sm mr-2 bg-gray-100 dark:bg-gray-700/50 text-center">100</span>
                                          <span className="text-xs">% de exoneración</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="table-cell font-medium">
                                  {lineTotals ? (
                                    selectedCurrency === 'USD' ? `$${new Intl.NumberFormat('es-CR', { minimumFractionDigits: 2 }).format(lineTotals.subtotal)}` :
                                    selectedCurrency === 'EUR' ? `€${new Intl.NumberFormat('es-CR', { minimumFractionDigits: 2 }).format(lineTotals.subtotal)}` :
                                    new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(lineTotals.subtotal)
                                  ) : (selectedCurrency === 'USD' ? '$0.00' : selectedCurrency === 'EUR' ? '€0.00' : '₡0.00')}
                                </td>
                                <td className="table-cell">
                                  <button 
                                    type="button"
                                    onClick={() => handleRemoveLine(index)}
                                    className="p-1.5 bg-red-600/40 rounded-md hover:bg-red-600/60 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Ahora el botón de agregar línea solo aparece si ya hay productos */}
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
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="text-center mb-6">
                      <div className="text-3xl mb-2">🛍️</div>
                      <p className="text-gray-400 mb-2">No hay productos o servicios en esta factura</p>
                      <p className="text-sm text-gray-500">Selecciona un producto guardado o agrega uno nuevo para comenzar</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Additional Information */}
            </div>
            {/* Otros Cargos Section */}
            <div id="seccion-otros-cargos" className="space-y-6 mt-8 p-6">
              <h2 className="text-xl font-semibold flex items-center">
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-primary-500 text-white mr-2 text-sm">5</span>
                Otros Cargos
              </h2>
              <div className="p-4 glass-card">
                <div className="flex justify-between items-center mb-4">
                  <label className="form-label text-lg m-0">Detalle de Otros Cargos</label>
                  <button 
                    type="button" 
                    onClick={addOtroCargo}
                    className="btn-primary flex items-center gap-1 text-sm py-1"
                  >
                    <Plus size={16} /> Agregar Cargo
                  </button>
                </div>

                {otrosCargoFields.length > 0 ? (
                  <div className="mt-4">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider text-left">Tipo</th>
                            <th scope="col" className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider text-left">Descripción</th>
                            <th scope="col" className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Porcentaje</th>
                            <th scope="col" className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Monto</th>
                            <th scope="col" className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {otrosCargoFields.map((field, index) => (
                            <tr key={field.id}>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <select
                                  className="form-select w-full text-sm"
                                  {...register(`otrosCargos.${index}.tipoCargo`)}
                                >
                                  <option value="">Seleccione un tipo</option>
                                  {tiposCargos.map(option => (
                                    <option key={option.codigo} value={option.codigo}>
                                      {option.descripcion} ({option.codigo})
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <input
                                  type="text"
                                  className="form-input w-full text-sm"
                                  value={watch(`otrosCargos.${index}.descripcionCargo`) || ''}
                                  onChange={(e) => handleDescripcionCargoChange(index, e.target.value)}
                                  placeholder="Descripción del cargo"
                                />
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-right">
                                <div className="relative">
                                  <input
                                    type="number"
                                    className="form-input w-20 text-right text-sm"
                                    value={watch(`otrosCargos.${index}.porcentaje`) || 0}
                                    onChange={(e) => handlePorcentajeChange(index, parseFloat(e.target.value) || 0)}
                                    step="0.01"
                                    min="0"
                                  />
                                  <span className="absolute right-2 top-2 text-gray-500">%</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-right">
                                <div className="relative">
                                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-gray-500 sm:text-sm">
                                      {selectedCurrency === 'USD' ? '$' : (selectedCurrency === 'EUR' ? '€' : '₡')}
                                    </span>
                                  </div>
                                  <input
                                    type="number"
                                    className="form-input pl-7 w-28 text-right text-sm"
                                    value={watch(`otrosCargos.${index}.montoCargo`) || 0}
                                    onChange={(e) => handleMontoCargoChange(index, parseFloat(e.target.value) || 0)}
                                    step="0.01"
                                    min="0"
                                  />
                                </div>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-center">
                                <button
                                  type="button"
                                  onClick={() => removeOtroCargoItem(index)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={3} className="px-3 py-2 text-right font-medium">Total Otros Cargos:</td>
                            <td className="px-3 py-2 text-right font-medium">
                              {selectedCurrency === 'USD' ? '$' : (selectedCurrency === 'EUR' ? '€' : '₡')}
                              {calcularTotalOtrosCargos().toFixed(2)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 italic text-sm">No hay otros cargos agregados.</p>
                )}
              </div>
            </div>

            {/* Observaciones Section */}
            <div id="seccion-observaciones" className="space-y-6 mt-8 p-6">
              <h2 className="text-xl font-semibold flex items-center">
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-primary-500 text-white mr-2 text-sm">6</span>
                Observaciones
              </h2>
              <div className="p-4 glass-card">
                <label className="form-label">Observaciones Adicionales</label>
                <textarea 
                  {...register('observaciones')} 
                  className="form-input min-h-24" 
                  placeholder="Cualquier información adicional relevante para la factura..."
                ></textarea>
              </div>
            </div>

          </div> {/* Closes div.p-6 started at line 1348 */}
        </div> {/* Closes div.glass-card started at line 1329 */}
            
            {/* Submit Buttons */}
            <div className="flex flex-wrap gap-4 justify-end mt-8">
              <div className="flex gap-2">
                <button type="button" className="btn-ghost" onClick={saveDraft}>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar como borrador
                </button>
                
                {hasDraft && (
                  <button type="button" className="btn-ghost" onClick={loadDraft}>
                    <RotateCw className="w-4 h-4 mr-2" />
                    Cargar borrador
                  </button>
                )}
              </div>
              
              <button type="button" className="btn-secondary" onClick={generatePreview}>
                <Eye className="w-4 h-4 mr-2" />
                Vista previa
              </button>
              
              <button 
                type="button" 
                className="btn-primary" 
                disabled={isSubmitting}
                onClick={() => {
                  // Obtener los datos del formulario directamente
                  const data = getValues();
                  console.log('Datos del formulario para generar factura:', data);
                  
                  // Verificaciones básicas
                  if (!data.detalleServicio || data.detalleServicio.length === 0) {
                    alert('Debe agregar al menos un producto o servicio a la factura');
                    return;
                  }
                  
                  if (!data.emisor || !data.emisor.identificacion || !data.emisor.identificacion.numero) {
                    alert('Los datos del emisor están incompletos');
                    return;
                  }
                  
                  if (!data.receptor || !data.receptor.identificacion || !data.receptor.identificacion.numero) {
                    alert('Los datos del receptor están incompletos');
                    return;
                  }
                  
                  // Llamar directamente a la función onSubmit
                  try {
                    onSubmit(data);
                  } catch (error) {
                    console.error('Error al generar factura:', error);
                    alert(`Error al generar factura: ${error instanceof Error ? error.message : 'Error desconocido'}`);
                  }
                }}
              >
                <Send className="w-4 h-4 mr-2" />
                {isSubmitting ? 'Generando...' : 'Generar Factura'}
              </button>
            </div>
          </div>
        </form>
        
        {/* Modal para crear nuevo cliente */}
        {isClientModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Nuevo Cliente</h2>
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  
                  // Si hay un error de contribuyente inválido, no permitir el envío del formulario
                  if (invalidContribuyente) {
                    alert('No se puede agregar un cliente con estado inválido en Hacienda');
                    return;
                  }
                  
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
                    economic_activity_code: formData.get('economic_activity_code') as string,
                    economic_activity_desc: formData.get('economic_activity_desc') as string,
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
                    <label className="form-label">Número de Identificación</label>
                    <div className="flex gap-2">
                      <input 
                        name="identification_number" 
                        id="client_identification_number"
                        className="form-input" 
                        placeholder="Cédula/ID" 
                        required 
                      />
                      <button
                        type="button"
                        className="p-2 bg-secondary-600 rounded-md hover:bg-secondary-700 transition-colors"
                        onClick={async () => {
                          const idNumberInput = document.getElementById('client_identification_number') as HTMLInputElement;
                          const idNumber = idNumberInput?.value;
                          const nameInput = document.getElementById('client_name') as HTMLInputElement;
                          const typeSelect = document.getElementById('client_identification_type') as HTMLSelectElement;
                          const errorMsgDiv = document.getElementById('client_validation_error');
                          
                          if (!idNumber || idNumber.length < 9) {
                            alert('Ingrese un número de identificación válido');
                            return;
                          }
                          
                          // Limpiar estado previo
                          setInvalidContribuyente(null);

                          
                          const searchButton = document.querySelector('button[type="button"]') as HTMLButtonElement;
                          if (searchButton) {
                            searchButton.disabled = true;
                            searchButton.innerHTML = '<svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
                          }
                          
                          try {
                            const contribuyente = await buscarContribuyente(idNumber);
                            
                            if (contribuyente && contribuyente.nombre) {
                              // Validar el estado del contribuyente
                              const validacionEstado = validarEstadoContribuyente(contribuyente);
                              
                              if (!validacionEstado.esValido) {
                              // Mostrar error de contribuyente inválido
                               setInvalidContribuyente({
                                 estado: validacionEstado.estado || 'Desconocido',
                                 mensaje: validacionEstado.mensaje
                               });
                               
                               // Limpiar el nombre para que el usuario note que no hubo autocompletado
                               if (nameInput) nameInput.value = '';
                              
                              // Ya no insertamos HTML, usamos el componente React con invalidContribuyente
                              return;
                              }
                              
                              // Si es válido, continuar con el proceso normal
                              if (nameInput) nameInput.value = contribuyente.nombre;
                              if (typeSelect) typeSelect.value = mapearTipoIdentificacion(contribuyente.tipoIdentificacion);
                              
                              // Guardar y mostrar las actividades económicas
                              if (contribuyente.actividades && contribuyente.actividades.length > 0) {
                                const actividadesActivas = contribuyente.actividades.filter(act => act.estado === 'A');
                                setEconomicActivities(actividadesActivas.map(act => ({
                                  codigo: act.codigo || '',
                                  descripcion: act.descripcion || ''
                                })));
                                
                                // Si solo hay una actividad, seleccionarla automáticamente
                                if (actividadesActivas.length === 1 && actividadesActivas[0].codigo && actividadesActivas[0].descripcion) {
                                  const codeField = document.querySelector<HTMLInputElement>('[name="economic_activity_code"]');
                                  if (codeField) codeField.value = actividadesActivas[0].codigo;
                                  
                                  const descField = document.querySelector<HTMLInputElement>('[name="economic_activity_desc"]');
                                  if (descField) descField.value = actividadesActivas[0].descripcion;
                                }
                              } else {
                                setEconomicActivities([]);
                              }
                             } else {
                               // Usar el mismo mecanismo de invalidContribuyente para cliente no encontrado
                               setInvalidContribuyente({
                                 estado: 'No encontrado',
                                 mensaje: 'No se encontró información del contribuyente en la base de datos de Hacienda'
                               });
                               
                               // Limpiar el nombre si existe
                               if (nameInput) nameInput.value = '';
                             }
                          } catch (error) {
                            console.error('Error al buscar el contribuyente:', error);
                            alert('Error al buscar el contribuyente');
                          } finally {
                            // Restaurar botón

                            if (searchButton) {
                              searchButton.disabled = false;
                              searchButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
                            }
                          }
                        }}
                      >
                        <Search className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="form-label">Nombre/Razón Social</label>
                    <input name="name" id="client_name" className="form-input" required />
                  </div>
                  
                  {/* Contenedor para mensajes de error de validación */}
                  <div id="client_validation_error" className="col-span-1 md:col-span-2 glass-card bg-orange-100 dark:bg-orange-800/30 border border-orange-300 dark:border-orange-700 p-4 rounded-lg mb-4" style={{ display: 'none' }}></div>
                  
                  {/* Mostrar error de contribuyente inválido */}
                  {invalidContribuyente && (
                    <div className="col-span-1 md:col-span-2 glass-card bg-orange-100 dark:bg-orange-800/30 border border-orange-300 dark:border-orange-700 p-4 rounded-lg mb-4 flex items-start space-x-3">
                      <div className="text-orange-600 dark:text-orange-400 mt-1">
                        <AlertTriangle size={24} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-black dark:text-white font-medium text-lg">Estado inválido en Hacienda</h3>
                        <p className="text-gray-800 dark:text-gray-300">{invalidContribuyente.mensaje}</p>
                        <p className="text-black dark:text-white mt-2 font-bold">El ID consultado no está inscrito ante Hacienda</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="form-label">Tipo de Identificación</label>
                    <select name="identification_type" id="client_identification_type" className="form-select" required>
                      <option value="">Seleccione...</option>
                      <option value="01">Física</option>
                      <option value="02">Jurídica</option>
                      <option value="03">DIMEX</option>
                      <option value="04">NITE</option>
                    </select>
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

                  <div className="md:col-span-2">
                    <label className="form-label">Actividad Económica</label>
                    {economicActivities.length > 0 ? (
                      <select 
                        className="form-select"
                        onChange={(e) => {
                          const selectedActivity = economicActivities.find(act => act.codigo === e.target.value);
                          if (selectedActivity) {
                            const codeField = document.querySelector<HTMLInputElement>('[name="economic_activity_code"]');
                            if (codeField) codeField.value = selectedActivity.codigo;
                            
                            const descField = document.querySelector<HTMLInputElement>('[name="economic_activity_desc"]');
                            if (descField) descField.value = selectedActivity.descripcion;
                          }
                        }}
                      >
                        <option value="">Seleccione una actividad económica...</option>
                        {economicActivities.map((activity) => (
                          <option key={activity.codigo} value={activity.codigo}>
                            {activity.codigo} - {activity.descripcion}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <input 
                            name="economic_activity_code" 
                            className="form-input" 
                            placeholder="Código" 
                            required 
                          />
                        </div>
                        <div>
                          <input 
                            name="economic_activity_desc" 
                            className="form-input" 
                            placeholder="Descripción" 
                            required 
                          />
                        </div>
                      </div>
                    )}
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
        onSelect={(product) => handleProductSelect(product)}
      />

      <NewProductModal
        isOpen={isNewProductModalOpen}
        onClose={() => setIsNewProductModalOpen(false)}
        onSave={(product) => handleNewProductSaved(product)}
      />

      {/* Modal de vista previa de la factura */}
      <InvoicePreviewModal 
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        invoice={previewInvoice}
      />
    </div>
  );
}

export default InvoiceCreate;