# Configuración del Sistema de Correo Electrónico con EmailJS

Este documento explica cómo configurar y utilizar el sistema de envío de correos electrónicos para facturas utilizando EmailJS, una solución que permite enviar correos directamente desde el frontend sin necesidad de un servidor backend.

## Índice

1. [Introducción](#introducción)
2. [Requisitos Previos](#requisitos-previos)
3. [Configuración de EmailJS](#configuración-de-emailjs)
4. [Variables de Entorno](#variables-de-entorno)
5. [Uso del Servicio](#uso-del-servicio)
6. [Plantillas de Correo](#plantillas-de-correo)
7. [Solución de Problemas](#solución-de-problemas)

## Introducción

El sistema implementado utiliza EmailJS para enviar facturas electrónicas por correo a los clientes. Esta solución permite:

- Enviar correos directamente desde el navegador sin necesidad de un servidor backend
- Adjuntar archivos PDF y XML de las facturas
- Incluir opcionalmente el documento de aceptación de Hacienda
- Personalizar el asunto y contenido de los correos
- Enviar copias (CC) a direcciones adicionales

## Requisitos Previos

1. Crear una cuenta en [EmailJS](https://www.emailjs.com/)
2. Configurar un servicio de correo electrónico (Gmail, Outlook, etc.)
3. Crear una plantilla de correo electrónico
4. Obtener las credenciales necesarias (Service ID, Template ID, User ID)
5. Instalar la biblioteca @emailjs/browser en el proyecto:

```bash
npm install --save @emailjs/browser
```

Esta biblioteca es la versión actualizada y recomendada para el envío de correos electrónicos desde el frontend.

## Configuración de EmailJS

### Paso 1: Crear una cuenta en EmailJS

1. Visita [https://www.emailjs.com/](https://www.emailjs.com/) y regístrate para obtener una cuenta gratuita
2. La cuenta gratuita permite enviar hasta 200 correos por mes, lo cual es suficiente para pruebas y pequeños negocios

### Paso 2: Configurar un servicio de correo

1. En el dashboard de EmailJS, ve a "Email Services" y haz clic en "Add New Service"
2. Selecciona tu proveedor de correo (Gmail, Outlook, etc.)
3. Sigue las instrucciones para conectar tu cuenta de correo
4. Una vez conectado, anota el "Service ID" que se te asignará

### Paso 3: Crear una plantilla de correo

1. En el dashboard de EmailJS, ve a "Email Templates" y haz clic en "Create New Template"
2. Puedes usar el ejemplo proporcionado en `src/examples/emailJSTemplateExample.html` como base
3. Asegúrate de incluir las variables necesarias en tu plantilla:
   - `{{to_name}}`: Nombre del destinatario
   - `{{to_id}}`: ID del destinatario
   - `{{to_email}}`: Correo del destinatario
   - `{{from_name}}`: Nombre del remitente
   - `{{from_email}}`: Correo del remitente
   - `{{subject}}`: Asunto del correo
   - `{{message}}`: Mensaje personalizado
   - `{{invoice_number}}`: Número de factura
   - `{{include_acceptance_doc}}`: Bandera para incluir documento de aceptación
4. Anota el "Template ID" que se te asignará

### Paso 4: Obtener las credenciales

1. En el dashboard de EmailJS, ve a "Account" > "API Keys"
2. Anota tu "User ID" (Public Key)
3. Opcionalmente, puedes generar un "Private Key" (Access Token) para mayor seguridad

## Variables de Entorno

Configura las siguientes variables en tu archivo `.env`:

```
# Configuración de EmailJS
VITE_EMAILJS_SERVICE_ID=tu_service_id
VITE_EMAILJS_TEMPLATE_ID=tu_template_id
VITE_EMAILJS_USER_ID=tu_user_id
VITE_EMAILJS_ACCESS_TOKEN=tu_access_token  # Opcional

# Configuración del remitente
VITE_EMAIL_FROM=tu_correo@ejemplo.com
VITE_EMAIL_FROM_NAME=Tu Empresa

# Configuración adicional
VITE_INCLUDE_ACCEPTANCE_DOC=true  # o false
```

## Uso del Servicio

El sistema está integrado con el proceso de facturación existente. Cuando se genera una factura, el sistema automáticamente:

1. Verifica si el cliente tiene un correo electrónico registrado
2. Convierte los archivos PDF y XML a formato Base64
3. Envía la factura por correo electrónico utilizando EmailJS

No se requiere ninguna acción adicional por parte del usuario para enviar las facturas por correo electrónico.

### Uso Programático

Si necesitas enviar correos electrónicos desde otras partes de la aplicación, puedes utilizar las funciones proporcionadas en `src/services/emailService.ts`:

```typescript
import { sendInvoiceEmail, blobToBase64 } from '../services/emailService';

// Convertir archivos a Base64
const pdfBase64 = await blobToBase64(pdfBlob);
const xmlBase64 = btoa(xmlContent);

// Enviar correo
const result = await sendInvoiceEmail(
  'cliente@ejemplo.com',  // Correo del cliente
  'Nombre del Cliente',   // Nombre del cliente (opcional)
  'FE-001-00000001',     // Número de factura
  pdfBase64,              // PDF en Base64
  xmlBase64,              // XML en Base64
  acceptanceDocBase64,    // Documento de aceptación (opcional)
  'Asunto personalizado', // Asunto (opcional)
  'Mensaje personalizado',// Mensaje (opcional)
  ['copia@ejemplo.com']   // Correos CC (opcional)
);

if (result.success) {
  console.log(result.message);
} else {
  console.error(result.message);
}
```

## Plantillas de Correo

Se proporciona un ejemplo de plantilla HTML en `src/examples/emailJSTemplateExample.html` que puedes utilizar como base para crear tu propia plantilla en EmailJS.

La plantilla incluye:

- Encabezado con el nombre de la empresa
- Saludo personalizado al cliente
- Mensaje personalizable
- Lista de archivos adjuntos
- Pie de página con información de contacto

Puedes personalizar esta plantilla según tus necesidades y el estilo de tu marca.

## Solución de Problemas

### Correos no enviados

Si los correos no se están enviando correctamente, verifica:

1. Las credenciales de EmailJS en tu archivo `.env`
2. La conexión a internet
3. Los límites de tu cuenta de EmailJS (200 correos/mes en el plan gratuito)
4. Los registros de la consola para mensajes de error específicos

### Problemas de importación de la biblioteca

Si encuentras errores relacionados con la importación de EmailJS:

1. Asegúrate de que la biblioteca esté correctamente instalada con `npm install --save @emailjs/browser`
2. Verifica que estés usando la sintaxis de importación correcta: `import('@emailjs/browser')` para importaciones dinámicas
3. No uses `as any` en las importaciones a menos que sea absolutamente necesario para la compatibilidad con TypeScript
4. Si usabas anteriormente `emailjs-com`, asegúrate de haber actualizado todas las referencias a `@emailjs/browser`

### Archivos adjuntos no visibles

Si los archivos adjuntos no aparecen en los correos:

1. Verifica que los archivos se estén convirtiendo correctamente a Base64
2. Asegúrate de que el tamaño total del correo no exceda los límites de EmailJS (50MB)
3. Comprueba que la plantilla esté configurada para mostrar los adjuntos

### Personalización de la plantilla

Si necesitas personalizar la plantilla:

1. Edita el archivo `src/examples/emailJSTemplateExample.html`
2. Copia el contenido a tu plantilla en EmailJS
3. Asegúrate de mantener todas las variables necesarias (`{{variable}}`)

---

Para más información sobre EmailJS, consulta la [documentación oficial](https://www.emailjs.com/docs/).