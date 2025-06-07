import { useState, useEffect } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Search, Save, FileText, Send, UserPlus, PackagePlus, Eye, RotateCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { searchByDescription } from '../services/cabysService';
import { generateXML, downloadXML, generatePDF, sendInvoiceXML, sendInvoiceByEmail } from '../services/invoiceService';
import { generateSequence } from '../services/sequenceService';
import { CabysItem, Invoice, availableCurrencies, tiposCargos } from '../types/invoice';
import { useUserSettings } from '../hooks/useUserSettings';
import { useClients } from '../hooks/useClients';
import { useInvoiceHistory, StoredInvoice } from '../hooks/useInvoiceHistory';
import ProductSelectorModal from '../components/ProductSelectorModal';
import NewProductModal from '../components/NewProductModal';
import InvoicePreviewModal from '../components/InvoicePreviewModal';
import { getExchangeRate } from '../services/exchangeRateService';

// Validation schema para Tiquete Electrónico según esquema v4.2
const tiqueteSchema = z.object({
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
  // En tiquetes electrónicos el receptor siempre es Consumidor Final
  receptor: z.object({
    nombre: z.string().min(1, "El nombre del receptor es requerido"),
    identificacion: z.object({
      tipo: z.string().min(1, "El tipo de identificación es requerido"),
      numero: z.string().min(1, "El número de identificación es requerido"),
    }),
    correo: z.string().email("Correo electrónico inválido").optional(),
    ubicacion: z.object({
      provincia: z.string().optional(),
      canton: z.string().optional(),
      distrito: z.string().optional(),
      barrio: z.string().optional(),
      otrasSenas: z.string().optional(),
    }).optional(),
  }).optional(), // Receptor opcional para tiquetes
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
    precioUnitarioCRC: z.number().optional(), // Campo oculto para almacenar el precio original en CRC
    tipoTransaccion: z.string().min(1, "El tipo de transacción es requerido").default("01"),
    descuento: z.object({
      montoDescuento: z.number().min(0, "El descuento debe ser mayor o igual a cero"),
      naturalezaDescuento: z.string().optional(),
    }).optional(),
    // Campos farmacéuticos y otros campos no obligatorios
    formaFarmaceutica: z.string().optional(),
    registroMedicamento: z.string().optional(),
    numeroVINoSerie: z.string().optional(),
    // Los tiquetes electrónicos NO usan exoneraciones
    tieneExoneracion: z.literal(false).optional().default(false),
    exoneracion: z.any().optional(),
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

type TiqueteFormData = z.infer<typeof tiqueteSchema>;

const TiqueteCreate = () => {

  const [cabysResults, setCabysResults] = useState<CabysItem[]>([]);
  const [cabysSearchTerm, setCabysSearchTerm] = useState('');
  // Eliminamos la declaración de selectedCabys ya que no se utiliza, pero mantenemos setSelectedCabys
  const [, setSelectedCabys] = useState<CabysItem | null>(null);
  const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  
  // Nuevos estados para manejo de modales de productos
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [isLoadingExchangeRate, setIsLoadingExchangeRate] = useState(false);
  // Estado para almacenar la secuencia (clave y consecutivo) y generarla solo una vez
  const [tiqueteSequence, setTiqueteSequence] = useState<{ clave: string; numeroConsecutivo: string }>({ clave: '', numeroConsecutivo: '' });

  // Verificar si hay un borrador guardado al cargar
  useEffect(() => {
    const draftTiquete = localStorage.getItem('tiqueteDraft');
    setHasDraft(!!draftTiquete);
  }, []);
  
  // Generar la secuencia una sola vez al cargar el componente
  useEffect(() => {
    // Función asíncrona para obtener la secuencia
    const getSequence = async () => {
      try {
        // Obtenemos el ID de la compañía seleccionada
        const selectedCompanyId = localStorage.getItem('selected_company') || 'innova';
        const userSettings = JSON.parse(localStorage.getItem('userSettings') || '{}');
        const emisorId = userSettings?.emisor?.identificacion?.numero || '3102928079';
        
        // Solo generamos la secuencia si no tenemos una guardada ya
        if (!tiqueteSequence.clave || !tiqueteSequence.numeroConsecutivo) {
          console.log('Generando secuencia ÚNICA para el tiquete...');
          
          // Usamos el servicio centralizado para generar el consecutivo y la clave
          const sequence = await generateSequence(
            selectedCompanyId,
            emisorId,
            '04', // Tipo de documento: tiquete electrónico
            '01', // Terminal
            '002' // Sucursal
          );
          
          console.log('Secuencia generada exitosamente:', sequence);
          setTiqueteSequence(sequence);
        }
      } catch (error) {
        console.error('Error al generar la secuencia:', error);
      }
    };
    
    // Ejecutar la función asíncrona
    getSequence();
  }, [tiqueteSequence.clave, tiqueteSequence.numeroConsecutivo]);
  
  // Obtener la configuración del usuario, los clientes y el historial de facturas
  const { settings, loading: loadingSettings } = useUserSettings();
const { loading: loadingClients } = useClients();
  const { addInvoice } = useInvoiceHistory();
  
  // Default form values
  const defaultValues: TiqueteFormData = {
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
      nombre: 'Consumidor Final',
      identificacion: {
        tipo: '01',
        numero: '000000000',
      },
      correo: '', // Se establecerá con el correo del emisor
    },
    condicionVenta: '01', // Contado
    plazoCredito: '',
    medioPago: ['01'], // Efectivo
    detalleServicio: [], // Mantener vacío - no añadir líneas en blanco
    otrosCargos: [], // Array vacío para otros cargos
    observaciones: '',
    moneda: 'CRC', // Moneda por defecto: Colones
    tipoCambio: 1, // Tipo de cambio por defecto para colones
  };

  const { register, control, setValue, getValues, reset, watch, handleSubmit, formState: { errors, isSubmitting } } = useForm<TiqueteFormData>({
    resolver: zodResolver(tiqueteSchema),
    defaultValues,
  });

  // Inicialización de variables del formulario
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

  // Función para añadir un nuevo otro cargo
  const addOtroCargo = () => {
    appendOtroCargo({
      tipoCargo: '01', // Valor por defecto: Equipo especial
      descripcionCargo: '',
      porcentaje: 0,
      montoCargo: 0
    });
  };

  // Función para manejar cambios en el tipo de cargo
  const handleTipoCargoChange = (index: number, value: string) => {
    setValue(`otrosCargos.${index}.tipoCargo`, value);
  };

  // Función para manejar cambios en la descripción del cargo
  const handleDescripcionCargoChange = (index: number, value: string) => {
    setValue(`otrosCargos.${index}.descripcionCargo`, value);
  };

  // Función para manejar cambios en el porcentaje y calcular el monto basado en el subtotal
  const handlePorcentajeChange = (index: number, value: number) => {
    setValue(`otrosCargos.${index}.porcentaje`, value);
    
    // Calcular el subtotal de productos/servicios para aplicar el porcentaje
    const detalleServicio = getValues('detalleServicio');
    const subtotalTotal = detalleServicio.reduce((sum, item) => {
      const precioTotal = item.cantidad * item.precioUnitario;
      const descuento = item.descuento?.montoDescuento || 0;
      return sum + (precioTotal - descuento);
    }, 0);
    
    // Calcular el monto basado en el porcentaje
    const montoCalculado = (subtotalTotal * value) / 100;
    setValue(`otrosCargos.${index}.montoCargo`, Math.round(montoCalculado * 100) / 100); // Redondear a 2 decimales
  };

  // Función para manejar cambios directos en el monto del cargo
  const handleMontoCargoChange = (index: number, value: number) => {
    setValue(`otrosCargos.${index}.montoCargo`, value);
  };

  // Función para eliminar un otro cargo
  const removeOtroCargoItem = (index: number) => {
    removeOtroCargo(index);
  };

  // Función para calcular el total de otros cargos
  const calcularTotalOtrosCargos = () => {
    const otrosCargos = getValues('otrosCargos');
    return otrosCargos.reduce((total, cargo) => total + (cargo.montoCargo || 0), 0);
  };
  
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
      
      // Establecer el correo del receptor igual al del emisor
      setValue('receptor.correo', emisorData.correo, { shouldValidate: true });
      
      console.log('Datos del emisor actualizados correctamente');
    }
  }, [settings, loadingSettings, setValue]);


  const condicionVenta = watch('condicionVenta');
  const selectedCurrency = watch('moneda');
  
  // Actualizar el tipo de cambio cuando cambia la moneda seleccionada
  useEffect(() => {
    const updateExchangeRate = async () => {
      if (selectedCurrency) {
        setIsLoadingExchangeRate(true);
        try {
          const rate = await getExchangeRate(selectedCurrency);
          // Formatear el tipo de cambio con 5 decimales como requiere Hacienda
          const formattedRate = parseFloat(rate.toFixed(5));
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
  


  // Esta función ha sido eliminada para evitar duplicación con la función handleProductSelect definida más abajo

  // Handle add from new product modal
  const handleNewProductSaved = (newProduct: any) => {
    // Obtener el tipo de cambio actual
    const currentCurrency = getValues('moneda');
    const exchangeRate = getValues('tipoCambio');
    
    // Calcular el precio según la moneda seleccionada
    let precioUnitario = newProduct.precioUnitario || 0;
    const precioUnitarioCRC = newProduct.precioUnitario || 0; // Siempre guardar el precio original en CRC
    
    // Convertir el precio si la moneda no es CRC
    if (currentCurrency !== 'CRC' && exchangeRate > 0) {
      precioUnitario = parseFloat((precioUnitarioCRC / exchangeRate).toFixed(2));
    }
    
    // Modificar el producto antes de agregarlo
    const modifiedProduct = {
      ...newProduct,
      precioUnitario: precioUnitario,
      precioUnitarioCRC: precioUnitarioCRC,
      tieneExoneracion: false,
      exoneracion: {
        tipoDocumento: '01', // Compra autorizada
        numeroDocumento: '',
        nombreInstitucion: '',
        fechaEmision: '',
        porcentajeExoneracion: 100, // Siempre 100% para tiquetes
      }
    };
    
    // Add the newly created product to the current line or create a new line
    handleProductSelect(modifiedProduct);
    // Close the new product modal after saving
    if (typeof setIsNewProductModalOpen === 'function') {
      // Close modal through parent component's callback if available
      setIsNewProductModalOpen(false);
      setIsProductModalOpen(false);
    }
  };
  
  // Remove line item
  const handleRemoveLine = (index: number) => {
    console.log(`Eliminando línea en índice: ${index}. Total actual: ${fields.length}`);
    remove(index);
    // Verificación opcional después de eliminar
    setTimeout(() => {
      console.log(`Líneas después de eliminar: ${fields.length}`);
    }, 0);
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
    
    // Eliminar todas las líneas vacías
    let foundEmptyLine = false;
    for (let i = fields.length - 1; i >= 0; i--) {
      const field = fields[i];
      if (!field.codigoCabys || !field.detalle) {
        // Si encontramos una línea vacía y no habíamos seleccionado ninguna,
        // la usamos para el nuevo producto
        if (!foundEmptyLine && currentLineIndex === null) {
          foundEmptyLine = true;
          setCurrentLineIndex(i);
        } else {
          // Cualquier otra línea vacía la eliminamos
          remove(i);
        }
      }
    }
        // If there's a currently selected line index, update that line
    if (currentLineIndex !== null) {
      setValue(`detalleServicio.${currentLineIndex}.codigoCabys`, product.codigoCabys || '9999999999999');
      setValue(`detalleServicio.${currentLineIndex}.detalle`, product.detalle || 'Producto o servicio seleccionado');
      setValue(`detalleServicio.${currentLineIndex}.cantidad`, product.cantidad || 1);
      setValue(`detalleServicio.${currentLineIndex}.unidadMedida`, product.unidadMedida || 'Sp');
      setValue(`detalleServicio.${currentLineIndex}.precioUnitario`, precioUnitario);
      setValue(`detalleServicio.${currentLineIndex}.precioUnitarioCRC`, precioUnitarioCRC); // Campo oculto para almacenar el precio original en CRC
      setValue(`detalleServicio.${currentLineIndex}.tipoTransaccion`, product.tipoTransaccion || '01'); // Valor predeterminado: Venta Normal
      setValue(`detalleServicio.${currentLineIndex}.descuento`, product.descuento || { montoDescuento: 0, naturalezaDescuento: 'Sin descuento' });
      
      // Campos farmacéuticos - solo establecerlos si existen en el producto
      try {
        // Forma farmacéutica (soportando ambas notaciones)
        const formaFarmaceutica = product.forma_farmaceutica || product.formaFarmaceutica;
        if (formaFarmaceutica) {
          console.log(`Asignando forma farmacéutica: ${formaFarmaceutica} a línea ${currentLineIndex}`);
          setValue(`detalleServicio.${currentLineIndex}.formaFarmaceutica`, formaFarmaceutica);
        }
        
        // Registro medicamento (soportando ambas notaciones)
        const registroMedicamento = product.registro_medicamento || product.registroMedicamento;
        if (registroMedicamento) {
          console.log(`Asignando registro medicamento: ${registroMedicamento} a línea ${currentLineIndex}`);
          setValue(`detalleServicio.${currentLineIndex}.registroMedicamento`, registroMedicamento);
        }
        
        // Número VIN/Serie (soportando ambas notaciones)
        const numeroVINoSerie = product.numero_vin_serie || product.numeroVINoSerie;
        if (numeroVINoSerie) {
          console.log(`Asignando número VIN/Serie: ${numeroVINoSerie} a línea ${currentLineIndex}`);
          setValue(`detalleServicio.${currentLineIndex}.numeroVINoSerie`, numeroVINoSerie);
        }
      } catch (err) {
        console.error('Error al establecer campos farmacéuticos:', err);
      }
      
      // Establecer valores de exoneración - siempre false para tiquetes
      setValue(`detalleServicio.${currentLineIndex}.tieneExoneracion`, false);
      setValue(`detalleServicio.${currentLineIndex}.exoneracion`, undefined);
    } else {
      // Si no hay líneas vacías, agregamos el producto como una nueva línea
      // Preparar datos farmacéuticos (soportando ambas notaciones)
      const formaFarmaceutica = product.forma_farmaceutica || product.formaFarmaceutica;
      const registroMedicamento = product.registro_medicamento || product.registroMedicamento;
      const numeroVINoSerie = product.numero_vin_serie || product.numeroVINoSerie;
      
      // Registrar en consola si hay campos farmacéuticos
      if (formaFarmaceutica || registroMedicamento || numeroVINoSerie) {
        console.log('Campos farmacéuticos encontrados para nueva línea:');
        if (formaFarmaceutica) console.log(`- Forma farmacéutica: ${formaFarmaceutica}`);
        if (registroMedicamento) console.log(`- Registro medicamento: ${registroMedicamento}`);
        if (numeroVINoSerie) console.log(`- Número VIN/Serie: ${numeroVINoSerie}`);
      }
      
      append({
        id: fields.length + 1,
        codigoCabys: product.codigoCabys || '9999999999999',
        cantidad: product.cantidad || 1,
        unidadMedida: product.unidadMedida || 'Sp',
        detalle: product.detalle || 'Producto o servicio seleccionado',
        precioUnitario: precioUnitario,
        precioUnitarioCRC: precioUnitarioCRC,
        tipoTransaccion: product.tipoTransaccion || '01',
        descuento: product.descuento || {
          montoDescuento: 0,
          naturalezaDescuento: 'Sin descuento',
        },
        // Añadir campos farmacéuticos solo si existen
        ...(formaFarmaceutica ? { formaFarmaceutica } : {}),
        ...(registroMedicamento ? { registroMedicamento } : {}),
        ...(numeroVINoSerie ? { numeroVINoSerie } : {}),
        // Tiquetes no usan exoneraciones
        tieneExoneracion: false,
        exoneracion: undefined,
      });
    }
    setCurrentLineIndex(null);
    setIsProductModalOpen(false);
  };
 
  // Esta función ya está implementada correctamente arriba

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
  
  // Función para guardar borrador
  const saveDraft = () => {
    const formData = getValues();
    localStorage.setItem('tiqueteDraft', JSON.stringify(formData));
    setHasDraft(true);
    alert('Borrador guardado exitosamente');
  };

  // Función para cargar borrador
  const loadDraft = () => {
    const draftJson = localStorage.getItem('tiqueteDraft');
    if (draftJson) {
      try {
        const draftData = JSON.parse(draftJson) as TiqueteFormData;
        // Cargar todos los campos del formulario
        Object.entries(draftData).forEach(([key, value]) => {
          if (key === 'detalleServicio') {
            // Borrar filas existentes y añadir las guardadas
            fields.forEach((_: any, index: number) => remove(index));
            if (Array.isArray(value) && value.length > 0) {
              value.forEach((item: any) => append(item));
            }
          } else {
            // @ts-ignore
            setValue(key, value);
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
          barrio: '',
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

  // Función para generar vista previa del tiquete
  const generatePreview = () => {
    // Verificar que haya al menos una línea de producto
    const formData = getValues();
    
    if (!formData.detalleServicio || formData.detalleServicio.length === 0 ||
        !formData.detalleServicio.some(item => item.codigoCabys && item.detalle)) {
      alert('Debe agregar al menos un producto o servicio para generar la vista previa');
      return;
    }
    
    // Asegurar que el receptor sea siempre Consumidor Final y use el correo del emisor
    formData.receptor = {
      nombre: 'Consumidor Final',
      identificacion: {
        tipo: '01',
        numero: '000000000',
      },
      correo: formData.emisor.correo, // Usar el correo del emisor
    };
    
    // Calcular detalles de servicio con impuestos y totales
      const detalleServicio = formData.detalleServicio.map((item, index) => {
        // Buscar el producto en localStorage para obtener el IVA de CABYS
        let impuestoTarifa = 13; // Valor por defecto como fallback
        
        // IMPORTANTE: Los tiquetes electrónicos NO llevan exoneraciones
        // Eliminar cualquier indicación de exoneración si existe por error
        if (item.tieneExoneracion) {
          item.tieneExoneracion = false;
          item.exoneracion = undefined;
        }
        
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
    
    // Calcular totales
    const subtotalTotal = detalleServicio.reduce((sum, item) => sum + item.subtotal, 0);
    const impuestoTotal = detalleServicio.reduce((sum, item) => sum + item.impuesto.monto, 0);
    const totalVenta = detalleServicio.reduce((sum, item) => sum + item.montoTotal, 0);
    const totalDescuentos = detalleServicio.reduce((sum, item) => sum + (item.descuento?.montoDescuento || 0), 0);
    const totalVentaNeta = totalVenta - totalDescuentos;
    const totalImpuesto = detalleServicio.reduce((sum, item) => sum + item.impuestoNeto, 0);
    const totalComprobante = totalVentaNeta + totalImpuesto + calcularTotalOtrosCargos();
    
    // Crear objeto de tiquete para la vista previa
    // Usamos los valores pre-generados del estado para la vista previa
    // De esta forma evitamos generar nuevas secuencias en cada vista previa
    
    const preview: Invoice = {
      clave: tiqueteSequence.clave,
      numeroConsecutivo: tiqueteSequence.numeroConsecutivo,
      fechaEmision: new Date().toISOString(),
      emisor: formData.emisor,
      receptor: formData.receptor,
      condicionVenta: formData.condicionVenta,
      plazoCredito: formData.plazoCredito ? parseInt(formData.plazoCredito.toString(), 10) : undefined,
      medioPago: Array.isArray(formData.medioPago) ? formData.medioPago : ['01'], // Asegurar que sea un array de strings
      detalleServicio: detalleServicio,
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
    };
    
    // Guardar la vista previa y mostrar el modal
    setPreviewInvoice(preview);
    setIsPreviewModalOpen(true);
  };
  
  // Generate tiquete on form submission
  const onSubmit = async (data: TiqueteFormData) => {
    console.log('🟢 INICIANDO GENERACIÓN DE TIQUETE');
    console.log('📋 Form submitted with:', data);
    
    // Verificar si hay líneas de detalle
    if (!data.detalleServicio || data.detalleServicio.length === 0) {
      console.error('❌ Error: No hay líneas de detalle en el tiquete');
      alert('Debe agregar al menos un producto o servicio al tiquete');
      return;
    }
    
    // NUEVO: Validar que cada línea tenga todos los datos requeridos con los tipos correctos
    const lineasIncompletas = data.detalleServicio.filter((item, index) => {
      // Verificar campos obligatorios
      if (!item.id || item.id <= 0) {
        console.error(`Línea ${index+1}: Falta ID válido`);
        data.detalleServicio[index].id = index + 1; // Asignar un ID secuencial
      }
      
      if (!item.codigoCabys || item.codigoCabys.trim() === '') {
        console.error(`Línea ${index+1}: Falta código CABYS`);
        return true;
      }
      
      if (!item.detalle || item.detalle.trim() === '') {
        console.error(`Línea ${index+1}: Falta detalle del producto`);
        return true;
      }
      
      if (!item.unidadMedida || item.unidadMedida.trim() === '') {
        console.error(`Línea ${index+1}: Falta unidad de medida`);
        data.detalleServicio[index].unidadMedida = 'Unid'; // Valor por defecto
      }
      
      // Verificar campos numéricos
      if (typeof item.cantidad !== 'number' || item.cantidad <= 0) {
        console.error(`Línea ${index+1}: Cantidad inválida`);
        // Intentar convertir si es string
        const cantidadNum = parseFloat(item.cantidad as any);
        if (!isNaN(cantidadNum) && cantidadNum > 0) {
          data.detalleServicio[index].cantidad = cantidadNum;
        } else {
          return true;
        }
      }
      
      if (typeof item.precioUnitario !== 'number' || item.precioUnitario < 0) {
        console.error(`Línea ${index+1}: Precio unitario inválido`);
        // Intentar convertir si es string
        const precioNum = parseFloat(item.precioUnitario as any);
        if (!isNaN(precioNum) && precioNum >= 0) {
          data.detalleServicio[index].precioUnitario = precioNum;
        } else {
          return true;
        }
      }
      
      // Si llega aquí, la línea es válida
      return false;
    });
    
    if (lineasIncompletas.length > 0) {
      console.error('❌ Hay líneas de detalle incompletas:', lineasIncompletas);
      alert(`Hay ${lineasIncompletas.length} línea(s) de productos incompletas. Verifique que todos tengan código CABYS, detalle, cantidad válida y precio válido.`);
      return;
    }
    
    // Declarar invoiceStatus en el ámbito correcto
    let invoiceStatus: 'Completada' | 'Pendiente' | 'Rechazada' = 'Pendiente';
    
    try {
      // Asegurar que el receptor sea siempre Consumidor Final y use el correo del emisor
      data.receptor = {
        nombre: 'Consumidor Final',
        identificacion: {
          tipo: '01',
          numero: '000000000',
        },
        correo: data.emisor.correo, // Usar el correo del emisor
      };
      
      // Calculate totals and prepare invoice data
      const detalleServicio = data.detalleServicio.map((item, index) => {
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
        
        // Calcular impuesto con el porcentaje correcto, considerando exoneración
        let impuestoMonto = subtotal * (impuestoTarifa / 100);
        let montoExoneracion = 0;
        
        // Si tiene exoneración, calcular el monto exonerado (siempre 100% en tiquetes)
        if (item.tieneExoneracion) {
          montoExoneracion = impuestoMonto; // 100% de exoneración
          impuestoMonto = 0; // El impuesto queda en 0 con exoneración total
        }
        
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
      const subtotalTotal = detalleServicio.reduce((sum, item) => sum + item.subtotal, 0);
      const impuestoTotal = detalleServicio.reduce((sum, item) => sum + item.impuesto.monto, 0);
      
      // Calcular total de otros cargos
      const otrosCargosTotal = otrosCargoFields.reduce((sum, _, index) => {
        const montoCargo = watch(`otrosCargos.${index}.montoCargo`) || 0;
        return sum + montoCargo;
      }, 0);
      
      const total = subtotalTotal + impuestoTotal + otrosCargosTotal;
      
      // Calculate invoice summary
      const totalVenta = detalleServicio.reduce((sum, item) => sum + item.montoTotal, 0);
      const totalDescuentos = detalleServicio.reduce((sum, item) => sum + (item.descuento?.montoDescuento || 0), 0);
      const totalVentaNeta = totalVenta - totalDescuentos;
      const totalImpuesto = detalleServicio.reduce((sum, item) => sum + item.impuestoNeto, 0);
      const totalComprobante = totalVentaNeta + totalImpuesto + otrosCargosTotal;
      
      // Create tiquete object
      // Usamos los valores pre-generados del estado para la creación del tiquete
      // De esta forma aseguramos que se use el mismo código de seguridad fijo para todos los tiquetes del usuario
      
      console.log('Generando tiquete con secuencia pre-generada:', tiqueteSequence);
      
      const tiquete: Invoice = {
        numeroConsecutivo: tiqueteSequence.numeroConsecutivo,
        clave: tiqueteSequence.clave,
        fechaEmision: new Date().toISOString(),
        emisor: data.emisor,
        receptor: data.receptor,
        condicionVenta: data.condicionVenta,
        plazoCredito: data.plazoCredito ? parseInt(data.plazoCredito.toString(), 10) : undefined,
        // Asegurar que medioPago sea siempre un array de strings
        medioPago: Array.isArray(data.medioPago) ? data.medioPago : ['01'], // Usar el valor por defecto '01' (efectivo)
        detalleServicio: detalleServicio.map(item => ({
          ...item,
          descuento: item.descuento && item.descuento.montoDescuento > 0 ? {
            ...item.descuento,
            naturalezaDescuento: item.descuento.naturalezaDescuento || 'Descuento general'
          } : undefined
        })),
        // Incluir otros cargos solo si hay al menos uno con monto mayor a cero
        otrosCargos: data.otrosCargos && data.otrosCargos.length > 0 ? 
          data.otrosCargos.filter(cargo => cargo.montoCargo > 0).map(cargo => ({
            ...cargo,
            descripcionCargo: cargo.descripcionCargo || 'Cargo adicional'
          })) : undefined,
        resumenFactura: {
          codigoMoneda: data.moneda,
          tipoCambio: data.tipoCambio,
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
      
      console.log('Tiquete preparado:', tiquete);
      
      try {
        // 1. Generar XML (el servicio ya maneja si es tiquete o factura basado en numeroConsecutivo)
        let xml = '';
        try {
          console.log(' Intentando generar XML para tiquete con clave:', tiquete.clave);
          console.log(' Datos para XML:', JSON.stringify(tiquete, null, 2));
          
          xml = generateXML(tiquete);
          console.log(' XML generado correctamente');
          
          // 2. Descargar XML automáticamente
          downloadXML(xml, tiquete.numeroConsecutivo);
          console.log(' XML descargado correctamente');
        } catch (xmlError) {
          console.error(' Error al generar o descargar XML:', xmlError);
          console.error('Detalles del error:', xmlError instanceof Error ? xmlError.stack : 'Error desconocido');
          xml = '<e>Error al generar XML</e>'; // XML mínimo para no romper el flujo
        }
        
        // 3. Generar y descargar PDF (el servicio ya maneja el título basado en numeroConsecutivo)
        let pdf;
        try {
          console.log('🔍 Intentando generar PDF para tiquete:', tiquete.numeroConsecutivo);
          pdf = generatePDF(tiquete);
          pdf.save(`tiquete_${tiquete.numeroConsecutivo}.pdf`);
          console.log('✅ PDF generado y descargado correctamente');
        } catch (pdfError) {
          console.error('❌ Error al generar PDF:', pdfError);
          console.error('Detalles del error PDF:', pdfError instanceof Error ? pdfError.stack : 'Error desconocido');
          alert('Hubo un problema al generar el PDF del tiquete. Revise la consola para más detalles.');
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
              clave: tiquete.clave,
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
            }
          }
        } catch (apiError) {
          console.error('Error en la comunicación con Hacienda:', apiError);
        }
        
        // 5. Enviar tiquete por correo electrónico
        let emailStatus: StoredInvoice['emailInfo'] = undefined;
        
        // Verificar si hay un correo de receptor válido para enviar el tiquete
        // Para tiquetes, podemos usar el correo proporcionado o el del emisor como respaldo
        const recipientEmail = data.receptor.correo || data.emisor.correo;
        
        if (recipientEmail) {
          try {
            if (pdf) {
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
                recipientEmail,                // Email del receptor
                data.receptor.nombre || '',    // Nombre del receptor
                tiquete.numeroConsecutivo,     // Número de tiquete
                pdfBlob,                       // PDF como Blob
                xml,                           // Contenido XML
                undefined,                     // Documento de aceptación (no aplica)
                `Tiquete Electrónico ${tiquete.numeroConsecutivo} - ${data.emisor.nombre}`, // Asunto personalizado
                undefined,                     // Mensaje personalizado
                undefined                      // CC emails
              );
              console.log(`Tiquete enviado por correo electrónico a: ${recipientEmail}`);
              
              // Guardar información del correo enviado exitosamente
              emailStatus = {
                destinatario: recipientEmail,
                fechaEnvio: new Date().toISOString(),
                estadoEnvio: 'Enviado',
                intentos: 1
              };
            } else {
              throw new Error('No se pudo generar el PDF para enviar por correo');
            }
          } catch (emailError) {
            console.error('Error al enviar el tiquete por correo electrónico:', emailError);
            // Guardar información del error en el envío
            emailStatus = {
              destinatario: recipientEmail,
              fechaEnvio: new Date().toISOString(),
              estadoEnvio: 'Fallido',
              intentos: 1,
              mensajeError: emailError instanceof Error ? emailError.message : 'Error desconocido al enviar correo'
            };
          }
        } else {
          console.warn('No se proporcionó ningún correo electrónico válido para enviar el tiquete.');
        }
        
        // Guardar tiquete en el historial independientemente de los errores anteriores
        try {
          // 6. Guardar tiquete en el historial
          const storedInvoice: StoredInvoice = {
            id: `T-${tiquete.numeroConsecutivo}`,
            client: data.receptor.nombre,
            date: new Date().toISOString(),
            amount: `₡${totalComprobante.toLocaleString()}`,
            status: invoiceStatus,
            items: data.detalleServicio.length,
            claveNumerica: tiquete.clave,
            condicionVenta: data.condicionVenta,
            medioPago: data.medioPago,
            detalleServicio: data.detalleServicio.map(item => ({
              codigoCabys: item.codigoCabys,
              detalle: item.detalle,
              cantidad: item.cantidad,
              precioUnitario: item.precioUnitario,
              subtotal: (item.cantidad * item.precioUnitario) - (item.descuento?.montoDescuento || 0)
            })),
            // Incluir otros cargos si existen
            otrosCargos: data.otrosCargos && data.otrosCargos.length > 0 ? 
              data.otrosCargos.filter(cargo => cargo.montoCargo > 0) : 
              undefined,
            subtotal: totalVentaNeta,
            impuesto: totalImpuesto,
            totalOtrosCargos: calcularTotalOtrosCargos(),
            total: totalComprobante,
            xmlContent: xml,
            // Usar la información de correo electrónico generada durante el envío
            emailInfo: emailStatus
          };
          
          console.log('Guardando tiquete en el historial:', storedInvoice);
          console.log('IMPORTANTE: ID del tiquete a guardar:', storedInvoice.id);
          
          try {
            // Llamar a addInvoice con seguimiento detallado
            addInvoice(storedInvoice);
            console.log('\u2705 Llamada a addInvoice completada para el tiquete');
            
            // Verificar explícitamente que se haya guardado correctamente en localStorage
            setTimeout(() => {
              try {
                // 1. Verificar en 'invoices' (ubicación principal)
                const storedInvoices = localStorage.getItem('invoices');
                if (storedInvoices) {
                  const invoices = JSON.parse(storedInvoices);
                  const found = invoices.some((inv: any) => inv.id === storedInvoice.id);
                  console.log(`\u2139️ Resultado de verificación en 'invoices': Tiquete ${found ? 'ENCONTRADO' : 'NO ENCONTRADO'}`);
                  
                  if (!found) {
                    console.log('\u26A0️ ADVERTENCIA: El tiquete no se encontró en el historial (clave "invoices"). Realizando segundo intento de guardado...');
                    
                    // Si no se encontró, intentar guardar directamente en localStorage
                    const updatedInvoices = [storedInvoice, ...invoices];
                    localStorage.setItem('invoices', JSON.stringify(updatedInvoices));
                    console.log('\u2705 Segundo intento completado: Tiquete agregado directamente a localStorage');
                  }
                } else {
                  console.log('\u26A0️ ADVERTENCIA: No se encontró la clave "invoices" en localStorage');
                  
                  // Crear el array con el nuevo tiquete
                  localStorage.setItem('invoices', JSON.stringify([storedInvoice]));
                  console.log('\u2705 Se ha creado una nueva entrada "invoices" en localStorage con el tiquete');
                }
              } catch (verifyError) {
                console.error('\u274C Error al verificar el guardado en localStorage:', verifyError);
              }
            }, 500);
          } catch (saveError) {
            console.error('\u274C Error al llamar addInvoice:', saveError);
          }
        } catch (historyError) {
          console.error('Error al guardar el tiquete en el historial:', historyError);
        }
      } catch (processingError) {
        console.error('Error al procesar el tiquete:', processingError);
        alert(`Error al procesar el tiquete: ${processingError instanceof Error ? processingError.message : 'Error desconocido'}`);
      }

      // El tiquete ya se guardó en el historial dentro del bloque try anterior
      // No es necesario guardarlo nuevamente aquí
      
      let alertMessage = `Tiquete generado exitosamente. Estado: ${invoiceStatus}. El XML y PDF se han descargado automáticamente.`;
      if (data.receptor.correo) {
        alertMessage += ` Además, se ha enviado por correo a ${data.receptor.correo}.`;
      }
      alert(alertMessage);
            
    } catch (error) {
      console.error('Error generating tiquete:', error);
      alert('Error al generar el tiquete');
    } finally {
      // Siempre limpiar el formulario, incluso si ocurren errores
      resetForm();
      
      // Eliminar borrador si existía
      localStorage.removeItem('tiqueteDraft');
      setHasDraft(false);
    }
  };

  // Actualizar el tipo de cambio cuando cambia la moneda seleccionada
  useEffect(() => {
    const updateExchangeRate = async () => {
      if (selectedCurrency) {
        setIsLoadingExchangeRate(true);
        try {
          const rate = await getExchangeRate(selectedCurrency);
          const formattedRate = parseFloat(rate.toFixed(5));
          setValue('tipoCambio', formattedRate);
        } catch (error) {
          console.error('Error al obtener el tipo de cambio:', error);
          if (selectedCurrency === 'CRC') setValue('tipoCambio', 1);
          else if (selectedCurrency === 'USD') setValue('tipoCambio', 506.00000);
          else if (selectedCurrency === 'EUR') setValue('tipoCambio', 567.00000);
        } finally {
          setIsLoadingExchangeRate(false);
        }
      }
    };
    updateExchangeRate();
  }, [selectedCurrency, setValue, getValues]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl title-primary">Crear Tiquete Electrónico</h1>
      </div>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Formulario para que onSubmit se conecte correctamente */}
        {/* Tabs for different sections */}
        <div className="glass-card">
          <div className="border-b border-primary-500/30">
            <nav className="flex overflow-x-auto">
              {['Emisor', 'Receptor (Opcional)', 'Detalles', 'Producto/Servicios', 'Resumen'].map((tab, index) => (
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
            
            {/* Receptor Section - Siempre Consumidor Final */}
            <div className="space-y-6 mt-8">
              <h2 className="text-xl title-secondary flex items-center">
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-primary-500 text-white mr-2 text-sm">2</span>
                Información del Receptor
              </h2>
              
              <div className="grid grid-cols-1 gap-4 p-4 glass-card">
                <div className="p-4 border border-primary-500/30 rounded-lg">
                  <h3 className="text-sm font-medium mb-3">Datos del Receptor</h3>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div className="bg-primary-500/10 p-3 rounded-lg">
                      <p className="text-sm">Para tiquetes electrónicos, el receptor siempre será "Consumidor Final".</p>
                    </div>
                    
                    <div>
                      <label className="form-label">Nombre</label>
                      <input 
                        {...register('receptor.nombre')} 
                        className="form-input" 
                        placeholder="Consumidor Final" 
                        disabled
                      />
                    </div>
                    
                    <div>
                      <label className="form-label">Correo Electrónico</label>
                      <p className="text-xs text-gray-400 mb-1">Se utilizará el mismo correo del emisor</p>
                      <input 
                        {...register('receptor.correo')} 
                        className="form-input" 
                        placeholder="email@ejemplo.com" 
                        disabled
                      />
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
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
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
                
                <div>
                  <label className="form-label">Tipo de Transacción</label>
                  <select {...register('detalleServicio.0.tipoTransaccion')} className="form-select">
                    <option value="01">Venta Normal de Bienes y Servicios</option>
                    <option value="02">Mercancía de Autoconsumo exento</option>
                    <option value="03">Mercancía de Autoconsumo gravado</option>
                    <option value="04">Servicio de Autoconsumo exento</option>
                    <option value="05">Servicio de Autoconsumo gravado</option>
                    <option value="06">Cuota de afiliación</option>
                    <option value="07">Cuota de afiliación Exenta</option>
                    <option value="08">Bienes de Capital para el emisor</option>
                    <option value="09">Bienes de Capital para el receptor</option>
                    <option value="10">Bienes de Capital para el emisor y el receptor</option>
                    <option value="11">Bienes de capital de autoconsumo exento para el emisor</option>
                    <option value="12">Bienes de capital sin contraprestación a terceros exento para el emisor</option>
                    <option value="13">Sin contraprestación a terceros</option>
                  </select>
                  {errors.detalleServicio?.[0]?.tipoTransaccion && <p className="form-error">{errors.detalleServicio[0].tipoTransaccion.message}</p>}
                </div>
              </div>
            </div>
            
            {/* Products/Services Section */}
            <div className="space-y-6 mt-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold flex items-center">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-primary-500 text-white mr-2 text-sm">4</span>
                  Productos y Servicios
                </h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsProductModalOpen(true)}
                    className="btn-primary flex items-center text-sm py-1 px-3"
                  >
                    <Search className="w-4 h-4 mr-1" />
                    Seleccionar Producto Guardado
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNewProductModalOpen(true)}
                    className="btn-secondary flex items-center text-sm py-1 px-3"
                  >
                    <PackagePlus className="w-4 h-4 mr-1" />
                    Agregar Producto Nuevo
                  </button>
                </div>
              </div>

              {/* Modal para seleccionar producto guardado */}
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
                      handleProductSelect(product);
                    }
                    setIsProductModalOpen(false);
                    setCurrentLineIndex(null);
                  }}
                />
              )}
              
              {/* Modal para crear nuevo producto */}
              {isNewProductModalOpen && (
                <NewProductModal
                  isOpen={isNewProductModalOpen}
                  onClose={() => setIsNewProductModalOpen(false)}
                  onSave={handleNewProductSaved}
                />
              )}
              
              <div className="p-4 glass-card">
                
                {/* Verificar si hay productos realmente seleccionados con datos completos */}
                {fields.some(field => field.codigoCabys && field.detalle) ? (
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
                                  {lineTotals ? formatCurrencyWithSymbol(lineTotals.subtotal, selectedCurrency) : (selectedCurrency === 'USD' ? '$0.00' : selectedCurrency === 'EUR' ? '€0.00' : '₡0.00')}
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
            <div className="space-y-6 mt-8">
              <h2 className="text-xl font-semibold flex items-center">
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-primary-500 text-white mr-2 text-sm">5</span>
                Información adicional
              </h2>
              
              {/* Otros Cargos */}
              <div className="p-4 glass-card mb-4">
                <div className="flex justify-between items-center mb-4">
                  <label className="form-label text-lg m-0">Otros Cargos</label>
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
                                  value={watch(`otrosCargos.${index}.tipoCargo`)}
                                  onChange={(e) => handleTipoCargoChange(index, e.target.value)}
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

              {/* Observaciones */}
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
              
              <Button 
                type="button" 
                className="btn-primary" 
                disabled={isSubmitting}
                onClick={() => {
                  // Verificar que hay al menos una línea de detalle
                  if (fields.length === 0) {
                    alert('Debe agregar al menos un producto o servicio al tiquete');
                    return;
                  }
                  
                  // Auto-completar campos faltantes en productos en lugar de bloquear
                  let hayProductosCorregidos = false;
                  
                  fields.forEach((_, index) => {
                    // Validar que el ID sea un número
                    let id = getValues(`detalleServicio.${index}.id`);
                    if (typeof id === 'string') {
                      console.log(`Convirtiendo ID de string a número en línea ${index+1}`);
                      const idNum = parseInt(id, 10);
                      if (!isNaN(idNum)) {
                        setValue(`detalleServicio.${index}.id`, idNum);
                        hayProductosCorregidos = true;
                      } else {
                        setValue(`detalleServicio.${index}.id`, index + 1);
                        hayProductosCorregidos = true;
                      }
                    } else if (!id || isNaN(id)) {
                      console.log(`Asignando ID numérico a línea ${index+1}`);
                      setValue(`detalleServicio.${index}.id`, index + 1);
                      hayProductosCorregidos = true;
                    }
                    
                    let codigoCabys = getValues(`detalleServicio.${index}.codigoCabys`);
                    let detalle = getValues(`detalleServicio.${index}.detalle`);
                    let unidadMedida = getValues(`detalleServicio.${index}.unidadMedida`);
                    
                    // Autocompletar campos faltantes con valores por defecto
                    if (!codigoCabys || codigoCabys.trim() === '') {
                      console.log(`Autocompletando código CABYS faltante en línea ${index+1}`);
                      setValue(`detalleServicio.${index}.codigoCabys`, '9999999999999');
                      hayProductosCorregidos = true;
                    }
                    
                    if (!detalle || detalle.trim() === '') {
                      console.log(`Autocompletando detalle faltante en línea ${index+1}`);
                      setValue(`detalleServicio.${index}.detalle`, 'Producto o servicio sin detalle');
                      hayProductosCorregidos = true;
                    }
                    
                    if (!unidadMedida || unidadMedida.trim() === '') {
                      console.log(`Autocompletando unidad de medida faltante en línea ${index+1}`);
                      setValue(`detalleServicio.${index}.unidadMedida`, 'Unid');
                      hayProductosCorregidos = true;
                    }
                    
                    // Asegurarse de que cantidad y precio son números
                    let cantidad = getValues(`detalleServicio.${index}.cantidad`);
                    if (typeof cantidad !== 'number' || isNaN(cantidad) || cantidad <= 0) {
                      console.log(`Corrigiendo cantidad inválida en línea ${index+1}`);
                      setValue(`detalleServicio.${index}.cantidad`, 1);
                      hayProductosCorregidos = true;
                    }
                    
                    let precioUnitario = getValues(`detalleServicio.${index}.precioUnitario`);
                    if (typeof precioUnitario !== 'number' || isNaN(precioUnitario)) {
                      console.log(`Corrigiendo precio unitario inválido en línea ${index+1}`);
                      setValue(`detalleServicio.${index}.precioUnitario`, 0);
                      hayProductosCorregidos = true;
                    }
                  });
                  
                  if (hayProductosCorregidos) {
                    console.log('Se han corregido automáticamente algunos campos de productos incompletos');
                  }
                  
                  // Proceder con el submit y validación completa
                  handleSubmit(
                    (data) => {
                      console.log('\u2705 Formulario validado correctamente');
                      onSubmit(data);
                    }, 
                    (errors) => {
                      console.error('\u274c Errores de validación:', errors);
                      
                      // Log detallado de errores para debugging
                      if (errors.detalleServicio) {
                        console.log('Detalles de errores en productos:', errors.detalleServicio);
                      }
                      
                      // Mostrar mensaje más detallado sobre los errores
                      let mensajeError = 'Hay errores en el formulario:\n';
                      
                      if (errors.detalleServicio) {
                        mensajeError += '- Productos/Servicios: Verifique que todos los campos estén completos\n';
                      }
                      
                      if (errors.emisor) {
                        mensajeError += '- Datos del Emisor: Información incompleta\n';
                      }
                      
                      if (errors.medioPago) {
                        mensajeError += '- Medio de Pago: Debe seleccionar al menos uno\n';
                      }
                      
                      alert(mensajeError);
                    }
                  )();
                }}
              >
                <Send className="w-4 h-4 mr-2" />
                {isSubmitting ? 'Generando...' : 'Generar Tiquete'}
              </Button>
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
                    
                    // Actualizar la ubicación del receptor cuando hay información disponible
                    if (data.province || data.canton || data.district || data.address) {
                      const updatedFormData = getValues();
                      if (!updatedFormData.receptor) {
                        updatedFormData.receptor = {
                          nombre: data.name,
                          identificacion: {
                            tipo: data.identification_type,
                            numero: data.identification_number
                          },
                          correo: data.email || ''
                        };
                      }
                      
                      if (!updatedFormData.receptor.ubicacion) {
                        updatedFormData.receptor.ubicacion = {};
                      }
                      
                      if (data.province) {
                        updatedFormData.receptor.ubicacion.provincia = data.province;
                      }
                      
                      if (data.canton) {
                        updatedFormData.receptor.ubicacion.canton = data.canton;
                      }
                      
                      if (data.district) {
                        updatedFormData.receptor.ubicacion.distrito = data.district;
                      }
                      
                      if (data.address) {
                        updatedFormData.receptor.ubicacion.otrasSenas = data.address;
                      }
                      
                      // Actualizar todo el formulario con los nuevos datos
                      reset(updatedFormData, { keepDefaultValues: true });
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

      <NewProductModal
        isOpen={isNewProductModalOpen}
        onClose={() => setIsNewProductModalOpen(false)}
        onSave={handleNewProductSaved}
      />
      
      {/* Modal de vista previa del tiquete */}
      <InvoicePreviewModal 
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        invoice={previewInvoice}
      />
    </div>
  );
};

export default TiqueteCreate;