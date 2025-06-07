import { supabase } from '../lib/supabase';
import { supabaseCompanyService } from './supabaseCompanyService';
import { envService } from './envService';

// Interfaz para representar un usuario
export interface User {
  id: string;
  username: string;
  email?: string;
  company_id: string;
  role?: string;
  is_active?: boolean;
  last_login?: string;
  created_at?: string;
  updated_at?: string;
}

// Interfaz para el resultado de autenticación
export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

/**
 * Servicio para gestionar la autenticación de usuarios con Supabase
 */
class SupabaseAuthService {
  private currentUser: User | null = null;
  
  constructor() {
    // Intentar cargar usuario desde localStorage (para compatibilidad durante la migración)
    this.loadUserFromLocalStorage();
  }
  
  /**
   * Carga el usuario desde localStorage (compatibilidad con el sistema antiguo)
   */
  private loadUserFromLocalStorage(): void {
    try {
      // Primero intentamos cargar el usuario
      const savedUser = localStorage.getItem('local_user');
      // Luego verificamos si hay una empresa seleccionada
      const selectedCompany = localStorage.getItem('selected_company');
      
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        
        // Si el usuario no tiene company_id pero hay una empresa seleccionada en localStorage,
        // asignar esa empresa al usuario
        if (!parsedUser.company_id && selectedCompany) {
          console.log(`Asignando empresa ${selectedCompany} al usuario desde localStorage`);
          parsedUser.company_id = selectedCompany;
        } else if (!parsedUser.company_id) {
          // Si no hay empresa seleccionada, por defecto usar 'innova'
          console.log('No hay empresa seleccionada, asignando innova por defecto');
          parsedUser.company_id = 'innova';
          localStorage.setItem('selected_company', 'innova');
        }
        
        // Guardar el usuario actualizado en localStorage y en memoria
        this.currentUser = parsedUser;
        localStorage.setItem('local_user', JSON.stringify(parsedUser));
        console.log('Usuario cargado desde localStorage:', parsedUser.id, 
                    'con empresa:', parsedUser.company_id);
      }
    } catch (error) {
      console.error('Error al cargar usuario desde localStorage:', error);
      this.currentUser = null;
    }
  }
  
  /**
   * Obtiene el usuario actualmente autenticado
   */
  getCurrentUser(): User | null {
    // Si no hay usuario, retornar null
    if (!this.currentUser) {
      return null;
    }
    
    // Verificar que el usuario tenga una empresa asignada
    if (!this.currentUser.company_id) {
      // Intentar obtener la empresa desde localStorage
      const selectedCompany = localStorage.getItem('selected_company');
      
      if (selectedCompany) {
        // Asignar la empresa al usuario
        this.currentUser.company_id = selectedCompany;
      } else {
        // Si no hay empresa seleccionada, asignar INNOVA por defecto
        this.currentUser.company_id = 'innova';
        localStorage.setItem('selected_company', 'innova');
      }
      
      // Guardar el usuario actualizado
      localStorage.setItem('local_user', JSON.stringify(this.currentUser));
      console.log(`Usuario actualizado con empresa: ${this.currentUser.company_id}`);
    }
    
    return this.currentUser;
  }
  
  /**
   * Autentica a un usuario por su nombre de usuario y contraseña
   */
  async login(username: string, password: string): Promise<AuthResult> {
    try {
      console.log(`Intentando autenticar usuario: ${username}`);
      
      // Buscar el usuario en Supabase
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('is_active', true)
        .limit(1);
      
      if (userError) {
        console.error('Error al buscar usuario:', userError);
        throw new Error('Error al buscar usuario');
      }
      
      // Si encontramos el usuario en Supabase, verificar la contraseña
      if (users && users.length > 0) {
        const user = users[0];
        
        // En un entorno real, deberíamos usar bcrypt o similar para verificar la contraseña
        // pero por simplicidad, comparamos directamente (esto debe mejorarse en producción)
        if (user.password_hash === password) {
          console.log('Usuario autenticado correctamente en Supabase');
          
          // Cargar la empresa asociada al usuario
          await supabaseCompanyService.selectCompany(user.company_id);
          
          // Actualizar la fecha de último inicio de sesión
          await supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', user.id);
          
          // Guardar usuario en memoria y localStorage
          this.currentUser = user;
          localStorage.setItem('local_user', JSON.stringify(user));
          localStorage.setItem('selected_company', user.company_id);
          
          return {
            success: true,
            user
          };
        } else {
          console.log('Contraseña incorrecta en Supabase');
          return {
            success: false,
            error: 'Credenciales inválidas'
          };
        }
      }
      
      // Si no encontramos el usuario en Supabase, intentamos con el sistema antiguo
      console.log('Usuario no encontrado en Supabase, intentando con el sistema antiguo');
      return this.legacyLogin(username, password);
    } catch (error) {
      console.error('Error durante el proceso de login:', error);
      
      // Si hay un error, intentar con el sistema antiguo
      return this.legacyLogin(username, password);
    }
  }
  
  /**
   * Sistema antiguo de autenticación (para compatibilidad durante la migración)
   */
  private async legacyLogin(username: string, password: string): Promise<AuthResult> {
    try {
      console.log('Usando sistema de autenticación anterior');
      
      // Obtener todas las empresas disponibles
      const companies = await supabaseCompanyService.getCompanies();
      
      // Buscar una empresa que corresponda a las credenciales proporcionadas
      let foundCompany = null;
      
      // Probar todas las empresas disponibles
      for (const company of companies) {
        console.log(`Verificando credenciales para empresa: ${company.name}`);
        
        // Cargar el archivo .env de la empresa
        await supabaseCompanyService.loadCompanyEnvironment(company.id);
        
        // Obtener las credenciales almacenadas en el archivo .env
        const envConfig = envService.getAll();
        
        // Verificar si la empresa tiene credenciales de administrador configuradas
        if (envConfig.ADMIN_USERNAME && envConfig.ADMIN_PASSWORD) {
          console.log(`Comparando: ${username} === ${envConfig.ADMIN_USERNAME}`);
          
          // Verificar si las credenciales coinciden exactamente con las almacenadas
          if (username === envConfig.ADMIN_USERNAME && password === envConfig.ADMIN_PASSWORD) {
            console.log(`¡Credenciales coinciden con empresa: ${company.name}!`);
            foundCompany = company;
            break;
          }
        } else {
          // Si no hay credenciales específicas pero el username coincide con el ID de la empresa
          if (username === company.identification_number) {
            console.log(`Username coincide con ID de empresa: ${company.name}, verificando contraseña`);
            
            // Usar contraseñas específicas para cada empresa como respaldo
            if (company.id === 'innova' && password === 'AutomationBT2023') {
              foundCompany = company;
              break;
            } else if (company.id === 'empresa2' && password === 'Kevin2025u') {
              foundCompany = company;
              break;
            }
          }
        }
      }
      
      // Si encontramos la empresa, crear un usuario
      if (foundCompany) {
        console.log(`Empresa identificada: ${foundCompany.name}`);
        
        // Cargar configuración de la empresa
        await supabaseCompanyService.selectCompany(foundCompany.id);
        
        // Crear un objeto de usuario (esto se debería guardar en Supabase en una implementación completa)
        const userObj: User = {
          id: foundCompany.id,
          username: username,
          email: envService.get('EMAIL', ''),
          company_id: foundCompany.id,
          role: 'admin',
          is_active: true,
          last_login: new Date().toISOString()
        };
        
        // Guardar usuario en memoria y localStorage
        this.currentUser = userObj;
        localStorage.setItem('local_user', JSON.stringify(userObj));
        localStorage.setItem('selected_company', foundCompany.id);
        
        // Como estamos usando el sistema antiguo, deberíamos migrar este usuario a Supabase
        this.migrateUserToSupabase(userObj, password)
          .then(() => console.log('Usuario migrado a Supabase'))
          .catch(err => console.error('Error al migrar usuario a Supabase:', err));
        
        return {
          success: true,
          user: userObj
        };
      } else {
        return {
          success: false,
          error: 'Credenciales inválidas. Por favor, verifique su nombre de usuario y contraseña.'
        };
      }
    } catch (error) {
      console.error('Error en el proceso de login antiguo:', error);
      return {
        success: false,
        error: 'Ocurrió un error durante el inicio de sesión. Por favor, intente nuevamente.'
      };
    }
  }
  
  /**
   * Migra un usuario del sistema antiguo a Supabase
   */
  private async migrateUserToSupabase(user: User, password: string): Promise<void> {
    try {
      // Verificar si el usuario ya existe en Supabase
      const { data: existingUsers } = await supabase
        .from('users')
        .select('id')
        .eq('username', user.username)
        .limit(1);
      
      if (existingUsers && existingUsers.length > 0) {
        console.log('Usuario ya existe en Supabase, no es necesario migrarlo');
        return;
      }
      
      // Crear el usuario en Supabase
      const { error } = await supabase
        .from('users')
        .insert({
          username: user.username,
          password_hash: password, // En una implementación real, esto debería ser hasheado
          email: user.email,
          company_id: user.company_id,
          role: user.role || 'admin',
          is_active: true,
          last_login: new Date().toISOString()
        });
      
      if (error) {
        console.error('Error al crear usuario en Supabase:', error);
        throw error;
      }
      
      console.log('Usuario migrado exitosamente a Supabase');
    } catch (error) {
      console.error('Error al migrar usuario a Supabase:', error);
      throw error;
    }
  }
  
  /**
   * Cierra la sesión del usuario actual
   */
  async logout(): Promise<boolean> {
    try {
      // Limpiar usuario actual
      this.currentUser = null;
      
      // Limpiar localStorage
      localStorage.removeItem('local_user');
      
      return true;
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      return false;
    }
  }
  
  /**
   * Verifica si hay un usuario autenticado
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }
  
  /**
   * Registra un nuevo usuario (para uso futuro)
   */
  async register(userData: Omit<User, 'id' | 'created_at' | 'updated_at'>, password: string): Promise<AuthResult> {
    try {
      // Verificar si el usuario ya existe
      const { data: existingUsers } = await supabase
        .from('users')
        .select('id')
        .eq('username', userData.username)
        .limit(1);
      
      if (existingUsers && existingUsers.length > 0) {
        return {
          success: false,
          error: 'El nombre de usuario ya está en uso'
        };
      }
      
      // Crear el usuario
      const { data, error } = await supabase
        .from('users')
        .insert({
          username: userData.username,
          password_hash: password, // En una implementación real, esto debería ser hasheado
          email: userData.email,
          company_id: userData.company_id,
          role: userData.role || 'user',
          is_active: userData.is_active !== undefined ? userData.is_active : true
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error al registrar usuario:', error);
        return {
          success: false,
          error: 'Error al registrar usuario'
        };
      }
      
      return {
        success: true,
        user: data
      };
    } catch (error) {
      console.error('Error en el proceso de registro:', error);
      return {
        success: false,
        error: 'Ocurrió un error durante el registro. Por favor, intente nuevamente.'
      };
    }
  }
}

// Exportar la instancia del servicio
export const supabaseAuthService = new SupabaseAuthService();
