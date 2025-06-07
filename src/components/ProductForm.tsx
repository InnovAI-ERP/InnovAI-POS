import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search, X, Save, Plus, Edit } from 'lucide-react';
import { searchByDescription } from '../services/cabysService';
import type { CabysItem } from '../types/invoice';

// Validation schema para productos
const productSchema = z.object({
  codigoCabys: z.string().min(1, "El código CABYS es requerido"),
  detalle: z.string().min(1, "El detalle es requerido"),
  cantidad: z.number().min(0.001, "La cantidad debe ser mayor a cero"),
  unidadMedida: z.string().min(1, "La unidad de medida es requerida"),
  precioUnitario: z.number().min(0, "El precio unitario debe ser mayor o igual a cero"),
  impuesto: z.number().min(0, "El impuesto debe ser mayor o igual a cero").default(13),
  descuento: z.object({
    montoDescuento: z.number().min(0, "El descuento debe ser mayor o igual a cero"),
    naturalezaDescuento: z.string().optional(),
  }).optional(),
  // Nuevos campos
  tipo_producto: z.enum(["bien", "servicio"]).optional(),
  costo_unitario: z.number().min(0, "El costo unitario debe ser mayor o igual a cero").optional(),
  margen_ganancia: z.number().min(0, "El margen de ganancia debe ser mayor o igual a cero").max(100, "El margen de ganancia no puede ser mayor a 100%").optional(),
  numero_vin_serie: z.string().optional(),
  registro_medicamento: z.string().optional(),
  forma_farmaceutica: z.enum(["tabletas", "jarabe", "cápsulas", "crema", "inyectable"]).optional(),
  // Clasificación Tarifa 0%
  clasificacion_tarifa_0: z.enum(["tarifa_exenta", "tarifa_0_no_sujeto", "transitorio_0"]).optional(),
  // Otros impuestos
  otro_impuesto: z.enum(["02", "03", "04", "05", "06", "07", "08", "12", "99", ""]).optional(),
  porcentaje_otro_impuesto: z.number().min(0).optional(),
  tarifa_otro_impuesto: z.number().min(0).optional(),
});

export type ProductFormData = z.infer<typeof productSchema> & { id?: string };

const PRODUCTS_KEY = 'products';

function getProducts(): ProductFormData[] {
  const data = localStorage.getItem(PRODUCTS_KEY);
  return data ? JSON.parse(data) : [];
}

function saveProducts(products: ProductFormData[]) {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
}

interface ProductFormProps {
  onSave: (product: ProductFormData) => void;
  onCancel: () => void;
  initialData?: ProductFormData;
  title?: string;
}

