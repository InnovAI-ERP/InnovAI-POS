import { createClient } from '@supabase/supabase-js';

// URL y clave fijas para asegurar la conexión correcta a Supabase
// Estas son las credenciales actualizadas para la instancia de Supabase
const SUPABASE_URL = 'https://kfjqfgtswnwhjfxhtyin.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmanFmZ3Rzd253aGpmeGh0eWluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY1ODY0OTIsImV4cCI6MjA2MjE2MjQ5Mn0.cRbXmH38MfSSVfnJtF9IhEs1TAWJPIJvaP_Wqh47E5o';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmanFmZ3Rzd253aGpmeGh0eWluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjU4NjQ5MiwiZXhwIjoyMDYyMTYyNDkyfQ.67St3b9Raljk99BG8-ZvuhKJzRQOtUGQQfgB-dadXXY';

// Crear cliente de Supabase con manejo de errores mejorado
let supabaseClient;
try {
  console.log('Inicializando cliente Supabase...');
  
  // Decidir qué clave usar basado en el contexto
  // Para desarrollo local y acceso a datos protegidos, usamos service_role
  // NOTA: En producción, normalmente se usaría la clave anon
  const keyToUse = SUPABASE_SERVICE_KEY; // Usamos service_role para desarrollo y pruebas
  
  supabaseClient = createClient(
    SUPABASE_URL,
    keyToUse,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true
      },
      global: {
        fetch: fetch.bind(globalThis)
      }
      // La propiedad debug no es compatible con SupabaseClientOptions
    }
  );
  
  // Verificar la conexión con una consulta simple
  supabaseClient.from('clients').select('count', { count: 'exact', head: true })
    .then(({ count, error }) => {
      if (error) {
        console.error('Error al verificar la conexión con Supabase:', error);
      } else {
        console.log(`✅ Conexión a Supabase exitosa - ${count} clientes encontrados`);
      }
    });
  
  console.log('Cliente Supabase inicializado correctamente');
} catch (error) {
  console.error('❌ Error crítico al inicializar el cliente Supabase:', error);
  
  // Crear un cliente de respaldo
  supabaseClient = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true
      }
    }
  );
  
  console.warn('Se ha inicializado un cliente Supabase de respaldo con derechos limitados.');
}

// Exportar el cliente
export const supabase = supabaseClient;

export type Tables = {
  clients: {
    Row: {
      id: string;
      name: string;
      identification_type: string;
      identification_number: string;
      email: string | null;
      phone: string | null;
      province: string | null;
      canton: string | null;
      district: string | null;
      address: string | null;
      economic_activity_code: string | null;
      economic_activity_desc: string | null;
      created_at: string;
      user_id: string;
    };
    Insert: Omit<Tables['clients']['Row'], 'id' | 'created_at'>;
    Update: Partial<Tables['clients']['Insert']>;
  };
  user_settings: {
    Row: {
      id: string;
      user_id: string;
      company_name: string;
      identification_type: string;
      identification_number: string;
      commercial_name: string | null;
      province: string | null;
      canton: string | null;
      district: string | null;
      address: string | null;
      phone: string | null;
      email: string | null;
      economic_activity: string | null;
      api_username: string | null;
      api_password: string | null;
      api_key_path: string | null;
      api_pin: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: Omit<Tables['user_settings']['Row'], 'id' | 'created_at' | 'updated_at'>;
    Update: Partial<Tables['user_settings']['Insert']>;
  };
};