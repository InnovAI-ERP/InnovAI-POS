import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, User, MapPin, Phone, Mail, Building, Image, Trash2, Store } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { UserProfileAPI } from '../services/userProfileService';
import { useUserSettings } from '../hooks/useUserSettings';
import { getAvailableCompanies, getSelectedCompany, selectCompany, loadCompanyEnvironment } from '../services/companyService';
import { envService } from '../services/envService';

// Validation schema
const userProfileSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  identificacion: z.object({
    tipo: z.string().min(1, "El tipo de identificación es requerido"),
    numero: z.string().min(9, "La identificación debe tener al menos 9 dígitos"),
  }),
  nombreComercial: z.string().optional(),
  ubicacion: z.object({
    provincia: z.string().min(1, "La provincia es requerida"),
    canton: z.string().min(1, "El cantón es requerido"),
    distrito: z.string().min(1, "El distrito es requerido"),
    barrio: z.string().optional(),
    otrasSenas: z.string().optional(),
  }),
  telefono: z.object({
    codigoPais: z.string().min(1, "El código del país es requerido"),
    numTelefono: z.string().min(8, "El número debe tener al menos 8 dígitos"),
  }),
  correo: z.string().email("Correo electrónico inválido"),
  actividadEconomica: z.string().min(1, "La actividad económica es requerida"),
});

type UserProfileForm = z.infer<typeof userProfileSchema>;

