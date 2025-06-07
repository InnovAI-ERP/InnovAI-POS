import { useState } from 'react';
import { AlertTriangle, Search, Loader2 } from 'lucide-react';
import { buscarContribuyente, mapearTipoIdentificacion, validarEstadoContribuyente } from '../services/haciendaService';

/**
 * This is a sample component that demonstrates how the client validation should look
 * in the InvoiceCreate.tsx file.
 * 
 * Please copy the validation logic and error display from this file
 * into the "Nuevo Cliente" modal in InvoiceCreate.tsx.
 */
const ClientModalWithValidation = () => {
  const [isSearchingContribuyente, setIsSearchingContribuyente] = useState(false);
  const [invalidContribuyente, setInvalidContribuyente] = useState<{estado: string, mensaje: string} | null>(null);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-2xl">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Nuevo Cliente</h2>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            
            // Si hay un error de contribuyente inválido, no permitir el envío del formulario
            if (invalidContribuyente) {
              alert('No se puede agregar un cliente con estado inválido en Hacienda');
              return;
            }
            
            // También bloquear si hay error relacionado con no estar inscrito
            // (Verificar si el mensaje de error existe y contiene texto sobre no estar inscrito)
            const errorMsgDiv = document.getElementById('client_validation_error');
            if (errorMsgDiv && errorMsgDiv.style.display === 'block' && 
                errorMsgDiv.innerHTML.includes('no está inscrito ante Hacienda')) {
              return;
            }
            
            // ... resto del código para guardar el cliente
          }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Número de Identificación</label>
                <div className="flex gap-2">
                  <input 
                    name="identification_number" 
                    id="client_identification_number"
                    className="form-input" 
                    placeholder="Cédula/ID" 
                    required 
                  />
                  <button
                    type="button"
                    className="p-2 bg-secondary-600 rounded-md hover:bg-secondary-700 transition-colors"
                    onClick={async () => {
                      const idNumberInput = document.getElementById('client_identification_number') as HTMLInputElement;
                      const idNumber = idNumberInput?.value;
                      const nameInput = document.getElementById('client_name') as HTMLInputElement;
                      const typeSelect = document.getElementById('client_identification_type') as HTMLSelectElement;
                      const errorMsgDiv = document.getElementById('client_validation_error');
                      
                      if (!idNumber || idNumber.length < 9) {
                        alert('Ingrese un número de identificación válido');
                        return;
                      }
                      
                      // Reset error message
                      if (errorMsgDiv) {
                        errorMsgDiv.innerHTML = '';
                        errorMsgDiv.style.display = 'none';
                      }
                      
                      // Limpiar estado previo
                      setInvalidContribuyente(null);
                      setIsSearchingContribuyente(true);
                      
                      // Mostrar indicador de carga
                      const searchButton = document.querySelector('button[type="button"]') as HTMLButtonElement;
                      if (searchButton) {
                        searchButton.disabled = true;
                        searchButton.innerHTML = '<svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
                      }
                      
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
                            
                            // Limpiar el nombre para que el usuario note que no hubo autocompletado
                            if (nameInput) nameInput.value = '';
                            
                            // Mostrar mensaje de error visual
                            if (errorMsgDiv) {
                              errorMsgDiv.innerHTML = `
                                <div class="flex items-start space-x-3">
                                  <div class="text-red-500 mt-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alert-triangle"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
                                  </div>
                                  <div class="flex-1">
                                    <h3 class="text-red-400 font-medium text-lg">Estado inválido en Hacienda</h3>
                                    <p class="text-white/80">${validacionEstado.mensaje}</p>
                                    <p class="text-white/80 mt-2 font-bold">El ID consultado no está inscrito ante Hacienda</p>
                                  </div>
                                </div>
                              `;
                              errorMsgDiv.style.display = 'block';
                            }
                            return;
                          }
                          
                          // Si es válido, continuar con el proceso normal
                          if (nameInput) nameInput.value = contribuyente.nombre;
                          if (typeSelect) typeSelect.value = mapearTipoIdentificacion(contribuyente.tipoIdentificacion);
                        } else {
                          // Mostrar mensaje de error más específico en la interfaz
                          if (errorMsgDiv) {
                            errorMsgDiv.innerHTML = `
                              <div class="flex items-start space-x-3">
                                <div class="text-red-500 mt-1">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alert-triangle"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
                                </div>
                                <div class="flex-1">
                                  <h3 class="text-red-400 font-medium text-lg">Cliente no encontrado</h3>
                                  <p class="text-white/80">No se encontró información del contribuyente en la base de datos de Hacienda</p>
                                  <p class="text-white/80 mt-2 font-bold">El ID consultado no está inscrito ante Hacienda</p>
                                </div>
                              </div>
                            `;
                            errorMsgDiv.style.display = 'block';
                          } else {
                            alert('No se encontró información del contribuyente. El ID consultado no está inscrito ante Hacienda');
                          }
                        }
                      } catch (error) {
                        console.error('Error al buscar el contribuyente:', error);
                        alert('Error al buscar el contribuyente');
                      } finally {
                        // Restaurar botón
                        setIsSearchingContribuyente(false);
                        if (searchButton) {
                          searchButton.disabled = false;
                          searchButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
                        }
                      }
                    }}
                  >
                    {isSearchingContribuyente ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="form-label">Nombre/Razón Social</label>
                <input name="name" id="client_name" className="form-input" required />
              </div>
              
              {/* Resto de los campos del formulario */}
              
              {/* Contenedor para mensajes de error de validación */}
              <div id="client_validation_error" className="col-span-1 md:col-span-2 glass-card bg-red-500/20 border border-red-500/30 p-4 rounded-lg mb-4" style={{ display: 'none' }}></div>
              
              {/* Componente de error para mostrar mensajes de error */}
              {invalidContribuyente && (
                <div className="col-span-1 md:col-span-2 glass-card bg-red-500/20 border border-red-500/30 p-4 rounded-lg mb-4 flex items-start space-x-3">
                  <div className="text-red-500 mt-1">
                    <AlertTriangle size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-red-400 font-medium text-lg">Estado inválido en Hacienda</h3>
                    <p className="text-white/80">{invalidContribuyente.mensaje}</p>
                    <p className="text-white/80 mt-2 font-bold">El ID consultado no está inscrito ante Hacienda</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button type="button" className="btn-ghost">Cancelar</button>
              <button type="submit" className="btn-primary">Guardar Cliente</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ClientModalWithValidation;
