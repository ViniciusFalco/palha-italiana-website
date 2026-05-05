import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FaChartLine,
  FaFileInvoiceDollar,
  FaHourglassHalf,
  FaWallet,
} from 'react-icons/fa6';
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminSkeleton,
} from '../../components/admin/AdminPrimitives';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/AuthProvider';

type PaidOrderRow = {
  total_cents: number | null;
  payment_method: string | null;
};

type PendingPaymentOrder = {
  id: string;
  customer_name: string | null;
  total_cents: number | null;
  payment_status: string | null;
  created_at: string;
  payment_due?: boolean | null;
};

type PaymentMethodSummary = {
  method: string;
  count: number;
  total_cents: number;
};

type ReceiptRow = {
  id: string;
  order_id: string;
  receipt_number: string;
  created_at: string;
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: 'Pix',
  credit: 'Credito',
  debit: 'Debito',
  cash: 'Dinheiro',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: 'Pago',
  due: 'Em aberto',
  pending: 'Pendente',
};

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const getMonthRange = (reference: Date) => {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1, 0, 0, 0, 0);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
};

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

const formatPaymentStatus = (value?: string | null) => {
  if (!value) return 'Nao informado';
  const normalized = value.toLowerCase();
  return PAYMENT_STATUS_LABELS[normalized] ?? value;
};

const formatPaymentMethod = (value?: string | null) => {
  if (!value) return 'Nao informado';
  const key = value.toLowerCase();
  return PAYMENT_METHOD_LABELS[key] ?? value;
};

const buildSkeletonList = (rows = 3) => (
  <ul className="dashboard-list">
    {Array.from({ length: rows }).map((_, index) => (
      <li key={`skeleton-${index}`} className="dashboard-item is-skeleton">
        <AdminSkeleton />
        <AdminSkeleton className="short" />
      </li>
    ))}
  </ul>
);

