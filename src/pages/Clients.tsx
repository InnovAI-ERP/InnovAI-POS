import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit, Trash2, Save, X, Search, User, Users, Loader2, AlertTriangle } from 'lucide-react';
import { useClients } from '../hooks/useClients';
import type { Tables } from '../lib/supabase';
import { buscarContribuyente, mapearTipoIdentificacion, validarEstadoContribuyente } from '../services/haciendaService';

// Validation schema
const clientSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  identification_type: z.string().min(1, "El tipo de identificación es requerido"),
  identification_number: z.string().min(9, "La identificación debe tener al menos 9 dígitos"),
  email: z.string().email("Correo electrónico inválido").optional().or(z.literal('')),
  phone: z.string().optional(),
  province: z.string().optional(),
  canton: z.string().optional(),
  district: z.string().optional(),
  address: z.string().optional(),
  economic_activity_code: z.string().min(1, "El código de actividad económica es requerido"),
  economic_activity_desc: z.string().min(1, "La descripción de actividad económica es requerida"),
});

type ClientFormData = z.infer<typeof clientSchema>;

const Clients = () => {
  const { clients, loading, error, addClient, updateClient, deleteClient } = useClients();
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  const [isSearchingContribuyente, setIsSearchingContribuyente] = useState(false);
  const [contribuyenteError, setContribuyenteError] = useState<string | null>(null);
  const [invalidContribuyente, setInvalidContribuyente] = useState<{estado: string, mensaje: string} | null>(null);
  
  const [economicActivities, setEconomicActivities] = useState<Array<{codigo: string, descripcion: string}>>([]);
  
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      identification_type: '01',
      identification_number: '',
      email: '',
      phone: '',
      province: '',
      canton: '',
      district: '',
      address: '',
      economic_activity_code: '',
      economic_activity_desc: '',
    }
  });
  
  const onSubmit = async (data: ClientFormData) => {
    // Verificar si hay un error de contribuyente inválido - SIEMPRE bloquear el envío
    if (invalidContribuyente) {
      setContribuyenteError('No se puede agregar un cliente con estado inválido en Hacienda');
      return;
    }
    
    // También bloquear si hay error de contribuyente
    if (contribuyenteError && contribuyenteError.includes('no está inscrito')) {
      return;
    }
    
    try {
      if (editingClientId) {
        await updateClient(editingClientId, data);
        setSuccessMessage('Cliente actualizado correctamente');
      } else {
        await addClient({ 
          ...data, 
          user_id: 'default_user_id',
          email: data.email || null,
          phone: data.phone || null,
          province: data.province || null,
          canton: data.canton || null,
          district: data.district || null,
          address: data.address || null,
          economic_activity_code: data.economic_activity_code,
          economic_activity_desc: data.economic_activity_desc
        });
        setSuccessMessage('Cliente agregado correctamente');
      }
      
      reset();
      setIsAddingClient(false);
      setEditingClientId(null);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving client:', error);
    }
  };
  
  const handleEdit = async (client: Tables['clients']['Row']) => {
    setEditingClientId(client.id);
    reset({
      name: client.name,
      identification_type: client.identification_type,
      identification_number: client.identification_number,
      email: client.email || '',
      phone: client.phone || '',
      province: client.province || '',
      canton: client.canton || '',
      district: client.district || '',
      address: client.address || '',
      economic_activity_code: client.economic_activity_code || '',
      economic_activity_desc: client.economic_activity_desc || '',
    });
    
    // Consultar las actividades económicas del cliente al editar
    if (client.identification_number) {
      try {
        const contribuyente = await buscarContribuyente(client.identification_number);
        if (contribuyente && contribuyente.actividades && contribuyente.actividades.length > 0) {
          // Filtrar solo las actividades activas
          const actividadesActivas = contribuyente.actividades.filter(act => act.estado === 'A');
          setEconomicActivities(actividadesActivas);
          
          // Si hay un código de actividad guardado, asegurarse de seleccionarlo en el dropdown
          if (client.economic_activity_code && actividadesActivas.length > 0) {
            // Encontrar la actividad correspondiente al código guardado
            const actividad = actividadesActivas.find(act => act.codigo === client.economic_activity_code);
            if (!actividad && actividadesActivas.length === 1) {
              // Si no se encuentra pero hay solo una actividad, usarla
              setValue('economic_activity_code', actividadesActivas[0].codigo);
              setValue('economic_activity_desc', actividadesActivas[0].descripcion);
            }
          }
        }
      } catch (error) {
        console.error('Error al buscar actividades económicas:', error);
      }
    }
    
    setIsAddingClient(true);
  };
  
  const handleDelete = async (id: string) => {
    if (window.confirm('¿Está seguro que desea eliminar este cliente?')) {
      await deleteClient(id);
      setSuccessMessage('Cliente eliminado correctamente');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };
  
  const handleCancel = () => {
    setIsAddingClient(false);
    setEditingClientId(null);
    reset();
  };
  
  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.identification_number.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        {!isAddingClient && (
          <button 
            onClick={() => setIsAddingClient(true)}
            className="btn-primary flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Cliente
          </button>
        )}
      </div>
      
      {successMessage && (
        <div className="glass-card bg-green-500/20 border border-green-500/30 p-4 rounded-lg">
          <p className="text-green-300">{successMessage}</p>
        </div>
      )}
      
      {isAddingClient ? (
        <div className="glass-card overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">
              {editingClientId ? 'Editar Cliente' : 'Nuevo Cliente'}
            </h2>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Nombre Completo</label>
                  <input 
                    {...register('name')} 
                    className="form-input" 
                    placeholder="Nombre completo" 
                  />
                  {errors.name && <p className="form-error">{errors.name.message}</p>}
                </div>
                
                <div>
                  <label className="form-label">Número de Identificación</label>
                  <div className="flex gap-2">
                    <input 
                      {...register('identification_number')} 
                      className="form-input" 
                      placeholder="Cédula/ID" 
                    />
                    <button
                      type="button"
                      className="p-2 bg-secondary-600 rounded-md hover:bg-secondary-700 transition-colors"
                      onClick={async () => {
                        const idNumber = document.querySelector<HTMLInputElement>('[placeholder="Cédula/ID"]')?.value;
                        if (!idNumber || idNumber.length < 9) {
                          setContribuyenteError('Ingrese un número de identificación válido');
                          return;
                        }
                        
                        setIsSearchingContribuyente(true);
                        setContribuyenteError(null);
                        setInvalidContribuyente(null);
                        
                        try {
                          const contribuyente = await buscarContribuyente(idNumber);
                          
                          if (contribuyente && contribuyente.nombre) {
                            // Validar el estado del contribuyente
                            const validacionEstado = validarEstadoContribuyente(contribuyente);
                            
                            if (!validacionEstado.esValido) {
                              // Mostrar error de contribuyente inválido
                              setInvalidContribuyente({
                                estado: validacionEstado.estado || 'Desconocido',
                                mensaje: validacionEstado.mensaje
                              });
                              
                              // Mostrar un mensaje adicional sobre la imposibilidad de agregar el cliente
                              setContribuyenteError('El ID consultado no está inscrito ante Hacienda');
                              
                              // Limpiar el nombre para que el usuario note que no se autorrellenó
                              setValue('name', '');
                              return;
                            }
                            
                            // Si es válido, continuar con el proceso normal
                            setValue('name', contribuyente.nombre);
                            setValue('identification_type', mapearTipoIdentificacion(contribuyente.tipoIdentificacion));
                            
                            // Guardar las actividades económicas encontradas
                            if (contribuyente.actividades && contribuyente.actividades.length > 0) {
                              // Filtrar solo las actividades activas
                              const actividadesActivas = contribuyente.actividades.filter(act => act.estado === 'A');
                              setEconomicActivities(actividadesActivas);
                              
                              // Si solo hay una actividad, seleccionarla automáticamente
                              if (actividadesActivas.length === 1 && actividadesActivas[0].codigo && actividadesActivas[0].descripcion) {
                                setValue('economic_activity_code', actividadesActivas[0].codigo);
                                setValue('economic_activity_desc', actividadesActivas[0].descripcion);
                              }
                            } else {
                              setEconomicActivities([]);
                            }
                          } else {
                            setContribuyenteError('No se encontró información del contribuyente');
                          }
                        } catch (error) {
                          setContribuyenteError('Error al buscar el contribuyente');
                          console.error(error);
                        } finally {
                          setIsSearchingContribuyente(false);
                        }
                      }}
                      disabled={isSearchingContribuyente}
                    >
                      {isSearchingContribuyente ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {errors.identification_number && <p className="form-error">{errors.identification_number.message}</p>}
                  {contribuyenteError && <p className="form-error mt-2">{contribuyenteError}</p>}
                </div>
                
                <div>
                  <label className="form-label">Tipo de Identificación</label>
                  <select {...register('identification_type')} className="form-select">
                    <option value="01">Física</option>
                    <option value="02">Jurídica</option>
                    <option value="03">DIMEX</option>
                    <option value="04">NITE</option>
                  </select>
                  {errors.identification_type && <p className="form-error">{errors.identification_type.message}</p>}
                </div>
                
                <div>
                  <label className="form-label">Correo Electrónico</label>
                  <input 
                    {...register('email')} 
                    className="form-input" 
                    placeholder="email@ejemplo.com" 
                  />
                  {errors.email && <p className="form-error">{errors.email.message}</p>}
                </div>
                
                <div>
                  <label className="form-label">Teléfono</label>
                  <input 
                    {...register('phone')} 
                    className="form-input" 
                    placeholder="Número de teléfono" 
                  />
                  {errors.phone && <p className="form-error">{errors.phone.message}</p>}
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="form-label">Provincia</label>
                    <input 
                      {...register('province')} 
                      className="form-input" 
                      placeholder="Provincia" 
                    />
                    {errors.province && <p className="form-error">{errors.province.message}</p>}
                  </div>
                  
                  <div>
                    <label className="form-label">Cantón</label>
                    <input 
                      {...register('canton')} 
                      className="form-input" 
                      placeholder="Cantón" 
                    />
                    {errors.canton && <p className="form-error">{errors.canton.message}</p>}
                  </div>
                  
                  <div>
                    <label className="form-label">Distrito</label>
                    <input 
                      {...register('district')} 
                      className="form-input" 
                      placeholder="Distrito" 
                    />
                    {errors.district && <p className="form-error">{errors.district.message}</p>}
                  </div>
                </div>
                
                <div className="md:col-span-2">
                  <label className="form-label">Dirección</label>
                  <input 
                    {...register('address')} 
                    className="form-input" 
                    placeholder="Dirección completa" 
                  />
                  {errors.address && <p className="form-error">{errors.address.message}</p>}
                </div>
                
                <div className="md:col-span-2 pb-2 border-b border-gray-600/30 mb-2">
                  <h3 className="text-lg font-semibold mb-2">Actividad Económica</h3>
                  
                  {economicActivities.length > 0 ? (
                    <div className="space-y-2">
                      <label className="form-label">Seleccione la actividad económica</label>
                      <select 
                        className="form-select w-full"
                        value={watch('economic_activity_code') || ''}
                        onChange={(e) => {
                          const selectedActivity = economicActivities.find(act => act.codigo === e.target.value);
                          if (selectedActivity) {
                            setValue('economic_activity_code', selectedActivity.codigo);
                            setValue('economic_activity_desc', selectedActivity.descripcion);
                          }
                        }}
                      >
                        <option value="">Seleccione una actividad económica...</option>
                        {economicActivities.map((activity) => (
                          <option key={activity.codigo} value={activity.codigo}>
                            {activity.codigo} - {activity.descripcion}
                          </option>
                        ))}
                      </select>
                      {errors.economic_activity_code && <p className="form-error">{errors.economic_activity_code.message}</p>}
                      <p className="text-xs text-gray-500 mt-1">Esta información se obtiene automáticamente al consultar el contribuyente</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <input 
                          {...register('economic_activity_code')} 
                          className="form-input" 
                          placeholder="Código" 
                        />
                        {errors.economic_activity_code && <p className="form-error">{errors.economic_activity_code.message}</p>}
                      </div>
                      <div>
                        <input 
                          {...register('economic_activity_desc')} 
                          className="form-input" 
                          placeholder="Descripción" 
                        />
                        {errors.economic_activity_desc && <p className="form-error">{errors.economic_activity_desc.message}</p>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {invalidContribuyente && (
                <div className="col-span-1 md:col-span-2 glass-card bg-orange-100 dark:bg-orange-800/30 border border-orange-300 dark:border-orange-700 p-4 rounded-lg flex items-start space-x-3">
                  <div className="text-orange-600 dark:text-orange-400 mt-1">
                    <AlertTriangle size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-black dark:text-white font-medium text-lg">Estado inválido en Hacienda</h3>
                    <p className="text-gray-800 dark:text-gray-300">{invalidContribuyente.mensaje}</p>
                    <p className="text-black dark:text-white mt-2 font-bold">El ID consultado no está inscrito ante Hacienda</p>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end space-x-2 mt-6">
                <button 
                  type="button" 
                  onClick={handleCancel}
                  className="btn-secondary flex items-center"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </button>
                
                <button 
                  type="submit" 
                  className="btn-primary flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingClientId ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <>
          <div className="glass-card p-4 mb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por nombre o identificación..."
                className="form-input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            </div>
          </div>
          
          {loading ? (
            <div className="glass-card p-6 text-center">
              <p>Cargando clientes...</p>
            </div>
          ) : error ? (
            <div className="glass-card bg-red-500/20 border border-red-500/30 p-4 rounded-lg">
              <p className="text-red-300">Error al cargar clientes: {error.message}</p>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="glass-card p-6 text-center">
              <Users className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <h3 className="text-lg font-medium">No hay clientes</h3>
              <p className="text-gray-400 mt-1">
                {searchTerm ? 'No se encontraron clientes con ese criterio de búsqueda' : 'Comience agregando su primer cliente'}
              </p>
            </div>
          ) : (
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left">
                      <th className="table-header rounded-tl-lg">Nombre</th>
                      <th className="table-header">Identificación</th>
                      <th className="table-header">Correo</th>
                      <th className="table-header">Teléfono</th>
                      <th className="table-header rounded-tr-lg">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client) => (
                      <tr key={client.id} className="table-row">
                        <td className="table-cell font-medium" title={client.economic_activity_code ? `${client.economic_activity_code} - ${client.economic_activity_desc}` : ''}>{client.name}</td>
                        <td className="table-cell">
                          {{
                            '01': 'Física',
                            '02': 'Jurídica',
                            '03': 'DIMEX',
                            '04': 'NITE'
                          }[client.identification_type] || client.identification_type}: {client.identification_number}
                        </td>
                        <td className="table-cell">{client.email || '-'}</td>
                        <td className="table-cell">{client.phone || '-'}</td>
                        <td className="table-cell">
                          <div className="flex space-x-2">
                            <button 
                              onClick={() => handleEdit(client)}
                              className="p-1 text-primary-400 hover:text-primary-300 transition-colors"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(client.id)}
                              className="p-1 text-red-400 hover:text-red-300 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Clients;