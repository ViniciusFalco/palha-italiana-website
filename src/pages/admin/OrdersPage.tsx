import { useCallback, useEffect, useMemo, useState } from 'react';
import { FaRegCopy, FaSearch } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/AuthProvider';

type OrderStatus = 'pending' | 'in_progress' | 'finished' | 'rejected' | 'canceled';

type OrderItem = {
  id?: string;
  product_id?: string | null;
  product_option_id?: string | null;
  quantity: number;
  unit_price_cents: number;
  subtotal_cents: number;
  flavor?: string | null;
  coverage?: string | null;
  size?: string | null;
  ribbon_width?: string | null;
  ribbon_color?: string | null;
  form_color?: string | null;
  product?: { name?: string | null; sku?: string | null } | null;
  product_option?: { option_name?: string | null } | null;
  details?: Array<{ id: string; value: string; field?: { label?: string | null } | null }>;
};

type Order = {
  id: string;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email?: string | null;
  note?: string | null;
  event_date?: string | null;
  total_cents: number;
  status: OrderStatus;
  delivery_date?: string | null;
  payment_due?: boolean | null;
  payment_method?: string | null;
  payment_status?: string | null;
  rejection_reason_text?: string | null;
  cancellation_reason_code?: string | null;
  cancellation_reason_text?: string | null;
  last_whatsapp_sent_at?: string | null;
  order_items?: OrderItem[];
};

type OrderSummaryRow = Pick<Order, 'id' | 'status' | 'created_at' | 'delivery_date' | 'customer_name'>;

type ToastVariant = 'info' | 'success' | 'warning' | 'error';

type Toast = {
  id: string;
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
};

const STATUS_TABS: Array<{ value: OrderStatus; label: string }> = [
  { value: 'pending', label: 'Pendente' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'finished', label: 'Concluído' },
  { value: 'rejected', label: 'Reprovado' },
  { value: 'canceled', label: 'Cancelado' },
];

const EMPTY_LABEL = 'Não informado';
const ORDERS_STATE_KEY = 'admin-orders-state';
const ORDERS_TOAST_KEY = 'admin-orders-toast-shown';
const SHORT_ID_LENGTH = 8;
const THREE_DAYS_MS = 1000 * 60 * 60 * 24 * 3;
const METRICS_EVENT = 'admin-metrics-refresh';

const notifyMetricsRefresh = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(METRICS_EVENT));
};

const PAYMENT_METHOD_OPTIONS = [
  { value: 'pix', label: 'Pix' },
  { value: 'credit', label: 'Crédito' },
  { value: 'debit', label: 'Débito' },
  { value: 'cash', label: 'Dinheiro' },
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: 'Pix',
  credit: 'Crédito',
  debit: 'Débito',
  cash: 'Dinheiro',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: 'Pago',
  due: 'Em aberto',
  pending: 'Pendente',
  debit: 'Débito',
};

const DEFAULT_STATUS_COUNTS: Record<OrderStatus, number> = {
  pending: 0,
  in_progress: 0,
  finished: 0,
  rejected: 0,
  canceled: 0,
};

const ORDER_SELECT_WITH_ITEMS = `
  id,
  created_at,
  customer_name,
  customer_phone,
  customer_email,
  note,
  event_date,
  total_cents,
  status,
  delivery_date,
  payment_due,
  payment_method,
  payment_status,
  rejection_reason_text,
  cancellation_reason_code,
  cancellation_reason_text,
  last_whatsapp_sent_at,
  order_items (
    id,
    order_id,
    product_id,
    product_option_id,
    quantity,
    unit_price_cents,
    subtotal_cents,
    flavor,
    coverage,
    size,
    ribbon_width,
    ribbon_color,
    form_color,
    product:products (name, sku),
    product_option:product_options (option_name),
    details:order_item_details (
      id,
      value,
      field:product_detail_fields (label)
    )
  )
`;

const loadStoredOrdersState = () => {
  if (typeof window === 'undefined') {
    return { status: 'pending' as OrderStatus, search: '' };
  }
  try {
    const raw = sessionStorage.getItem(ORDERS_STATE_KEY);
    if (!raw) {
      return { status: 'pending' as OrderStatus, search: '' };
    }
    const parsed = JSON.parse(raw) as { status?: OrderStatus; search?: string };
    const status = STATUS_TABS.some((tab) => tab.value === parsed.status)
      ? (parsed.status as OrderStatus)
      : ('pending' as OrderStatus);
    const search = typeof parsed.search === 'string' ? parsed.search : '';
    return { status, search };
  } catch {
    return { status: 'pending' as OrderStatus, search: '' };
  }
};

const formatShortId = (id: string, length = SHORT_ID_LENGTH) =>
  id.length > length ? `${id.slice(0, length)}…` : id;

const formatOptionalText = (value?: string | null, fallback = EMPTY_LABEL) => {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
};

const formatPaymentMethod = (value?: string | null) => {
  if (!value) return EMPTY_LABEL;
  const normalized = value.toLowerCase();
  return PAYMENT_METHOD_LABELS[normalized] ?? value;
};

const formatPaymentStatus = (value?: string | null) => {
  if (!value) return EMPTY_LABEL;
  const normalized = value.toLowerCase();
  return PAYMENT_STATUS_LABELS[normalized] ?? value;
};

const formatPaymentDue = (value?: boolean | null) => {
  if (value === null || value === undefined) return EMPTY_LABEL;
  return value ? 'Sim' : 'Não';
};

const isSameDay = (value: string | null | undefined, reference: Date) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
};

