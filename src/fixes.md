# Cambios necesarios para corregir la generación de secuencias de facturas

## 1. Cambios en la función generateInvoiceSequence

```typescript
// Función para generar la secuencia (consecutivo y clave)
const generateInvoiceSequence = async (emisorId: string) => {
  try {
    // Solo generamos la secuencia si no tenemos una guardada ya
    if (!invoiceSequence.clave || !invoiceSequence.numeroConsecutivo) {
      console.log('Generando secuencia ÚNICA para la factura...');
      
      // Usamos el servicio centralizado para generar el consecutivo y la clave
      const sequence = await generateSequence(
        selectedCompanyId,
        emisorId,
        '01', // Tipo de documento: factura electrónica
        '01', // Terminal
        '002' // Sucursal
      );
      
      console.log('Secuencia generada exitosamente:', sequence);
      setInvoiceSequence(sequence);
    }
  } catch (error) {
    console.error('Error al generar la secuencia:', error);
  }
};
```

## 2. Asegurar que se llame la función antes de la vista previa

Modificar la función de vista previa para que llame a generateInvoiceSequence:

```typescript
// Función para generar la vista previa
const handlePreview = async () => {
  const formData = getValues();
  
  // Validar datos básicos
  if (!formData.detalleServicio || formData.detalleServicio.length === 0) {
    alert('Debe agregar al menos un producto o servicio para generar la vista previa');
    return;
  }
  
  if (!formData.emisor || !formData.emisor.identificacion || !formData.emisor.identificacion.numero) {
    alert('Los datos del emisor están incompletos');
    return;
  }
  
  if (!formData.receptor || !formData.receptor.identificacion || !formData.receptor.identificacion.numero) {
    alert('Los datos del receptor están incompletos');
    return;
  }
  
  try {
    // Generar la secuencia si no existe
    if (!invoiceSequence.clave || !invoiceSequence.numeroConsecutivo) {
      await generateInvoiceSequence(formData.emisor.identificacion.numero);
    }
    
    // Verificar que la secuencia se haya generado correctamente
    if (!invoiceSequence.clave || !invoiceSequence.numeroConsecutivo) {
      throw new Error('No se pudo generar la secuencia para la factura');
    }
    
    // Actualizar los datos del formulario con la secuencia generada
    formData.clave = invoiceSequence.clave;
    formData.numeroConsecutivo = invoiceSequence.numeroConsecutivo;
    
    // Mostrar la vista previa
    setPreviewInvoice(formData);
    setIsPreviewModalOpen(true);
  } catch (error) {
    console.error('Error al generar la vista previa:', error);
    alert('Error al generar la vista previa: ' + (error instanceof Error ? error.message : 'Error desconocido'));
  }
};
```

## 3. Asegurar que se llame la función al enviar el formulario

Modificar la función onSubmit para que llame a generateInvoiceSequence:

```typescript
const onSubmit = async (data: InvoiceFormData) => {
  setIsSubmitting(true);
  try {
    // Validar que haya líneas de detalle
    if (!data.detalleServicio || data.detalleServicio.length === 0) {
      console.error('Error: No hay líneas de detalle en la factura');
      alert('Debe agregar al menos un producto o servicio a la factura');
      setIsSubmitting(false);
      return;
    }
    
    if (!data.emisor || !data.emisor.identificacion || !data.emisor.identificacion.numero) {
      console.error('Error: Datos del emisor incompletos');
      alert('Los datos del emisor están incompletos');
      setIsSubmitting(false);
      return;
    }
    
    if (!data.receptor || !data.receptor.identificacion || !data.receptor.identificacion.numero) {
      console.error('Error: Datos del receptor incompletos');
      alert('Los datos del receptor están incompletos');
      setIsSubmitting(false);
      return;
    }
    
    // Generar la secuencia si no existe
    if (!invoiceSequence.clave || !invoiceSequence.numeroConsecutivo) {
      await generateInvoiceSequence(data.emisor.identificacion.numero);
    }
    
    // Verificar que la secuencia se haya generado correctamente
    if (!invoiceSequence.clave || !invoiceSequence.numeroConsecutivo) {
      console.error('Error: No se pudo generar la secuencia para la factura');
      alert('No se pudo generar la secuencia para la factura');
      setIsSubmitting(false);
      return;
    }
    
    // Asignar la secuencia a los datos del formulario
    data.clave = invoiceSequence.clave;
    data.numeroConsecutivo = invoiceSequence.numeroConsecutivo;
    
    // Continuar con el procesamiento del formulario...
    // Resto del código de onSubmit
  } catch (error) {
    console.error('Error al procesar la factura:', error);
    alert('Error al procesar la factura: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    setIsSubmitting(false);
  }
};
```

## 4. Actualizar la configuración del botón de vista previa

Asegurarse de que el botón de vista previa llame a la función correcta:

```jsx
<button
  type="button"
  className="px-4 py-2 bg-indigo-600 text-white rounded-md flex items-center justify-center hover:bg-indigo-700 mr-2"
  onClick={handlePreview}
>
  <Eye className="w-4 h-4 mr-2" />
  Vista Previa
</button>
```

## 5. Asegurar que el botón de envío use onSubmit correctamente

Configurar el formulario para usar onSubmit:

```jsx
<form onSubmit={handleSubmit(onSubmit)} className="p-4 bg-white rounded-lg shadow-md h-full flex flex-col">
  {/* Contenido del formulario */}
</form>
```

## Resumen de cambios

1. Mantenemos la función `generateInvoiceSequence` como está, asegurando que genera correctamente el consecutivo y la clave.
2. Actualizamos `handlePreview` para que llame a `generateInvoiceSequence` antes de mostrar la vista previa.
3. Actualizamos `onSubmit` para que llame a `generateInvoiceSequence` antes de procesar el envío del formulario.
4. Aseguramos que los botones y el formulario estén correctamente configurados para llamar a estas funciones.

Estos cambios garantizarán que tanto en la vista previa como en el envío final, se genere y utilice el consecutivo y la clave correctamente.
