# Facturador POS Costa Rica

Sistema de facturación electrónica para Costa Rica con interfaz POS moderna y funcional.

## Características

- Interfaz moderna y responsiva
- Integración con API de CABYS
- Generación de facturas electrónicas según normativa de Costa Rica
- Gestión de clientes
- Configuración de credenciales de Hacienda
- Dashboard con estadísticas y acciones rápidas

## Configuración Inicial

1. Conectar con Supabase:
   - Hacer clic en el botón "Connect to Supabase" en la esquina superior derecha
   - Seguir el proceso de configuración

2. Variables de Entorno:
   - Crear archivo `.env.local` con las siguientes variables:
     ```
     VITE_SUPABASE_URL=tu_url_de_supabase
     VITE_SUPABASE_ANON_KEY=tu_anon_key
     VITE_HACIENDA_API_URL=https://api-sandbox.comprobanteselectronicos.go.cr/recepcion/v1/recepcion/
     VITE_HACIENDA_TOKEN_URL=https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/protocol/openid-connect/token
     VITE_HACIENDA_CLIENT_ID=api-stag
     ```

3. Configuración de Hacienda:
   - Acceder a "Configuración de Usuario"
   - Completar credenciales de API
   - Subir certificado .p12

## Cambios Recientes

1. Base de Datos:
   - Tablas para clientes y configuración de usuario
   - Políticas de seguridad RLS implementadas

2. Interfaz:
   - Campos de emisor no editables en facturación
   - Gestión de clientes mejorada
   - Configuración de API de Hacienda actualizada

3. Factura PDF:
   - Diseño mejorado con márgenes ajustados
   - Soporte para logo de empresa
   - Mejor distribución de información

4. Dashboard:
   - Botones de acciones rápidas funcionales
   - Enlaces a secciones correspondientes

## Próximos Pasos

1. Implementar carga y almacenamiento de certificados .p12
2. Mejorar validación de credenciales de Hacienda
3. Agregar más opciones de personalización de facturas
4. Implementar sistema de respaldo de datos

## Notas de Seguridad

- Las credenciales de API se almacenan de forma segura y encriptada
- Implementación de políticas RLS para protección de datos
- Certificados .p12 almacenados de forma segura