export default function ProductForm({ onSave, onCancel, initialData, title = "Nuevo Producto o Servicio" }: ProductFormProps) {
  // CABYS modal state
  const [cabysModalOpen, setCabysModalOpen] = useState(false);
  const [cabysSearch, setCabysSearch] = useState('');
  const [cabysResults, setCabysResults] = useState<CabysItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Estado para controlar la visualización condicional de campos
  const [showMedicinaFields, setShowMedicinaFields] = useState(false);
  const [showVINField, setShowVINField] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: initialData || {
      codigoCabys: '',
      detalle: '',
      cantidad: 1,
      unidadMedida: 'Sp',
      precioUnitario: 0,
      descuento: { montoDescuento: 0, naturalezaDescuento: '' },
      otro_impuesto: '',
      porcentaje_otro_impuesto: 0,
      tarifa_otro_impuesto: 0
    }
  });

  // CABYS search handler
  const handleCabysSearch = async () => {
    if (!cabysSearch) return;
    setIsSearching(true);
    try {
      const results = await searchByDescription(cabysSearch);
      setCabysResults(results.cabys || []);
    } catch (error) {
      setCabysResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // CABYS select handler
  const handleSelectCabys = (item: CabysItem) => {
    setValue('codigoCabys', item.codigo);
    setValue('detalle', item.descripcion);
    
    // Establecer el impuesto según el valor de CABYS
    if (item.impuesto !== undefined) {
      setValue('impuesto', item.impuesto);
      
      // Si el impuesto es 0%, resetear la clasificación de tarifa 0%
      if (item.impuesto === 0) {
        setValue('clasificacion_tarifa_0', undefined);
      } else {
        // Si no es 0%, limpiar el campo de clasificación
        setValue('clasificacion_tarifa_0', undefined);
      }
    }
    
    // Verificar prefijos especiales
    const codigo = item.codigo;
    if (codigo.startsWith('356')) {
      setShowMedicinaFields(true);
      setShowVINField(false);
    } else if (codigo.startsWith('49')) {
      setShowVINField(true);
      setShowMedicinaFields(false);
    } else {
      setShowMedicinaFields(false);
      setShowVINField(false);
    }
    
    setCabysModalOpen(false);
    setCabysSearch('');
    setCabysResults([]);
  };
  
  // Inicializar campos condicionales basados en initialData
  useEffect(() => {
    if (initialData?.codigoCabys) {
      const codigo = initialData.codigoCabys;
      if (codigo.startsWith('356')) {
        setShowMedicinaFields(true);
        setShowVINField(false);
      } else if (codigo.startsWith('49')) {
        setShowVINField(true);
        setShowMedicinaFields(false);
      }
    }
  }, [initialData]);
  
  // Monitorear campos relevantes para cálculos
  const tipoProducto = watch('tipo_producto');
  const costoUnitario = watch('costo_unitario');
  const margenGanancia = watch('margen_ganancia');
  const precioUnitario = watch('precioUnitario');
  const porcentajeOtroImpuesto = watch('porcentaje_otro_impuesto');
  const tarifaOtroImpuesto = watch('tarifa_otro_impuesto');
  
  // Calcular precio unitario automáticamente cuando es un bien
  useEffect(() => {
    if (tipoProducto === 'bien' && costoUnitario && margenGanancia) {
      const nuevoPrecio = costoUnitario + (costoUnitario * margenGanancia / 100);
      setValue('precioUnitario', parseFloat(nuevoPrecio.toFixed(2)));
    }
  }, [tipoProducto, costoUnitario, margenGanancia, setValue]);
  
  // Cálculo bidireccional entre porcentaje y tarifa de Otros Impuestos
  useEffect(() => {
    // Si hay precio unitario y se modificó el porcentaje, calcular la tarifa
    if (precioUnitario && porcentajeOtroImpuesto !== undefined && porcentajeOtroImpuesto !== null) {
      // Evitar loop infinito verificando que no fue triggered por un cambio en la tarifa
      if (document.activeElement?.id !== 'tarifa_otro_impuesto') {
        const nuevaTarifa = (precioUnitario * porcentajeOtroImpuesto) / 100;
        setValue('tarifa_otro_impuesto', parseFloat(nuevaTarifa.toFixed(2)));
      }
    }
  }, [precioUnitario, porcentajeOtroImpuesto, setValue]);
  
  // Si se ingresa la tarifa, calcular el porcentaje
  useEffect(() => {
    // Si hay precio unitario y se modificó la tarifa, calcular el porcentaje
    if (precioUnitario && precioUnitario > 0 && tarifaOtroImpuesto !== undefined && tarifaOtroImpuesto !== null) {
      // Evitar loop infinito verificando que no fue triggered por un cambio en el porcentaje
      if (document.activeElement?.id !== 'porcentaje_otro_impuesto') {
        const nuevoPorcentaje = (tarifaOtroImpuesto / precioUnitario) * 100;
        setValue('porcentaje_otro_impuesto', parseFloat(nuevoPorcentaje.toFixed(2)));
      }
    }
  }, [precioUnitario, tarifaOtroImpuesto, setValue]);

  const handleSaveProduct = (data: ProductFormData) => {
    // Si no hay ID, agregamos uno nuevo
    if (!data.id) {
      const products = getProducts();
      const newProduct = { ...data, id: Date.now().toString() };
      saveProducts([...products, newProduct]);
    }
    onSave(data);
  };

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          {initialData?.id ? (
            <>
              <Edit className="w-5 h-5 mr-2 text-primary-400" /> Editar Producto o Servicio
            </>
          ) : (
            <>
              <Plus className="w-5 h-5 mr-2 text-primary-400" /> {title}
            </>
          )}
        </h2>
        
        <form onSubmit={handleSubmit(handleSaveProduct)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Código CABYS</label>
              <div className="flex gap-2">
                <input {...register('codigoCabys')} className="form-input flex-1" placeholder="Código CABYS" />
                <button
                  type="button"
                  className="p-2 bg-secondary-600 rounded-md hover:bg-secondary-700 transition-colors"
                  onClick={() => setCabysModalOpen(true)}
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
              {errors.codigoCabys && <p className="form-error">{errors.codigoCabys.message}</p>}
            </div>

            <div>
              <label className="form-label">Detalle</label>
              <input {...register('detalle')} className="form-input" placeholder="Nombre del producto o servicio" />
              {errors.detalle && <p className="form-error">{errors.detalle.message}</p>}
            </div>
            
            <div>
              <label className="form-label">Tipo de Producto</label>
              <select {...register('tipo_producto')} className="form-select">
                <option value="">Seleccione un tipo</option>
                <option value="bien">Bien</option>
                <option value="servicio">Servicio</option>
              </select>
              {errors.tipo_producto && <p className="form-error">{errors.tipo_producto.message}</p>}
            </div>
            
            {watch('tipo_producto') === 'bien' && (
              <>
                <div>
                  <label className="form-label">Costo Unitario (₡)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    {...register('costo_unitario', { valueAsNumber: true })} 
                    className="form-input" 
                    placeholder="0.00"
                  />
                  {errors.costo_unitario && <p className="form-error">{errors.costo_unitario.message}</p>}
                </div>

                <div>
                  <label className="form-label">Margen de Ganancia (%)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      step="0.01" 
                      {...register('margen_ganancia', { valueAsNumber: true })} 
                      className="form-input" 
                      placeholder="0.00"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</div>
                  </div>
                  {errors.margen_ganancia && <p className="form-error">{errors.margen_ganancia.message}</p>}
                </div>
              </>
            )}
            
            {showMedicinaFields && (
              <>
                <div>
                  <label className="form-label">Registro de Medicamento</label>
                  <input 
                    {...register('registro_medicamento')} 
                    className="form-input" 
                    placeholder="Número de registro"
                  />
                  {errors.registro_medicamento && <p className="form-error">{errors.registro_medicamento.message}</p>}
                </div>

                <div>
                  <label className="form-label">Forma Farmacéutica</label>
                  <select 
                    {...register('forma_farmaceutica')} 
                    className="form-select"
                  >
                    <option value="">Seleccione una opción</option>
                    <option value="tabletas">Tabletas</option>
                    <option value="jarabe">Jarabe</option>
                    <option value="cápsulas">Cápsulas</option>
                    <option value="crema">Crema</option>
                    <option value="inyectable">Inyectable</option>
                  </select>
                  {errors.forma_farmaceutica && <p className="form-error">{errors.forma_farmaceutica.message}</p>}
                </div>
              </>
            )}
            
            {showVINField && (
              <div>
                <label className="form-label">Número VIN o Serie</label>
                <input 
                  {...register('numero_vin_serie')} 
                  className="form-input" 
                  placeholder="Número VIN o Serie"
                />
                {errors.numero_vin_serie && <p className="form-error">{errors.numero_vin_serie.message}</p>}
              </div>
            )}
            
            <div>
              <label className="form-label">Cantidad</label>
              <input 
                type="number" 
                step="0.001" 
                {...register('cantidad', { valueAsNumber: true })} 
                className="form-input" 
                placeholder="1.000"
              />
              {errors.cantidad && <p className="form-error">{errors.cantidad.message}</p>}
            </div>

            <div>
              <label className="form-label">Unidad de Medida</label>
              <select {...register('unidadMedida')} className="form-select">
                <option value="Sp">Servicios Profesionales (Sp)</option>
                <option value="Unid">Unidad (Unid)</option>
                <option value="Kg">Kilogramo (Kg)</option>
                <option value="m">Metro (m)</option>
                <option value="L">Litro (L)</option>
                <option value="h">Hora (h)</option>
                <option value="d">Día (d)</option>
              </select>
              {errors.unidadMedida && <p className="form-error">{errors.unidadMedida.message}</p>}
            </div>

            <div>
              <label className="form-label">Precio Unitario (₡)</label>
              <input 
                type="number" 
                step="0.01" 
                {...register('precioUnitario', { valueAsNumber: true })} 
                className="form-input" 
                placeholder="0.00"
              />
              {errors.precioUnitario && <p className="form-error">{errors.precioUnitario.message}</p>}
            </div>

            <div>
              <label className="form-label">
                IVA (%) 
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                  Asignado automáticamente desde CABYS
                </span>
              </label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.01" 
                  {...register('impuesto', { valueAsNumber: true })} 
                  className="form-input bg-gray-100 dark:bg-gray-700/50" 
                  placeholder="Impuesto según CABYS"
                  readOnly
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  %
                </div>
              </div>
              {errors.impuesto && <p className="form-error">{errors.impuesto.message}</p>}
            </div>

            {/* Campo de Clasificación Tarifa 0% - Solo visible cuando el impuesto es 0% */}
            {watch('impuesto') === 0 && (
              <div>
                <label className="form-label">Clasificación Tarifa 0%</label>
                <select 
                  {...register('clasificacion_tarifa_0')} 
                  className="form-select"
                >
                  <option value="tarifa_exenta">Tarifa Exenta</option>
                  <option value="tarifa_0_no_sujeto">Tarifa 0% sin derecho a crédito (No Sujeto)</option>
                  <option value="transitorio_0">Transitorio 0%</option>
                </select>
                {errors.clasificacion_tarifa_0 && <p className="form-error">{errors.clasificacion_tarifa_0.message}</p>}
              </div>
            )}

            <div>
              <label className="form-label">Descuento (₡)</label>
              <input 
                type="number" 
                step="0.01" 
                {...register('descuento.montoDescuento', { valueAsNumber: true })} 
                className="form-input" 
                placeholder="0.00"
              />
              {errors.descuento?.montoDescuento && <p className="form-error">{errors.descuento.montoDescuento.message}</p>}
            </div>
          </div>

          <div>
            <label className="form-label">Naturaleza Descuento</label>
            <input 
              {...register('descuento.naturalezaDescuento')} 
              className="form-input" 
              placeholder="Ej: Descuento por volumen"
            />
            {errors.descuento?.naturalezaDescuento && <p className="form-error">{errors.descuento.naturalezaDescuento.message}</p>}
          </div>

          {/* Campos para Otros Impuestos */}
          <div className="pt-4 border-t border-primary-500/30 mt-6">
            <h3 className="text-md font-semibold mb-4">Otros Impuestos (Opcional)</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Tipo de Impuesto</label>
                <select 
                  {...register('otro_impuesto')} 
                  className="form-select"
                >
                  <option value="">No aplica</option>
                  <option value="02">Impuesto Selectivo de Consumo 02</option>
                  <option value="03">Impuesto Único a los Combustibles 03</option>
                  <option value="04">Impuesto específico de Bebidas Alcohólicas 04</option>
                  <option value="05">Imp. Específico sobre bebidas envasadas sin contenido alcohólico y jabones 05</option>
                  <option value="06">Impuesto a los Productos de Tabaco 06</option>
                  <option value="07">IVA (cálculo especial) 07</option>
                  <option value="08">IVA Régimen de Bienes Usados (Factor) 08</option>
                  <option value="12">Impuesto Específico al Cemento 12</option>
                  <option value="99">Otros 99</option>
                </select>
                {errors.otro_impuesto && <p className="form-error">{errors.otro_impuesto.message}</p>}
              </div>

              {watch('otro_impuesto') && (
                <>
                  <div>
                    <label className="form-label">% de impuesto (si corresponde)</label>
                    <div className="relative">
                      <input 
                        id="porcentaje_otro_impuesto"
                        type="number" 
                        step="0.01" 
                        {...register('porcentaje_otro_impuesto', { valueAsNumber: true })} 
                        className="form-input" 
                        placeholder="0.00"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</div>
                    </div>
                    {errors.porcentaje_otro_impuesto && <p className="form-error">{errors.porcentaje_otro_impuesto.message}</p>}
                  </div>
                  
                  <div>
                    <label className="form-label">Tarifa del impuesto (₡)</label>
                    <input 
                      id="tarifa_otro_impuesto"
                      type="number" 
                      step="0.01" 
                      {...register('tarifa_otro_impuesto', { valueAsNumber: true })} 
                      className="form-input" 
                      placeholder="0.00"
                    />
                    {errors.tarifa_otro_impuesto && <p className="form-error">{errors.tarifa_otro_impuesto.message}</p>}
                  </div>
                </>
              )}
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4 border-t border-primary-500/30 mt-6">
            <button 
              type="button" 
              className="btn-secondary flex items-center" 
              onClick={onCancel}
            >
              <X className="w-4 h-4 mr-2" /> Cancelar
            </button>
            <button type="submit" className="btn-primary flex items-center">
              <Save className="w-4 h-4 mr-2" /> Guardar
            </button>
          </div>
        </form>
      </div>

      {/* Modal CABYS */}
      {cabysModalOpen && (
        <div className="modal-overlay z-50">
          <div className="modal max-w-lg glass-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Search className="w-4 h-4 text-primary-400" /> Buscar CABYS
              </h3>
              <button 
                className="p-1.5 bg-red-500/20 text-red-400 rounded-md hover:bg-red-500/40 transition-colors"
                onClick={() => setCabysModalOpen(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <input
                  className="form-input w-full pr-10"
                  placeholder="Buscar por descripción..."
                  value={cabysSearch}
                  onChange={e => setCabysSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCabysSearch(); }}
                  autoFocus
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 animate-spin">
                    <div className="w-4 h-4 border-2 border-primary-500 rounded-full border-t-transparent"></div>
                  </div>
                )}
              </div>
              <button 
                className="btn-primary flex items-center"
                onClick={handleCabysSearch} 
                disabled={isSearching}
              >
                <Search className="w-4 h-4 mr-1" /> Buscar
              </button>
            </div>
            
            <div className="max-h-64 overflow-y-auto rounded-md border border-primary-500/30 bg-gray-50 dark:bg-gray-900 p-1">
              {cabysResults.length === 0 && <p className="text-center text-gray-400 dark:text-gray-500 py-4">Sin resultados. Intente otra búsqueda.</p>}
              {cabysResults.map((item) => (
                <div 
                  key={item.codigo} 
                  className="p-3 border-b border-primary-500/10 last:border-0 dark:hover:bg-primary-800/20 hover:bg-primary-50 cursor-pointer rounded-md"
                  onClick={() => handleSelectCabys(item)}
                >
                  <div className="flex justify-between items-start">
                    <div className="font-medium">{item.descripcion}</div>
                    <div className="bg-primary-500/10 text-primary-600 dark:text-primary-400 text-xs py-1 px-2 rounded-md">
                      IVA: {item.impuesto}%
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Código: {item.codigo}</div>
                    {item.categorias && item.categorias.length > 0 && (
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        | Categoría: {item.categorias[0]}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
