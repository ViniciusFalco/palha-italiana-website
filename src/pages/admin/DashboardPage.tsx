import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/AuthProvider';

type DeliveryOrder = {
  id: string;
  customer_name: string | null;
  delivery_date: string | null;
};

type PendingOrder = {
  id: string;
  customer_name: string | null;
  created_at: string;
};

type PaymentOrder = {
  id: string;
  customer_name: string | null;
  total_cents: number;
  payment_method: string | null;
  updated_at: string;
};

type FinishedOrder = {
  id: string;
  customer_name: string | null;
  updated_at: string;
};

const MAX_ITEMS = 5;

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: 'Pix',
  credit: 'Credito',
  debit: 'Debito',
  cash: 'Dinheiro',
};

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const parseDateValue = (value?: string | null) => {
  if (!value) return null;
  if (value.includes('T')) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parts = value.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts.map(Number);
    if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
      return new Date(year, month - 1, day);
    }
  }
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const formatDate = (value?: string | null) => {
  const parsed = parseDateValue(value);
  if (!parsed) return '--';
  return dateFormatter.format(parsed);
};

const formatCurrency = (cents?: number | null) => {
  if (typeof cents !== 'number' || Number.isNaN(cents)) return '--';
  return currencyFormatter.format(cents / 100);
};

const formatCustomer = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : 'Cliente sem nome';
};

const formatPaymentMethod = (value?: string | null) => {
  if (!value) return 'Nao informado';
  const key = value.toLowerCase();
  return PAYMENT_METHOD_LABELS[key] ?? value;
};

