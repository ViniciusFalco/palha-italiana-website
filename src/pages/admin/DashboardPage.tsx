import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  FaBoxOpen,
  FaClipboardCheck,
  FaMoneyBillTrendUp,
  FaStar,
} from 'react-icons/fa6';
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminSkeleton,
} from '../../components/admin/AdminPrimitives';
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

type DashboardPanelProps = {
  emptyDescription: string;
  emptyTitle: string;
  icon: ReactNode;
  kicker: string;
  loading: boolean;
  title: string;
  toneClassName: string;
  children: ReactNode;
};

function DashboardPanel({
  children,
  emptyDescription,
  emptyTitle,
  icon,
  kicker,
  loading,
  title,
  toneClassName,
}: DashboardPanelProps) {
  return (
    <article className={`dashboard-block ${toneClassName}`}>
      <header className="dashboard-block-header">
        <div>
          <p className="dashboard-block-kicker">{kicker}</p>
          <h2 className="dashboard-block-title">{title}</h2>
        </div>
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-admin-stroke/75 bg-white/75 text-primary shadow-admin-soft">
          {icon}
        </span>
      </header>
      {loading ? (
        <ul className="dashboard-list">
          {Array.from({ length: 4 }).map((_, index) => (
            <li key={`dashboard-skeleton-${index}`} className="dashboard-item is-skeleton">
              <AdminSkeleton />
              <AdminSkeleton className="short" />
            </li>
          ))}
        </ul>
      ) : (
        children || (
          <AdminEmptyState
            compact
            description={emptyDescription}
            icon={icon}
            title={emptyTitle}
          />
        )
      )}
    </article>
  );
}

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
      <AdminPageHeader
        kicker="Visao geral"
        title="Dashboard operacional"
        subtitle=""
      />

      <section className="dashboard-grid">
        <DashboardPanel
          toneClassName="dashboard-block-primary"
          kicker="Agenda"
          title="Pedidos com entrega proxima"
          icon={<FaStar />}
          loading={loading}
          emptyTitle="Nenhuma entrega critica no momento"
          emptyDescription="Assim que um pedido em andamento se aproximar da data de entrega, ele aparecera aqui."
        >
          {deliveryToday.length > 0 ? (
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
          ) : null}
        </DashboardPanel>

        <DashboardPanel
          toneClassName="dashboard-block-warning"
          kicker="Atencao"
          title="Pedidos pendentes"
          icon={<FaClipboardCheck />}
          loading={loading}
          emptyTitle="Nada aguardando aprovacao"
          emptyDescription="Os novos pedidos pendentes aparecerao aqui para voce destravar o fluxo rapidamente."
        >
          {stalePending.length > 0 ? (
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
          ) : null}
        </DashboardPanel>

        <DashboardPanel
          toneClassName="dashboard-block-success"
          kicker="Financeiro"
          title="Ultimos pagamentos realizados"
          icon={<FaMoneyBillTrendUp />}
          loading={loading}
          emptyTitle="Nenhum pagamento registrado"
          emptyDescription="Quando houver pagamentos confirmados, o resumo financeiro recente aparece aqui."
        >
          {openPayments.length > 0 ? (
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
          ) : null}
        </DashboardPanel>

        <DashboardPanel
          toneClassName="dashboard-block-success-soft"
          kicker="Producao"
          title="Pedidos concluidos"
          icon={<FaBoxOpen />}
          loading={loading}
          emptyTitle="Sem pedidos concluidos agora"
          emptyDescription="Os pedidos finalizados recentemente ficam reunidos aqui para uma leitura rapida."
        >
          {finishedOrders.length > 0 ? (
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
          ) : null}
        </DashboardPanel>
      </section>
    </div>
  );
}