const getOrderItemDisplayName = (item: OrderItem) => {
  const baseName = item.product?.name?.trim() || 'Item';
  const optionName = item.product_option?.option_name?.trim();
  return optionName ? `${baseName} (${optionName})` : baseName;
};

const getOrderItemMetaText = (item: OrderItem) => {
  const parts = [
    item.flavor && `Sabor: ${item.flavor}`,
    item.coverage && `Cobertura: ${item.coverage}`,
    item.size && `Tamanho: ${item.size}`,
    item.ribbon_width && `Fita: ${item.ribbon_width}`,
    item.ribbon_color && `Cor: ${item.ribbon_color}`,
    item.form_color && `Forminha: ${item.form_color}`,
  ].filter(Boolean) as string[];

  const extras = (item.details ?? [])
    .map((detail) => {
      const label = detail.field?.label ?? 'Campo';
      const value = (detail.value ?? '').trim();
      if (!value) return null;
      return `${label}: ${value}`;
    })
    .filter(Boolean) as string[];

  if (extras.length) parts.push(`Extras: ${extras.join('; ')}`);

  return parts.join(' • ');
};

const formatCurrency = (cents?: number | null) => {
  if (cents === null || cents === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
};

const formatDateTime = (value?: string | null) => {
  if (!value) return EMPTY_LABEL;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY_LABEL;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

const formatDate = (value?: string | null) => {
  if (!value) return EMPTY_LABEL;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY_LABEL;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date);
};

const statusClass = (status: OrderStatus) => {
  switch (status) {
    case 'pending':
      return 'admin-pill admin-pill-pendente';
    case 'in_progress':
      return 'admin-pill admin-pill-in_progress';
    case 'finished':
      return 'admin-pill admin-pill-finished';
    case 'rejected':
      return 'admin-pill admin-pill-reprovado';
    case 'canceled':
    default:
      return 'admin-pill admin-pill-canceled';
  }
};

export default function OrdersPage() {
  const { withAuthRetry } = useAuth();
  const storedState = useMemo(() => loadStoredOrdersState(), []);
  const [statusFilter, setStatusFilter] = useState<OrderStatus>(storedState.status);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(storedState.search);
  const [statusCounts, setStatusCounts] = useState<Record<OrderStatus, number>>(DEFAULT_STATUS_COUNTS);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (message: string, options?: { variant?: ToastVariant; durationMs?: number }) => {
      const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const toast: Toast = {
        id,
        message,
        variant: options?.variant ?? 'info',
        durationMs: options?.durationMs ?? 8000,
      };
      setToasts((prev) => [...prev, toast]);
      if (typeof window !== 'undefined' && toast.durationMs && toast.durationMs > 0) {
        window.setTimeout(() => removeToast(id), toast.durationMs);
      }
    },
    [removeToast]
  );

  const handleCopyId = useCallback(
    async (id: string) => {
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(id);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = id;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
        pushToast('ID copiado.', { variant: 'success', durationMs: 4000 });
      } catch {
        pushToast('Não foi possível copiar o ID.', { variant: 'error' });
      }
    },
    [pushToast]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(
      ORDERS_STATE_KEY,
      JSON.stringify({
        status: statusFilter,
        search,
      })
    );
  }, [statusFilter, search]);

  const loadStatusCounts = useCallback(async () => {
    const { data, error: countsError } = await withAuthRetry(
      () => supabase.from('orders').select('status'),
      { label: 'load-order-status-counts' }
    );
    if (countsError) {
      if (import.meta.env.DEV) {
        console.error('Erro ao carregar contadores de status', {
          message: countsError.message,
          details: (countsError as any)?.details,
          hint: (countsError as any)?.hint,
          code: (countsError as any)?.code,
        });
      }
      return;
    }

    const nextCounts = { ...DEFAULT_STATUS_COUNTS };
    (data ?? []).forEach((row) => {
      const status = (row as { status?: OrderStatus }).status;
      if (status && status in nextCounts) {
        nextCounts[status] += 1;
      }
    });
    setStatusCounts(nextCounts);
  }, [withAuthRetry]);

  const loadNotifications = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(ORDERS_TOAST_KEY)) return;

    const { data, error: summaryError } = await withAuthRetry(
      () =>
        supabase
          .from('orders')
          .select('id, status, created_at, delivery_date, customer_name')
          .in('status', ['pending', 'in_progress']),
      { label: 'load-order-notifications' }
    );

    if (summaryError) {
      if (import.meta.env.DEV) {
        console.error('Erro ao carregar notificações de pedidos', {
          message: summaryError.message,
          details: (summaryError as any)?.details,
          hint: (summaryError as any)?.hint,
          code: (summaryError as any)?.code,
        });
      }
      sessionStorage.setItem(ORDERS_TOAST_KEY, new Date().toISOString());
      return;
    }

    const rows = (data ?? []) as OrderSummaryRow[];
    const pendingOrders = rows.filter((row) => row.status === 'pending');
    if (pendingOrders.length > 0) {
      pushToast(`Existem ${pendingOrders.length} pedidos pendentes.`, { variant: 'info' });
    }

    const now = Date.now();
    const stalePending = pendingOrders.filter((row) => {
      const createdAt = new Date(row.created_at).getTime();
      return Number.isFinite(createdAt) && now - createdAt > THREE_DAYS_MS;
    });
    if (stalePending.length > 0) {
      pushToast(`Atenção: existem ${stalePending.length} pedidos pendentes há mais de 3 dias.`, {
        variant: 'warning',
      });
    }

    const today = new Date();
    const inProgressToday = rows.filter(
      (row) => row.status === 'in_progress' && isSameDay(row.delivery_date, today)
    );
    if (inProgressToday.length > 0) {
      const references = inProgressToday.slice(0, 2).map((row) => {
        const shortId = formatShortId(row.id);
        const name = row.customer_name?.trim();
        return name ? `${name} (${shortId})` : `#${shortId}`;
      });
      const referenceText = references.length ? ` Ex.: ${references.join(', ')}.` : '';
      pushToast(
        `Entrega para hoje: ${inProgressToday.length} pedido(s) em andamento com entrega hoje.${referenceText}`,
        { variant: 'info' }
      );
    }

    sessionStorage.setItem(ORDERS_TOAST_KEY, new Date().toISOString());
  }, [pushToast, withAuthRetry]);

  const loadOrders = useCallback(
    async (opts?: { keepSelection?: boolean }) => {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await withAuthRetry(
        () =>
          supabase
            .from('orders')
            .select(ORDER_SELECT_WITH_ITEMS)
            .eq('status', statusFilter)
            .order('created_at', { ascending: false }),
        { label: 'load-orders' }
      );

      if (fetchError) {
        if (import.meta.env.DEV) {
          console.error('Erro ao carregar pedidos', {
            message: fetchError.message,
            details: (fetchError as any)?.details,
            hint: (fetchError as any)?.hint,
            code: (fetchError as any)?.code,
          });
        }
        setError('Não foi possível carregar os pedidos agora.');
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as Order[];
      setOrders(rows);
      setLoading(false);
      void loadStatusCounts();
      if (opts?.keepSelection) {
        notifyMetricsRefresh();
      }

      if (opts?.keepSelection && selectedOrder) {
        const refreshed = rows.find((o) => o.id === selectedOrder.id);
        if (refreshed) setSelectedOrder(refreshed);
      }
    },
    [loadStatusCounts, selectedOrder, statusFilter, withAuthRetry]
  );

  useEffect(() => {
    void loadOrders();
  }, [loadOrders, statusFilter]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const filteredOrders = useMemo(() => {
    if (!search.trim()) return orders;
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      const name = order.customer_name?.toLowerCase() ?? '';
      const phone = order.customer_phone?.toLowerCase() ?? '';
      const id = order.id.toLowerCase();
      return name.includes(term) || phone.includes(term) || id.includes(term);
    });
  }, [orders, search]);

  const hasOrders = filteredOrders.length > 0;

  return (
    <div className="admin-page">
      {toasts.length > 0 && (
        <div className="admin-toast-stack" role="region" aria-live="polite">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`admin-toast admin-toast-${toast.variant ?? 'info'}`}
              role={toast.variant === 'error' ? 'alert' : 'status'}
            >
              <span>{toast.message}</span>
              <button
                type="button"
                className="admin-toast-close"
                onClick={() => removeToast(toast.id)}
                aria-label="Fechar notificação"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="admin-page-header">
        <div>
          <p className="admin-page-kicker">Operação</p>
          <h1 className="admin-page-title">Pedidos</h1>
          <p className="admin-page-subtitle">Acompanhe pedidos por status e avance o fluxo.</p>
        </div>
      </div>

      <div className="admin-table-shell">
        <div className="admin-table-headerbar" style={{ gap: 18, flexWrap: 'wrap' }}>
          <div>
            <p className="admin-section-kicker">Filtrar</p>
            <h3 className="admin-table-title">Pedidos por status</h3>
            <p className="admin-table-subtitle">
              Pendentes, em andamento, concluídos, reprovados ou cancelados.
            </p>
            <p className="admin-helper-text">Contadores consideram todos os pedidos, mesmo com busca.</p>
          </div>
          <div className="admin-section-actions" style={{ flexWrap: 'wrap' }}>
            <div className="admin-table-actions" style={{ gap: 6 }}>
              {STATUS_TABS.map((tab) => {
                const count = statusCounts[tab.value] ?? 0;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    className={`admin-button-small admin-status-tab ${
                      statusFilter === tab.value ? '' : 'admin-button-ghost'
                    }`}
                    onClick={() => setStatusFilter(tab.value)}
                    aria-pressed={statusFilter === tab.value}
                  >
                    <span>{tab.label}</span>
                    <span className="admin-status-count">({count})</span>
                  </button>
                );
              })}
            </div>
            <div className="admin-input-inline" style={{ minWidth: 240 }}>
              <FaSearch />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="admin-input"
                placeholder="Buscar por nome, telefone ou ID"
              />
            </div>
          </div>
        </div>

        <div className="admin-table-scroll">
          <div className="admin-table">
            <div className="admin-table-header admin-table-header-generic">
              <div>ID</div>
              <div className="admin-cell-left">Cliente</div>
              <div>Status</div>
              <div>Data</div>
              <div className="admin-col-number">Total</div>
              <div className="admin-col-actions">Ações</div>
            </div>

            {loading && (
              <div className="admin-table-row admin-table-row-generic admin-row-skeleton">
                <div className="admin-skeleton-line" />
                <div className="admin-skeleton-line" />
                <div className="admin-skeleton-pill" />
                <div className="admin-skeleton-line short" />
                <div className="admin-skeleton-line short" />
                <div className="admin-table-actions">
                  <div className="admin-skeleton-button" />
                </div>
              </div>
            )}

            {!loading && hasOrders ? (
              filteredOrders.map((order) => (
                <div key={order.id} className="admin-table-row admin-table-row-generic">
                  <div className="admin-cell-strong admin-id-cell" title={order.id}>
                    <span className="admin-id-text">{formatShortId(order.id)}</span>
                    <button
                      type="button"
                      className="admin-copy-button"
                      onClick={() => handleCopyId(order.id)}
                      aria-label="Copiar ID completo"
                      title="Copiar ID completo"
                    >
                      <FaRegCopy aria-hidden="true" focusable="false" />
                    </button>
                  </div>
                  <div className="admin-cell-text admin-cell-left" title={order.customer_name ?? 'Sem nome'}>
                    {order.customer_name ?? 'Sem nome'}
                  </div>
                  <div>
                    <span className={statusClass(order.status)}>{STATUS_TABS.find((s) => s.value === order.status)?.label}</span>
                  </div>
                  <div>{formatDate(order.created_at)}</div>
                  <div className="admin-col-number">{formatCurrency(order.total_cents)}</div>
                  <div className="admin-table-actions">
                    <button
                      type="button"
                      className="admin-button-small admin-button-ghost"
                      onClick={() => setSelectedOrder(order)}
                    >
                      Detalhes
                    </button>
                  </div>
                </div>
              ))
            ) : (
              !loading && (
                <div className="admin-empty-row">
                  <div>
                    <p className="admin-empty-title">Nenhum pedido encontrado</p>
                    <p className="admin-empty-helper">Ajuste filtros, status ou faça nova busca.</p>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
        <div className="admin-table-footer">
          <span>
            {loading ? 'Carregando...' : hasOrders ? `${filteredOrders.length} pedido(s)` : 'Nenhum pedido listado'}
          </span>
          <div className="admin-table-actions">
            <button type="button" className="admin-button-ghost admin-button-small" onClick={() => loadOrders({ keepSelection: true })}>
              Atualizar
            </button>
          </div>
        </div>
      </div>

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdated={() => loadOrders({ keepSelection: true })}
          setSelectedOrder={setSelectedOrder}
          onToast={pushToast}
        />
      )}

      {error && <div className="admin-inline-error">{error}</div>}
    </div>
  );
}

