// Tipos para facturación electrónica de Costa Rica

// Información del emisor/receptor
export interface Party {
  nombre: string;
  identificacion: {
    tipo: string; // 01=Física, 02=Jurídica, 03=DIMEX, 04=NITE
    numero: string;
  };
  nombreComercial?: string;
  registroFiscal8707?: string; // Campo obligatorio para bebidas alcohólicas según Ley 8707
  ubicacion?: Location;
  telefono?: Phone;
  correo?: string;
  actividadEconomica?: string; // Descripción de la actividad económica
  economic_activity_code?: string; // Código de actividad económica
  otrasSenasExtranjero?: string; // Ubicación en el extranjero (obligatorio para receptores extranjeros)
}

export interface Location {
  provincia?: string;
  canton?: string;
  distrito?: string;
  barrio?: string;
  otrasSenas?: string;
}

export interface Phone {
  codigoPais: string;
  numTelefono: string;
}

// Línea de detalle (producto/servicio)
export interface LineItem {
  id: number;
  codigo?: string;
  codigoCabys?: string;
  cantidad: number;
  unidadMedida: string;
  tipoTransaccion?: string; // Nuevo en v4.4: Identificar el tipo de transacción (01-14, 99)
  unidadMedidaComercial?: string; // Nuevo en v4.4: Unidad de medida comercial del producto
  detalle: string;
  numeroVINoSerie?: string; // Nuevo en v4.4: Obligatorio para códigos CAByS de medios de transporte
  registroMedicamento?: string; // Nuevo en v4.4: Obligatorio para códigos CAByS de medicamentos
  formaFarmaceutica?: string; // Nuevo en v4.4: Obligatorio para códigos CAByS de medicamentos (A-Z)
  precioUnitario: number;
  precioUnitarioCRC?: number; // Precio en colones para conversión de moneda
  montoTotal: number;
  descuento?: {
    montoDescuento: number;
    naturalezaDescuento?: string;
  };
  subtotal: number;
  baseImponible?: number; // Nuevo en v4.4: Base imponible para el cálculo de impuestos
  impuesto: Tax;
  tieneExoneracion?: boolean; // Flag para indicar si tiene exoneración
  exoneracion?: TaxExemption; // Exoneración directa para facilitar el manejo en el formulario
  impuestoAsumidoEmisorFabrica?: number; // Nuevo en v4.4: Impuesto asumido por el emisor o fábrica
  impuestoNeto: number;
  montoTotalLinea: number;
  detalleSurtido?: DetalleSurtidoItem[]; // Nuevo en v4.4: Para paquetes o conjuntos de productos
  // Campos para otros impuestos (adicionales al IVA)
  otroImpuesto?: string; // Código del otro impuesto (02, 03, 04, etc.)
  porcentajeOtroImpuesto?: number; // Porcentaje del otro impuesto
  tarifaOtroImpuesto?: number; // Tarifa del otro impuesto
  montoOtroImpuesto?: number; // Monto calculado del otro impuesto
  exoneracionOtroImpuesto?: TaxExemption; // Exoneración para el otro impuesto
}

export interface Tax {
  codigo: string;
  codigoTarifa: string;
  tarifa: number;
  monto: number;
  exoneracion?: TaxExemption;
}

export interface TaxExemption {
  tipoDocumento?: string;
  numeroDocumento?: string;
  nombreInstitucion?: string;
  fechaEmision?: string;
  porcentajeExoneracion?: number;
  montoExoneracion?: number;
}

// Interfaz para los elementos de surtido o paquetes de productos (nuevo en v4.4)
export interface DetalleSurtidoItem {
  codigoCabysSurtido?: string;
  cantidadSurtido: number;
  unidadMedidaSurtido: string;
  detalleSurtido: string;
  precioUnitarioSurtido: number;
  montoTotalSurtido: number;
  subTotalSurtido: number;
  baseImponibleSurtido?: number;
  impuestoSurtido?: {
    codigoImpuestoSurtido: string;
    montoImpuestoSurtido: number;
  };
}

