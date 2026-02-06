
import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { fetchProducts } from './lib/api/products';
import RequireAdmin from './components/admin/RequireAdmin';
import OrderPage from './pages/OrderPage';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminLayout from './pages/admin/AdminLayout';
import DashboardPage from './pages/admin/DashboardPage';
import FinanceDashboardPage from './pages/admin/FinanceDashboardPage';
import OrdersPage from './pages/admin/OrdersPage';
import ProductsPage from './pages/admin/ProductsPage';
import ReceiptsPage from './pages/admin/ReceiptsPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ForgotPasswordPage from './pages/admin/ForgotPasswordPage';




function App() {
  useEffect(() => {
    fetchProducts().then(console.log).catch(console.error);
  }, []);
  

  return (
    <Router>
      <Routes>
        <Route path="/" element={<OrderPage />} />
        <Route path="/pedidos" element={<OrderPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/forgot-password" element={<ForgotPasswordPage />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="financeiro" element={<FinanceDashboardPage />} />
          <Route path="pedidos" element={<OrdersPage />} />
          <Route path="produtos" element={<ProductsPage />} />
          <Route path="recibos" element={<ReceiptsPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
