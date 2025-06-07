import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit3, Trash2, Search, Loader2, UserPlus } from 'lucide-react';
import { useClients } from '../hooks/useClients';
import { buscarContribuyente, mapearTipoIdentificacion, validarEstadoContribuyente } from '../services/haciendaService';

// Validation schema
const clientSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres").max(100, "El nombre no puede exceder 100 caracteres"),
  identification_type: z.string().min(1, "El tipo de identificación es requerido"),
  identification_number: z.string().min(9, "La identificación debe tener al menos 9 dígitos"),
  email: z.string().email("Correo electrónico inválido").optional().nullable(),
  phone: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  canton: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  economic_activity_code: z.string().min(1, "El código de actividad económica es requerido"),
  economic_activity_desc: z.string().min(1, "La descripción de actividad económica es requerida"),
});

type ClientFormData = z.infer<typeof clientSchema>;

const Clients = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  
  const { clients, loading, error, addClient, updateClient, deleteClient } = useClients();
  
  const [isSearchingContribuyente, setIsSearchingContribuyente] = useState(false);
  const [contribuyenteError, setContribuyenteError] = useState<string | null>(null);
  const [invalidContribuyente, setInvalidContribuyente] = useState<{estado: string, mensaje: string} | null>(null);
  const [economicActivities, setEconomicActivities] = useState<Array<{codigo: string, descripcion: string}>>([]);
  
  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
  });

  const onSubmit = async (data: ClientFormData) => {
    // Verificar si hay un error de contribuyente inválido
    if (invalidContribuyente) {
      setContribuyenteError('No se puede agregar un cliente con estado inválido en Hacienda');
      return;
    }
    
    // También bloquear si hay error de contribuyente indicando que no está inscrito
    if (contribuyenteError && contribuyenteError.includes('no está inscrito')) {
      return;
    }
    
    try {
      if (editingClient) {
        await updateClient(editingClient.id, data);
      } else {
        await addClient({ 
          ...data, 
          user_id: "default",
          email: data.email || null,
          phone: data.phone || null,
          province: data.province || null,
          canton: data.canton || null,
          district: data.district || null,
          address: data.address || null
        });
      }
      setIsModalOpen(false);
      reset();
      setEditingClient(null);
    } catch (error) {
      console.error('Error saving client:', error);
    }
  };

  const handleEdit = (client: any) => {
    setEditingClient(client);
    reset(client);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Está seguro de eliminar este cliente?')) {
      await deleteClient(id);
    }
  };

  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.identification_number.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl title-primary">Gestión de Clientes</h1>
        <button 
          onClick={() => {
            setEditingClient(null);
            reset();
            setIsModalOpen(true);
          }}
          className="btn-primary flex items-center"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Nuevo Cliente
        </button>
      </div>

      <div className="glass-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o identificación..." 
            className="form-input pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Nombre</th>
                <th className="table-header">Identificación</th>
                <th className="table-header">Correo</th>
                <th className="table-header">Teléfono</th>
                <th className="table-header">Ubicación</th>
                <th className="table-header text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="table-cell text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredClients.length > 0 ? (
                filteredClients.map((client) => (
                  <tr key={client.id} className="table-row">
                    <td className="table-cell font-medium">{client.name}</td>
                    <td className="table-cell">
                      {client.identification_type} - {client.identification_number}
                    </td>
                    <td className="table-cell">{client.email || 'N/A'}</td>
                    <td className="table-cell">{client.phone || 'N/A'}</td>
                    <td className="table-cell">
                      {client.province && client.canton && client.district
                        ? `${client.province}, ${client.canton}, ${client.district}`
                        : 'N/A'}
                    </td>
                    <td className="table-cell text-right">
                      <button 
                        onClick={() => handleEdit(client)}
                        className="p-1.5 bg-primary-500/20 text-primary-400 rounded-md hover:bg-primary-500/40 transition-colors mr-2"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(client.id)}
                        className="p-1.5 bg-red-500/20 text-red-400 rounded-md hover:bg-red-500/40 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="table-cell text-center py-8 text-gray-400">
                    No se encontraron clientes
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-2xl">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">
                {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h2>
              
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Nombre/Razón Social</label>
                    <input {...register('name')} className="form-input" />
                    {errors.name && <p className="form-error">{errors.name.message}</p>}
                  </div>

                  <div>
                    <label className="form-label">Número de Identificación</label>
                    <div className="flex gap-2">
                      <input {...register('identification_number')} className="form-input" placeholder="Cédula/ID" />
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
                                
                                // Limpiar el nombre para que el usuario note que no se autorrellenó
                                setValue('name', '');
                                
                                // Mostrar un mensaje adicional sobre la imposibilidad de agregar el cliente
                                setContribuyenteError('El ID consultado no está inscrito ante Hacienda');
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
                              setContribuyenteError('No se encontró información del contribuyente. El ID consultado no está inscrito ante Hacienda');
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
                    {errors.identification_number && (
                      <p className="form-error">{errors.identification_number.message}</p>
                    )}
                    {contribuyenteError && <p className="form-error">{contribuyenteError}</p>}
                    
                    {invalidContribuyente && (
                      <div className="col-span-1 md:col-span-2 glass-card bg-orange-100 dark:bg-orange-800/30 border border-orange-300 dark:border-orange-700 p-4 rounded-lg mt-2 flex items-start space-x-3">
                        <div className="text-orange-600 dark:text-orange-400 mt-1">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-alert-triangle"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-black dark:text-white font-medium text-lg">Estado inválido en Hacienda</h3>
                          <p className="text-gray-800 dark:text-gray-300">{invalidContribuyente.mensaje}</p>
                          <p className="text-black dark:text-white mt-2 font-bold">El ID consultado no está inscrito ante Hacienda</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="form-label">Tipo de Identificación</label>
                    <select {...register('identification_type')} className="form-select">
                      <option value="">Seleccione...</option>
                      <option value="01">Física</option>
                      <option value="02">Jurídica</option>
                      <option value="03">DIMEX</option>
                      <option value="04">NITE</option>
                    </select>
                    {errors.identification_type && (
                      <p className="form-error">{errors.identification_type.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="form-label">Correo Electrónico</label>
                    <input {...register('email')} type="email" className="form-input" />
                    {errors.email && <p className="form-error">{errors.email.message}</p>}
                  </div>

                  <div>
                    <label className="form-label">Teléfono</label>
                    <input {...register('phone')} className="form-input" />
                    {errors.phone && <p className="form-error">{errors.phone.message}</p>}
                  </div>

                  <div>
                    <label className="form-label">Provincia</label>
                    <input {...register('province')} className="form-input" />
                    {errors.province && <p className="form-error">{errors.province.message}</p>}
                  </div>

                  <div>
                    <label className="form-label">Cantón</label>
                    <input {...register('canton')} className="form-input" />
                    {errors.canton && <p className="form-error">{errors.canton.message}</p>}
                  </div>

                  <div>
                    <label className="form-label">Distrito</label>
                    <input {...register('district')} className="form-input" />
                    {errors.district && <p className="form-error">{errors.district.message}</p>}
                  </div>

                  <div className="md:col-span-2">
                    <label className="form-label">Dirección Completa</label>
                    <input {...register('address')} className="form-input" />
                    {errors.address && <p className="form-error">{errors.address.message}</p>}
                  </div>

                  <div className="md:col-span-2 pb-2 border-b border-gray-600/30 mb-2">
                    <h3 className="text-lg font-semibold mb-2">Actividad Económica</h3>
                    
                    {economicActivities.length > 0 ? (
                      <div className="space-y-2">
                        <label className="form-label">Seleccione la actividad económica</label>
                        <select 
                          className="form-select w-full"
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

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingClient(null);
                      reset();
                    }}
                    className="btn-ghost"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      'Guardar Cliente'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;
