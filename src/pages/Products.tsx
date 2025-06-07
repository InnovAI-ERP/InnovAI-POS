import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Package, Loader2, AlertTriangle } from 'lucide-react';
import ProductForm, { ProductFormData } from '../components/ProductForm';
import { supabaseProductService } from '../services/supabaseProductService';
import { Product } from '../services/supabaseProductService';
import { useAuth } from '../hooks/useAuth';

// Función para convertir un producto de Supabase al formato ProductFormData
function mapSupabaseProductToFormData(product: Product): ProductFormData {
  return {
    id: product.id,
    detalle: product.name,
    codigoCabys: product.code || '',
    cantidad: 1, // Valor por defecto
    unidadMedida: product.unit_measure || 'Unid',
    precioUnitario: product.unit_price || 0,
    impuesto: product.tax_rate || 13,
    descuento: {
      montoDescuento: 0,
      naturalezaDescuento: ''
    },
    // Nuevos campos
    tipo_producto: product.tipo_producto?.toLowerCase() === 'bien' ? 'bien' : 
                  product.tipo_producto?.toLowerCase() === 'servicio' ? 'servicio' : 'servicio',
    costo_unitario: product.costo_unitario || 0,
    margen_ganancia: product.margen_ganancia || 0,
    numero_vin_serie: product.numero_vin_serie || '',
    registro_medicamento: product.registro_medicamento || '',
    forma_farmaceutica: product.forma_farmaceutica as any || undefined
  };
}

