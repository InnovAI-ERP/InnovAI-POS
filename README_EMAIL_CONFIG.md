# Configuración del Servicio de Correo Electrónico para Producción

Este documento proporciona instrucciones paso a paso para configurar el servicio de correo electrónico en producción para el envío de facturas y tiquetes electrónicos con sus respectivos documentos adjuntos (XML, PDF y documento de aceptación de Hacienda).

## Requisitos Previos

- Cuenta de correo electrónico para el envío de facturas (Gmail, Outlook, u otro proveedor)
- Acceso a la configuración SMTP del proveedor de correo
- Si se usa Gmail, se recomienda crear una "Contraseña de aplicación" en lugar de usar la contraseña normal

## Pasos para la Configuración

### 1. Configurar las Variables de Entorno

Puedes configurar las siguientes variables de entorno en tu servidor de producción:

```
# Configuración del servidor SMTP
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=tu_correo@gmail.com
EMAIL_PASSWORD=tu_contraseña_de_aplicacion

# Configuración del remitente
EMAIL_FROM=tu_correo@gmail.com
EMAIL_FROM_NAME=Tu Empresa

# Incluir documento de aceptación de Hacienda
INCLUDE_ACCEPTANCE_DOC=true
```

### 2. Configuración Programática

Alternativamente, puedes configurar el servicio de correo electrónico directamente en tu código utilizando la función `configureEmailService` que hemos implementado:

```typescript
import { configureEmailService } from './services/invoiceService';

// Configurar el servicio de correo con Gmail
configureEmailService(
  {
    // Configuración del servidor SMTP
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true para puerto 465, false para otros puertos
    user: 'tu_correo@gmail.com',
    password: 'tu_contraseña_de_aplicacion'
  },
  {
    // Información del remitente
    name: 'Tu Empresa',
    email: 'tu_correo@gmail.com'
  },
  true // Incluir documento de aceptación de Hacienda
);
```

### 3. Configuración para Diferentes Proveedores de Correo

#### Gmail

- **Host**: smtp.gmail.com
- **Puerto**: 587 (TLS) o 465 (SSL)
- **Seguro**: false para puerto 587, true para puerto 465
- **Usuario**: Tu dirección de correo de Gmail
- **Contraseña**: Contraseña de aplicación (recomendado) o contraseña normal

> **Nota**: Para Gmail, es recomendable usar una "Contraseña de aplicación" en lugar de la contraseña normal. Puedes crear una contraseña de aplicación en: https://myaccount.google.com/apppasswords

#### Outlook/Office 365

- **Host**: smtp.office365.com
- **Puerto**: 587
- **Seguro**: false
- **Usuario**: Tu dirección de correo de Outlook
- **Contraseña**: Tu contraseña

## Envío de Facturas por Correo Electrónico

Una vez configurado el servicio de correo, puedes enviar facturas por correo electrónico utilizando la función `sendInvoiceByEmail`:

```typescript
import { sendInvoiceByEmail } from './services/invoiceService';

// Enviar la factura por correo electrónico
await sendInvoiceByEmail(
  'cliente@ejemplo.com', // Correo del receptor
  xmlContent, // Contenido XML de la factura
  pdfBlob, // PDF de la factura
  invoiceNumber, // Número de factura
  undefined, // Usar el correo del remitente configurado
  undefined, // Usar el nombre del remitente configurado
  acceptanceDocBlob, // Documento de aceptación de Hacienda
  ['copia@empresa.com'], // Correo en copia (CC)
  ['registro@empresa.com'], // Correo en copia oculta (BCC)
  `Factura Electrónica ${invoiceNumber} - Tu Empresa`, // Asunto personalizado
  htmlMessage // Mensaje HTML personalizado (opcional)
);
```

## Solución de Problemas

### Verificación de la Conexión SMTP

La función `sendInvoiceByEmail` ahora incluye una verificación de la conexión con el servidor SMTP antes de enviar el correo. Si hay algún problema con la conexión, se mostrará un mensaje de error detallado.

### Errores Comunes

1. **Error de autenticación**: Verifica que el usuario y la contraseña sean correctos.
2. **Error de conexión**: Verifica que el host y el puerto sean correctos y que no haya restricciones de firewall.
3. **Error de seguridad**: Si usas Gmail, asegúrate de haber habilitado el acceso a aplicaciones menos seguras o de estar usando una contraseña de aplicación.

## Ejemplo Completo

Hemos incluido un archivo de ejemplo en `src/examples/emailConfigExample.ts` que muestra cómo configurar el servicio de correo para diferentes proveedores y cómo enviar facturas por correo electrónico con todas las opciones disponibles.

## Características Adicionales

- **Copias (CC) y Copias Ocultas (BCC)**: Puedes enviar copias del correo a múltiples destinatarios.
- **Asunto Personalizado**: Puedes personalizar el asunto del correo.
- **Mensaje HTML Personalizado**: Puedes personalizar el contenido HTML del correo.
- **Prioridad Alta**: Los correos se envían con prioridad alta para asegurar que sean notados por el receptor.

## Seguridad

- No almacenes las credenciales de correo electrónico directamente en el código.
- Utiliza variables de entorno o un sistema de gestión de secretos para almacenar las credenciales.
- Si usas Gmail, utiliza una contraseña de aplicación en lugar de la contraseña normal.
- Considera implementar cifrado adicional para proteger la información sensible.