// Resumen de factura
export interface InvoiceSummary {
  codigoMoneda: string;
  tipoCambio?: number;
  totalServGravados: number;
  totalServExentos: number;
  totalServExonerado?: number; // Nuevo en v4.4
  totalServNoSujeto?: number; // Nuevo en v4.4
  totalMercGravada: number;
  totalMercExenta: number;
  totalMercExonerada?: number; // Nuevo en v4.4
  totalMercNoSujeta?: number; // Nuevo en v4.4
  totalGravado: number;
  totalExento: number;
  totalExonerado?: number; // Nuevo en v4.4
  totalNoSujeto?: number; // Nuevo en v4.4
  totalVenta: number;
  totalDescuentos: number;
  totalVentaNeta: number;
  totalImpuesto: number;
  totalOtrosImpuestos?: number; // Total de otros impuestos (impuestos adicionales al IVA)
  totalComprobante: number;
}

// Tipos de moneda disponibles
export const availableCurrencies = [
  { code: 'CRC', name: 'Colones' },
  { code: 'USD', name: 'Dólares' },
  { code: 'EUR', name: 'Euros' }
];

// Interfaz para el tipo de moneda
export interface Currency {
  code: string;
  name: string;
}

// Información de referencia (para notas de crédito, etc.)
export interface Reference {
  tipoDocOtros?: string; // TipoDocRefOTRO en XML (obligatorio cuando tipoDoc es '99')
  tipoDoc: string; // TipoDocIR en XML
  numero: string;
  codigo: string;
  fechaEmision: string; // FechaEmisionIR en XML
  razonOtros?: string; // CodigoReferenciaOTRO en XML (obligatorio cuando codigo es '99')
  razon: string;
}

// Información general de la factura
export interface Invoice {
  clave: string;
  proveedorSistemas?: string;
  numeroConsecutivo: string;
  fechaEmision: string;
  emisor: Party;
  receptor: Party;
  condicionVenta: string;
  condicionVentaOtros?: string;
  plazoCredito?: number; // Plazo de crédito en días (número)
  medioPago: string[];
  medioPagoOtros?: string; // Descripción de medio de pago cuando es 'Otros'
  totalMedioPago?: number[]; // Montos correspondientes a cada medio de pago
  detalleServicio: LineItem[];
  resumenFactura: InvoiceSummary;
  informacionReferencia?: Reference[];
  otros?: string | OtrosData | OtrosItem[];
  moneda?: string;
  tipoCambio?: number;
  otrosCargos?: OtrosCargos[]; // Cargos adicionales
}

// Tipos para campo 'otros' estructurado
export interface OtrosItem {
  tipo: 'texto' | 'contenido';
  contenido: string;
}

export interface OtrosData {
  textos?: string[];
  contenidos?: string[];
}

// Interfaz para otros cargos
export interface OtrosCargos {
  tipoCargo: string;  // Código del tipo de cargo (01-99)
  montoCargo: number;  // Monto del cargo
  porcentaje?: number;  // Porcentaje opcional para cálculo automático
  descripcionCargo?: string;  // Descripción del cargo
}

// Constantes para los tipos de cargos disponibles
export const tiposCargos = [
  { codigo: '01', descripcion: 'Contribución parafiscal' },
  { codigo: '02', descripcion: 'Timbre de la Cruz Roja' },
  { codigo: '03', descripcion: 'Timbre de Benemérito Cuerpo de Bomberos de Costa Rica' },
  { codigo: '04', descripcion: 'Cobro de un tercero' },
  { codigo: '05', descripcion: 'Costos de Exportación' },
  { codigo: '06', descripcion: 'Impuesto de servicio 10%' },
  { codigo: '07', descripcion: 'Timbre de Colegios Profesionales' },
  { codigo: '08', descripcion: 'Depósitos de Garantía' },
  { codigo: '09', descripcion: 'Multas o Penalizaciones' },
  { codigo: '10', descripcion: 'Intereses Moratorios' },
  { codigo: '99', descripcion: 'Otros Cargos' },
]

// Respuesta de la API de CABYS
export interface CabysResponse {
  total?: number;
  cantidad?: number;
  cabys: CabysItem[];
}

export interface CabysItem {
  codigo: string;
  descripcion: string;
  categorias: string[];
  impuesto: number;
  uri?: string;
}

// Tipos para la interfaz de usuario
export interface UserProfile {
  nombre: string;
  identificacion: {
    tipo: string;
    numero: string;
  };
  nombreComercial?: string;
  ubicacion: Location;
  telefono?: Phone;
  correo: string;
  actividadEconomica: string;
}