import React, { useState, useEffect, useRef, useContext } from 'react';
import axios from 'axios';
import { API, AuthContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Minus, Plus, Trash2, ShoppingCart, Barcode, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Sales() {
  const { user } = useContext(AuthContext);
  const [cart, setCart] = useState([]);
  const [products, setProducts] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const barcodeRef = useRef(null);

  useEffect(() => {
    fetchProducts();
    // Focus barcode input on mount
    if (barcodeRef.current) {
      barcodeRef.current.focus();
    }
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API}/products`);
      setProducts(response.data);
    } catch (error) {
      toast.error('Error al cargar productos');
    }
  };

  const calculateBestPrice = (quantity, product) => {
    if (!product.volume_pricing_enabled || !product.volume_prices || product.volume_prices.length === 0) {
      return {
        total_price: quantity * product.regular_price,
        unit_price: product.regular_price,
        savings: 0,
        promotion_applied: false
      };
    }

    const sortedPrices = [...product.volume_prices].sort((a, b) => b.quantity_min - a.quantity_min);

    for (const tier of sortedPrices) {
      if (quantity >= tier.quantity_min) {
        const total = tier.total_price * Math.floor(quantity / tier.quantity_min);
        const remaining = quantity % tier.quantity_min;
        let finalTotal = total + remaining * product.regular_price;

        const regularTotal = quantity * product.regular_price;
        return {
          total_price: finalTotal,
          unit_price: finalTotal / quantity,
          savings: regularTotal - finalTotal,
          promotion_applied: true
        };
      }
    }

    return {
      total_price: quantity * product.regular_price,
      unit_price: product.regular_price,
      savings: 0,
      promotion_applied: false
    };
  };

  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const product = products.find((p) => p.barcode === barcodeInput.trim());
    if (product) {
      addToCart(product);
    } else {
      toast.error('Producto no encontrado');
    }

    setBarcodeInput('');
    if (barcodeRef.current) {
      barcodeRef.current.focus();
    }
  };

  const addToCart = (product) => {
    const existingIndex = cart.findIndex((item) => item.product_id === product.id);

    if (existingIndex >= 0) {
      updateQuantity(existingIndex, cart[existingIndex].quantity + 1);
    } else {
      const pricing = calculateBestPrice(1, product);
      const newItem = {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: pricing.unit_price,
        total_price: pricing.total_price,
        regular_price: product.regular_price,
        savings: pricing.savings,
        promotion_applied: pricing.promotion_applied,
        product: product
      };
      setCart([...cart, newItem]);
      toast.success(`${product.name} agregado`);
    }
  };

  const updateQuantity = (index, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(index);
      return;
    }

    const item = cart[index];
    const product = item.product;

    if (newQuantity > product.stock) {
      toast.error('Stock insuficiente');
      return;
    }

    const pricing = calculateBestPrice(newQuantity, product);
    const updatedCart = [...cart];
    updatedCart[index] = {
      ...item,
      quantity: newQuantity,
      unit_price: pricing.unit_price,
      total_price: pricing.total_price,
      savings: pricing.savings,
      promotion_applied: pricing.promotion_applied
    };
    setCart(updatedCart);
  };

  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const getTotals = () => {
    const total = cart.reduce((sum, item) => sum + item.total_price, 0);
    const savings = cart.reduce((sum, item) => sum + item.savings, 0);
    return { total, savings };
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }

    setProcessing(true);
    try {
      const { total, savings } = getTotals();
      const saleData = {
        items: cart.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          regular_price: item.regular_price,
          savings: item.savings,
          promotion_applied: item.promotion_applied
        })),
        total_amount: total,
        total_savings: savings
      };

      await axios.post(`${API}/sales`, saleData);
      toast.success('Venta completada exitosamente');
      setCart([]);
      fetchProducts(); // Refresh stock
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al procesar venta');
    } finally {
      setProcessing(false);
      if (barcodeRef.current) {
        barcodeRef.current.focus();
      }
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
  };

  const { total, savings } = getTotals();

  return (
    <div className="space-y-6" data-testid="sales-page">
      <div>
        <h1 className="text-3xl font-bold text-green-800 mb-2">Punto de Venta</h1>
        <p className="text-green-600">Escanea o busca productos para agregar al carrito</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card data-testid="barcode-scanner">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Barcode className="w-5 h-5 text-green-600" />
                Escáner de Código de Barras
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
                <Input
                  ref={barcodeRef}
                  data-testid="barcode-input"
                  placeholder="Escanea o ingresa código de barras"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="text-lg"
                />
                <Button type="submit" className="btn-primary" data-testid="add-to-cart-button">
                  Agregar
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card data-testid="products-grid">
            <CardHeader>
              <CardTitle>Productos Disponibles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto">
                {products.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="p-4 border border-green-100 rounded-lg hover:bg-green-50 cursor-pointer transition-colors"
                    data-testid={`product-card-${product.id}`}
                  >
                    <p className="font-medium text-green-900 mb-1">{product.name}</p>
                    <p className="text-lg font-bold text-green-700">{formatCurrency(product.regular_price)}</p>
                    <p className="text-xs text-green-600 mt-1">Stock: {product.stock}</p>
                    {product.volume_pricing_enabled && (
                      <Badge className="mt-2 promotion-badge text-white text-xs">
                        Promoción
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-6" data-testid="cart">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-green-600" />
                  Carrito
                </span>
                <Badge className="bg-green-600 text-white">{cart.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.length === 0 ? (
                <p className="text-center text-green-500 py-8">El carrito está vacío</p>
              ) : (
                <>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {cart.map((item, index) => (
                      <div key={index} className="cart-item p-3 border border-green-100 rounded-lg" data-testid={`cart-item-${index}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-green-900">{item.product_name}</p>
                            {item.promotion_applied && (
                              <Badge className="promotion-badge text-white text-xs mt-1">
                                ¡Promoción aplicada!
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromCart(index)}
                            data-testid={`remove-item-${index}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(index, item.quantity - 1)}
                              data-testid={`decrease-quantity-${index}`}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="font-medium w-8 text-center" data-testid={`quantity-${index}`}>{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(index, item.quantity + 1)}
                              data-testid={`increase-quantity-${index}`}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-800">{formatCurrency(item.total_price)}</p>
                            {item.savings > 0 && (
                              <p className="text-xs text-green-600">Ahorro: {formatCurrency(item.savings)}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    {savings > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Ahorros totales:</span>
                        <span className="font-bold" data-testid="total-savings">{formatCurrency(savings)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xl font-bold text-green-800">
                      <span>Total:</span>
                      <span data-testid="cart-total">{formatCurrency(total)}</span>
                    </div>
                  </div>

                  <Button
                    onClick={handleCheckout}
                    disabled={processing}
                    className="w-full btn-primary text-lg py-6"
                    data-testid="checkout-button"
                  >
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    {processing ? 'Procesando...' : 'Completar Venta'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
