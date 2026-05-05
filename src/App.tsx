
import { useEffect } from 'react';
import { BrowserRouter as Router, Navigate, Routes, Route } from 'react-router-dom';
import { fetchProducts } from './lib/api/products';
import RequireAdmin from './components/admin/RequireAdmin';
import OrderPage from './pages/OrderPage';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminLayout from './pages/admin/AdminLayout';
import OrdersPage from './pages/admin/OrdersPage';
import ProductsPage from './pages/admin/ProductsPage';
import WorkInProgressPage from './pages/admin/WorkInProgressPage';
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
          <Route index element={<Navigate to="/admin/pedidos" replace />} />
          <Route path="dashboard" element={<WorkInProgressPage tabName="Dashboard" />} />
          <Route path="financeiro" element={<WorkInProgressPage tabName="Financeiro" />} />
          <Route path="pedidos" element={<OrdersPage />} />
          <Route path="produtos" element={<ProductsPage />} />
          <Route path="recibos" element={<WorkInProgressPage tabName="Recibos" />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
