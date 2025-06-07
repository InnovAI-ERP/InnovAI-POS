// Migración de datos de localStorage a Supabase
// Este script toma los datos existentes en localStorage y los migra a Supabase
// Ejecutar en el navegador después de inicializar el esquema de la base de datos

async function migrateLocalStorageToSupabase() {
  console.log('Iniciando migración de datos de localStorage a Supabase...');
  
  // IMPORTANTE: Eliminar forzosamente el modo local
  console.log('Eliminando forzosamente el modo local...');
  localStorage.removeItem('FORCE_LOCAL_MODE');
  
  // Diagnóstico: Mostrar todos los elementos de localStorage
  console.log('Datos actuales en localStorage:');
  for (const key of Object.keys(localStorage)) {
    console.log(`${key}: ${localStorage.getItem(key)?.length || 0} bytes`);
  }

  // Función para obtener datos de localStorage
  function getLocalStorageData(key, defaultValue = []) {
    try {
      const data = localStorage.getItem(key);
      const parsedData = data ? JSON.parse(data) : defaultValue;
      console.log(`Recuperados ${parsedData.length || 0} elementos de ${key}`);
      return parsedData;
    } catch (error) {
      console.error(`Error al obtener datos de localStorage (${key}):`, error);
      return defaultValue;
    }
  }
  
  // Importar servicios de Supabase
  const { supabaseCompanyService } = await import('../services/supabaseCompanyService');
  const { supabaseAuthService } = await import('../services/supabaseAuthService');
  const { supabaseClientService } = await import('../services/supabaseClientService');
  const { supabaseProductService } = await import('../services/supabaseProductService');
  
  try {
    // Verificar conexión con Supabase
    const { supabase } = await import('../lib/supabase');
    console.log('Probando conexión a Supabase...');
    
    // Verificar simplemente que podemos acceder a las tablas
    console.log('Verificando acceso a las tablas de Supabase...');
    try {
      // Intentamos una operación básica primero
      const { data: tablesData } = await supabase.from('companies').select('id').limit(1);
      console.log('Acceso a tablas verificado:', tablesData);
    } catch (e) {
      console.log('Error al verificar acceso a tablas:', e);
      // Continuamos a pesar del error
    }
    
    const { data: testData, error: testError } = await supabase.from('companies').select('count');
    
    if (testError) {
      console.error('Error de conexión con Supabase:', testError);
      throw new Error('No se pudo conectar con Supabase. Verifica las credenciales y la conexión a internet.');
    }
    
    console.log('Conexión a Supabase exitosa:', testData);
    
    // 1. Migrar empresas (companies)
    console.log('Migrando empresas...');
    let localCompanies = getLocalStorageData('companies', []);
    
    // Si no hay empresas en 'companies', intentar obtenerlas de user_settings
    if (localCompanies.length === 0) {
      console.log('No se encontraron empresas en localStorage.companies, buscando en user_settings...');
      const userSettings = getLocalStorageData('user_settings', {});
      
      if (userSettings && Object.keys(userSettings).length > 0) {
        console.log('Encontrados datos de empresa en user_settings');
        // Crear una empresa a partir de los datos de user_settings
        localCompanies = [{
          id: 'default_company',
          name: userSettings.company_name || 'Empresa Default',
          legalName: userSettings.company_name,
          identificationType: userSettings.identification_type || 'Cédula jurídica',
          identificationNumber: userSettings.identification_number,
          email: userSettings.email || 'info@empresa.com',
          phone: userSettings.phone || '',
          address: userSettings.address || '',
          province: userSettings.province || '',
          canton: userSettings.canton || '',
          district: userSettings.district || '',
          isActive: true
        }];
      }
      
      // Si todavía no hay empresas, intentar usar selected_company
      if (localCompanies.length === 0) {
        const selectedCompany = localStorage.getItem('selected_company');
        if (selectedCompany) {
          console.log('Usando selected_company como referencia:', selectedCompany);
          localCompanies = [{
            id: selectedCompany,
            name: selectedCompany,
            legalName: selectedCompany,
            identificationType: 'Cédula jurídica',
            identificationNumber: '000000000',
            email: 'info@empresa.com',
            isActive: true
          }];
        }
      }
    }
    
    console.log(`Empresas encontradas para migrar: ${localCompanies.length}`);
    if (localCompanies.length === 0) {
      console.warn('¡ADVERTENCIA! No se encontraron empresas para migrar. Creando una empresa por defecto.');
      localCompanies = [{
        id: 'default_company',
        name: 'Empresa Default',
        legalName: 'Empresa Default, S.A.',
        identificationType: 'Cédula jurídica',
        identificationNumber: '000000000',
        email: 'info@empresa.com',
        isActive: true
      }];
    }
    
    for (const company of localCompanies) {
      // Imprimir los datos que intentamos enviar para depuración
      console.log('Intentando crear empresa con los siguientes datos:', {
        name: company.name,
        legalName: company.legalName,
        identificationType: company.identificationType,
        identificationNumber: company.identificationNumber
      });
      
      // Mapear los datos al formato que espera Supabase
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
        is_active: true
      };
      
      console.log('Datos formateados para Supabase:', companyData);
      
      // Intentar crear la empresa en Supabase
      const { success, data, error } = await supabaseCompanyService.createCompany(companyData);
      
      if (success) {
        console.log(`Empresa migrada: ${company.name} (ID: ${data.id})`);
        
        // Verificar inmediatamente que la empresa se guardó correctamente
        const { supabase } = await import('../lib/supabase');
        const checkCompany = await supabase
          .from('companies')
          .select('*')
          .eq('id', data.id)
          .single();
        
        if (checkCompany.error) {
          console.error(`Error al verificar empresa migrada ${company.name}:`, checkCompany.error);
        } else {
          console.log(`Verificación exitosa de empresa migrada: ${checkCompany.data.name}`);
        }
        
        // 2. Migrar usuarios para esta empresa
        console.log(`Migrando usuarios para empresa: ${company.name}...`);
        const localUsers = getLocalStorageData('users', [])
          .filter(user => user.companyId === company.id);
        
        for (const user of localUsers) {
          // Buscar la empresa en Supabase por número de identificación
          const { data: companyData } = await supabaseCompanyService.getCompanyByIdentificationNumber(
            company.identificationNumber
          );
          
          if (companyData) {
            const { success: userSuccess, error: userError } = await supabaseAuthService.createUser({
              username: user.username,
              password: user.password, // Nota: este campo debería ser hasheado
              email: user.email || `${user.username}@${company.name.toLowerCase()}.com`,
              full_name: user.fullName || user.username,
              role: user.role || 'user',
              company_id: companyData.id,
              is_active: true
            });
            
            if (userSuccess) {
              console.log(`Usuario migrado: ${user.username}`);
            } else {
              console.error(`Error al migrar usuario ${user.username}:`, userError);
            }
          } else {
            console.error(`No se pudo encontrar la empresa para el usuario ${user.username}`);
          }
        }
        
        // 3. Migrar clientes para esta empresa
        console.log(`Migrando clientes para empresa: ${company.name}...`);
        const localClients = getLocalStorageData('clients', [])
          .filter(client => client.companyId === company.id);
        
        const { data: companyData } = await supabaseCompanyService.getCompanyByIdentificationNumber(
          company.identificationNumber
        );
        
        if (companyData) {
          for (const client of localClients) {
            const { success: clientSuccess, error: clientError } = await supabaseClientService.createClient({
              name: client.name,
              identification_type: client.identificationType || 'Física',
              identification_number: client.identificationNumber,
              email: client.email || '',
              phone: client.phone || '',
              address: client.address || '',
              province: client.province || '',
              canton: client.canton || '',
              district: client.district || '',
              postal_code: client.postalCode || '',
              tax_regime: client.taxRegime || '',
              company_id: companyData.id,
              is_active: true
            });
            
            if (clientSuccess) {
              console.log(`Cliente migrado: ${client.name}`);
              
              // Verificar inmediatamente que el cliente se guardó correctamente
              const { supabase } = await import('../lib/supabase');
              const checkClient = await supabase
                .from('clients')
                .select('*')
                .eq('identification_number', client.identificationNumber)
                .eq('user_id', companyData.id)
                .single();
              
              if (checkClient.error) {
                console.error(`Error al verificar cliente migrado ${client.name}:`, checkClient.error);
              } else {
                console.log(`Verificación exitosa de cliente migrado: ${checkClient.data.name}`);
              }
            } else {
              console.error(`Error al migrar cliente ${client.name}:`, clientError);
            }
          }
        }
        
        // 4. Migrar productos para esta empresa
        console.log(`Migrando productos para empresa: ${company.name}...`);
        const localProducts = getLocalStorageData('products', [])
          .filter(product => product.companyId === company.id);
        
        if (companyData) {
          for (const product of localProducts) {
            const { success: productSuccess, error: productError } = await supabaseProductService.createProduct({
              code: product.code,
              name: product.name,
              description: product.description || '',
              unit_price: parseFloat(product.unitPrice),
              tax_rate: parseFloat(product.taxRate || 13),
              has_tax_exemption: product.hasTaxExemption || false,
              unit_measure: product.unitMeasure || 'Unid',
              sku: product.sku || '',
              barcode: product.barcode || '',
              stock: parseFloat(product.stock || 0),
              min_stock: parseFloat(product.minStock || 0),
              company_id: companyData.id,
              is_active: true
            });
            
            if (productSuccess) {
              console.log(`Producto migrado: ${product.name}`);
              
              // Verificar inmediatamente que el producto se guardó correctamente
              const { supabase } = await import('../lib/supabase');
              const checkProduct = await supabase
                .from('products')
                .select('*')
                .eq('code', product.code)
                .eq('user_id', companyData.id)
                .single();
              
              if (checkProduct.error) {
                console.error(`Error al verificar producto migrado ${product.name}:`, checkProduct.error);
              } else {
                console.log(`Verificación exitosa de producto migrado: ${checkProduct.data.name}`);
              }
            } else {
              console.error(`Error al migrar producto ${product.name}:`, productError);
            }
          }
        }
      } else {
        console.error(`Error al migrar empresa ${company.name}:`, error);
      }
    }
    
    console.log('Migración completada con éxito.');
    return { success: true, message: 'Datos migrados correctamente a Supabase' };
  } catch (error) {
    console.error('Error durante la migración:', error);
    return { success: false, message: 'Error durante la migración', error };
  }
}

// Exponer la función para ejecutarla desde la consola del navegador
window.migrateLocalStorageToSupabase = migrateLocalStorageToSupabase;

// Exportar la función para importarla como módulo ES
export { migrateLocalStorageToSupabase };
