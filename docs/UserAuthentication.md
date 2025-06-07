# Documentación de Autenticación y Perfil de Usuario

## Descripción General

Este documento describe la implementación del sistema de autenticación y el perfil de usuario en la aplicación FacturadorCR. La funcionalidad permite a los usuarios ver su información actual, acceder a opciones de configuración y cerrar sesión para volver a la pantalla de inicio de sesión.

## Componentes Principales

### 1. Header

El componente `Header` muestra la información del usuario actual y proporciona acceso al menú desplegable de usuario.

- **Ubicación**: `src/components/Header.tsx`
- **Funcionalidades**:
  - Muestra el nombre de la empresa del usuario actual
  - Muestra el tipo de identificación
  - Proporciona un botón con la inicial del usuario que al hacer clic muestra el menú desplegable

### 2. UserMenu

El componente `UserMenu` es un menú desplegable que aparece al hacer clic en el avatar del usuario en el Header.

- **Ubicación**: `src/components/UserMenu.tsx`
- **Funcionalidades**:
  - Muestra información detallada del usuario (nombre de empresa, número de identificación, correo)
  - Proporciona acceso a la página de configuración
  - Permite cerrar sesión

### 3. Login

El componente `Login` maneja la autenticación de usuarios cuando inician sesión o después de cerrar sesión.

- **Ubicación**: `src/pages/Login.tsx`
- **Funcionalidades**:
  - Formulario de inicio de sesión con campos para usuario y contraseña
  - Validación de credenciales
  - Opción para recuperar contraseña olvidada

## Flujo de Autenticación

1. **Inicio de Sesión**:
   - El usuario ingresa sus credenciales en la página de Login
   - Al enviar el formulario, se validan las credenciales
   - Si son correctas, se redirige al dashboard del usuario

2. **Sesión Activa**:
   - La información del usuario se carga desde `useUserSettings`
   - El Header muestra la información básica del usuario
   - El avatar muestra la inicial del nombre de la empresa

3. **Cierre de Sesión**:
   - El usuario hace clic en el avatar para abrir el menú desplegable
   - Selecciona "Cerrar sesión"
   - Se ejecuta `supabase.auth.signOut()` para cerrar la sesión
   - Se redirige al usuario a la página de Login

## Integración con Supabase

La autenticación y gestión de usuarios se realiza a través de Supabase:

- **Obtener Usuario Actual**: `supabase.auth.getUser()`
- **Cerrar Sesión**: `supabase.auth.signOut()`

## Configuración del Usuario

La información del usuario se gestiona a través del hook `useUserSettings`, que proporciona:

- Datos del usuario actual (nombre de empresa, identificación, etc.)
- Funciones para actualizar la configuración del usuario

## Personalización

El avatar del usuario muestra la inicial del nombre de la empresa. Si no hay un nombre de empresa configurado, se muestra "U" como valor predeterminado.

## Consideraciones de Seguridad

- Las credenciales de inicio de sesión deben almacenarse de forma segura
- Se recomienda implementar autenticación de dos factores en futuras versiones
- Las sesiones deben tener un tiempo de expiración adecuado

## Mejoras Futuras

- Implementar recuperación de contraseña por correo electrónico
- Añadir roles de usuario (administrador, usuario estándar, etc.)
- Mejorar la validación de credenciales con políticas de contraseñas seguras
- Implementar bloqueo de cuenta después de múltiples intentos fallidos de inicio de sesión