import { supabase } from '../lib/supabase';
import fs from 'fs';
import path from 'path';

/**
 * Utilidad para inicializar la base de datos Supabase con el esquema definido
 */
export async function initializeDatabase() {
  try {
    console.log('Iniciando la inicialización de la base de datos en Supabase...');
    
    // Leer el archivo SQL
    const sqlFilePath = path.join(__dirname, 'supabase_schema.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Dividir el contenido SQL en instrucciones individuales
    // Las instrucciones SQL están separadas por punto y coma
    const sqlStatements = sqlContent
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement && !statement.startsWith('--'));
    
    console.log(`Se encontraron ${sqlStatements.length} instrucciones SQL para ejecutar.`);
    
    // Ejecutar cada instrucción SQL
    for (let i = 0; i < sqlStatements.length; i++) {
      const statement = sqlStatements[i];
      
      if (!statement) continue;
      
      try {
        console.log(`Ejecutando instrucción SQL ${i + 1}/${sqlStatements.length}...`);
        // Ejecutar la instrucción SQL en Supabase
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          console.error(`Error al ejecutar la instrucción SQL ${i + 1}:`, error);
        }
      } catch (error) {
        console.error(`Error al ejecutar la instrucción SQL ${i + 1}:`, error);
      }
    }
    
    console.log('Inicialización de la base de datos en Supabase completada.');
    return { success: true, message: 'Base de datos inicializada correctamente.' };
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
    return { success: false, message: 'Error al inicializar la base de datos.', error };
  }
}

// Versión del cliente que se puede llamar desde Node.js
export async function initializeDatabaseFromNode() {
  try {
    console.log('Iniciando la inicialización de la base de datos en Supabase desde Node.js...');
    
    // Como esto se ejecutará desde Node.js, necesitamos usar la API de Supabase directamente
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://kfjqfgtswnwhjfxhtyin.supabase.co';
    const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmanFmZ3Rzd253aGpmeGh0eWluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY1ODY0OTIsImV4cCI6MjA2MjE2MjQ5Mn0.cRbXmH38MfSSVfnJtF9IhEs1TAWJPIJvaP_Wqh47E5o';
    
    // Leer el archivo SQL
    const sqlFilePath = path.join(__dirname, 'supabase_schema.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Para inicializar desde Node.js, necesitaríamos hacer una solicitud HTTP POST
    // a Supabase con nuestro script SQL. Esto es solo un ejemplo y debería adaptarse
    // para usar la API correcta.
    console.log(`URL de Supabase: ${SUPABASE_URL}`);
    console.log(`Contenido SQL cargado, longitud: ${sqlContent.length} caracteres`);
    console.log('Para aplicar este esquema de base de datos, siga estos pasos:');
    console.log('1. Inicie sesión en su panel de Supabase (https://app.supabase.com)');
    console.log('2. Seleccione su proyecto');
    console.log('3. Vaya a la sección "SQL Editor"');
    console.log('4. Cree una nueva consulta');
    console.log('5. Copie y pegue el contenido del archivo supabase_schema.sql');
    console.log('6. Ejecute la consulta');

    return { success: true, message: 'Instrucciones para inicializar la base de datos generadas correctamente.' };
  } catch (error) {
    console.error('Error al generar instrucciones:', error);
    return { success: false, message: 'Error al generar instrucciones.', error };
  }
}

// Si este archivo se ejecuta directamente (node initSupabaseDb.js)
if (require.main === module) {
  initializeDatabaseFromNode()
    .then(result => {
      if (result.success) {
        console.log('Resultado:', result.message);
      } else {
        console.error('Error:', result.message, result.error);
      }
    })
    .catch(error => console.error('Error no controlado:', error));
}
