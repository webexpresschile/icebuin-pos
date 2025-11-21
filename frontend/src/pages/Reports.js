import React, { useState } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, TrendingUp, Package, DollarSign, Tag, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

export default function Reports() {
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/reports/sales`, {
        params: {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString()
        }
      });
      setReport(response.data);
    } catch (error) {
      toast.error('Error al generar reporte');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    setExporting(true);
    try {
      const response = await axios.get(`${API}/reports/export-excel`, {
        params: {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString()
        },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const filename = `reporte_ventas_${format(startDate, 'yyyyMMdd')}_${format(endDate, 'yyyyMMdd')}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Reporte exportado exitosamente');
    } catch (error) {
      toast.error('Error al exportar reporte');
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
  };

  return (
    <div className="space-y-4 md:space-y-6" data-testid="reports-page">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-green-800 mb-2">Reportes</h1>
        <p className="text-sm md:text-base text-green-600">Análisis de ventas y promociones</p>
      </div>

      <Card data-testid="date-selector">
        <CardHeader>
          <CardTitle>Seleccionar Rango de Fechas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 md:gap-4 items-stretch sm:items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-sm">Fecha Inicio</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start mt-1" data-testid="start-date-button">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    <span className="text-sm">{format(startDate, 'PPP', { locale: es })}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex-1 min-w-[200px]">
              <Label className="text-sm">Fecha Fin</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start mt-1" data-testid="end-date-button">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    <span className="text-sm">{format(endDate, 'PPP', { locale: es })}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} />
                </PopoverContent>
              </Popover>
            </div>

            <Button onClick={fetchReport} disabled={loading} className="btn-primary w-full sm:w-auto" data-testid="generate-report-button">
              {loading ? 'Generando...' : 'Generar Reporte'}
            </Button>

            {report && (
              <Button
                onClick={exportToExcel}
                disabled={exporting}
                variant="outline"
                className="border-green-500 text-green-700 hover:bg-green-50 w-full sm:w-auto"
                data-testid="export-excel-button"
              >
                <FileDown className="w-4 h-4 mr-2" />
                {exporting ? 'Exportando...' : 'Exportar a Excel'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {report && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6" data-testid="report-summary">
            <Card className="stat-card border-green-100">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs md:text-sm font-medium text-green-700">Total Ventas</CardTitle>
                <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-lg md:text-2xl font-bold text-green-800" data-testid="total-sales">{report.summary.total_sales}</div>
              </CardContent>
            </Card>

            <Card className="stat-card border-green-100">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs md:text-sm font-medium text-green-700">Ingresos</CardTitle>
                <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-base md:text-2xl font-bold text-green-800" data-testid="total-revenue">
                  {formatCurrency(report.summary.total_revenue)}
                </div>
              </CardContent>
            </Card>

            <Card className="stat-card border-green-100">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs md:text-sm font-medium text-green-700">Ahorros</CardTitle>
                <Tag className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-base md:text-2xl font-bold text-green-800" data-testid="total-savings">
                  {formatCurrency(report.summary.total_savings)}
                </div>
              </CardContent>
            </Card>

            <Card className="stat-card border-green-100">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs md:text-sm font-medium text-green-700">Con Promo</CardTitle>
                <Package className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-lg md:text-2xl font-bold text-green-800" data-testid="promotion-sales">
                  {report.summary.promotion_sales}
                </div>
                <p className="text-xs text-green-600 mt-1">Regular: {report.summary.regular_sales}</p>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="top-products">
            <CardHeader>
              <CardTitle>Top 10 Productos Más Vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {report.top_products.map((product, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-4 bg-green-50 rounded-lg border border-green-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-green-900">{product.product_name}</p>
                        <p className="text-sm text-green-600">
                          {product.promotion_count} ventas con promoción · {product.regular_count} ventas regulares
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-800">{product.quantity} unidades</p>
                      <p className="text-sm text-green-600">{formatCurrency(product.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
