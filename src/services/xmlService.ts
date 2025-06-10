import { create } from 'xmlbuilder2';
import { Invoice } from '../types/invoice';

/**
 * Servicio para la generación de documentos XML para facturación electrónica v4.4
 * Este servicio centraliza la lógica de creación de XML siguiendo los estándares de Hacienda CR
 */

/**
 * Genera el XML para factura electrónica según los estándares de la versión 4.4 de Hacienda CR
 * @param invoice Datos de la factura
 * @returns String con el contenido XML formateado
 */
export const generateXML = (invoice: Invoice): string => {
  // Validar y sanitizar los datos de la factura/tiquete
  invoice = validateAndSanitizeInvoice(invoice);
  try {
    // Verificar que el objeto invoice tenga todos los campos necesarios
    if (!invoice || !invoice.numeroConsecutivo || !invoice.clave || !invoice.emisor) {
      console.error('Error: Datos de factura/tiquete incompletos', invoice);
      throw new Error('Datos de factura/tiquete incompletos');
    }
    
    // Determinar si es un tiquete electrónico basado en el número consecutivo
    const isTiquete = invoice.numeroConsecutivo.startsWith('04');
    console.log(`Generando XML para ${isTiquete ? 'tiquete' : 'factura'} con consecutivo: ${invoice.numeroConsecutivo}`);
    
    const doc = create({ version: '1.0', encoding: 'utf-8' });
    
    let rootNode; // Declarar rootNode
    
    // Crear el elemento raíz (TiqueteElectronico o FacturaElectronica) y asignarlo a rootNode
    if (isTiquete) {
      rootNode = doc.ele('TiqueteElectronico', { // Asignar aquí
        'xmlns': 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/tiqueteElectronico',
        'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xmlns:vc': 'http://www.w3.org/2007/XMLSchema-versioning',
        'xsi:schemaLocation': 
          'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/tiqueteElectronico schema.xsd'
      });
      console.log('Creando XML para TiqueteElectronico con namespace correcto para v4.4');
    } else {
      rootNode = doc.ele('FacturaElectronica', { // Asignar aquí
        'xmlns': 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica',
        'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xmlns:vc': 'http://www.w3.org/2007/XMLSchema-versioning',
        'xsi:schemaLocation': 
          'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica schema.xsd'
      });
      console.log('Creando XML para FacturaElectronica con namespace correcto para v4.4');
    }

    // ---- Encabezado --------------------------------------------------
    rootNode.ele('Clave').txt(invoice.clave);
    
    // Nuevo campo obligatorio en v4.4: ProveedorSistemas
    rootNode.ele('ProveedorSistemas').txt(invoice.proveedorSistemas || '3102928079');
    
    // Nuevo campo obligatorio en v4.4: CodigoActividadEmisor
    rootNode.ele('CodigoActividadEmisor').txt(invoice.emisor.actividadEconomica || '741203');
    
    // Campo obligatorio en v4.4 para facturas, pero NO para tiquetes: CodigoActividadReceptor
    if (!isTiquete && invoice.receptor?.economic_activity_code) {
      rootNode.ele('CodigoActividadReceptor').txt(invoice.receptor.economic_activity_code);
    }
    
    rootNode.ele('NumeroConsecutivo').txt(invoice.numeroConsecutivo);
    rootNode.ele('FechaEmision').txt(invoice.fechaEmision);

    // ---- Emisor -----------------------------------------------------
    const emisor = rootNode.ele('Emisor');
    emisor.ele('Nombre').txt(invoice.emisor.nombre);
    const idEmisor = emisor.ele('Identificacion');
    idEmisor.ele('Tipo').txt(invoice.emisor.identificacion.tipo);
    idEmisor.ele('Numero').txt(invoice.emisor.identificacion.numero);
    if (invoice.emisor.nombreComercial) {
      emisor.ele('NombreComercial').txt(invoice.emisor.nombreComercial);
    }
    if (invoice.emisor.ubicacion) {
      const ubi = emisor.ele('Ubicacion');
      if (invoice.emisor.ubicacion.provincia)
        ubi.ele('Provincia').txt(invoice.emisor.ubicacion.provincia);
      if (invoice.emisor.ubicacion.canton)
        ubi.ele('Canton').txt(invoice.emisor.ubicacion.canton);
      if (invoice.emisor.ubicacion.distrito)
        ubi.ele('Distrito').txt(invoice.emisor.ubicacion.distrito);
      if (invoice.emisor.ubicacion.barrio)
        ubi.ele('Barrio').txt(invoice.emisor.ubicacion.barrio);
      if (invoice.emisor.ubicacion.otrasSenas)
        ubi.ele('OtrasSenas').txt(invoice.emisor.ubicacion.otrasSenas);
    }
    if (invoice.emisor.telefono) {
      const tel = emisor.ele('Telefono');
      tel.ele('CodigoPais').txt(invoice.emisor.telefono.codigoPais);
      tel.ele('NumTelefono').txt(invoice.emisor.telefono.numTelefono);
    }
    if (invoice.emisor.correo) {
      emisor.ele('CorreoElectronico').txt(invoice.emisor.correo);
    }

    // ---- Receptor ---------------------------------------------------
    const receptor = rootNode.ele('Receptor');
    receptor.ele('Nombre').txt(invoice.receptor.nombre);
    const idReceptor = receptor.ele('Identificacion');
    idReceptor.ele('Tipo').txt(invoice.receptor.identificacion.tipo);
    idReceptor.ele('Numero').txt(invoice.receptor.identificacion.numero);
    if (invoice.receptor.nombreComercial) {
      receptor.ele('NombreComercial').txt(invoice.receptor.nombreComercial);
    }
    if (invoice.receptor.ubicacion) {
      const ubiR = receptor.ele('Ubicacion');
      if (invoice.receptor.ubicacion.provincia)
        ubiR.ele('Provincia').txt(invoice.receptor.ubicacion.provincia);
      if (invoice.receptor.ubicacion.canton)
        ubiR.ele('Canton').txt(invoice.receptor.ubicacion.canton);
      if (invoice.receptor.ubicacion.distrito)
        ubiR.ele('Distrito').txt(invoice.receptor.ubicacion.distrito);
      if (invoice.receptor.ubicacion.barrio)
        ubiR.ele('Barrio').txt(invoice.receptor.ubicacion.barrio);
      if (invoice.receptor.ubicacion.otrasSenas)
        ubiR.ele('OtrasSenas').txt(invoice.receptor.ubicacion.otrasSenas);
    }
    if (invoice.receptor.telefono) {
      const telR = receptor.ele('Telefono');
      telR.ele('CodigoPais').txt(invoice.receptor.telefono.codigoPais);
      telR.ele('NumTelefono').txt(invoice.receptor.telefono.numTelefono);
    }
    if (invoice.receptor.correo) {
      receptor.ele('CorreoElectronico').txt(invoice.receptor.correo);
    }

    // ---- Condicion de venta y medio de pago -------------------------
    rootNode.ele('CondicionVenta').txt(invoice.condicionVenta);
    if (invoice.condicionVenta === '99' && invoice.condicionVentaOtros) {
      rootNode.ele('CondicionVentaOtros').txt(invoice.condicionVentaOtros);
    }
    if (invoice.plazoCredito) {
      rootNode.ele('PlazoCredito').txt(String(invoice.plazoCredito));
    }

    // ---- Detalle de servicio ---------------------------------------
    const detalleServicio = rootNode.ele('DetalleServicio');
    invoice.detalleServicio.forEach(item => {
      const linea = detalleServicio.ele('LineaDetalle');
      linea.ele('NumeroLinea').txt(String(item.id));
      if (item.codigoCabys) {
        linea.ele('CodigoCABYS').txt(item.codigoCabys);
      }
      if (item.codigo) {
        const cc = linea.ele('CodigoComercial');
        cc.ele('Tipo').txt('01');
        cc.ele('Codigo').txt(item.codigo);
      }
      linea.ele('Cantidad').txt(item.cantidad.toString());
      linea.ele('UnidadMedida').txt(item.unidadMedida);
      if (item.tipoTransaccion) {
        linea.ele('TipoTransaccion').txt(item.tipoTransaccion);
      }
      if (item.unidadMedidaComercial) {
        linea.ele('UnidadMedidaComercial').txt(item.unidadMedidaComercial);
      }
      linea.ele('Detalle').txt(item.detalle);
      if (item.numeroVINoSerie) {
        linea.ele('NumeroVINoSerie').txt(item.numeroVINoSerie);
      }
      if (item.registroMedicamento) {
        linea.ele('RegistroMedicamento').txt(item.registroMedicamento);
      }
      if (item.formaFarmaceutica) {
        linea.ele('FormaFarmaceutica').txt(item.formaFarmaceutica);
      }
      linea.ele('PrecioUnitario').txt(item.precioUnitario.toFixed(5));
      linea.ele('MontoTotal').txt(item.montoTotal.toFixed(5));
      if (item.descuento) {
        const d = linea.ele('Descuento');
        d.ele('MontoDescuento').txt(item.descuento.montoDescuento.toFixed(5));
        if (item.descuento.naturalezaDescuento) {
          d.ele('NaturalezaDescuento').txt(item.descuento.naturalezaDescuento);
        }
      }
      linea.ele('SubTotal').txt(item.subtotal.toFixed(5));
      if (item.baseImponible !== undefined) {
        linea.ele('BaseImponible').txt(item.baseImponible.toFixed(5));
      }
      if (item.impuesto) {
        const imp = linea.ele('Impuesto');
        imp.ele('Codigo').txt(item.impuesto.codigo);
        imp.ele('CodigoTarifa').txt(item.impuesto.codigoTarifa);
        imp.ele('Tarifa').txt(item.impuesto.tarifa.toFixed(2));
        imp.ele('Monto').txt(item.impuesto.monto.toFixed(5));
        if (item.impuesto.exoneracion) {
          const exo = imp.ele('Exoneracion');
          if (item.impuesto.exoneracion.tipoDocumento)
            exo.ele('TipoDocumento').txt(item.impuesto.exoneracion.tipoDocumento);
          if (item.impuesto.exoneracion.numeroDocumento)
            exo.ele('NumeroDocumento').txt(item.impuesto.exoneracion.numeroDocumento);
          if (item.impuesto.exoneracion.nombreInstitucion)
            exo.ele('NombreInstitucion').txt(item.impuesto.exoneracion.nombreInstitucion);
          if (item.impuesto.exoneracion.fechaEmision)
            exo.ele('FechaEmision').txt(item.impuesto.exoneracion.fechaEmision);
          if (item.impuesto.exoneracion.porcentajeExoneracion !== undefined)
            exo.ele('PorcentajeExoneracion').txt(item.impuesto.exoneracion.porcentajeExoneracion.toString());
          if (item.impuesto.exoneracion.montoExoneracion !== undefined)
            exo.ele('MontoExoneracion').txt(item.impuesto.exoneracion.montoExoneracion.toFixed(5));
        }
      }
      linea.ele('ImpuestoNeto').txt(item.impuestoNeto.toFixed(5));
      linea.ele('MontoTotalLinea').txt(item.montoTotalLinea.toFixed(5));
    });

    // ---- Otros Cargos (opcional) -----------------------------------
    if (invoice.otrosCargos) {
      invoice.otrosCargos.forEach(cargo => {
        const oc = rootNode.ele('OtrosCargos');
        oc.ele('TipoDocumentoOC').txt(cargo.tipoCargo);
        if (cargo.descripcionCargo) oc.ele('Detalle').txt(cargo.descripcionCargo);
        if (cargo.porcentaje !== undefined) oc.ele('PorcentajeOC').txt(cargo.porcentaje.toString());
        oc.ele('MontoCargo').txt(cargo.montoCargo.toFixed(5));
      });
    }

    // ---- Resumen de factura ---------------------------------------
    const resumen = rootNode.ele('ResumenFactura');
    const moneda = resumen.ele('CodigoTipoMoneda');
    moneda.ele('CodigoMoneda').txt(invoice.resumenFactura.codigoMoneda);
    if (invoice.resumenFactura.tipoCambio !== undefined) {
      moneda.ele('TipoCambio').txt(invoice.resumenFactura.tipoCambio.toFixed(5));
    }
    resumen.ele('TotalServGravados').txt(invoice.resumenFactura.totalServGravados.toFixed(2));
    resumen.ele('TotalServExentos').txt(invoice.resumenFactura.totalServExentos.toFixed(2));
    if (invoice.resumenFactura.totalServExonerado !== undefined) {
      resumen.ele('TotalServExonerado').txt(invoice.resumenFactura.totalServExonerado.toFixed(2));
    }
    if (invoice.resumenFactura.totalServNoSujeto !== undefined) {
      resumen.ele('TotalServNoSujeto').txt(invoice.resumenFactura.totalServNoSujeto.toFixed(2));
    }
    resumen.ele('TotalMercanciasGravadas').txt(invoice.resumenFactura.totalMercGravada.toFixed(2));
    resumen.ele('TotalMercanciasExentas').txt(invoice.resumenFactura.totalMercExenta.toFixed(2));
    if (invoice.resumenFactura.totalMercExonerada !== undefined) {
      resumen.ele('TotalMercExonerada').txt(invoice.resumenFactura.totalMercExonerada.toFixed(2));
    }
    if (invoice.resumenFactura.totalMercNoSujeta !== undefined) {
      resumen.ele('TotalMercNoSujeta').txt(invoice.resumenFactura.totalMercNoSujeta.toFixed(2));
    }
    resumen.ele('TotalGravado').txt(invoice.resumenFactura.totalGravado.toFixed(2));
    resumen.ele('TotalExento').txt(invoice.resumenFactura.totalExento.toFixed(2));
    if (invoice.resumenFactura.totalExonerado !== undefined) {
      resumen.ele('TotalExonerado').txt(invoice.resumenFactura.totalExonerado.toFixed(2));
    }
    if (invoice.resumenFactura.totalNoSujeto !== undefined) {
      resumen.ele('TotalNoSujeto').txt(invoice.resumenFactura.totalNoSujeto.toFixed(2));
    }
    resumen.ele('TotalVenta').txt(invoice.resumenFactura.totalVenta.toFixed(2));
    resumen.ele('TotalDescuentos').txt(invoice.resumenFactura.totalDescuentos.toFixed(2));
    resumen.ele('TotalVentaNeta').txt(invoice.resumenFactura.totalVentaNeta.toFixed(2));
    if (invoice.resumenFactura.totalOtrosImpuestos !== undefined) {
      resumen.ele('TotalOtrosImpuestos').txt(invoice.resumenFactura.totalOtrosImpuestos.toFixed(2));
    }
    resumen.ele('TotalImpuesto').txt(invoice.resumenFactura.totalImpuesto.toFixed(2));
    resumen.ele('TotalComprobante').txt(invoice.resumenFactura.totalComprobante.toFixed(2));

    // ---- Medios de pago --------------------------------------------
    invoice.medioPago.forEach((mp, idx) => {
      const mpNode = rootNode.ele('MedioPago');
      mpNode.ele('TipoMedioPago').txt(mp);
      if (invoice.medioPagoOtros && mp === '99') {
        mpNode.ele('MedioPagoOtros').txt(invoice.medioPagoOtros);
      }
      if (invoice.totalMedioPago && invoice.totalMedioPago[idx] !== undefined) {
        mpNode.ele('TotalMedioPago').txt(invoice.totalMedioPago[idx].toFixed(2));
      }
    });

    // ---- Información de referencia (opcional) ----------------------
    if (invoice.informacionReferencia) {
      invoice.informacionReferencia.forEach(ref => {
        const refNode = rootNode.ele('InformacionReferencia');
        refNode.ele('TipoDocIR').txt(ref.tipoDoc);
        if (ref.tipoDoc === '99' && ref.tipoDocOtros) {
          refNode.ele('TipoDocRefOTRO').txt(ref.tipoDocOtros);
        }
        refNode.ele('Numero').txt(ref.numero);
        refNode.ele('FechaEmisionIR').txt(ref.fechaEmision);
        refNode.ele('Codigo').txt(ref.codigo);
        if (ref.codigo === '99' && ref.razonOtros) {
          refNode.ele('CodigoReferenciaOTRO').txt(ref.razonOtros);
        }
        refNode.ele('Razon').txt(ref.razon);
      });
    }

    // ---- Otros -----------------------------------------------------
    if (invoice.otros) {
      const otrosNode = rootNode.ele('Otros');
      if (typeof invoice.otros === 'string') {
        otrosNode.ele('OtroTexto').txt(invoice.otros);
      } else if (Array.isArray(invoice.otros)) {
        invoice.otros.forEach(o => {
          if (o.tipo === 'texto') otrosNode.ele('OtroTexto').txt(o.contenido);
          else otrosNode.ele('OtroContenido').txt(o.contenido);
        });
      } else {
        if (invoice.otros.textos) invoice.otros.textos.forEach(t => otrosNode.ele('OtroTexto').txt(t));
        if (invoice.otros.contenidos) invoice.otros.contenidos.forEach(c => otrosNode.ele('OtroContenido').txt(c));
      }
    }

    return doc.end({ prettyPrint: true });
  } catch (error) {
    console.error('Error al generar XML:', error);
    throw new Error(`Error al generar XML: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
};

/**
 * Validate and sanitize invoice data
 * @param invoice Invoice data
 */
const validateAndSanitizeInvoice = (invoice: Invoice): Invoice => {
  // Crear una copia profunda para no modificar el objeto original
  const sanitizedInvoice = JSON.parse(JSON.stringify(invoice)) as Invoice;
  
  // Validar y corregir detalleServicio
  if (sanitizedInvoice.detalleServicio && Array.isArray(sanitizedInvoice.detalleServicio)) {
    sanitizedInvoice.detalleServicio = sanitizedInvoice.detalleServicio.map((item, index) => {
      // Asegurarse de que exista un ID válido
      if (!item.id || typeof item.id !== 'number') {
        item.id = index + 1;
      }
      
      // Validar y convertir cantidad a número
      if (typeof item.cantidad !== 'number') {
        const cantidadNum = parseFloat(String(item.cantidad));
        if (!isNaN(cantidadNum)) {
          item.cantidad = cantidadNum;
        } else {
          item.cantidad = 1; // Valor por defecto
        }
      }
      
      // Validar y convertir precioUnitario a número
      if (typeof item.precioUnitario !== 'number') {
        const precioNum = parseFloat(String(item.precioUnitario));
        if (!isNaN(precioNum)) {
          item.precioUnitario = precioNum;
        } else {
          item.precioUnitario = 0; // Valor por defecto
        }
      }
      
      // Asegurarse de que existe unidadMedida
      if (!item.unidadMedida || item.unidadMedida.trim() === '') {
        item.unidadMedida = 'Unid'; // Valor por defecto
      }
      
      return item;
    });
  }
  
  return sanitizedInvoice;
};

/**
 * Genera un string XML a partir del documento
 * @param doc Documento XML
 * @returns String XML formateado
 */
export const generateXmlString = (doc: any, shouldSign: boolean = true): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const xmlString = doc.end({ prettyPrint: true });
      if (shouldSign) {
        // En este punto se podría integrar la lógica de firmado del XML
        // Por ahora solo devolvemos el string sin firmar
        resolve(xmlString);
      } else {
        resolve(xmlString);
      }
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Descarga el XML como archivo
 * @param xmlString Contenido del XML
 * @param consecutivo Número consecutivo de la factura
 */
export function downloadXML(xmlString: string, consecutivo: string) {
  const blob = new Blob([xmlString], { type: 'application/xml;charset=utf-8' });
  // Determinar si es un tiquete electrónico basado en el número consecutivo
  const isTiquete = consecutivo.startsWith('04');
  const filePrefix = isTiquete ? 'tiquete' : 'factura';
  
  try {
    // Usar la API del navegador para descargar archivos
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filePrefix}_${consecutivo}.xml`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    console.log(`XML guardado como ${filePrefix}_${consecutivo}.xml`);
  } catch (error) {
    console.error('Error al descargar el XML:', error);
    throw new Error(`Error al descargar XML: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}
