import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, Tag } from 'lucide-react';
import { toast } from 'sonner';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    regular_price: '',
    category: '',
    stock: '',
    min_stock: '',
    volume_pricing_enabled: false,
    volume_prices: []
  });
  const [newVolumeTier, setNewVolumeTier] = useState({ quantity_min: '', total_price: '' });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API}/products`);
      setProducts(response.data);
    } catch (error) {
      toast.error('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        regular_price: parseFloat(formData.regular_price),
        stock: parseInt(formData.stock),
        min_stock: parseInt(formData.min_stock)
      };

      if (editingProduct) {
        await axios.put(`${API}/products/${editingProduct.id}`, data);
        toast.success('Producto actualizado');
      } else {
        await axios.post(`${API}/products`, data);
        toast.success('Producto creado');
      }

      fetchProducts();
      handleCloseDialog();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar producto');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este producto?')) return;
    try {
      await axios.delete(`${API}/products/${id}`);
      toast.success('Producto eliminado');
      fetchProducts();
    } catch (error) {
      toast.error('Error al eliminar producto');
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      regular_price: product.regular_price.toString(),
      category: product.category,
      stock: product.stock.toString(),
      min_stock: product.min_stock.toString(),
      volume_pricing_enabled: product.volume_pricing_enabled,
      volume_prices: product.volume_prices || []
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingProduct(null);
    setFormData({
      name: '',
      sku: '',
      barcode: '',
      regular_price: '',
      category: '',
      stock: '',
      min_stock: '',
      volume_pricing_enabled: false,
      volume_prices: []
    });
    setNewVolumeTier({ quantity_min: '', total_price: '' });
  };

  const addVolumeTier = () => {
    if (!newVolumeTier.quantity_min || !newVolumeTier.total_price) {
      toast.error('Completa todos los campos del nivel de precio');
      return;
    }

    const quantity_min = parseInt(newVolumeTier.quantity_min);
    const total_price = parseFloat(newVolumeTier.total_price);
    const unit_price = total_price / quantity_min;

    setFormData({
      ...formData,
      volume_prices: [...formData.volume_prices, { quantity_min, total_price, unit_price }].sort(
        (a, b) => a.quantity_min - b.quantity_min
      )
    });
    setNewVolumeTier({ quantity_min: '', total_price: '' });
  };

  const removeVolumeTier = (index) => {
    setFormData({
      ...formData,
      volume_prices: formData.volume_prices.filter((_, i) => i !== index)
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
  };

  return (
    <div className="space-y-4 md:space-y-6" data-testid="products-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-green-800 mb-2">Inventario</h1>
          <p className="text-sm md:text-base text-green-600">Gestión de productos y precios</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary w-full sm:w-auto" data-testid="add-product-button">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Producto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="product-dialog">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nombre</Label>
                  <Input
                    data-testid="product-name-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>SKU</Label>
                  <Input
                    data-testid="product-sku-input"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Código de Barras</Label>
                  <Input
                    data-testid="product-barcode-input"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Precio Regular</Label>
                  <Input
                    data-testid="product-price-input"
                    type="number"
                    step="0.01"
                    value={formData.regular_price}
                    onChange={(e) => setFormData({ ...formData, regular_price: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Categoría</Label>
                  <Input
                    data-testid="product-category-input"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Stock Actual</Label>
                  <Input
                    data-testid="product-stock-input"
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Stock Mínimo</Label>
                  <Input
                    data-testid="product-minstock-input"
                    type="number"
                    value={formData.min_stock}
                    onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <Label>Precios por Volumen</Label>
                  <Switch
                    data-testid="volume-pricing-switch"
                    checked={formData.volume_pricing_enabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, volume_pricing_enabled: checked })
                    }
                  />
                </div>

                {formData.volume_pricing_enabled && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        data-testid="volume-quantity-input"
                        type="number"
                        placeholder="Cantidad mínima"
                        value={newVolumeTier.quantity_min}
                        onChange={(e) => setNewVolumeTier({ ...newVolumeTier, quantity_min: e.target.value })}
                      />
                      <Input
                        data-testid="volume-price-input"
                        type="number"
                        step="0.01"
                        placeholder="Precio total"
                        value={newVolumeTier.total_price}
                        onChange={(e) => setNewVolumeTier({ ...newVolumeTier, total_price: e.target.value })}
                      />
                      <Button type="button" onClick={addVolumeTier} data-testid="add-volume-tier-button">
                        Agregar
                      </Button>
                    </div>

                    {formData.volume_prices.length > 0 && (
                      <div className="space-y-2">
                        {formData.volume_prices.map((tier, index) => (
                          <div
                            key={index}
                            className="flex justify-between items-center p-3 bg-green-50 rounded-lg"
                          >
                            <div>
                              <p className="font-medium">
                                {tier.quantity_min}+ unidades → {formatCurrency(tier.total_price)}
                              </p>
                              <p className="text-sm text-green-600">
                                {formatCurrency(tier.unit_price)} por unidad
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeVolumeTier(index)}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button type="submit" className="btn-primary" data-testid="save-product-button">
                  {editingProduct ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card data-testid="products-list">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-green-600">No hay productos registrados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-green-50 border-b border-green-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      Producto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      SKU / Código
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      Precio
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      Stock
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      Promociones
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-green-700 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-green-50">
                  {products.map((product) => (
                    <tr key={product.id} className="product-row">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-green-900">{product.name}</p>
                          <p className="text-sm text-green-600">{product.category}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div>
                          <p className="text-green-900">{product.sku}</p>
                          <p className="text-green-600">{product.barcode}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-green-900">
                        {formatCurrency(product.regular_price)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            product.stock <= product.min_stock
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {product.stock} unidades
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {product.volume_pricing_enabled && product.volume_prices?.length > 0 ? (
                          <Badge className="promotion-badge text-white">
                            <Tag className="w-3 h-3 mr-1" />
                            {product.volume_prices.length} niveles
                          </Badge>
                        ) : (
                          <span className="text-sm text-green-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(product)}
                          data-testid={`edit-product-${product.id}`}
                        >
                          <Edit className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(product.id)}
                          data-testid={`delete-product-${product.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