type OrderDetailModalProps = {
  order: Order;
  onClose: () => void;
  onUpdated: () => void;
  setSelectedOrder: (order: Order | null) => void;
  onToast: (message: string, options?: { variant?: ToastVariant; durationMs?: number }) => void;
};

function OrderDetailModal({ order, onClose, onUpdated, setSelectedOrder, onToast }: OrderDetailModalProps) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const canDelete = order.status === 'rejected' || order.status === 'canceled';

  const renderPayment = () => (
    <div className="admin-section">
      <div className="admin-section-header">
        <div>
          <p className="admin-section-kicker">Pagamento</p>
          <h3 className="admin-section-title">Status financeiro</h3>
        </div>
      </div>
      <div className="admin-card-grid">
        <div className="admin-card">
          <p className="admin-card-title">Método</p>
          <p className="admin-card-copy">{formatPaymentMethod(order.payment_method)}</p>
        </div>
        <div className="admin-card">
          <p className="admin-card-title">Status</p>
          <p className="admin-card-copy">{formatPaymentStatus(order.payment_status)}</p>
        </div>
        <div className="admin-card">
          <p className="admin-card-title">Pagamento em aberto?</p>
          <p className="admin-card-copy">{formatPaymentDue(order.payment_due)}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="admin-modal-backdrop">
      <div className="admin-modal" style={{ maxHeight: '90vh' }}>
        <div className="admin-modal-header">
          <div>
            <p className="admin-modal-subtitle">Pedido</p>
            <h2 className="admin-modal-title">#{order.id}</h2>
            <p className="admin-modal-helper">Criado em {formatDateTime(order.created_at)}</p>
          </div>
          <div className="admin-table-actions">
            <span className={statusClass(order.status)}>{STATUS_TABS.find((s) => s.value === order.status)?.label}</span>
            <button type="button" className="admin-button-ghost" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>

        <div className="admin-modal-body">
          <div className="admin-card-grid">
            <div className="admin-card">
              <p className="admin-card-title">Cliente</p>
              <p className="admin-card-copy">{formatOptionalText(order.customer_name)}</p>
              <p className="admin-card-copy">Telefone: {formatOptionalText(order.customer_phone)}</p>
            </div>
            <div className="admin-card">
              <p className="admin-card-title">Datas</p>
              <p className="admin-card-copy">Entrega: {formatDate(order.delivery_date)}</p>
            </div>
            <div className="admin-card">
              <p className="admin-card-title">Observações</p>
              <p className="admin-card-copy">{formatOptionalText(order.note)}</p>
            </div>
          </div>

          <div className="admin-section">
            <div className="admin-section-header">
              <div>
                <p className="admin-section-kicker">Itens</p>
                <h3 className="admin-section-title">Produtos do pedido</h3>
              </div>
              <div className="admin-section-actions">
                <p className="admin-card-copy" style={{ margin: 0 }}>
                  Total: {formatCurrency(order.total_cents)}
                </p>
              </div>
            </div>
            <div className="admin-table admin-quantity-table">
              <div className="admin-table-header">
                <div>Qtd</div>
                <div>Descrição</div>
                <div>Preço</div>
                <div>Subtotal</div>
              </div>
              {order.order_items && order.order_items.length > 0 ? (
                order.order_items.map((item) => (
                  <div key={item.id ?? `${item.product_id}-${item.product_option_id}`} className="admin-table-row">
                    <div>{item.quantity}</div>
                    <div className="admin-cell-left">
                      {getOrderItemDisplayName(item)}{' '}
                      <span className="admin-cell-text">{getOrderItemMetaText(item)}</span>
                    </div>
                    <div className="admin-col-number">{formatCurrency(item.unit_price_cents)}</div>
                    <div className="admin-col-number">{formatCurrency(item.subtotal_cents)}</div>
                  </div>
                ))
              ) : (
                <div className="admin-table-row">
                  <div className="admin-empty">Sem itens listados.</div>
                </div>
              )}
            </div>
          </div>

          {renderPayment()}

          {(order.rejection_reason_text || order.cancellation_reason_code || order.cancellation_reason_text) && (
            <div className="admin-section">
              <div className="admin-section-header">
                <div>
                  <p className="admin-section-kicker">Motivos</p>
                  <h3 className="admin-section-title">Reprovação/Cancelamento</h3>
                </div>
              </div>
              <p className="admin-card-copy">Reprovação: {formatOptionalText(order.rejection_reason_text)}</p>
              <p className="admin-card-copy">
                Cancelamento: {formatOptionalText(order.cancellation_reason_code)}
                {order.cancellation_reason_text ? ` - ${order.cancellation_reason_text}` : ''}
              </p>
            </div>
          )}
        </div>

        <div className="admin-modal-footer">
          <span className="admin-card-copy">Total: {formatCurrency(order.total_cents)}</span>
          <div className="admin-footer-actions">
            {order.status === 'pending' && (
              <>
                <button type="button" className="admin-button admin-button-danger" onClick={() => setRejectOpen(true)}>
                  Reprovar Pedido
                </button>
                <button type="button" className="admin-button" onClick={() => setApproveOpen(true)}>
                  Aprovar e iniciar
                </button>
              </>
            )}
            {order.status === 'in_progress' && (
              <>
                <button type="button" className="admin-button admin-button-danger" onClick={() => setCancelOpen(true)}>
                  Cancelar Pedido
                </button>
                <button type="button" className="admin-button" onClick={() => setFinishOpen(true)}>
                  Concluir
                </button>
              </>
            )}
            {order.status === 'finished' && (
              <button type="button" className="admin-button-outline" onClick={() => setFinishOpen(true)}>
                Ajustar pagamento
              </button>
            )}
            {canDelete && (
              <>
                <button type="button" className="admin-button admin-button-danger" onClick={() => setDeleteOpen(true)}>
                  Excluir pedido
                </button>
                <button type="button" className="admin-button-ghost" onClick={onClose}>
                  Fechar
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {approveOpen && (
        <ApproveModal
          order={order}
          onClose={() => setApproveOpen(false)}
          onUpdated={(updated) => {
            setSelectedOrder(updated);
            onUpdated();
            setApproveOpen(false);
          }}
        />
      )}
      {rejectOpen && (
        <RejectModal
          order={order}
          onClose={() => setRejectOpen(false)}
          onUpdated={(updated) => {
            setSelectedOrder(updated);
            onUpdated();
            setRejectOpen(false);
            onClose();
          }}
        />
      )}
      {cancelOpen && (
        <CancelModal
          order={order}
          onClose={() => setCancelOpen(false)}
          onUpdated={(updated) => {
            setSelectedOrder(updated);
            onUpdated();
            setCancelOpen(false);
            onClose();
          }}
        />
      )}
      {finishOpen && (
        <FinishModal
          order={order}
          onClose={() => setFinishOpen(false)}
          onUpdated={(updated) => {
            setSelectedOrder(updated);
            onUpdated();
            setFinishOpen(false);
            if (order.status !== 'finished') onClose();
          }}
        />
      )}
      {deleteOpen && (
        <DeleteOrderModal
          order={order}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => {
            setSelectedOrder(null);
            onUpdated();
            setDeleteOpen(false);
            onClose();
          }}
          onToast={onToast}
        />
      )}
    </div>
  );
}