export default function FinanceDashboardPage() {
  const { withAuthRetry } = useAuth();
  const [loading, setLoading] = useState(true);
  const [monthRevenueCents, setMonthRevenueCents] = useState(0);
  const [monthPaidCount, setMonthPaidCount] = useState(0);
  const [pendingPayments, setPendingPayments] = useState<PendingPaymentOrder[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodSummary[]>([]);
  const [receiptsCount, setReceiptsCount] = useState(0);
  const [recentReceipts, setRecentReceipts] = useState<ReceiptRow[]>([]);

  const loadFinance = useCallback(async () => {
    setLoading(true);
    const { startISO, endISO } = getMonthRange(new Date());

    const [paidResult, pendingResult, receiptsCountResult, receiptsListResult] = await Promise.all([
      withAuthRetry(
        () =>
          supabase
            .from('orders')
            .select('total_cents, payment_method', { count: 'exact' })
            .eq('payment_status', 'paid')
            .gte('created_at', startISO)
            .lt('created_at', endISO),
        { label: 'finance-month-paid' }
      ),
      withAuthRetry(
        () =>
          supabase
            .from('orders')
            .select('id, customer_name, total_cents, payment_status, created_at, payment_due')
            .or('payment_due.eq.true,payment_status.neq.paid')
            .order('created_at', { ascending: false })
            .limit(5),
        { label: 'finance-pending' }
      ),
      withAuthRetry(
        () =>
          supabase
            .from('receipts')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', startISO)
            .lt('created_at', endISO),
        { label: 'finance-receipts-count' }
      ),
      withAuthRetry(
        () =>
          supabase
            .from('receipts')
            .select('id, order_id, receipt_number, created_at')
            .gte('created_at', startISO)
            .lt('created_at', endISO)
            .order('created_at', { ascending: false })
            .limit(5),
        { label: 'finance-receipts-list' }
      ),
    ]);

    if (paidResult.error && import.meta.env.DEV) {
      console.error('Erro ao carregar pagamentos do mes', paidResult.error);
    }
    if (pendingResult.error && import.meta.env.DEV) {
      console.error('Erro ao carregar pendencias financeiras', pendingResult.error);
    }
    if (receiptsCountResult.error && import.meta.env.DEV) {
      console.error('Erro ao carregar total de recibos', receiptsCountResult.error);
    }
    if (receiptsListResult.error && import.meta.env.DEV) {
      console.error('Erro ao carregar recibos recentes', receiptsListResult.error);
    }

    const paidRows = (paidResult.data ?? []) as PaidOrderRow[];
    const nextRevenue = paidRows.reduce((sum, row) => sum + (row.total_cents ?? 0), 0);
    const nextPaidCount = paidResult.count ?? paidRows.length;

    const methodMap = new Map<string, PaymentMethodSummary>();
    paidRows.forEach((row) => {
      const label = formatPaymentMethod(row.payment_method);
      const current = methodMap.get(label) ?? { method: label, count: 0, total_cents: 0 };
      current.count += 1;
      current.total_cents += row.total_cents ?? 0;
      methodMap.set(label, current);
    });

    const methodList = Array.from(methodMap.values()).sort((a, b) => b.total_cents - a.total_cents);

    setMonthRevenueCents(nextRevenue);
    setMonthPaidCount(nextPaidCount);
    setPendingPayments((pendingResult.data ?? []) as PendingPaymentOrder[]);
    setPaymentMethods(methodList);
    setReceiptsCount(receiptsCountResult.count ?? 0);
    setRecentReceipts((receiptsListResult.data ?? []) as ReceiptRow[]);
    setLoading(false);
  }, [withAuthRetry]);

  useEffect(() => {
    void loadFinance();
  }, [loadFinance]);

  return (
    <div className="admin-page finance-page">
      <AdminPageHeader
        kicker="Financeiro"
        title="Dashboard financeiro"
        subtitle="Receita do mes, pendencias e recibos em uma leitura mais limpa e segura."
      />

      <section className="dashboard-grid finance-grid">
        <article className="dashboard-block dashboard-block-primary">
          <header className="dashboard-block-header">
            <div>
              <p className="dashboard-block-kicker">Mes atual</p>
              <h2 className="dashboard-block-title">Resumo do mes</h2>
            </div>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-admin-stroke/75 bg-white/75 text-primary shadow-admin-soft">
              <FaWallet />
            </span>
          </header>
          {loading ? (
            <div className="finance-summary">
              <div className="finance-metric is-skeleton">
                <div className="dashboard-skeleton-line" />
                <div className="dashboard-skeleton-line short" />
              </div>
              <div className="finance-metric is-skeleton">
                <div className="dashboard-skeleton-line" />
                <div className="dashboard-skeleton-line short" />
              </div>
            </div>
          ) : (
            <div className="finance-summary">
              <div className="finance-metric">
                <span className="finance-metric-label">Receita do mes</span>
                <span className="finance-metric-value">{formatCurrency(monthRevenueCents)}</span>
              </div>
              <div className="finance-metric">
                <span className="finance-metric-label">Pedidos pagos no mes</span>
                <span className="finance-metric-value">{monthPaidCount}</span>
              </div>
            </div>
          )}
        </article>

        <article className="dashboard-block dashboard-block-warning">
          <header className="dashboard-block-header">
            <div>
              <p className="dashboard-block-kicker">Atencao</p>
              <h2 className="dashboard-block-title">Pendencias financeiras</h2>
            </div>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-admin-stroke/75 bg-white/75 text-primary shadow-admin-soft">
              <FaHourglassHalf />
            </span>
          </header>
          {loading ? (
            buildSkeletonList(4)
          ) : pendingPayments.length === 0 ? (
            <AdminEmptyState
              compact
              icon={<FaHourglassHalf />}
              title="Nenhuma pendencia financeira"
              description="Assim que houver pagamentos em aberto ou atrasados, eles aparecem aqui."
            />
          ) : (
            <ul className="dashboard-list">
              {pendingPayments.map((order) => (
                <li key={order.id} className="dashboard-item">
                  <div className="dashboard-item-row">
                    <span className="dashboard-item-name">{formatCustomer(order.customer_name)}</span>
                    <span className="dashboard-item-value">{formatCurrency(order.total_cents)}</span>
                  </div>
                  <div className="dashboard-item-meta">
                    Status: {formatPaymentStatus(order.payment_status)} • Pedido: {formatDate(order.created_at)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="dashboard-block dashboard-block-success">
          <header className="dashboard-block-header">
            <div>
              <p className="dashboard-block-kicker">Mes atual</p>
              <h2 className="dashboard-block-title">Meios de pagamento no mes</h2>
            </div>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-admin-stroke/75 bg-white/75 text-primary shadow-admin-soft">
              <FaChartLine />
            </span>
          </header>
          {loading ? (
            buildSkeletonList(3)
          ) : paymentMethods.length === 0 ? (
            <AdminEmptyState
              compact
              icon={<FaChartLine />}
              title="Nenhum pagamento no periodo"
              description="Os meios de pagamento se consolidam aqui conforme os pedidos forem pagos."
            />
          ) : (
            <ul className="dashboard-list">
              {paymentMethods.map((method) => (
                <li key={method.method} className="dashboard-item">
                  <div className="dashboard-item-row">
                    <span className="dashboard-item-name">{method.method}</span>
                    <span className="dashboard-item-value">{formatCurrency(method.total_cents)}</span>
                  </div>
                  <div className="dashboard-item-meta">Quantidade: {method.count}</div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="dashboard-block dashboard-block-success-soft">
          <header className="dashboard-block-header">
            <div>
              <p className="dashboard-block-kicker">Mes atual</p>
              <h2 className="dashboard-block-title">Recibos</h2>
              <p className="finance-block-helper">Total emitidos no mes: {receiptsCount}</p>
            </div>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-admin-stroke/75 bg-white/75 text-primary shadow-admin-soft">
              <FaFileInvoiceDollar />
            </span>
          </header>
          {loading ? (
            buildSkeletonList(3)
          ) : recentReceipts.length === 0 ? (
            <AdminEmptyState
              compact
              icon={<FaFileInvoiceDollar />}
              title="Nenhum recibo emitido"
              description="Quando os recibos forem gerados, os ultimos documentos aparecerao aqui."
            />
          ) : (
            <ul className="dashboard-list">
              {recentReceipts.map((receipt) => (
                <li key={receipt.id} className="dashboard-item">
                  <div className="dashboard-item-row">
                    <span className="dashboard-item-name">Recibo #{receipt.receipt_number}</span>
                    <Link to="/admin/recibos" className="dashboard-item-link">
                      Ver
                    </Link>
                  </div>
                  <div className="dashboard-item-meta">
                    Pedido: {receipt.order_id} • Data: {formatDate(receipt.created_at)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </div>
  );
}
