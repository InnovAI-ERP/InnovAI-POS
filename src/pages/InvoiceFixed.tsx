import { useState } from 'react';
import { Search, PackagePlus } from 'lucide-react';
import ProductSelectorModal from '../components/ProductSelectorModal';
import NewProductModal from '../components/NewProductModal';

const InvoiceFixed = () => {
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(null);

  const handleProductSelect = (product: any) => {
    console.log('Producto seleccionado:', product);
    setIsProductModalOpen(false);
    setCurrentLineIndex(null);
  };

  const handleNewProductSaved = (product: any) => {
    console.log('Nuevo producto guardado:', product);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Crear Factura Electrónica</h1>
      </div>
      
      <form className="space-y-6">
        <div className="glass-card">
          <div className="p-4">
            {/* Contenido del formulario */}
            <div className="flex justify-end mb-6 gap-3">
              <button
                type="button"
                className="btn-primary flex items-center"
                onClick={() => setIsProductModalOpen(true)}
              >
                <Search className="w-4 h-4 mr-2" />
                Seleccionar Producto
              </button>
              <button
                type="button"
                className="btn-secondary flex items-center"
                onClick={() => setIsNewProductModalOpen(true)}
              >
                <PackagePlus className="w-4 h-4 mr-2" />
                Agregar Producto Nuevo
              </button>
            </div>
          </div>
        </div>
      </form>
      
      <ProductSelectorModal 
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setCurrentLineIndex(null);
        }}
        onSelect={handleProductSelect}
      />

      <NewProductModal
        isOpen={isNewProductModalOpen}
        onClose={() => setIsNewProductModalOpen(false)}
        onSave={handleNewProductSaved}
      />
    </div>
  );
};

export default InvoiceFixed;