const UserSettings = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  
  // Cargar empresas disponibles y logo existente
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoadingCompanies(true);
        setErrorMessage('');
        
        // Obtener lista de empresas disponibles
        const companiesList = await getAvailableCompanies();
        setCompanies(companiesList);
        
        // Obtener empresa actualmente seleccionada desde el localStorage o del servicio
        const company = getSelectedCompany();
        
        if (company) {
          console.log(`Empresa seleccionada: ${company.name} (${company.id})`);
          setSelectedCompanyId(company.id);
          
          // Cargar el logo específico para esta empresa
          loadCompanyLogo(company.id);
          
          // Asegurar que se carguen las variables de entorno específicas
          await loadCompanyEnvironment(company.id);
        } else if (companiesList.length > 0) {
          // Si no hay empresa seleccionada, seleccionar la primera o la por defecto
          const defaultCompany = companiesList.find(c => c.isDefault) || companiesList[0];
          setSelectedCompanyId(defaultCompany.id);
          
          // Cargar el logo y variables de entorno para la empresa por defecto
          loadCompanyLogo(defaultCompany.id);
          await loadCompanyEnvironment(defaultCompany.id);
        }
      } catch (error) {
        console.error('Error al cargar datos iniciales:', error);
        setErrorMessage('No se pudieron cargar las empresas disponibles.');
      } finally {
        setLoadingCompanies(false);
      }
    };
    
    loadInitialData();
  }, []);
  
  // Manejar cambio de empresa seleccionada
  const handleCompanyChange = async (companyId: string) => {
    try {
      setErrorMessage('');
      setSuccessMessage('');
      setSelectedCompanyId(companyId);
      
      // Seleccionar la empresa y cargar su configuración
      await selectCompany(companyId);
      const companyEnv = envService.getAll();
      
      // Actualizar el formulario con los datos de la empresa seleccionada
      const updatedProfile: UserProfileForm = {
        nombre: companyEnv.COMPANY_NAME || '',
        identificacion: {
          tipo: companyEnv.IDENTIFICATION_TYPE || '01',
          numero: companyEnv.IDENTIFICATION_NUMBER || '',
        },
        nombreComercial: companyEnv.COMMERCIAL_NAME || '',
        ubicacion: {
          provincia: companyEnv.PROVINCE || '',
          canton: companyEnv.CANTON || '',
          distrito: companyEnv.DISTRICT || '',
          barrio: '',
          otrasSenas: companyEnv.ADDRESS || '',
        },
        telefono: {
          codigoPais: (companyEnv.PHONE || '').split('-')[0] || '506',
          numTelefono: (companyEnv.PHONE || '').split('-')[1] || '',
        },
        correo: companyEnv.EMAIL || '',
        actividadEconomica: companyEnv.ECONOMIC_ACTIVITY || '',
      };
      
      // Recargar el formulario con los nuevos valores
      reset(updatedProfile);
      
      // Actualizar logo si existe
      const company = companies.find(c => c.id === companyId);
      if (company && company.logo) {
        setLogoPreview(company.logo);
      } else {
        setLogoPreview(null);
      }
      
    } catch (error) {
      console.error('Error al cambiar de empresa:', error);
      setErrorMessage('Error al cargar la configuración de la empresa seleccionada.');
    }
  };

  // Cargar logo específico para esta empresa
  const loadCompanyLogo = (companyId: string) => {
    try {
      // Intentar cargar el logo desde localStorage primero (si fue modificado en esta sesión)
      const storedLogo = localStorage.getItem(`companyLogo_${companyId}`);
      if (storedLogo) {
        setLogoPreview(storedLogo);
        return;
      }

      // Si no está en localStorage, intentar cargarlo desde la carpeta img con convención de nombres
      const logoPath = `/img/${companyId}.png`;
      console.log(`Intentando cargar logo desde: ${logoPath}`);

      // Verificar si la imagen existe
      fetch(logoPath)
        .then(response => {
          if (response.ok) {
            return response.blob();
          }
          throw new Error('Logo no encontrado');
        })
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = reader.result as string;
            setLogoPreview(base64String);
          };
          reader.readAsDataURL(blob);
        })
        .catch(err => {
          console.log('No se encontró logo para esta empresa:', err);
          setLogoPreview(null);
        });
    } catch (error) {
      console.error('Error al cargar logo de empresa:', error);
      setLogoPreview(null);
    }
  };

  // Manejar carga de logo
  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && selectedCompanyId) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setLogoPreview(base64String);
        // Guardar el logo específico para esta empresa
        localStorage.setItem(`companyLogo_${selectedCompanyId}`, base64String);

        // También guardar en el servidor (simulado) - en un entorno real esto sería un upload
        console.log(`Guardando logo para empresa: ${selectedCompanyId}`);
        // En una implementación real, aquí se llamaría a un endpoint para guardar el logo
        // con el nombre del ID de la empresa
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteLogo = () => {
    setLogoPreview(null);
    if (selectedCompanyId) {
      localStorage.removeItem(`companyLogo_${selectedCompanyId}`);
      // En una implementación real, aquí se llamaría a un endpoint para eliminar el logo
    }
  };

  // Obtener la configuración actual desde el servicio de entorno
  const envConfig = envService.getAll();

  // Default user profile basado en la configuración de entorno actual
  const defaultProfile: UserProfileForm = {
    nombre: envConfig.COMPANY_NAME || 'Innova & Ai Group CR SRL',
    identificacion: {
      tipo: envConfig.IDENTIFICATION_TYPE || '02',
      numero: envConfig.IDENTIFICATION_NUMBER || '3102928079',
    },
    nombreComercial: envConfig.COMMERCIAL_NAME || '',
    ubicacion: {
      provincia: envConfig.PROVINCE || 'San José',
      canton: envConfig.CANTON || 'San José',
      distrito: envConfig.DISTRICT || 'San Sebastian',
      barrio: 'Avenida París',
      otrasSenas: envConfig.ADDRESS || 'San Sebastian, San José, de la Iglesia Bautista 75 metros sur, 25 oeste, Avenida París',
    },
    telefono: {
      codigoPais: (envConfig.PHONE || '506-88821455').split('-')[0] || '506',
      numTelefono: (envConfig.PHONE || '506-88821455').split('-')[1] || '88821455',
    },
    correo: envConfig.EMAIL || 'admin@innovaicr.com',
    actividadEconomica: envConfig.ECONOMIC_ACTIVITY || '741203',
  };
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<UserProfileForm>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: defaultProfile,
  });
  
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const { updateSettings } = useUserSettings();
  
  const onSubmit = async (data: UserProfileForm) => {
    setIsSaving(true);
    setErrorMessage('');
    
    try {
      if (!selectedCompanyId) {
        throw new Error('Debe seleccionar una empresa para guardar la configuración');
      }
      
      // Convertir los datos del formulario al formato esperado por la API
      const settingsData = {
        company_name: data.nombre,
        identification_type: data.identificacion.tipo,
        identification_number: data.identificacion.numero,
        commercial_name: data.nombreComercial || null,
        province: data.ubicacion.provincia,
        canton: data.ubicacion.canton,
        district: data.ubicacion.distrito,
        address: data.ubicacion.otrasSenas || null,
        phone: data.telefono ? `${data.telefono.codigoPais}-${data.telefono.numTelefono}` : null,
        email: data.correo,
        economic_activity: data.actividadEconomica,
        api_username: document.querySelector<HTMLInputElement>('[placeholder="Usuario de API"]')?.value || null,
        api_password: document.querySelector<HTMLInputElement>('[placeholder="••••••••••••••••••••"]')?.value || null,
        api_pin: null, // No se está utilizando en este formulario
      };
      
      // Guardar el logo en localStorage y asociarlo a la empresa si se ha cargado uno nuevo
      if (logoPreview) {
        localStorage.setItem(`companyLogo_${selectedCompanyId}`, logoPreview);
        localStorage.setItem('companyLogo', logoPreview); // Mantener compatibilidad con versión anterior
        
        // Actualizar la empresa en la lista con el nuevo logo
        const updatedCompanies = companies.map(company => {
          if (company.id === selectedCompanyId) {
            return { ...company, logo: logoPreview };
          }
          return company;
        });
        setCompanies(updatedCompanies);
      }
      
      // Seleccionar la empresa antes de actualizar la configuración para asegurar
      // que se guarda en el archivo .env correcto
      await selectCompany(selectedCompanyId);
      
      // Actualizar la configuración del usuario
      const { error } = await updateSettings(settingsData, certificateFile || undefined);
      
      if (error) throw error;
      
      setSuccessMessage(`¡Configuración de "${data.nombre}" guardada correctamente!`);
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Error saving profile:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Error al guardar la configuración. Por favor, inténtelo de nuevo.');
      setTimeout(() => setErrorMessage(''), 7000);
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Configuración de Empresa</h1>
      </div>
      
      {successMessage && (
        <div className="glass-card bg-green-500/20 border border-green-500/30 p-4 rounded-lg">
          <p className="text-green-300">{successMessage}</p>
        </div>
      )}
      
      {errorMessage && (
        <div className="glass-card bg-red-500/20 border border-red-500/30 p-4 rounded-lg">
          <p className="text-red-300">{errorMessage}</p>
        </div>
      )}
      
     
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="glass-card overflow-hidden">
          <div className="p-6">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white text-2xl font-medium">
                {defaultProfile.nombre.charAt(0)}
              </div>
              
              <div>
                <h2 className="text-xl font-semibold">{defaultProfile.nombre}</h2>
                <p className="text-gray-400">Información del emisor de facturas</p>
              </div>
            </div>
            
            <div className="space-y-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center">
                  <User className="w-5 h-5 mr-2 text-primary-400" />
                  Información Personal
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Nombre Completo</label>
                    <input 
                      {...register('nombre')} 
                      className="form-input" 
                      placeholder="Nombre completo" 
                    />
                    {errors.nombre && <p className="form-error">{errors.nombre.message}</p>}
                  </div>
                  
                  <div>
                    <label className="form-label">Nombre Comercial (Opcional)</label>
                    <input 
                      {...register('nombreComercial')} 
                      className="form-input" 
                      placeholder="Nombre comercial" 
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="form-label">Tipo de Identificación</label>
                      <select {...register('identificacion.tipo')} className="form-select">
                        <option value="01">Física</option>
                        <option value="02">Jurídica</option>
                        <option value="03">DIMEX</option>
                        <option value="04">NITE</option>
                      </select>
                      {errors.identificacion?.tipo && <p className="form-error">{errors.identificacion.tipo.message}</p>}
                    </div>
                    
                    <div>
                      <label className="form-label">Número de Identificación</label>
                      <input 
                        {...register('identificacion.numero')} 
                        className="form-input" 
                        placeholder="Cédula/RUC" 
                      />
                      {errors.identificacion?.numero && <p className="form-error">{errors.identificacion.numero.message}</p>}
                    </div>
                  </div>
                  
                  <div>
                    <label className="form-label">Actividad Económica</label>
                    <input 
                      {...register('actividadEconomica')} 
                      className="form-input" 
                      placeholder="Código de actividad" 
                    />
                    {errors.actividadEconomica && <p className="form-error">{errors.actividadEconomica.message}</p>}
                  </div>
                </div>
              </div>
              
              {/* Location Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-primary-400" />
                  Información de Ubicación
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="form-label">Provincia</label>
                    <input 
                      {...register('ubicacion.provincia')} 
                      className="form-input" 
                      placeholder="Provincia" 
                    />
                    {errors.ubicacion?.provincia && <p className="form-error">{errors.ubicacion.provincia.message}</p>}
                  </div>
                  
                  <div>
                    <label className="form-label">Cantón</label>
                    <input 
                      {...register('ubicacion.canton')} 
                      className="form-input" 
                      placeholder="Cantón" 
                    />
                    {errors.ubicacion?.canton && <p className="form-error">{errors.ubicacion.canton.message}</p>}
                  </div>
                  
                  <div>
                    <label className="form-label">Distrito</label>
                    <input 
                      {...register('ubicacion.distrito')} 
                      className="form-input" 
                      placeholder="Distrito" 
                    />
                    {errors.ubicacion?.distrito && <p className="form-error">{errors.ubicacion.distrito.message}</p>}
                  </div>
                  
                  <div>
                    <label className="form-label">Barrio (Opcional)</label>
                    <input 
                      {...register('ubicacion.barrio')} 
                      className="form-input" 
                      placeholder="Barrio" 
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="form-label">Otras Señas</label>
                    <input 
                      {...register('ubicacion.otrasSenas')} 
                      className="form-input" 
                      placeholder="Dirección completa" 
                    />
                  </div>
                </div>
              </div>
              
              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center">
                  <Phone className="w-5 h-5 mr-2 text-primary-400" />
                  Información de Contacto
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="form-label">Código País</label>
                      <input 
                        {...register('telefono.codigoPais')} 
                        className="form-input" 
                        placeholder="Ej: 506" 
                      />
                      {errors.telefono?.codigoPais && <p className="form-error">{errors.telefono.codigoPais.message}</p>}
                    </div>
                    
                    <div className="col-span-2">
                      <label className="form-label">Teléfono</label>
                      <input 
                        {...register('telefono.numTelefono')} 
                        className="form-input" 
                        placeholder="Número de teléfono" 
                      />
                      {errors.telefono?.numTelefono && <p className="form-error">{errors.telefono.numTelefono.message}</p>}
                    </div>
                  </div>
                  
                  <div>
                    <label className="form-label">Correo Electrónico</label>
                    <input 
                      {...register('correo')}
                      className="form-input" 
                      placeholder="email@ejemplo.com" 
                    />
                    {errors.correo && <p className="form-error">{errors.correo.message}</p>}
                  </div>

                  {/* Logo Upload Section */}
                  <div className="mt-8">
                    <h3 className="text-lg font-medium flex items-center mb-4">
                      <Image className="w-5 h-5 mr-2 text-primary-400" />
                      Logo para Facturas
                    </h3>
                    
                    <div className="bg-secondary-500/5 p-4 rounded-lg mb-6">
                      <p className="text-sm text-gray-600 mb-4">
                        Sube el logo de tu empresa para que aparezca en las facturas PDF. Formato recomendado: PNG o JPG.
                      </p>
                      
                      {logoPreview ? (
                        <div className="flex flex-col items-center">
                          <div className="relative mb-4">
                            <img 
                              src={logoPreview} 
                              alt="Logo de la empresa" 
                              className="max-w-[200px] max-h-[100px] object-contain border rounded p-2" 
                            />
                            <button 
                              type="button"
                              onClick={handleDeleteLogo}
                              className="absolute -top-2 -right-2 bg-red-100 rounded-full p-1 text-red-500 hover:bg-red-200"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <span className="text-sm text-gray-500">Logo actual</span>
                        </div>
                      ) : (
                        <div className="flex justify-center items-center border-2 border-dashed border-gray-300 rounded-lg p-8 cursor-pointer hover:bg-gray-50"
                             onClick={() => document.getElementById('logoInput')?.click()}
                        >
                          <div className="text-center">
                            <Image className="w-10 h-10 mx-auto text-gray-400" />
                            <p className="mt-2 text-sm text-gray-500">Haz clic para subir un logo</p>
                          </div>
                        </div>
                      )}
                      
                      <input 
                        type="file" 
                        id="logoInput"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="hidden" 
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Usuario para envío de XML</label>
                      <input 
                        type="text"
                        className="form-input" 
                        placeholder="Usuario de API"
                        value={envConfig.HACIENDA_USERNAME || ''}
                        onChange={(e) => {
                          // En una implementación real, aquí se actualizaría el valor
                          console.log('Actualizando usuario de Hacienda:', e.target.value);
                        }}
                      />
                    </div>
                    
                    <div>
                      <label className="form-label">Contraseña para envío de XML</label>
                      <input 
                        type="password"
                        className="form-input" 
                        placeholder="••••••••••••••••••••"
                        value={envConfig.HACIENDA_PASSWORD || ''}
                        onChange={(e) => {
                          // En una implementación real, aquí se actualizaría el valor
                          console.log('Actualizando contraseña de Hacienda:', e.target.value);
                        }}
                      />
                    </div>
                    
                    <div>
                      <label className="form-label">Token de API</label>
                      <input 
                        type="password"
                        className="form-input" 
                        placeholder="••••••••••••••••••••"
                        value={envConfig.HACIENDA_TOKEN || ''}
                        onChange={(e) => {
                          // En una implementación real, aquí se actualizaría el valor
                          console.log('Actualizando token de API:', e.target.value);
                        }}
                      />
                    </div>
                    
                    <div>
                      <label className="form-label">Ambiente</label>
                      <select 
                        className="form-select"
                        onChange={(e) => {
                          const newEnvironment = e.target.value as 'test' | 'prod';
                          // Importar el servicio de consecutivos dinámicamente
                          import('../services/consecutiveService').then(({ resetConsecutive }) => {
                            if (selectedCompanyId) {
                              // Resetear el consecutivo al cambiar de ambiente
                              const result = resetConsecutive(selectedCompanyId, newEnvironment);
                              
                              if (result.success) {
                                // Mostrar mensaje de éxito
                                setSuccessMessage(result.message);
                                // Limpiar mensaje después de 5 segundos
                                setTimeout(() => setSuccessMessage(''), 5000);
                              } else {
                                // Mostrar mensaje de error
                                setErrorMessage(result.message);
                                // Limpiar mensaje después de 7 segundos
                                setTimeout(() => setErrorMessage(''), 7000);
                              }
                            } else {
                              setErrorMessage('Debe seleccionar una empresa para cambiar el ambiente');
                              setTimeout(() => setErrorMessage(''), 7000);
                            }
                          }).catch(error => {
                            console.error('Error al cargar el servicio de consecutivos:', error);
                            setErrorMessage('Error al cambiar el ambiente. Por favor, intente nuevamente.');
                            setTimeout(() => setErrorMessage(''), 7000);
                          });
                        }}
                        defaultValue={localStorage.getItem(`company_${selectedCompanyId}_consecutive_settings`) ? 
                          (JSON.parse(localStorage.getItem(`company_${selectedCompanyId}_consecutive_settings`) || '{}').environment || 'test') : 
                          'test'}
                      >
                        <option value="test">Pruebas (Sandbox)</option>
                        <option value="prod">Producción</option>
                      </select>
                    </div>
                    
                    <div className="col-span-1 md:col-span-2">
                      <label className="form-label">Certificado</label>
                      <div className="flex">
                        <input 
                          id="certificado"
                          className="form-input rounded-r-none" 
                          placeholder="No hay certificado seleccionado" 
                          readOnly
                          value="certificado_hacienda.p12"
                        />
                        <label 
                          htmlFor="certificado-upload"
                          className="px-4 py-2 bg-secondary-600 text-white rounded-r-md hover:bg-secondary-700 transition-colors cursor-pointer"
                        >
                          Examinar
                        </label>
                        <input 
                          id="certificado-upload"
                          type="file"
                          accept=".p12"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              // Guardar el archivo para procesarlo en el envío del formulario
                              setCertificateFile(file);
                              console.log('Archivo seleccionado:', file.name);
                              // Actualizar el input visible con el nombre del archivo
                              const certificadoInput = document.getElementById('certificado') as HTMLInputElement;
                              if (certificadoInput) certificadoInput.value = file.name;
                            }
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Archivo de certificado digital para firmar comprobantes (.p12)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="px-6 py-4 bg-dark-400/50 border-t border-gray-700 flex justify-end">
            <button 
              type="submit" 
              className="btn-primary flex items-center"
              disabled={isSaving}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default UserSettings;