const Products = () => {
  const [products, setProducts] = useState<ProductFormData[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductFormData | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { user } = useAuth();
  
  // Cargar productos desde Supabase cuando el componente se monta
  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true);
        setError(null);
        
        console.log('🔄 Cargando productos desde Supabase...');
        const result = await supabaseProductService.getProducts(1, 1000); // Traer todos los productos
        
        if (!result.success) {
          throw new Error(result.error || 'Error al cargar los productos');
        }
        
        console.log(`✅ Productos cargados correctamente: ${result.data?.length || 0} productos`);
        
        // Convertir productos de Supabase al formato requerido por el formulario
        const mappedProducts = (result.data || []).map(mapSupabaseProductToFormData);
        setProducts(mappedProducts);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido al cargar productos';
        console.error('❌ Error al cargar productos:', errorMessage);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }
    
    loadProducts();
  }, []);

  const handleSaveProduct = async (productData: ProductFormData) => {
    try {
      setIsProcessing(true);
      
      if (editingProduct?.id) {
        // Actualizar producto existente en Supabase
        console.log(`✏️ Actualizando producto ${editingProduct.id} en Supabase...`);
        
        const result = await supabaseProductService.updateProduct(
          editingProduct.id,
          {
            code: productData.codigoCabys,
            name: productData.detalle,
            unit_price: productData.precioUnitario,
            tax_rate: productData.impuesto || 13,
            unit_measure: productData.unidadMedida,
            // Nuevos campos
            tipo_producto: productData.tipo_producto,
            costo_unitario: productData.costo_unitario,
            margen_ganancia: productData.margen_ganancia,
            numero_vin_serie: productData.numero_vin_serie,
            registro_medicamento: productData.registro_medicamento,
            forma_farmaceutica: productData.forma_farmaceutica
          }
        );
        
        if (!result.success) {
          throw new Error(result.error || 'Error al actualizar el producto');
        }
        
        // Actualizar la lista local
        setProducts(prevProducts => 
          prevProducts.map(p => p.id === editingProduct.id ? 
            { ...productData, id: editingProduct.id } : p
          )
        );
        
        setSuccessMessage('Producto actualizado correctamente');
      } else {
        // Agregar nuevo producto en Supabase
        console.log('➕ Creando nuevo producto en Supabase...');
        
        if (!user?.company_id) {
          throw new Error('No se pudo determinar la empresa actual');
        }
        
        const result = await supabaseProductService.createProduct({
          company_id: user.company_id,
          code: productData.codigoCabys,
          name: productData.detalle,
          unit_price: productData.precioUnitario,
          tax_rate: productData.impuesto || 13,
          unit_measure: productData.unidadMedida,
          is_active: true,
          // Nuevos campos
          tipo_producto: productData.tipo_producto,
          costo_unitario: productData.costo_unitario,
          margen_ganancia: productData.margen_ganancia,
          numero_vin_serie: productData.numero_vin_serie,
          registro_medicamento: productData.registro_medicamento,
          forma_farmaceutica: productData.forma_farmaceutica
        });
        
        if (!result.success || !result.data) {
          throw new Error(result.error || 'Error al crear el producto');
        }
        
        // Añadir el nuevo producto a la lista local
        const newMappedProduct = mapSupabaseProductToFormData(result.data);
        setProducts(prevProducts => [...prevProducts, newMappedProduct]);
        
        setSuccessMessage('Producto agregado correctamente');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      console.error('❌ Error al guardar producto:', errorMessage);
      setError(errorMessage);
      setTimeout(() => setError(null), 3000);
      return; // No continuar si hay error
    } finally {
      setIsProcessing(false);
    }
    
    // Limpiar estado
    setIsAdding(false);
    setEditingProduct(undefined);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleEdit = (product: ProductFormData) => {
    setEditingProduct(product);
    setIsAdding(true);
  };

  const handleDelete = async (id: string | undefined) => {
    if (!id) return;
    
    if (window.confirm('¿Está seguro que desea eliminar este producto?')) {
      try {
        setIsProcessing(true);
        console.log(`🚮 Eliminando producto ${id} de Supabase...`);
        
        const result = await supabaseProductService.deleteProduct(id);
        
        if (!result.success) {
          throw new Error(result.error || 'Error al eliminar el producto');
        }
        
        // Actualizar la lista local
        setProducts(prevProducts => prevProducts.filter(p => p.id !== id));
        setSuccessMessage('Producto eliminado correctamente');
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
        console.error('❌ Error al eliminar producto:', errorMessage);
        setError(errorMessage);
        setTimeout(() => setError(null), 3000);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const filteredProducts = products.filter((p) =>
    p.detalle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.codigoCabys.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl title-primary flex items-center gap-2">
          <Package className="w-6 h-6" /> Productos o Servicios
        </h1>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="btn-primary flex items-center"
            disabled={loading || isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Nuevo Producto
          </button>
        )}
      </div>
      
      {/* Mensaje de éxito */}
      {successMessage && (
        <div className="glass-card bg-green-500/20 border border-green-500/30 p-4 rounded-lg">
          <p className="text-green-300">{successMessage}</p>
        </div>
      )}
      
      {/* Mensaje de error */}
      {error && (
        <div className="glass-card bg-red-500/20 border border-red-500/30 p-4 rounded-lg flex items-center">
          <AlertTriangle className="w-5 h-5 text-red-400 mr-2" />
          <p className="text-red-300">{error}</p>
        </div>
      )}
      
      {/* Estado de carga */}
      {loading && (
        <div className="glass-card p-12 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin mb-4" />
          <p className="text-gray-400">Cargando productos...</p>
        </div>
      )}
      
      {/* Tabla de productos */}
      {!isAdding && !loading ? (
        <div className="glass-card">
          <div className="p-4 border-b border-primary-500/30">
            <div className="flex items-center relative">
              <Search className="w-4 h-4 text-gray-400 absolute ml-3" />
              <input
                className="form-input w-full pl-10"
                placeholder="Buscar por nombre o código CABYS..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="table-header rounded-tl-lg">Detalle</th>
                  <th className="table-header">Código CABYS</th>
                  <th className="table-header">Cantidad</th>
                  <th className="table-header">Unidad</th>
                  <th className="table-header">Precio Unitario</th>
                  <th className="table-header">Descuento</th>
                  <th className="table-header rounded-tr-lg">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="table-row">
                    <td className="table-cell">{product.detalle}</td>
                    <td className="table-cell">{product.codigoCabys}</td>
                    <td className="table-cell">{product.cantidad}</td>
                    <td className="table-cell">{product.unidadMedida}</td>
                    <td className="table-cell">₡{product.precioUnitario.toLocaleString()}</td>
                    <td className="table-cell">{product.descuento?.montoDescuento || 0}</td>
                    <td className="table-cell">
                      <button
                        className="p-1.5 bg-primary-500/20 text-primary-400 rounded-md hover:bg-primary-500/40 transition-colors mr-2"
                        onClick={() => handleEdit(product)}
                        disabled={isProcessing}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1.5 bg-red-500/20 text-red-400 rounded-md hover:bg-red-500/40 transition-colors"
                        onClick={() => product.id && handleDelete(product.id)}
                        disabled={isProcessing}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr className="table-row">
                    <td colSpan={7} className="table-cell text-center text-gray-400 py-8">
                      No se encontraron productos o servicios.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      
      {/* Formulario de producto */}
      {isAdding && (
        <ProductForm 
          onSave={handleSaveProduct}
          onCancel={() => {
            setIsAdding(false);
            setEditingProduct(undefined);
          }}
          initialData={editingProduct}
          title={editingProduct ? "Editar Producto o Servicio" : "Nuevo Producto o Servicio"}
        />
      )}
    </div>
  );
};

export default Products;