type ActionModalProps = {
  order: Order;
  onClose: () => void;
  onUpdated: (order: Order) => void;
};

type DeleteOrderModalProps = {
  order: Order;
  onClose: () => void;
  onDeleted: () => void;
  onToast: (message: string, options?: { variant?: ToastVariant; durationMs?: number }) => void;
};

function ApproveModal({ order, onClose, onUpdated }: ActionModalProps) {
  const { withAuthRetry } = useAuth();
  const [phone, setPhone] = useState(order.customer_phone ?? '');
  const [deliveryDate, setDeliveryDate] = useState(order.delivery_date ?? '');
  const [paymentDone, setPaymentDone] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('pix');
  const initialItems = useMemo(
    () =>
      (order.order_items ?? []).map((item) => ({
        ...item,
        unit_price_cents: item.unit_price_cents ?? item.subtotal_cents / (item.quantity || 1),
        subtotal_cents: item.subtotal_cents ?? (item.unit_price_cents ?? 0) * (item.quantity || 1),
      })),
    [order.id]
  );
  const [items, setItems] = useState<OrderItem[]>(initialItems);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalCents = useMemo(
    () => items.reduce((acc, item) => acc + (Number(item.subtotal_cents) || 0), 0),
    [items]
  );

  const handleChangeItem = (index: number, field: 'quantity' | 'unit_price_cents', value: string) => {
    setItems((prev) => {
      const next = [...prev];
      const current = { ...next[index] };
      if (field === 'quantity') {
        const qty = Math.max(1, Number.parseInt(value, 10) || 1);
        current.quantity = qty;
        current.subtotal_cents = Math.round(qty * (current.unit_price_cents || 0));
      } else {
        const parsed = Number(String(value).replace(',', '.'));
        const price = Math.max(0, Math.round((Number.isNaN(parsed) ? 0 : parsed) * 100));
        current.unit_price_cents = price;
        current.subtotal_cents = Math.round((current.quantity || 1) * price);
      }
      next[index] = current;
      return next;
    });
  };

  const handleConfirm = async () => {
    if (saving) return;
    const confirmed = window.confirm('Confirmar reprovação do pedido? Esta ação não pode ser desfeita.');
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      if (!cleanPhone) {
        throw new Error('Informe um telefone válido para o WhatsApp.');
      }
      if (!deliveryDate) {
        throw new Error('Informe a data de entrega.');
      }

      const missingItemId = items.find((item) => !item.id);
      const missingOriginalId = initialItems.find((item) => !item.id);
      if (missingItemId || missingOriginalId) {
        throw new Error('Não foi possível identificar os itens do pedido. Recarregue e tente novamente.');
      }

      const orderUpdate = {
        delivery_date: deliveryDate || null,
        payment_method: paymentDone ? paymentMethod : null,
        payment_status: paymentDone ? 'paid' : 'due',
        payment_due: !paymentDone,
        total_cents: totalCents,
        status: 'in_progress' as OrderStatus,
        last_whatsapp_sent_at: new Date().toISOString(),
      };

      const toOrderItemRow = (item: OrderItem) => ({
        id: item.id,
        order_id: order.id,
        product_id: item.product_id ?? null,
        product_option_id: item.product_option_id ?? null,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        subtotal_cents: item.subtotal_cents,
        flavor: item.flavor ?? null,
        coverage: item.coverage ?? null,
        size: item.size ?? null,
        ribbon_width: item.ribbon_width ?? null,
        ribbon_color: item.ribbon_color ?? null,
        form_color: item.form_color ?? null,
      });

      const payload = items.map(toOrderItemRow);
      const rollbackPayload = initialItems.map(toOrderItemRow);

      const { error: itemsError } = await withAuthRetry(
        () => supabase.from('order_items').upsert(payload),
        { label: 'approve-items' }
      );
      if (itemsError) {
        if (import.meta.env.DEV) {
          console.error('Erro ao atualizar order_items', {
            message: itemsError.message,
            details: (itemsError as any)?.details,
            hint: (itemsError as any)?.hint,
            code: (itemsError as any)?.code,
          });
        }
        throw new Error('Não foi possível salvar os itens do pedido.');
      }

      const { data: updated, error: orderError } = await withAuthRetry(
        () =>
          supabase
            .from('orders')
            .update(orderUpdate)
            .eq('id', order.id)
            .select(ORDER_SELECT_WITH_ITEMS)
            .single(),
        { label: 'approve-order' }
      );
      if (orderError || !updated) {
        if (import.meta.env.DEV && orderError) {
          console.error('Erro ao aprovar pedido', {
            message: orderError.message,
            details: (orderError as any)?.details,
            hint: (orderError as any)?.hint,
            code: (orderError as any)?.code,
          });
        }

        const { error: rollbackError } = await withAuthRetry(
          () => supabase.from('order_items').upsert(rollbackPayload),
          { label: 'approve-items-rollback' }
        );
        if (rollbackError && import.meta.env.DEV) {
          console.error('Erro ao reverter order_items', {
            message: rollbackError.message,
            details: (rollbackError as any)?.details,
            hint: (rollbackError as any)?.hint,
            code: (rollbackError as any)?.code,
          });
        }

        if (rollbackError) {
          throw new Error('Não foi possível aprovar o pedido. Atualize a página e verifique os itens.');
        }
        throw new Error('Não foi possível aprovar o pedido. As alterações foram revertidas.');
      }

      const summary = items
        .map((item) => `${item.quantity}x ${getOrderItemDisplayName(item)} - ${formatCurrency(item.subtotal_cents)}`)
        .join('\n');
      const message = encodeURIComponent(
        `Olá, ${order.customer_name ?? 'cliente'}! Recebemos seu pedido e ele já está em andamento.\n` +
          `Entrega: ${deliveryDate ? formatDate(deliveryDate) : 'A combinar'}\n` +
          `Total: ${formatCurrency(totalCents)}\n` +
          `Itens:\n${summary}\n` +
          `Qualquer dúvida, estamos à disposição.`
      );
      window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');

      onUpdated(updated as Order);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao aprovar pedido.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-backdrop">
      <div className="admin-modal" style={{ maxHeight: '90vh', width: 'min(960px, 100%)' }}>
        <div className="admin-modal-header">
          <div>
            <p className="admin-modal-subtitle">Aprovar pedido</p>
            <h2 className="admin-modal-title">#{order.id}</h2>
          </div>
          <button type="button" className="admin-button-ghost" onClick={onClose}>
            Fechar
          </button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">
            <label className="admin-field">
              <span>Telefone (WhatsApp)</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="admin-input"
                placeholder="(00) 00000-0000"
              />
            </label>
            <label className="admin-field">
              <span>Data de entrega</span>
              <input
                type="date"
                value={deliveryDate ?? ''}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="admin-input"
              />
            </label>
            <label className="admin-field admin-checkbox">
              <input
                type="checkbox"
                checked={paymentDone}
                onChange={(e) => setPaymentDone(e.target.checked)}
              />
              <span>Pagamento já realizado?</span>
            </label>
            {paymentDone && (
              <label className="admin-field">
                <span>Método de pagamento</span>
                <select
                  className="admin-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  {PAYMENT_METHOD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="admin-section">
            <div className="admin-section-header">
              <div>
                <p className="admin-section-kicker">Itens</p>
                <h3 className="admin-section-title">Ajustar quantidades/preços</h3>
              </div>
              <div className="admin-section-actions">
                <p className="admin-card-copy" style={{ margin: 0 }}>
                  Total: {formatCurrency(totalCents)}
                </p>
              </div>
            </div>
            <div className="admin-table admin-quantity-table">
              <div className="admin-table-header">
                <div>Qtd</div>
                <div>Descrição</div>
                <div>Preço unitário (R$)</div>
                <div>Subtotal</div>
              </div>
              {items.map((item, index) => (
                <div key={item.id ?? index} className="admin-table-row">
                  <div>
                    <input
                      type="number"
                      min={1}
                      className="admin-input admin-table-input"
                      value={item.quantity}
                      onChange={(e) => handleChangeItem(index, 'quantity', e.target.value)}
                    />
                  </div>
                  <div className="admin-cell-left">
                    <div className="admin-product-name">{getOrderItemDisplayName(item)}</div>
                    <div className="admin-cell-text">{getOrderItemMetaText(item)}</div>
                  </div>
                  <div>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="admin-input admin-table-input"
                      value={item.unit_price_cents / 100}
                      onChange={(e) => handleChangeItem(index, 'unit_price_cents', e.target.value)}
                    />
                  </div>
                  <div className="admin-col-number">{formatCurrency(item.subtotal_cents)}</div>
                </div>
              ))}
            </div>
          </div>
          {error && <div className="admin-inline-error">{error}</div>}
        </div>
        <div className="admin-modal-footer">
          <div className="admin-footer-actions">
            <button type="button" className="admin-button-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="admin-button" onClick={handleConfirm} disabled={saving}>
              {saving ? 'Salvando...' : 'Aprovar e iniciar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RejectModal({ order, onClose, onUpdated }: ActionModalProps) {
  const { withAuthRetry } = useAuth();
  const [reason, setReason] = useState(order.rejection_reason_text ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (saving) return;
    const confirmed = window.confirm('Confirmar cancelamento do pedido? Esta ação não pode ser desfeita.');
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    try {
      const { data, error: updError } = await withAuthRetry(
        () =>
          supabase
            .from('orders')
            .update({ status: 'rejected', rejection_reason_text: reason || null })
            .eq('id', order.id)
            .select(ORDER_SELECT_WITH_ITEMS)
            .single(),
        { label: 'reject-order' }
      );
      if (updError || !data) {
        if (import.meta.env.DEV && updError) {
          console.error('Erro ao reprovar pedido', {
            message: updError.message,
            details: (updError as any)?.details,
            hint: (updError as any)?.hint,
            code: (updError as any)?.code,
          });
        }
        throw new Error('Não foi possível reprovar o pedido.');
      }
      onUpdated(data as Order);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao reprovar pedido.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-backdrop">
      <div className="admin-modal">
        <div className="admin-modal-header">
          <div>
            <p className="admin-modal-subtitle">Reprovar pedido</p>
            <h2 className="admin-modal-title">#{order.id}</h2>
          </div>
          <button type="button" className="admin-button-ghost" onClick={onClose}>
            Fechar
          </button>
        </div>
        <div className="admin-modal-body">
          <label className="admin-field admin-textarea-field">
            <span>Motivo da reprovação</span>
            <textarea
              className="admin-textarea"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva o motivo brevemente"
            />
          </label>
          {error && <div className="admin-inline-error">{error}</div>}
        </div>
        <div className="admin-modal-footer">
          <div className="admin-footer-actions">
            <button type="button" className="admin-button-ghost" onClick={onClose}>
              Voltar
            </button>
            <button
              type="button"
              className="admin-button admin-button-danger"
              onClick={handleConfirm}
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Reprovar Pedido'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CancelModal({ order, onClose, onUpdated }: ActionModalProps) {
  const { withAuthRetry } = useAuth();
  const [reasonCode, setReasonCode] = useState<string>(order.cancellation_reason_code ?? 'Cliente não respondeu');
  const [reasonText, setReasonText] = useState(order.cancellation_reason_text ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const { data, error: updError } = await withAuthRetry(
        () =>
          supabase
            .from('orders')
            .update({
              status: 'canceled',
              cancellation_reason_code: reasonCode,
              cancellation_reason_text: reasonText || null,
            })
            .eq('id', order.id)
            .select(ORDER_SELECT_WITH_ITEMS)
            .single(),
        { label: 'cancel-order' }
      );
      if (updError || !data) {
        if (import.meta.env.DEV && updError) {
          console.error('Erro ao cancelar pedido', {
            message: updError.message,
            details: (updError as any)?.details,
            hint: (updError as any)?.hint,
            code: (updError as any)?.code,
          });
        }
        throw new Error('Não foi possível cancelar o pedido.');
      }
      onUpdated(data as Order);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao cancelar pedido.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-backdrop">
      <div className="admin-modal">
        <div className="admin-modal-header">
          <div>
            <p className="admin-modal-subtitle">Cancelar pedido</p>
            <h2 className="admin-modal-title">#{order.id}</h2>
          </div>
          <button type="button" className="admin-button-ghost" onClick={onClose}>
            Fechar
          </button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">
            <label className="admin-field">
              <span>Motivo</span>
              <select className="admin-select" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
                <option value="Cliente não respondeu">Cliente não respondeu</option>
                <option value="Sem disponibilidade de agenda">Sem disponibilidade de agenda</option>
                <option value="Sem estoque">Sem estoque</option>
                <option value="Pagamento não confirmado">Pagamento não confirmado</option>
                <option value="Endereço/Informações inválidas">Endereço/Informações inválidas</option>
                <option value="Outro">Outro</option>
              </select>
            </label>
            <label className="admin-field admin-textarea-field">
              <span>Descrição curta</span>
              <textarea
                className="admin-textarea"
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                placeholder="Explique rapidamente o cancelamento"
              />
            </label>
          </div>
          {error && <div className="admin-inline-error">{error}</div>}
        </div>
        <div className="admin-modal-footer">
          <div className="admin-footer-actions">
            <button type="button" className="admin-button-ghost" onClick={onClose}>
              Voltar
            </button>
            <button
              type="button"
              className="admin-button admin-button-danger"
              onClick={handleConfirm}
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Cancelar Pedido'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteOrderModal({ order, onClose, onDeleted, onToast }: DeleteOrderModalProps) {
  const { withAuthRetry } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAllowed = order.status === 'rejected' || order.status === 'canceled';
  const isConfirmed = confirmText.trim().toUpperCase() === 'EXCLUIR';

  const handleDelete = async () => {
    if (deleting) return;
    if (!isAllowed) {
      setError('Este pedido não pode ser excluído.');
      return;
    }
    if (!isConfirmed) {
      setError('Digite EXCLUIR para confirmar.');
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const itemIds = (order.order_items ?? [])
        .map((item) => item.id)
        .filter(Boolean) as string[];

      if (itemIds.length > 0) {
        const { error: detailsError } = await withAuthRetry(
          () => supabase.from('order_item_details').delete().in('order_item_id', itemIds),
          { label: 'delete-order-item-details' }
        );
        if (detailsError) {
          throw detailsError;
        }

        const { error: itemsError } = await withAuthRetry(
          () => supabase.from('order_items').delete().in('id', itemIds),
          { label: 'delete-order-items' }
        );
        if (itemsError) {
          throw itemsError;
        }
      }

      const { error: deleteError } = await withAuthRetry(
        () => supabase.from('orders').delete().eq('id', order.id),
        { label: 'delete-order' }
      );
      if (deleteError) {
        throw deleteError;
      }

      onToast('Pedido excluído com sucesso.', { variant: 'success' });
      onDeleted();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível excluir o pedido.';
      setError(message);
      onToast(message, { variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="admin-modal-backdrop">
      <div className="admin-modal">
        <div className="admin-modal-header">
          <div>
            <p className="admin-modal-subtitle">Excluir pedido</p>
            <h2 className="admin-modal-title">#{order.id}</h2>
          </div>
          <button type="button" className="admin-button-ghost" onClick={onClose}>
            Fechar
          </button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-inline-error">
            Esta ação é irreversível. O pedido e seus itens serão removidos.
          </div>
          <label className="admin-field">
            <span>Digite EXCLUIR para confirmar</span>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value);
                setError(null);
              }}
              className="admin-input"
              placeholder="EXCLUIR"
            />
          </label>
          {error && <div className="admin-inline-error">{error}</div>}
        </div>
        <div className="admin-modal-footer">
          <div className="admin-footer-actions">
            <button type="button" className="admin-button-ghost" onClick={onClose}>
              Voltar
            </button>
            <button
              type="button"
              className="admin-button admin-button-danger"
              onClick={handleDelete}
              disabled={deleting || !isConfirmed}
            >
              {deleting ? 'Excluindo...' : 'Excluir pedido'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FinishModal({ order, onClose, onUpdated }: ActionModalProps) {
  const { withAuthRetry } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState(order.payment_method ?? 'pix');
  const [paymentStatus, setPaymentStatus] = useState(order.payment_status ?? 'paid');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        payment_due: paymentStatus !== 'paid',
        status: 'finished',
      };
      const { data, error: updError } = await withAuthRetry(
        () =>
          supabase
            .from('orders')
            .update(payload)
            .eq('id', order.id)
            .select(ORDER_SELECT_WITH_ITEMS)
            .single(),
        { label: 'finish-order' }
      );
      if (updError || !data) {
        if (import.meta.env.DEV && updError) {
          console.error('Erro ao concluir pedido', {
            message: updError.message,
            details: (updError as any)?.details,
            hint: (updError as any)?.hint,
            code: (updError as any)?.code,
          });
        }
        throw new Error('Não foi possível concluir o pedido.');
      }
      onUpdated(data as Order);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao concluir pedido.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-backdrop">
      <div className="admin-modal">
        <div className="admin-modal-header">
          <div>
            <p className="admin-modal-subtitle">Concluir pedido</p>
            <h2 className="admin-modal-title">#{order.id}</h2>
          </div>
          <button type="button" className="admin-button-ghost" onClick={onClose}>
            Fechar
          </button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">
            <label className="admin-field">
              <span>Método de pagamento</span>
              <select
                className="admin-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {PAYMENT_METHOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-field">
              <span>Status do pagamento</span>
              <select
                className="admin-select"
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
              >
                <option value="paid">Pago</option>
                <option value="due">Em aberto</option>
                <option value="pending">Pendente</option>
              </select>
            </label>
          </div>
          {error && <div className="admin-inline-error">{error}</div>}
        </div>
        <div className="admin-modal-footer">
          <div className="admin-footer-actions">
            <button type="button" className="admin-button-ghost" onClick={onClose}>
              Voltar
            </button>
            <button type="button" className="admin-button" onClick={handleConfirm} disabled={saving}>
              {saving ? 'Salvando...' : 'Concluir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
