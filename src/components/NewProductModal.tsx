import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import ProductForm, { ProductFormData } from './ProductForm';
import { supabaseProductService } from '../services/supabaseProductService';

export interface NewProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: ProductFormData) => void;
}

export default function NewProductModal({ isOpen, onClose, onSave }: NewProductModalProps) {
  // Estado para mensajes de guardado
  const [saveMessage, setSaveMessage] = useState<string>('');
  
  // Determinar si debemos cerrar automáticamente el modal después del guardado
  // IMPORTANTE: Todos los hooks deben estar antes de cualquier retorno condicional
  useEffect(() => {
    if (saveMessage && !saveMessage.includes('Error')) {
      const timer = setTimeout(() => onClose(), 1500);
      return () => clearTimeout(timer);
    }
  }, [saveMessage, onClose]);
  
  const handleSave = async (product: ProductFormData) => {
    // Indicar que estamos procesando
    setSaveMessage('Guardando producto...');
    
    try {
      // Preparar objeto para Supabase con los campos necesarios
      // Nota: El campo company_id lo asigna automáticamente el servicio supabaseProductService
      const supabaseProduct: any = {
        code: product.codigoCabys || '',
        name: product.detalle || '',
        description: product.detalle || '',
        unit_price: product.precioUnitario || 0,
        unit_measure: product.unidadMedida || 'Sp',
        tax_rate: product.impuesto || 13,
        is_active: true,
      };
      
      // Añadir campos farmacéuticos solo si tienen valor
      if (product.forma_farmaceutica) {
        supabaseProduct.forma_farmaceutica = product.forma_farmaceutica;
      }
      
      if (product.registro_medicamento) {
        supabaseProduct.registro_medicamento = product.registro_medicamento;
      }
      
      if (product.numero_vin_serie) {
        supabaseProduct.numero_vin_serie = product.numero_vin_serie;
      }
      
      console.log('Guardando producto en Supabase:', supabaseProduct);
      
      // Guardar en Supabase
      const result = await supabaseProductService.createProduct(supabaseProduct);
      
      if (result.success && result.data) {
        console.log('Producto guardado con éxito en Supabase:', result.data);
        setSaveMessage('Producto guardado correctamente');
        
        // Convertir el resultado de Supabase a un formato compatible con el formulario
        // Usando campos del producto original cuando sea necesario
        const savedProduct: ProductFormData = {
          id: result.data.id,
          // Usar el código CABYS original ya que es el que conocemos
          codigoCabys: product.codigoCabys,
          // Usar datos del resultado de Supabase donde sea posible
          detalle: result.data.name || product.detalle,
          cantidad: product.cantidad || 1,
          unidadMedida: result.data.unit_measure || product.unidadMedida,
          precioUnitario: result.data.unit_price || product.precioUnitario,
          impuesto: result.data.tax_rate || product.impuesto || 13,
          // Campos farmacéuticos - transferir solo si existen
          ...(result.data.forma_farmaceutica ? { forma_farmaceutica: result.data.forma_farmaceutica } : 
             (product.forma_farmaceutica ? { forma_farmaceutica: product.forma_farmaceutica } : {})),
          ...(result.data.registro_medicamento ? { registro_medicamento: result.data.registro_medicamento } : 
             (product.registro_medicamento ? { registro_medicamento: product.registro_medicamento } : {})),
          ...(result.data.numero_vin_serie ? { numero_vin_serie: result.data.numero_vin_serie } : 
             (product.numero_vin_serie ? { numero_vin_serie: product.numero_vin_serie } : {})),
        };
        
        // Enviar el producto recién creado al componente padre
        onSave(savedProduct);
        
        // Limpiar mensaje después de 3 segundos
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        console.error('Error al guardar el producto en Supabase:', result.error);
        setSaveMessage(`Error al guardar el producto: ${result.error}`);
      }
    } catch (error) {
      console.error('Error inesperado al guardar el producto:', error);
      setSaveMessage('Error inesperado al guardar el producto');
    }
  };

  // Retorno condicional DESPUÉS de definir todos los hooks
  if (!isOpen) return null;

  return (
    <div className="modal-overlay z-50">
      <div className="modal max-w-3xl glass-card">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-semibold dark:text-white text-gray-800">Agregar Producto</h2>
          <button 
            onClick={onClose} 
            className="p-1.5 bg-red-500/20 text-red-400 rounded-md hover:bg-red-500/40 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {saveMessage && (
          <div className={`mb-4 p-3 rounded-md ${saveMessage.includes('Error') ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
            {saveMessage}
          </div>
        )}

        <ProductForm 
          onSave={handleSave} 
          onCancel={onClose} 
        />
      </div>
    </div>
  );
}
