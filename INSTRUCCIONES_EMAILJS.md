# Instrucciones para Probar el Sistema de Correo Electrónico

Este documento proporciona instrucciones paso a paso para configurar y probar el nuevo sistema de envío de correos electrónicos con EmailJS implementado en la aplicación.

## Configuración Inicial

### 1. Crear una Cuenta en EmailJS

1. Visita [https://www.emailjs.com/](https://www.emailjs.com/) y regístrate para obtener una cuenta gratuita
2. La cuenta gratuita permite enviar hasta 200 correos por mes

### 2. Configurar un Servicio de Correo

1. En el dashboard de EmailJS, ve a "Email Services" y haz clic en "Add New Service"
2. Selecciona tu proveedor de correo (Gmail, Outlook, etc.)
3. Sigue las instrucciones para conectar tu cuenta de correo
4. Anota el "Service ID" que se te asignará

### 3. Crear una Plantilla de Correo

1. En el dashboard de EmailJS, ve a "Email Templates" y haz clic en "Create New Template"
2. Puedes usar el ejemplo proporcionado en `src/examples/emailJSTemplateExample.html` como base
3. Asegúrate de incluir las variables necesarias en tu plantilla (ver archivo de ejemplo)
4. Anota el "Template ID" que se te asignará

### 4. Configurar Variables de Entorno

1. Crea o edita el archivo `.env` en la raíz del proyecto
2. Añade las siguientes variables con tus valores:

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

## Prueba del Sistema

### 1. Reiniciar la Aplicación

1. Detén la aplicación si está en ejecución
2. Inicia la aplicación nuevamente con `npm run dev`
3. Verifica en la consola del navegador que aparezca el mensaje "EmailJS inicializado correctamente"

### 2. Crear un Cliente con Correo Electrónico

1. Ve a la sección "Clientes" en la aplicación
2. Crea un nuevo cliente o edita uno existente
3. Asegúrate de incluir una dirección de correo electrónico válida

### 3. Crear una Factura

1. Ve a la sección "Crear Factura"
2. Selecciona el cliente que creaste o editaste
3. Completa los datos de la factura y guárdala
4. El sistema enviará automáticamente un correo electrónico al cliente con la factura

### 4. Verificar el Envío

1. Revisa la consola del navegador para ver los mensajes de registro
2. Verifica la bandeja de entrada del correo electrónico del cliente
3. Comprueba que el correo incluya:
   - Asunto personalizado con el número de factura
   - Nombre del cliente en el saludo
   - Archivos adjuntos (PDF y XML)

## Solución de Problemas

### Si el correo no se envía:

1. Verifica las credenciales de EmailJS en el archivo `.env`
2. Comprueba que la plantilla de correo esté correctamente configurada
3. Revisa la consola del navegador para ver mensajes de error específicos
4. Asegúrate de que el cliente tenga un correo electrónico válido

### Si los archivos adjuntos no aparecen:

1. Verifica que la plantilla de EmailJS esté configurada para mostrar adjuntos
2. Comprueba que el tamaño total del correo no exceda los límites de EmailJS

## Personalización

Puedes personalizar el contenido y apariencia de los correos electrónicos editando:

1. La plantilla en EmailJS
2. Los parámetros en la función `sendInvoiceByEmail` en los archivos:
   - `src/pages/InvoiceCreate.tsx`
   - `src/pages/TiqueteCreate.tsx`

---

Para más información, consulta el archivo `README_EMAILJS.md` que contiene documentación detallada sobre el sistema de correo electrónico.