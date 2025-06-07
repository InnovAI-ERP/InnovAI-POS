import { useState, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { supabaseProductService } from '../services/supabaseProductService';
import { Product } from '../services/supabaseProductService';

// Interfaz para los productos formateados para el selector
export interface ProductForSelector {
  id?: string;
  detalle: string;
  codigoCabys: string;
  unidadMedida: string;
  precioUnitario: number;
  impuesto: number;
  cantidad?: number;
  // Campos farmacéuticos agregados para compatibilidad con Supabase
  formaFarmaceutica?: string;
  registroMedicamento?: string;
  descuento?: {
    montoDescuento: number;
    naturalezaDescuento?: string;
  };
}

export interface ProductSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (product: ProductForSelector) => void;
}

// Función para convertir un producto de Supabase al formato para el selector
function mapSupabaseProductToSelector(product: Product): ProductForSelector {
  console.log('Mapeando producto farmacéutico:', product);
  
  // Incluir campos farmacéuticos directamente desde la base de datos
  return {
    id: product.id,
    detalle: product.name,
    codigoCabys: product.code || '',
    unidadMedida: product.unit_measure || 'Unid',
    precioUnitario: product.unit_price || 0,
    impuesto: product.tax_rate || 13,
    // NUEVO: Incluir campos farmacéuticos desde la base de datos
    formaFarmaceutica: product.forma_farmaceutica || undefined,
    registroMedicamento: product.registro_medicamento || undefined,
    descuento: {
      montoDescuento: 0,
      naturalezaDescuento: ''
    }
  };
}

export default function ProductSelectorModal({ isOpen, onClose, onSelect }: ProductSelectorModalProps) {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<ProductForSelector[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Cargar productos desde Supabase cuando el modal se abre
  useEffect(() => {
    if (isOpen) {
      loadProducts();
    }
  }, [isOpen]);
  
  // Función para cargar productos desde Supabase
  async function loadProducts() {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Cargando productos desde Supabase para el selector...');
      const result = await supabaseProductService.getProducts(1, 1000); // Traer todos los productos
      
      if (!result.success) {
        throw new Error(result.error || 'Error al cargar los productos');
      }
      
      console.log(`✅ Productos cargados correctamente: ${result.data?.length || 0} productos`);
      
      // Convertir productos de Supabase al formato requerido por el selector
      const mappedProducts = (result.data || []).map(mapSupabaseProductToSelector);
      setProducts(mappedProducts);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al cargar productos';
      console.error('❌ Error al cargar productos:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  const filtered = products.filter((p: any) =>
    p.detalle.toLowerCase().includes(search.toLowerCase()) ||
    p.codigoCabys.toLowerCase().includes(search.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="modal-overlay z-50">
      <div className="modal max-w-lg glass-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 dark:text-white text-gray-800">
            <Search className="w-4 h-4 text-primary-500" /> Seleccionar Producto o Servicio
          </h3>
          <button 
            className="p-1.5 bg-red-500/20 text-red-400 rounded-md hover:bg-red-500/40 transition-colors"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="relative mb-4">
          <input
            className="form-input w-full pl-9"
            placeholder="Buscar por nombre o código CABYS..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            <Search className="w-4 h-4" />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto border rounded-lg border-primary-500/30 p-2 dark:bg-black/20 bg-gray-100/50 mb-2">
          {/* Estado de carga */}
          {loading && (
            <div className="text-center py-8 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary-400 animate-spin mb-2" />
              <span className="dark:text-gray-400 text-gray-500">Cargando productos...</span>
            </div>
          )}
          
          {/* Mensaje de error */}
          {error && (
            <div className="text-center py-6 text-red-400 flex flex-col items-center">
              <div className="bg-red-500/10 p-3 rounded-lg mb-2 max-w-md">
                <p>{error}</p>
              </div>
              <button 
                onClick={loadProducts}
                className="text-sm bg-primary-500/20 hover:bg-primary-500/30 text-primary-500 px-3 py-1 rounded-md transition-colors flex items-center"
              >
                <Loader2 className="w-3 h-3 mr-1" /> Reintentar
              </button>
            </div>
          )}
          
          {/* Mensaje cuando no hay resultados */}
          {!loading && !error && filtered.length === 0 && 
            <div className="text-center py-8 dark:text-gray-400 text-gray-500">No se encontraron productos. Utilice la búsqueda o agregue un nuevo producto.</div>
          }
          
          {/* Lista de productos */}
          {!loading && !error && filtered.map((product: ProductForSelector, index: number) => (
            <div
              key={`product-${product.codigoCabys}-${index}`}
              className="p-3 dark:hover:bg-primary-500/10 hover:bg-primary-500/5 rounded-md cursor-pointer border-b dark:border-primary-500/10 border-primary-500/30 last:border-0 dark:bg-dark-500/40 bg-white mb-2"
              onClick={() => { onSelect(product); onClose(); }}
            >
              <div className="flex justify-between items-start">
                <div className="font-semibold dark:text-white text-gray-800">{product.detalle}</div>
                <div className="bg-primary-500/10 text-primary-600 dark:text-primary-400 text-xs py-1 px-2 rounded-md">
                  IVA: {product.impuesto || '13'}%
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="text-xs dark:text-gray-400 text-gray-600">
                  <span className="text-gray-500 dark:text-gray-500">CABYS:</span><br/>
                  {product.codigoCabys}
                </div>
                <div className="text-xs dark:text-gray-400 text-gray-600">
                  <span className="text-gray-500 dark:text-gray-500">Unidad:</span><br/>
                  {product.unidadMedida}
                </div>
                <div className="text-xs dark:text-gray-400 text-gray-600 text-right">
                  <span className="text-gray-500 dark:text-gray-500">Precio:</span><br/>
                  <span className="font-semibold dark:text-white text-gray-800">₡{product.precioUnitario.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