export default function DashboardPage() {
  const { withAuthRetry } = useAuth();
  const [loading, setLoading] = useState(true);
  const [deliveryToday, setDeliveryToday] = useState<DeliveryOrder[]>([]);
  const [stalePending, setStalePending] = useState<PendingOrder[]>([]);
  const [openPayments, setOpenPayments] = useState<PaymentOrder[]>([]);
  const [finishedOrders, setFinishedOrders] = useState<FinishedOrder[]>([]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);

    const [deliveryResult, pendingResult, paymentsResult, finishedResult] = await Promise.all([
      withAuthRetry(
        () =>
          supabase
            .from('orders')
            .select('id, customer_name, delivery_date')
            .eq('status', 'in_progress')
            .order('delivery_date', { ascending: true, nullsFirst: false })
            .limit(MAX_ITEMS),
        { label: 'dashboard-delivery-upcoming' }
      ),
      withAuthRetry(
        () =>
          supabase
            .from('orders')
            .select('id, customer_name, created_at')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(MAX_ITEMS),
        { label: 'dashboard-pending' }
      ),
      withAuthRetry(
        () =>
          supabase
            .from('orders')
            .select('id, customer_name, total_cents, payment_method, updated_at')
            .eq('payment_status', 'paid')
            .order('updated_at', { ascending: false })
            .limit(MAX_ITEMS),
        { label: 'dashboard-payments-paid' }
      ),
      withAuthRetry(
        () =>
          supabase
            .from('orders')
            .select('id, customer_name, updated_at')
            .eq('status', 'finished')
            .order('updated_at', { ascending: false })
            .limit(MAX_ITEMS),
        { label: 'dashboard-finished' }
      ),
    ]);

    if (deliveryResult.error && import.meta.env.DEV) {
      console.error('Erro ao carregar entregas proximas', deliveryResult.error);
    }
    if (pendingResult.error && import.meta.env.DEV) {
      console.error('Erro ao carregar pendencias', pendingResult.error);
    }
    if (paymentsResult.error && import.meta.env.DEV) {
      console.error('Erro ao carregar pagamentos realizados', paymentsResult.error);
    }
    if (finishedResult.error && import.meta.env.DEV) {
      console.error('Erro ao carregar pedidos concluidos', finishedResult.error);
    }

    setDeliveryToday((deliveryResult.data ?? []) as DeliveryOrder[]);
    setStalePending((pendingResult.data ?? []) as PendingOrder[]);
    setOpenPayments((paymentsResult.data ?? []) as PaymentOrder[]);
    setFinishedOrders((finishedResult.data ?? []) as FinishedOrder[]);
    setLoading(false);
  }, [withAuthRetry]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  return (
    <div className="admin-page dashboard-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-kicker">Visao geral</p>
          <h1 className="admin-page-title">Dashboard operacional</h1>
          <p className="admin-page-subtitle">
            Veja rapidamente o que esta acontecendo agora e o que precisa de atencao.
          </p>
        </div>
      </div>

      <section className="dashboard-grid">
        <article className="dashboard-block dashboard-block-primary">
          <header className="dashboard-block-header">
            <div>
              <p className="dashboard-block-kicker">Prioridade maxima</p>
              <h2 className="dashboard-block-title">Pedidos com entrega proxima</h2>
            </div>
          </header>
          {loading ? (
            <div className="dashboard-empty">Carregando...</div>
          ) : deliveryToday.length === 0 ? (
            <div className="dashboard-empty">Nenhum pedido com entrega proxima</div>
          ) : (
            <ul className="dashboard-list">
              {deliveryToday.slice(0, MAX_ITEMS).map((order) => (
                <li key={order.id} className="dashboard-item">
                  <div className="dashboard-item-row">
                    <span className="dashboard-item-name">{formatCustomer(order.customer_name)}</span>
                  </div>
                  <div className="dashboard-item-meta">Entrega: {formatDate(order.delivery_date)}</div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="dashboard-block dashboard-block-warning">
          <header className="dashboard-block-header">
            <div>
              <p className="dashboard-block-kicker">Atencao</p>
              <h2 className="dashboard-block-title">Pedidos pendentes</h2>
            </div>
          </header>
          {loading ? (
            <div className="dashboard-empty">Carregando...</div>
          ) : stalePending.length === 0 ? (
            <div className="dashboard-empty">Nenhum pedido pendente para aprovacao</div>
          ) : (
            <ul className="dashboard-list">
              {stalePending.slice(0, MAX_ITEMS).map((order) => (
                <li key={order.id} className="dashboard-item">
                  <div className="dashboard-item-row">
                    <span className="dashboard-item-name">{formatCustomer(order.customer_name)}</span>
                  </div>
                  <div className="dashboard-item-meta">Pedido em {formatDate(order.created_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="dashboard-block dashboard-block-success">
          <header className="dashboard-block-header">
            <div>
              <p className="dashboard-block-kicker">Financeiro</p>
              <h2 className="dashboard-block-title">Ultimos pagamentos realizados</h2>
            </div>
          </header>
          {loading ? (
            <div className="dashboard-empty">Carregando...</div>
          ) : openPayments.length === 0 ? (
            <div className="dashboard-empty">Nenhum pagamento registrado</div>
          ) : (
            <ul className="dashboard-list">
              {openPayments.slice(0, MAX_ITEMS).map((order) => (
                <li key={order.id} className="dashboard-item">
                  <div className="dashboard-item-row">
                    <span className="dashboard-item-name">{formatCustomer(order.customer_name)}</span>
                    <span className="dashboard-item-value">{formatCurrency(order.total_cents)}</span>
                  </div>
                  <div className="dashboard-item-meta">Metodo: {formatPaymentMethod(order.payment_method)}</div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="dashboard-block dashboard-block-success-soft">
          <header className="dashboard-block-header">
            <div>
              <p className="dashboard-block-kicker">Producao</p>
              <h2 className="dashboard-block-title">Pedidos concluidos</h2>
            </div>
          </header>
          {loading ? (
            <div className="dashboard-empty">Carregando...</div>
          ) : finishedOrders.length === 0 ? (
            <div className="dashboard-empty">Nenhum pedido concluido</div>
          ) : (
            <ul className="dashboard-list">
              {finishedOrders.slice(0, MAX_ITEMS).map((order) => (
                <li key={order.id} className="dashboard-item">
                  <div className="dashboard-item-row">
                    <span className="dashboard-item-name">{formatCustomer(order.customer_name)}</span>
                  </div>
                  <div className="dashboard-item-meta">Conclusao: {formatDate(order.updated_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </div>
  );
}
