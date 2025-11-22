import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, ShoppingCart, Package, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsResponse, salesResponse] = await Promise.all([
        axios.get(`${API}/reports/dashboard`),
        axios.get(`${API}/sales/recent?limit=10`)
      ]);
      setStats(statsResponse.data);
      setRecentSales(salesResponse.data);
    } catch (error) {
      toast.error('Error al cargar estadísticas');
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
  };

  return (
    <div className="space-y-4 md:space-y-6" data-testid="dashboard">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-green-800 mb-2">Panel de Control</h1>
        <p className="text-sm md:text-base text-green-600">Resumen de operaciones del día</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <Card className="stat-card border-green-100" data-testid="revenue-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-green-700">Ingresos Hoy</CardTitle>
            <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg md:text-2xl font-bold text-green-800">{formatCurrency(stats?.today_revenue || 0)}</div>
          </CardContent>
        </Card>

        <Card className="stat-card border-green-100" data-testid="sales-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-green-700">Ventas Hoy</CardTitle>
            <ShoppingCart className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg md:text-2xl font-bold text-green-800">{stats?.today_sales_count || 0}</div>
          </CardContent>
        </Card>

        <Card className="stat-card border-green-100" data-testid="products-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-green-700">Total Productos</CardTitle>
            <Package className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg md:text-2xl font-bold text-green-800">{stats?.total_products || 0}</div>
          </CardContent>
        </Card>

        <Card className="stat-card border-orange-100" data-testid="low-stock-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-orange-700">Stock Bajo</CardTitle>
            <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg md:text-2xl font-bold text-orange-800">{stats?.low_stock_count || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {stats?.low_stock_products && stats.low_stock_products.length > 0 && (
          <Card className="border-orange-100" data-testid="low-stock-list">
            <CardHeader>
              <CardTitle className="text-base md:text-lg text-green-800">Productos con Stock Bajo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 md:space-y-3">
                {stats.low_stock_products.map((product) => (
                  <div
                    key={product.id}
                    className="flex justify-between items-center p-2 md:p-3 bg-orange-50 rounded-lg border border-orange-100"
                  >
                    <div>
                      <p className="font-medium text-orange-900 text-sm md:text-base">{product.name}</p>
                      <p className="text-xs md:text-sm text-orange-600">SKU: {product.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base md:text-lg font-bold text-orange-800">{product.stock}</p>
                      <p className="text-xs text-orange-600">Mín: {product.min_stock}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-green-100" data-testid="recent-sales-list">
          <CardHeader>
            <CardTitle className="text-base md:text-lg text-green-800 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Ventas Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentSales.length === 0 ? (
              <p className="text-center text-green-500 py-4 text-sm">No hay ventas registradas</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {recentSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="p-3 bg-green-50 rounded-lg border border-green-100 hover:bg-green-100 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="text-xs text-green-600">
                          {format(new Date(sale.created_at), 'PPp', { locale: es })}
                        </p>
                        <p className="text-sm font-medium text-green-900">{sale.seller_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-green-800">{formatCurrency(sale.total_amount)}</p>
                        {sale.total_savings > 0 && (
                          <p className="text-xs text-green-600">Ahorro: {formatCurrency(sale.total_savings)}</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {sale.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs text-green-700">
                          <span>{item.quantity}x {item.product_name}</span>
                          <span>{formatCurrency(item.total_price)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
