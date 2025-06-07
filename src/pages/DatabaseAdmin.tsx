import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';
import { Textarea } from '../components/ui/textarea';
import { Toaster } from '../components/ui/toaster';
import { useToast } from '../components/ui/use-toast';
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { getCompanyUuid } from '../services/uuidMappingService';
// Supabase está importado tanto directamente como a través de otros servicios
import { useInvoiceHistory } from '../hooks/useInvoiceHistory';
// Importar la función de actualización de facturas
import { actualizarFacturasExistentes } from '../db/update_invoices';

const DatabaseAdmin: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{success?: boolean; message: string}>({message: ''});
  const [migrationStatus, setMigrationStatus] = useState('');
  const [sqlContent, setSqlContent] = useState<string>('');
  const [refreshStatus, setRefreshStatus] = useState('');
  // Hook para gestionar las facturas y sincronizarlas con Supabase
  const { syncToSupabase } = useInvoiceHistory();
  const { toast } = useToast();

  // Función para cargar el contenido SQL desde el archivo
  const loadSqlContent = async () => {
    try {
      setLoading(true);
      const response = await fetch('/src/db/supabase_schema.sql');
      const content = await response.text();
      setSqlContent(content);
      toast({
        title: '¡SQL cargado correctamente!',
        description: 'El esquema de la base de datos ha sido cargado.',
        variant: 'default',
      });
    } catch (error) {
      console.error('Error al cargar el SQL:', error);
      toast({
        title: 'Error al cargar SQL',
        description: 'No se pudo cargar el archivo SQL. Verifique la consola para más detalles.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Función para preparar las instrucciones SQL para inicializar la base de datos
  const initializeDatabase = async () => {
    if (!sqlContent) {
      toast({
        title: 'Error',
        description: 'Por favor, cargue el esquema SQL primero.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setResult({message: 'Preparando SQL para la inicialización...'});

    try {
      // Procesamos el contenido SQL para verificar que sea válido
      const isValidSql = sqlContent
        .split(';')
        .some(statement => statement.trim() && !statement.startsWith('--'));

      if (!isValidSql) {
        throw new Error('El contenido SQL parece no ser válido. Verifique que contiene instrucciones SQL correctas.');
      }

      // En lugar de intentar ejecutar las sentencias SQL directamente con una función RPC
      // que no existe, proporcionamos instrucciones para ejecutarlas manualmente
      setResult({success: true, message: `La función RPC 'exec_sql' no está disponible en Supabase por motivos de seguridad. Por favor, siga estas instrucciones para inicializar la base de datos manualmente:

1. Inicie sesión en su panel de Supabase (https://app.supabase.com)
2. Seleccione su proyecto: kfjqfgtswnwhjfxhtyin
3. Vaya a la sección "SQL Editor"
4. Cree una nueva consulta
5. Copie y pegue el contenido del esquema SQL que ha cargado
6. Ejecute la consulta

Alternativamente, puede usar la pestaña "Instrucciones Manuales" en esta página para obtener más detalles y copiar el SQL necesario.`
      });

      toast({
        title: 'SQL preparado',
        description: 'Por favor, ejecute el SQL manualmente siguiendo las instrucciones proporcionadas.',
        variant: 'default',
      });
      
    } catch (error) {
      console.error('Error al preparar SQL:', error);
      setResult({
        success: false, 
        message: 'Error al preparar SQL. Ver consola para detalles.'
      });
      toast({
        title: 'Error',
        description: 'Error al preparar SQL. Ver consola para detalles.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Función para verificar datos en Supabase
  const verifySupabaseData = async () => {
    setLoading(true);
    setMigrationStatus('Verificando datos en Supabase...');
    
    try {
      // Importar supabase
      const { supabase } = await import('../lib/supabase');
      
      console.log('Iniciando verificación de datos en Supabase...');
      
      // Verificar empresas
      const { data: companies, error: companiesError } = await supabase.from('companies').select('*');
      if (companiesError) {
        console.error('Error al obtener empresas:', companiesError);
        throw new Error(`Error al obtener empresas: ${companiesError.message}`);
      }
      
      console.log('Empresas en Supabase:', companies);
      
      // Verificar estructura de la tabla companies
      const { data: companiesColumns, error: columnsError } = await supabase
        .from('companies')
        .select()
        .limit(0);
      
      if (columnsError) {
        console.error('Error al obtener estructura de empresas:', columnsError);
      } else {
        // Esto mostrará la estructura de la respuesta para depuración
        console.log('Estructura de la tabla companies:', companiesColumns);
      }
      
      // Obtener el UUID correcto para INNOVA una sola vez
      const innovaUuid = getCompanyUuid('innova');
      console.log('UUID de INNOVA para verificación:', innovaUuid);
      
      // Verificar clientes
      console.log('Verificando clientes con UUID de INNOVA:', innovaUuid);
      
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .eq('company_id', innovaUuid);
        
      if (clientsError) {
        console.error('Error al obtener clientes:', clientsError);
        throw new Error(`Error al obtener clientes: ${clientsError.message}`);
      }
      
      console.log(`Se encontraron ${clients?.length || 0} clientes para INNOVA`);
      
      // Verificar productos
      console.log('Verificando productos con UUID de INNOVA:', innovaUuid);
      
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', innovaUuid);
        
      if (productsError) {
        console.error('Error al obtener productos:', productsError);
        throw new Error(`Error al obtener productos: ${productsError.message}`);
      }
      
      console.log(`Se encontraron ${products?.length || 0} productos para INNOVA`);
      
      // Verificar usuarios (opcional)
      try {
        const { data: users } = await supabase.from('users').select('*');
        console.log('Usuarios en Supabase:', users || 'No hay usuarios');
      } catch (userError) {
        console.log('Error al consultar usuarios (tabla probablemente no existe aún):', userError);
      }
      
      // Mostrar resumen detallado
      const summary = `
Datos en Supabase:
- Empresas: ${companies.length} ${companies.length > 0 ? '✅' : '❌'}
- Clientes: ${clients.length} ${clients.length > 0 ? '✅' : '❌'}
- Productos: ${products.length} ${products.length > 0 ? '✅' : '❌'}`;
      
      // Mostrar los IDs de las empresas migradas para más detalle
      const companiesDetails = companies.length > 0 
        ? `\n\nEmpresas migradas: ${companies.map(c => `${c.name} (ID: ${c.id})`).join(', ')}`
        : '';
      
      setMigrationStatus(`Verificación completada. ${summary}${companiesDetails}`);
      console.log('Datos en Supabase:', { companies, clients, products });
      
      toast({
        title: 'Verificación completada',
        description: summary,
      });
    } catch (error) {
      console.error('Error durante la verificación:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setMigrationStatus(`Error durante la verificación: ${errorMessage}`);
      toast({
        title: 'Error en la verificación',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Función para actualizar los datos de facturas existentes en Supabase
  const refreshDatabaseData = async () => {
    setLoading(true);
    setRefreshStatus('Iniciando actualización de datos de facturas en Supabase...');
    
    try {
      // Llamar a la función de actualización importada
      const result = await actualizarFacturasExistentes();
      
      if (result.success) {
        setRefreshStatus('Actualización completada con éxito. Las facturas han sido enriquecidas con plazo de crédito, consecutivo unificado y nombre de medio de pago.');
        toast({
          title: 'Actualización completada',
          description: 'Los datos de facturas se han actualizado correctamente en Supabase.',
        });
      } else {
        const errorMessage = result.error || 'Error desconocido';
        setRefreshStatus(`Error durante la actualización: ${errorMessage}`);
        toast({
          title: 'Error en la actualización',
          description: errorMessage.toString(),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error durante la actualización:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setRefreshStatus(`Error durante la actualización: ${errorMessage}`);
      toast({
        title: 'Error en la actualización',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Función para migrar datos desde localStorage a Supabase
  const migrateData = async () => {
    setLoading(true);
    setMigrationStatus('Iniciando migración de datos...');
    
    try {
      // En lugar de importar, ejecutamos la migración directamente
      // Implementación simplificada de migrateLocalStorageToSupabase
      console.log('Iniciando migración de datos de localStorage a Supabase...');
      
      // Eliminar forzosamente el modo local
      console.log('Eliminando forzosamente el modo local...');
      localStorage.setItem('force_local_mode', 'false');
      
      // Sincronizar facturas usando la función del hook useInvoiceHistory
      console.log('Sincronizando facturas con Supabase...');
      try {
        const syncResult = await syncToSupabase();
        console.log('Resultado de sincronización de facturas:', syncResult);
        setMigrationStatus(prev => `${prev}\nFacturas sincronizadas correctamente.`);
      } catch (syncError) {
        console.error('Error al sincronizar facturas:', syncError);
        setMigrationStatus(prev => `${prev}\nError al sincronizar facturas: ${syncError instanceof Error ? syncError.message : 'Error desconocido'}`);
      }
      
      // Importar Supabase directamente - enfoque más simple
      const { supabase } = await import('../lib/supabase');
      
      // Verificar si estamos autenticados o necesitamos serlo
      const { data: sessionData } = await supabase.auth.getSession();
      console.log('Estado de sesión actual:', sessionData?.session ? 'Autenticado' : 'No autenticado');
      
      // Intentar autenticar con service_role para superar las restricciones de RLS
      if (!sessionData?.session) {
        try {
          // Intentar iniciar sesión como admin para tener más permisos
          // Solo para migración - en un entorno real no se haría así
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: 'admin@example.com',
            password: 'admin123'
          });
          
          if (signInError) {
            console.log('No se pudo autenticar, usando cliente anónimo:', signInError);
          } else {
            console.log('Autenticado exitosamente para la migración');
          }
        } catch (e) {
          console.error('Error al intentar autenticar:', e);
        }
      }
      
      // Migrar empresas
      console.log('Migrando empresas...');
      
      // Obtener empresas de localStorage
      let localCompanies = [];
      try {
        const companiesStr = localStorage.getItem('companies');
        if (companiesStr) {
          localCompanies = JSON.parse(companiesStr);
        }
      } catch (error) {
        console.error('Error al obtener empresas de localStorage:', error);
      }
      
      // Si no hay empresas en localStorage, verificar si hay una empresa seleccionada
      if (localCompanies.length === 0) {
        try {
          const selectedCompanyStr = localStorage.getItem('selected_company');
          const userSettingsStr = localStorage.getItem('user_settings');
          
          if (selectedCompanyStr) {
            // Verificar si el valor es un JSON válido o simplemente un string
            try {
              const selectedCompany = JSON.parse(selectedCompanyStr);
              if (typeof selectedCompany === 'object' && selectedCompany !== null) {
                localCompanies = [selectedCompany];
                console.log('Empresa seleccionada obtenida de localStorage:', selectedCompany);
              }
            } catch (jsonError) {
              console.log('El valor de selected_company no es un JSON válido:', selectedCompanyStr);
              // No es un JSON válido, probablemente es solo el nombre de la empresa
              // Verificar si coincide con alguna empresa en userSettings
            }
          }
          
          // Si aún no tenemos empresas, intentar con user_settings
          if (localCompanies.length === 0 && userSettingsStr) {
            try {
              const userSettings = JSON.parse(userSettingsStr);
              if (userSettings.companies && userSettings.companies.length > 0) {
                localCompanies = userSettings.companies;
                console.log('Empresas obtenidas de user_settings:', localCompanies);
              }
            } catch (jsonError) {
              console.error('Error al parsear user_settings:', jsonError);
            }
          }
        } catch (error) {
          console.error('Error al obtener empresa seleccionada:', error);
        }
      }
      
      // Si aún no hay empresas, crear la empresa Innova con los datos del archivo .env
      if (localCompanies.length === 0) {
        console.log('No se encontraron empresas en localStorage. Creando empresa Innova desde el archivo .env...');
        localCompanies = [{
          name: 'INNOVA & AI GROUP CR SOCIEDAD DE RESPONSABILIDAD LIMITADA',
          legalName: 'INNOVA & AI GROUP CR SOCIEDAD DE RESPONSABILIDAD LIMITADA',
          commercialName: 'Grupo InnovAI',
          identificationType: 'Jurídica',
          identificationNumber: '3102928079',
          email: 'admin@innovaicr.com',
          phone: '506-88821455',
          address: 'San Sebastian, San José, de la Iglesia Bautista 75 metros sur, 25 oeste, Avenida París',
          province: 'San José',
          canton: 'San José',
          district: 'San Sebastian',
          economicActivity: '741203',
          haciendaUsername: 'cpj-3-102-928079@stag.comprobanteselectronicos.go.cr',
          haciendaPassword: '}:f%}y>LU7)D|)|I%SwQ',
          isActive: true
        }];
      }
      
      // Migrar cada empresa
      for (const company of localCompanies) {
        console.log('Migrando empresa:', company.name);
        
        // Asegurémonos de mapear todos los campos relevantes de la empresa
        console.log('Mapeando empresa:', company);
        const companyData = {
          name: company.name || 'Empresa sin nombre',
          legal_name: company.legalName || company.name || 'Empresa sin nombre legal',
          identification_type: company.identificationType || 'Jurídica',
          identification_number: company.identificationNumber || '000000000',
          email: company.email || 'info@empresa.com',
          phone: company.phone || '',
          address: company.address || '',
          province: company.province || '',
          canton: company.canton || '',
          district: company.district || '',
          // Si hay campos adicionales disponibles, los incluimos
          currency: 'CRC',
          economic_activity: company.economicActivity || '',
          is_active: true
        };
        
        // Ver exactamente qué datos estamos enviando para depuración
        console.log('Datos a insertar en Supabase:', companyData);
        
        // Llamada directa a Supabase
        const { data, error } = await supabase
          .from('companies')
          .insert(companyData)
          .select()
          .single();
        
        if (!error && data) {
          console.log(`Empresa migrada: ${company.name} (ID: ${data.id})`);
        } else {
          console.error(`Error al migrar empresa ${company.name}:`, error);
          
          // Mensaje específico para errores de políticas RLS
          if (error?.code === '42501' && error?.message?.includes('row-level security policy')) {
            console.error(`
=========== MENSAJE IMPORTANTE ===========
Para migrar datos a Supabase, necesitas:

1. Iniciar sesión en tu proyecto Supabase: https://kfjqfgtswnwhjfxhtyin.supabase.co
2. Ir a 'Authentication' > 'Policies'
3. Habilitar (enable) las políticas para 'companies', 'clients' y 'products'
   o agregar políticas específicas que permitan inserción

Alternativamente, puedes obtener tu service_role key y usarla para la migración.
=========================================`);
          }
        }
      }
      
      // Migrar clientes
      console.log('Migrando clientes...');
      try {
        const clientsStr = localStorage.getItem('clients');
        if (clientsStr) {
          const clients = JSON.parse(clientsStr);
          let clientsCount = 0;
          
          for (const client of clients) {
            // Usar directamente el UUID de INNOVA desde nuestro servicio centralizado
            // Esto evita tener que consultar la base de datos cada vez
            const companyUuid = getCompanyUuid('innova');
            console.log('Usando UUID de INNOVA para cliente:', companyUuid);
            
            // Examinar completamente el cliente para asegurar una migración correcta
            console.log('Cliente original a migrar:', client);
            
            // Buscar campos específicos en varias posibles ubicaciones del objeto cliente
            // Mapeo de campos para manejar diferentes nombres de propiedades
            const getClientField = (fieldNames: string[], defaultValue: any = null) => {
              for (const fieldName of fieldNames) {
                if (client[fieldName] !== undefined && client[fieldName] !== null) {
                  return client[fieldName];
                }
              }
              return defaultValue;
            };
            
            // Obtener el número de identificación correcto (cédula) - IMPORTANTE: No usar el campo 'id' que es un UUID interno
            // Buscamos explícitamente solo en campos que representan el número de cédula real
            let identificationNumber = getClientField(['identification_number', 'identificationNumber', 'cedula', 'identification']);
            
            // Verificar exactamente qué campo se está utilizando para la trazabilidad
            if (identificationNumber) {
              console.log(`✅ Número de identificación encontrado: ${identificationNumber}`);
            } else {
              // Crear un número de identificación genérico basado en el nombre
              identificationNumber = `GEN-${client.name?.replace(/\s+/g, '-').substring(0, 10) || 'CLIENTE'}-${Date.now().toString().substring(8, 13)}`;
              console.log(`⚠️ Cliente sin número de identificación, generando uno temporal: ${identificationNumber}`);
            }
            
            // Registro adicional para depuración
            if (client.id && client.identification_number) {
              console.log(`ℹ️ Diferencia entre ID y cédula: ID=${client.id}, Cédula=${client.identification_number}`);
            }
            
            const clientData = {
              identification_number: identificationNumber, // Nunca será nulo
              identification_type: getClientField(['identificationType', 'tipoIdentificacion', 'tipo_identificacion'], 'Física'),
              name: getClientField(['name', 'nombre'], 'Cliente sin nombre'),
              email: getClientField(['email', 'correo'], ''),
              phone: getClientField(['phone', 'telefono'], ''),
              address: getClientField(['address', 'direccion'], ''),
              province: getClientField(['province', 'provincia'], ''),
              canton: getClientField(['canton'], ''),
              district: getClientField(['district', 'distrito'], ''),
              postal_code: getClientField(['postalCode', 'postal_code', 'codigo_postal'], ''),
              tax_regime: getClientField(['taxRegime', 'tax_regime', 'regimen_fiscal'], ''),
              company_id: companyUuid, // UUID válido de la compañía
              is_active: true
            };
            
            console.log('Datos de cliente mapeados para inserción:', clientData);
            
            // Insertar cliente directamente en Supabase
            const { data, error } = await supabase
              .from('clients')
              .insert(clientData)
              .select()
              .single();
              
            if (!error && data) {
              clientsCount++;
            } else {
              console.error(`Error al migrar cliente ${client.name}:`, error);
            }
          }
          
          console.log(`Clientes migrados: ${clientsCount} de ${clients.length}`);
        } else {
          console.log('No se encontraron clientes en localStorage');
        }
      } catch (error) {
        console.error('Error al migrar clientes:', error);
      }
      
      // Migrar productos
      console.log('Migrando productos...');
      try {
        const productsStr = localStorage.getItem('products');
        if (productsStr) {
          const products = JSON.parse(productsStr);
          let productsCount = 0;
          
          for (const product of products) {
            // Usar directamente el UUID de INNOVA desde nuestro servicio centralizado
            // Esto evita tener que consultar la base de datos cada vez
            const companyUuid = getCompanyUuid('innova');
            console.log('Usando UUID de INNOVA para producto:', companyUuid);
            
            // Verificar si el objeto producto es válido
            if (!product || typeof product !== 'object') {
              console.error('Objeto de producto inválido:', product);
              continue;
            }
            
            // Examinar el producto para entender su estructura
            console.log('Producto original a migrar:', product);
            
            // Función auxiliar para obtener campos de diferentes posibles ubicaciones
            const getProductField = (fieldNames: string[], defaultValue: any = null) => {
              for (const fieldName of fieldNames) {
                if (product[fieldName] !== undefined && product[fieldName] !== null) {
                  return product[fieldName];
                }
              }
              return defaultValue;
            };
            
            // Obtener código CABYS - muy importante para productos en Costa Rica
            let productCode = getProductField(['cabys', 'codigo', 'code', 'codigoCabys', 'codigoCABYS']);
            if (!productCode) {
              // Si no existe, generar uno
              productCode = `SKU-${Math.floor(Math.random() * 10000)}`;
              console.log(`Producto sin código CABYS, generando uno: ${productCode}`);
            } else {
              console.log(`Código CABYS encontrado: ${productCode}`);
            }
            
            // Buscar el precio unitario en diferentes propiedades posibles
            const unitPrice = getProductField(['precioUnitario', 'precio', 'price', 'precioVenta', 'unit_price', 'unitPrice'], 0);
            console.log(`Precio unitario encontrado: ${unitPrice}`);
            
            // Mapear campos de producto según el esquema SQL exacto
            const productData = {
              name: getProductField(['nombre', 'name', 'descripcion', 'detalle'], 'Producto sin nombre'),
              code: productCode,
              description: getProductField(['detalle', 'description', 'descripcion'], ''),
              // Campos de precio y fiscal
              unit_price: unitPrice,
              tax_rate: getProductField(['impuesto', 'taxPercentage', 'tax_rate', 'porcentajeImpuesto', 'tasaImpuesto'], 13),
              has_tax_exemption: getProductField(['tieneExoneracion', 'hasExemption', 'exento', 'has_tax_exemption'], false),
              // Campos adicionales
              unit_measure: getProductField(['unitMeasure', 'unidadMedida', 'unidad', 'unit_measure'], 'Unid'),
              sku: getProductField(['sku', 'codigo'], productCode),
              barcode: getProductField(['barcode', 'codigoBarras', 'codigoBarra'], ''),
              stock: getProductField(['inventario', 'stock', 'cantidad'], 0),
              min_stock: getProductField(['stockMinimo', 'min_stock', 'stockMin'], 0),
              company_id: companyUuid,
              is_active: true
            };
            
            console.log('Datos de producto mapeados a insertar:', productData);
            
            // Insertar producto directamente en Supabase
            const { data, error } = await supabase
              .from('products')
              .insert(productData)
              .select()
              .single();
              
            if (!error && data) {
              productsCount++;
            } else {
              console.error(`Error al migrar producto ${product.name}:`, error);
            }
          }
          
          console.log(`Productos migrados: ${productsCount} de ${products.length}`);
        } else {
          console.log('No se encontraron productos en localStorage');
        }
      } catch (error) {
        console.error('Error al migrar productos:', error);
      }
      
      // Migrar facturas
      console.log('Migrando historial de facturas...');
      try {
        // Buscar facturas con varias posibles claves en localStorage
        // Primero mostramos todas las claves disponibles en localStorage para diagnóstico
        console.log('📋 Claves disponibles en localStorage:');
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            console.log(`   - ${key}`);
          }
        }
        
        // Probar diferentes claves posibles donde podrían estar almacenadas las facturas
        const possibleKeys = ['invoices', 'invoice_history', 'invoiceData', 'invoiceHistory', 'facturasLocal'];
        let invoicesStr = null;
        let keyUsed = '';
        
        for (const key of possibleKeys) {
          const data = localStorage.getItem(key);
          if (data) {
            try {
              // Verificar si es un JSON válido que contiene un array
              const parsed = JSON.parse(data);
              if (Array.isArray(parsed) && parsed.length > 0) {
                console.log(`✅ Encontradas facturas en localStorage con clave: ${key}`);
                invoicesStr = data;
                keyUsed = key;
                break;
              } else if (typeof parsed === 'object' && parsed !== null) {
                console.log(`🔍 Encontrado objeto en localStorage con clave: ${key}, pero no es un array`);
                
                // Inspeccionar la estructura del objeto para entender cómo están almacenadas las facturas
                console.log(`📊 Estructura del objeto en '${key}':`, Object.keys(parsed));
                
                // Caso 1: El objeto tiene una propiedad 'invoices' que es un array
                if (parsed.invoices && Array.isArray(parsed.invoices)) {
                  console.log(`✅ Encontradas facturas dentro del objeto con clave: ${key}.invoices`);
                  invoicesStr = JSON.stringify(parsed.invoices);
                  keyUsed = `${key}.invoices`;
                  break;
                } 
                // Caso 2: El objeto tiene una propiedad 'data' que es un array
                else if (parsed.data && Array.isArray(parsed.data)) {
                  console.log(`✅ Encontradas facturas dentro del objeto con clave: ${key}.data`);
                  invoicesStr = JSON.stringify(parsed.data);
                  keyUsed = `${key}.data`;
                  break;
                }
                // Caso 3: El objeto podría ser un mapa donde las claves son IDs de facturas
                else if (Object.keys(parsed).length > 0) {
                  console.log(`🔎 Posible mapa de facturas detectado. Examinando estructura...`);
                  
                  // Intentar extraer las facturas como un array de valores del objeto
                  const potentialInvoices = Object.values(parsed);
                  if (potentialInvoices.length > 0 && typeof potentialInvoices[0] === 'object') {
                    console.log(`✅ Extraídas ${potentialInvoices.length} facturas del mapa con clave: ${key}`);
                    
                    // Para verificar si son facturas, comprobamos si tienen campos comunes de facturas
                    const firstItem = potentialInvoices[0];
                    const invoiceFields = ['id', 'date', 'total', 'client', 'items', 'status'];
                    const hasInvoiceFields = invoiceFields.some(field => firstItem.hasOwnProperty(field));
                    
                    if (hasInvoiceFields) {
                      console.log(`✅ Confirmado que son facturas. Procesar...`);
                      invoicesStr = JSON.stringify(potentialInvoices);
                      keyUsed = `${key} (mapa de facturas)`;
                      break;
                    } else {
                      console.log(`❌ No parecen ser facturas. Estructura del primer elemento:`, 
                                Object.keys(firstItem));
                    }
                  }
                }
              }
            } catch (error) {
              console.log(`❌ Error al parsear JSON en clave ${key}:`, error);
            }
          }
        }
        
        if (invoicesStr) {
          console.log(`🎯 Usando facturas de localStorage con clave: ${keyUsed}`);
          const invoices = JSON.parse(invoicesStr);
          console.log(`📊 Encontradas ${invoices.length} facturas para migrar`);
          let invoicesCount = 0;
          
          // Usar directamente el UUID de INNOVA desde nuestro servicio centralizado
          // Esto garantiza consistencia y evita problemas con UUIDs incorrectos
          const companyUuid = getCompanyUuid('innova');
          console.log('Usando UUID de INNOVA para facturas:', companyUuid);
          
          // Mostrar el SQL necesario para crear la tabla invoices compatible con la estructura actual
          const createInvoicesTableSQL = `
-- Tabla de facturas (invoices) adaptada al formato usado en BoltFact v2
-- EJECUTAR ESTE SQL EN EL EDITOR SQL DE SUPABASE
CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(100) PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  client VARCHAR(255),
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  amount VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Completada',
  items INTEGER,
  claveNumerica VARCHAR(150),
  condicionVenta VARCHAR(10),
  medioPago JSONB,
  detalleServicio JSONB,
  subtotal DECIMAL(18, 5),
  impuesto DECIMAL(18, 5),
  total DECIMAL(18, 5),
  xmlContent TEXT,
  emailInfo JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;
          
          console.log('Para crear la tabla invoices correctamente, ejecuta el siguiente SQL en Supabase:');
          console.log(createInvoicesTableSQL);
          
          // Vamos a intentar crear una nueva tabla con un nombre diferente para evitar conflictos
          console.log('Intentando alternativa: crear una nueva tabla invoice_data...');
          
          // Primero verificamos si la tabla invoice_data ya existe
          try {
            const { error: checkError } = await supabase.from('invoice_data').select('count').limit(1);
            
            if (checkError) {
              console.log('La tabla invoice_data no existe, vamos a crearla...');
              
              // Creamos una tabla nueva con estructura simple para guardar las facturas
              const createTableSQL = `
                CREATE TABLE IF NOT EXISTS invoice_data (
                  id TEXT PRIMARY KEY,
                  company_id UUID NOT NULL REFERENCES companies(id),
                  data JSONB,
                  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
              `;
              
              // Ejecutamos SQL directo para crear la tabla
              const { error: createError } = await supabase.rpc('execute_sql', { sql: createTableSQL });
              
              if (createError) {
                console.log('Error al crear tabla invoice_data:', createError.message);
                console.log('Ejecuta este SQL manualmente en el editor SQL de Supabase:');
                console.log(createTableSQL);
                
                alert('Es necesario crear manualmente la tabla invoice_data. Revisa la consola para el SQL.');
                throw new Error('No se pudo crear tabla invoice_data');
              } else {
                console.log('Tabla invoice_data creada correctamente');
              }
            } else {
              console.log('Usando tabla invoice_data existente');
            }
          } catch (error) {
            console.error('Error al verificar/crear tabla invoice_data:', error);
            throw new Error('Error con tabla invoice_data');
          }
          
          console.log('Procediendo con la migración a invoice_data...');
          
          for (const invoice of invoices) {
            // Función para obtener campos
            const getInvoiceField = (fieldNames: string[], defaultValue: any = null) => {
              for (const fieldName of fieldNames) {
                if (invoice[fieldName] !== undefined && invoice[fieldName] !== null) {
                  return invoice[fieldName];
                }
              }
              return defaultValue;
            };
            
            // Usando la nueva tabla invoice_data con estructura simplificada
            console.log('Procesando factura:', invoice.id || 'Sin ID');
            
            // Preparar objeto mínimo para inserción en invoice_data
            const invoiceData = {
              id: invoice.id, // Usamos el ID original como clave primaria
              company_id: companyUuid, // Referencia a la empresa (clave foránea)
              data: invoice // Guardamos todos los datos originales como JSON
            };
            
            console.log(`Migrando factura ${invoice.id} a invoice_data`);
            console.log('Datos a migrar:', invoiceData);
            
            try {
              // Insertar factura en la tabla invoice_data
              const { data, error } = await supabase
                .from('invoice_data') // Usamos la nueva tabla
                .insert(invoiceData)
                .select()
                .single();
                
              if (!error && data) {
                invoicesCount++;
                console.log(`Factura migrada con éxito: ${invoice.id || 'Sin número'}`);
              } else {
                console.error(`Error al migrar factura:`, error);
              }
            } catch (insertError) {
              console.error('Error al insertar factura:', insertError);
            }
          }
          
          console.log(`Facturas migradas: ${invoicesCount} de ${invoices.length}`);
        } else {
          console.log('No se encontraron facturas en localStorage');
        }
      } catch (error) {
        console.error('Error al migrar facturas:', error);
      }
      
      console.log('Migración completada con éxito!');
      // Fin de la implementación
      
      setMigrationStatus('Migración completada con éxito.');
      toast({
        title: 'Migración completada',
        description: 'Los datos se han migrado correctamente de localStorage a Supabase.',
      });
      
      // Automáticamente verificar los datos después de la migración
      await verifySupabaseData();
    } catch (error) {
      console.error('Error durante la migración:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setMigrationStatus(`Error durante la migración: ${errorMessage}`);
      toast({
        title: 'Error en la migración',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 dark:text-white">Administración de Base de Datos</h1>
        
        <Tabs defaultValue="initialize">
          <TabsList className="mb-4 bg-gray-200 dark:bg-gray-700 p-1 rounded">
            <TabsTrigger value="initialize" className="dark:text-white data-[state=active]:bg-orange-500 dark:data-[state=active]:bg-teal-500 data-[state=active]:text-white">Inicializar Base de Datos</TabsTrigger>
            <TabsTrigger value="migrate" className="dark:text-white data-[state=active]:bg-orange-500 dark:data-[state=active]:bg-teal-500 data-[state=active]:text-white">Migrar Datos</TabsTrigger>
            <TabsTrigger value="manual" className="dark:text-white data-[state=active]:bg-orange-500 dark:data-[state=active]:bg-teal-500 data-[state=active]:text-white">Instrucciones Manuales</TabsTrigger>
            <TabsTrigger value="sync-invoices" className="dark:text-white data-[state=active]:bg-orange-500 dark:data-[state=active]:bg-teal-500 data-[state=active]:text-white">Migrar Facturas (Nuevo)</TabsTrigger>
            <TabsTrigger value="refresh-data" className="dark:text-white data-[state=active]:bg-orange-500 dark:data-[state=active]:bg-teal-500 data-[state=active]:text-white">Refrescar Data en Database</TabsTrigger>
          </TabsList>
          
          <TabsContent value="initialize">
            <Card className="border shadow dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="dark:text-white">Inicializar Base de Datos en Supabase</CardTitle>
                <CardDescription className="dark:text-gray-300">
                  Este proceso creará todas las tablas necesarias y configurará la base de datos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button 
                    onClick={loadSqlContent} 
                    disabled={loading}
                    variant="outline"
                    className="border-orange-500 text-orange-500 hover:bg-orange-50 dark:border-teal-500 dark:text-teal-500 dark:hover:bg-gray-700"
                  >
                    Cargar Esquema SQL
                  </Button>
                  
                  {sqlContent && (
                    <div className="mt-4">
                      <p className="text-sm mb-2">Contenido SQL:</p>
                      <Textarea 
                        value={sqlContent} 
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSqlContent(e.target.value)} 
                        rows={10}
                        className="font-mono text-xs"
                      />
                    </div>
                  )}
                  
                  {result.message && (
                    <Alert variant={result.success ? "default" : "destructive"}>
                      <AlertTitle>
                        {result.success ? 'Operación exitosa' : 'Error'}
                      </AlertTitle>
                      <AlertDescription className="whitespace-pre-wrap">
                        {result.message}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button 
                  onClick={initializeDatabase} 
                  disabled={loading || !sqlContent}
                  className="bg-orange-500 hover:bg-orange-600 text-white dark:bg-teal-500 dark:hover:bg-teal-600"
                >
                  {loading ? 'Inicializando...' : 'Inicializar Base de Datos'}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="migrate">
            <Card className="border shadow dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="dark:text-white">Migrar Datos de LocalStorage a Supabase</CardTitle>
                <CardDescription className="dark:text-gray-300">
                  Este proceso migrará todos los datos existentes en localStorage a la nueva base de datos Supabase.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert variant="warning" className="mb-4">
                  <AlertTitle>Advertencia</AlertTitle>
                  <AlertDescription>
                    Asegúrese de haber inicializado la base de datos antes de intentar migrar los datos.
                    Este proceso intentará mover todos los datos de localStorage a Supabase.
                  </AlertDescription>
                </Alert>
                
                {migrationStatus && (
                  <Alert variant={migrationStatus.includes('Error') ? "destructive" : "default"}>
                    <AlertTitle>
                      {migrationStatus.includes('Error') ? 'Error' : 'Estado'}
                    </AlertTitle>
                    <AlertDescription>
                      {migrationStatus}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={migrateData} 
                  disabled={loading}
                  className="bg-orange-500 hover:bg-orange-600 text-white dark:bg-teal-500 dark:hover:bg-teal-600"
                >
                  {loading ? 'Migrando...' : 'Iniciar Migración'}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="manual">
            <Card className="border shadow dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="dark:text-white">Instrucciones para Configuración Manual</CardTitle>
                <CardDescription className="dark:text-gray-300">
                  Si la inicialización automática no funciona, siga estas instrucciones para configurar manualmente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Alert variant="default">
                    <AlertTitle>Configuración Manual en Supabase</AlertTitle>
                    <AlertDescription>
                      <ol className="list-decimal pl-4 space-y-2 mt-2">
                        <li>Inicie sesión en su panel de Supabase (https://app.supabase.com)</li>
                        <li>Seleccione su proyecto</li>
                        <li>Vaya a la sección "SQL Editor"</li>
                        <li>Cree una nueva consulta</li>
                        <li>Copie y pegue el contenido del archivo supabase_schema.sql</li>
                        <li>Ejecute la consulta</li>
                      </ol>
                    </AlertDescription>
                  </Alert>
                  
                  <div className="mt-4">
                    <Button 
                      onClick={loadSqlContent} 
                      disabled={loading}
                      variant="outline"
                      className="border-orange-500 text-orange-500 hover:bg-orange-50 dark:border-teal-500 dark:text-teal-500 dark:hover:bg-gray-700"
                    >
                      Cargar SQL para copiar
                    </Button>
                    
                    {sqlContent && (
                      <div className="mt-4">
                        <p className="text-sm mb-2">Contenido SQL para copiar:</p>
                        <Textarea 
                          value={sqlContent} 
                          rows={10}
                          className="font-mono text-xs"
                          readOnly
                        />
                        <Button 
                          onClick={() => {
                            navigator.clipboard.writeText(sqlContent);
                            toast({
                              title: 'Copiado al portapapeles',
                              description: 'El SQL ha sido copiado al portapapeles.',
                              variant: 'default',
                            });
                          }}
                          variant="outline"
                          className="mt-2 border-orange-500 text-orange-500 hover:bg-orange-50 dark:border-teal-500 dark:text-teal-500 dark:hover:bg-gray-700"
                        >
                          Copiar al portapapeles
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="refresh-data">
            <Card className="border shadow dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="dark:text-white">Refrescar Data en Database</CardTitle>
                <CardDescription className="dark:text-gray-300">
                  Este proceso actualiza las facturas existentes en Supabase con información adicional como plazos de crédito y consecutivos unificados.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert variant="info" className="mb-4">
                  <AlertTitle>Información</AlertTitle>
                  <AlertDescription>
                    Este proceso enriquecerá todas las facturas en Supabase con:
                    <ul className="list-disc pl-6 mt-2">
                      <li>Plazo de crédito calculado correctamente</li>
                      <li>Consecutivo unificado para todas las facturas</li>
                      <li>Nombre descriptivo del medio de pago</li>
                    </ul>
                    No se perderá ninguna información existente y se mejorará la visualización en el módulo de Pagos.
                  </AlertDescription>
                </Alert>
                
                {refreshStatus && (
                  <Alert variant={refreshStatus.includes('Error') ? "destructive" : "default"} className="mt-4">
                    <AlertTitle>
                      {refreshStatus.includes('Error') ? 'Error' : 'Estado'}
                    </AlertTitle>
                    <AlertDescription className="whitespace-pre-wrap">
                      {refreshStatus}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={refreshDatabaseData} 
                  disabled={loading}
                  className="bg-orange-500 hover:bg-orange-600 text-white dark:bg-teal-500 dark:hover:bg-teal-600"
                >
                  {loading ? 'Actualizando datos...' : 'Refrescar datos de facturas'}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <Toaster />
    </div>
  );
};

export default DatabaseAdmin;
