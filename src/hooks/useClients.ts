import { useEffect, useState } from 'react';
import { supabaseClientService, Client as SupabaseClient } from '../services/supabaseClientService';
import { supabaseAuthService } from '../services/supabaseAuthService';

// Definir la interfaz para los clientes
interface Client {
  id: string;
  user_id: string;
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
  updated_at?: string;
}

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    try {
      setLoading(true);
      
      // Obtener el usuario actual
      const currentUser = supabaseAuthService.getCurrentUser();
      if (!currentUser) {
        throw new Error('Usuario no autenticado');
      }
      
      // Cargar clientes desde Supabase - usando 1000 como límite para traer todos
      const result = await supabaseClientService.getClients(1, 1000);
      
      if (!result.success) {
        throw new Error(result.error || 'Error al cargar los clientes');
      }
      
      // Mapear los clientes de Supabase a nuestro formato interno
      const mappedClients: Client[] = (result.data || []).map(client => ({
        id: client.id || '',
        user_id: currentUser.id,
        name: client.name,
        identification_type: client.identification_type,
        identification_number: client.identification_number,
        email: client.email || null,
        phone: client.phone || null,
        province: client.province || null,
        canton: client.canton || null,
        district: client.district || null,
        address: client.address || null,
        economic_activity_code: client.economic_activity_code || null,
        economic_activity_desc: client.economic_activity_desc || null,
        created_at: client.created_at || new Date().toISOString()
      }));
      
      setClients(mappedClients);
    } catch (err) {
      console.error('Error cargando clientes:', err);
      setError(err instanceof Error ? err : new Error('Error al cargar los clientes'));
    } finally {
      setLoading(false);
    }
  }

  async function addClient(client: Omit<Client, 'id' | 'created_at' | 'updated_at'>) {
    try {
      // Obtener el usuario actual
      const currentUser = supabaseAuthService.getCurrentUser();
      if (!currentUser) {
        throw new Error('Usuario no autenticado');
      }
      
      // Adaptar el cliente a formato Supabase
      const clientToSave = {
        company_id: currentUser.company_id,
        name: client.name,
        identification_type: client.identification_type,
        identification_number: client.identification_number,
        email: client.email || undefined,
        phone: client.phone || undefined,
        province: client.province || undefined,
        canton: client.canton || undefined,
        district: client.district || undefined,
        address: client.address || undefined,
        economic_activity_code: client.economic_activity_code || undefined,
        economic_activity_desc: client.economic_activity_desc || undefined,
        tax_status: 'Activo', // Por defecto
        is_active: true
      } as SupabaseClient;
      
      // Guardar en Supabase
      const result = await supabaseClientService.createClient(clientToSave);
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Error al guardar el cliente');
      }
      
      // Convertir el resultado a formato interno
      const newClient: Client = {
        id: result.data.id || '',
        user_id: currentUser.id,
        name: result.data.name,
        identification_type: result.data.identification_type,
        identification_number: result.data.identification_number,
        email: result.data.email || null,
        phone: result.data.phone || null,
        province: result.data.province || null,
        canton: result.data.canton || null,
        district: result.data.district || null,
        address: result.data.address || null,
        economic_activity_code: result.data.economic_activity_code || null,
        economic_activity_desc: result.data.economic_activity_desc || null,
        created_at: result.data.created_at || new Date().toISOString()
      };

      // Actualizar el estado local
      setClients([newClient, ...clients]);
      
      return { data: newClient, error: null };
    } catch (err) {
      console.error('Error al agregar cliente:', err);
      return { data: null, error: err instanceof Error ? err : new Error('Error al agregar el cliente') };
    }
  }

  async function updateClient(id: string, updates: Partial<Client>) {
    try {
      // Encontrar el cliente a actualizar
      const clientIndex = clients.findIndex(client => client.id === id);
      if (clientIndex === -1) {
        throw new Error('Cliente no encontrado');
      }

      // Obtener el usuario actual
      const currentUser = supabaseAuthService.getCurrentUser();
      if (!currentUser) {
        throw new Error('Usuario no autenticado');
      }
      
      // Adaptar las actualizaciones al formato de Supabase
      const clientToUpdate = {
        name: updates.name,
        identification_type: updates.identification_type,
        identification_number: updates.identification_number,
        email: updates.email || undefined,
        phone: updates.phone || undefined,
        province: updates.province || undefined,
        canton: updates.canton || undefined,
        district: updates.district || undefined,
        address: updates.address || undefined,
        economic_activity_code: updates.economic_activity_code || undefined,
        economic_activity_desc: updates.economic_activity_desc || undefined
      } as Partial<SupabaseClient>;
      
      // Actualizar en Supabase
      const result = await supabaseClientService.updateClient(id, clientToUpdate);
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Error al actualizar el cliente');
      }
      
      // Convertir el resultado a formato interno
      const updatedClient: Client = {
        ...clients[clientIndex],
        ...{
          name: result.data.name,
          identification_type: result.data.identification_type,
          identification_number: result.data.identification_number,
          email: result.data.email || null,
          phone: result.data.phone || null,
          province: result.data.province || null,
          canton: result.data.canton || null,
          district: result.data.district || null,
          address: result.data.address || null,
          economic_activity_code: result.data.economic_activity_code || null,
          economic_activity_desc: result.data.economic_activity_desc || null
        }
      };

      // Actualizar el estado local
      const updatedClients = [...clients];
      updatedClients[clientIndex] = updatedClient;
      setClients(updatedClients);
      
      return { data: updatedClient, error: null };
    } catch (err) {
      console.error('Error al actualizar cliente:', err);
      return { data: null, error: err instanceof Error ? err : new Error('Error al actualizar el cliente') };
    }
  }

  async function deleteClient(id: string) {
    try {
      // Eliminar de Supabase (marcando como inactivo)
      const result = await supabaseClientService.deleteClient(id);
      
      if (!result.success) {
        throw new Error(result.error || 'Error al eliminar el cliente');
      }
      
      // Filtrar el cliente eliminado del estado local
      const updatedClients = clients.filter(client => client.id !== id);
      setClients(updatedClients);
      
      return { success: true, error: null };
    } catch (err) {
      console.error('Error al eliminar cliente:', err);
      return { success: false, error: err instanceof Error ? err : new Error('Error al eliminar el cliente') };
    }
  }

  return {
    clients,
    loading,
    error,
    addClient,
    updateClient,
    deleteClient,
    refresh: loadClients
  };
}