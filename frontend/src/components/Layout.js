import React, { useContext, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '@/App';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Package, ShoppingCart, FileText, LogOut, Snowflake, Menu, X } from 'lucide-react';

export default function Layout({ children }) {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/products', label: 'Inventario', icon: Package },
    { path: '/sales', label: 'Ventas', icon: ShoppingCart },
    { path: '/reports', label: 'Reportes', icon: FileText }
  ];

  return (
    <div className=\"min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50\" data-testid=\"layout\">
      <nav className=\"bg-white border-b border-green-100 shadow-sm sticky top-0 z-40\">
        <div className=\"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8\">
          <div className=\"flex justify-between h-14 md:h-16\">
            <div className=\"flex items-center\">
              <div className=\"flex items-center gap-2 md:gap-3\">
                <div className=\"bg-gradient-to-br from-green-500 to-emerald-600 p-1.5 md:p-2 rounded-lg\">
                  <Snowflake className=\"w-5 h-5 md:w-6 md:h-6 text-white\" />
                </div>
                <span className=\"text-lg md:text-2xl font-bold text-green-800\">FrozenPOS</span>
              </div>
              <div className=\"hidden md:ml-10 md:flex md:space-x-1\">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      data-testid={`nav-${item.label.toLowerCase()}`}
                      className={`px-3 lg:px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm ${
                        isActive
                          ? 'bg-green-100 text-green-800 font-medium'
                          : 'text-green-600 hover:bg-green-50'
                      }`}
                    >
                      <Icon className=\"w-4 h-4\" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
            
            <div className=\"flex items-center gap-2 md:gap-4\">
              <div className=\"text-right hidden sm:block\">
                <p className=\"text-xs md:text-sm font-medium text-green-800\" data-testid=\"user-name\">{user?.name}</p>
                <p className=\"text-xs text-green-600\">{user?.role === 'admin' ? 'Admin' : 'Vendedor'}</p>
              </div>
              <Button
                variant=\"outline\"
                size=\"sm\"
                onClick={handleLogout}
                className=\"border-green-200 hover:bg-green-50 hidden sm:flex\"
                data-testid=\"logout-button\"
              >
                <LogOut className=\"w-4 h-4\" />
              </Button>
              
              {/* Mobile menu button */}
              <Button
                variant=\"outline\"
                size=\"sm\"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className=\"md:hidden border-green-200\"
                data-testid=\"mobile-menu-button\"
              >
                {mobileMenuOpen ? <X className=\"w-5 h-5\" /> : <Menu className=\"w-5 h-5\" />}
              </Button>
            </div>
          </div>
          
          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className=\"md:hidden pb-4\" data-testid=\"mobile-menu\">
              <div className=\"space-y-1\">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      data-testid={`mobile-nav-${item.label.toLowerCase()}`}
                      className={`px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${
                        isActive
                          ? 'bg-green-100 text-green-800 font-medium'
                          : 'text-green-600 hover:bg-green-50'
                      }`}
                    >
                      <Icon className=\"w-5 h-5\" />
                      {item.label}
                    </Link>
                  );
                })}
                <div className=\"border-t border-green-100 mt-2 pt-2\">
                  <div className=\"px-4 py-2\">
                    <p className=\"text-sm font-medium text-green-800\">{user?.name}</p>
                    <p className=\"text-xs text-green-600\">{user?.role === 'admin' ? 'Administrador' : 'Vendedor'}</p>
                  </div>
                  <Button
                    variant=\"outline\"
                    size=\"sm\"
                    onClick={handleLogout}
                    className=\"mx-4 w-[calc(100%-2rem)] border-green-200 hover:bg-green-50\"
                    data-testid=\"mobile-logout-button\"
                  >
                    <LogOut className=\"w-4 h-4 mr-2\" />
                    Cerrar Sesi\u00f3n
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      <main className=\"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8\">{children}</main>
    </div>
  );
}
