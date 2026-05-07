import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaCalendarAlt, FaCheck, FaEdit, FaMapMarkerAlt, FaRegCommentDots, FaRegCopy, FaSearch, FaTimes, FaTrash, FaUser } from 'react-icons/fa';
import { AdminPageHeader, AdminToastStack } from '../../components/admin/AdminPrimitives';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/AuthProvider';
import { BiSolidDetail } from 'react-icons/bi';
import { resolveUnitPriceCents } from '../../lib/api/pricing';
import { fetchProductDetailFields } from '../../lib/api/products';
import type { ProductDetailField, ProductDetailSelection } from '../../types/productDetail';
import { IoClose } from 'react-icons/io5';

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
  customer_address?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_cep?: string | null;
  address_latitude?: number | null;
  address_longitude?: number | null;
  address_source?: string | null;
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

type CreateOrderStatus = Extract<OrderStatus, 'pending' | 'in_progress'>;

type CreateOrderProduct = {
  id: string;
  name: string;
  base_price_cents: number;
  min_quantity: number | null;
};

type DetailValueDraft = string | string[];

type CreateOrderItemDetailDraft = {
  field_id: string;
  field_key: string;
  label: string;
  value: string;
  display_value: string;
  extra_price_delta_cents: number;
  input_type: ProductDetailSelection['inputType'];
};

type CreateOrderItemDraft = {
  client_id: string;
  product_id: string;
  quantity: number;
  unit_price_cents: number;
  unitPriceInput: string;
  subtotal_cents: number;
  manualPrice: boolean;
  details: CreateOrderItemDetailDraft[];
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

const CREATE_ORDER_STATUS_OPTIONS: Array<{ value: CreateOrderStatus; label: string }> = [
  { value: 'pending', label: 'Pendente' },
  { value: 'in_progress', label: 'Em andamento' },
];

const ORDER_SELECT_BASE_WITH_ITEMS = `
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

const ORDER_SELECT_WITH_ITEMS = `
  id,
  created_at,
  customer_name,
  customer_phone,
  customer_email,
  customer_address,
  address_street,
  address_number,
  address_complement,
  address_neighborhood,
  address_city,
  address_state,
  address_cep,
  address_latitude,
  address_longitude,
  address_source,
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

const shouldFallbackOrderSelect = (error: unknown) => {
  const code = (error as { code?: string } | null)?.code;
  return code === 'PGRST204' || code === '42703';
};

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

const formatOrderAddress = (order: Order) => {
  const storedAddress = order.customer_address?.trim();
  if (storedAddress) return storedAddress;

  const noteAddress = order.note
    ?.split('\n')
    .map((line) => line.trim())
    .find((line) => line.toLowerCase().startsWith('endereço:') || line.toLowerCase().startsWith('endereco:'))
    ?.replace(/^endere[cç]o:\s*/i, '')
    .trim();
  if (noteAddress) return noteAddress;

  const base = [order.address_street?.trim(), order.address_number?.trim()].filter(Boolean).join(', ');
  const complement = order.address_complement?.trim();
  const cityState = [order.address_city?.trim(), order.address_state?.trim()].filter(Boolean).join(' - ');
  const cep = order.address_cep?.trim();
  const address = [base, complement, order.address_neighborhood?.trim(), cityState, cep ? `CEP ${cep}` : '']
    .filter(Boolean)
    .join(' • ');

  return address || EMPTY_LABEL;
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
  const baseName = item.product?.name?.trim() || 'Produto excluído';
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

const extractSupabaseErrorMessage = (error: unknown, fallback: string) => {
  if (!error) return fallback;
  if (error instanceof Error) return error.message || fallback;

  if (typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message;
    const maybeDetails = (error as { details?: unknown }).details;
    const maybeHint = (error as { hint?: unknown }).hint;
    const message = typeof maybeMessage === 'string' ? maybeMessage.trim() : '';
    const details = typeof maybeDetails === 'string' ? maybeDetails.trim() : '';
    const hint = typeof maybeHint === 'string' ? maybeHint.trim() : '';
    if (message && details) return `${message} (${details})`;
    if (message && hint) return `${message} (${hint})`;
    if (message) return message;
  }

  return fallback;
};

const parseCurrencyInput = (value: string) => {
  const normalized = value.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
};

const centsToInput = (value: number) => {
  const cents = Number.isFinite(value) ? value : 0;
  return (cents / 100).toFixed(2).replace('.', ',');
};

const createTempId = () => `tmp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const getDetailTextValue = (value: DetailValueDraft | undefined) =>
  (Array.isArray(value) ? value[0] ?? '' : value ?? '').trim();

const getDetailSelectedValues = (value: DetailValueDraft | undefined) =>
  Array.isArray(value)
    ? value.map((item) => item.trim()).filter(Boolean)
    : typeof value === 'string' && value.trim()
      ? [value.trim()]
      : [];

const normalizeDetailValueForField = (field: ProductDetailField, value: DetailValueDraft | undefined): DetailValueDraft =>
  field.input_type === 'multi_select'
    ? getDetailSelectedValues(value)
    : Array.isArray(value)
      ? value[0] ?? ''
      : value ?? '';

const mapSelectionsToDetailDraft = (selections: ProductDetailSelection[]): CreateOrderItemDetailDraft[] =>
  selections.map((selection) => ({
    field_id: selection.fieldId,
    field_key: selection.fieldKey,
    label: selection.label,
    value: selection.value,
    display_value: selection.displayValue,
    extra_price_delta_cents: selection.extraPriceDeltaCents,
    input_type: selection.inputType,
  }));

const buildDetailSelections = (
  fields: ProductDetailField[],
  detailValues: Record<string, DetailValueDraft>
): ProductDetailSelection[] =>
  fields.flatMap((field) => {
    const key = field.id ?? field.field_key;
    if (field.input_type === 'multi_select') {
      return getDetailSelectedValues(detailValues[key]).map((value) => {
        const option = field.options?.find((opt) => opt.value === value);
        return {
          fieldId: field.id ?? '',
          fieldKey: field.field_key,
          label: field.label,
          value,
          displayValue: option?.label ?? value,
          extraPriceDeltaCents: option?.extra_price_delta_cents ?? 0,
          inputType: field.input_type,
        };
      });
    }

    const value = getDetailTextValue(detailValues[key]);
    if (!value) return [];
    const option = field.options?.find((opt) => opt.value === value);
    return [
      {
        fieldId: field.id ?? '',
        fieldKey: field.field_key,
        label: field.label,
        value,
        displayValue: option?.label ?? value,
        extraPriceDeltaCents: option?.extra_price_delta_cents ?? 0,
        inputType: field.input_type,
      },
    ];
  });

const getInitialDetailValueFromItem = (
  field: ProductDetailField,
  details?: CreateOrderItemDetailDraft[]
): DetailValueDraft => {
  if (!details?.length) return field.input_type === 'multi_select' ? [] : '';
  const matches = details.filter(
    (detail) => detail.field_id === field.id || detail.field_key === field.field_key
  );
  if (field.input_type === 'multi_select') {
    return matches.map((detail) => detail.value).filter(Boolean);
  }
  return matches[0]?.value ?? '';
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
  const [createModalOpen, setCreateModalOpen] = useState(false);
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
    async (opts?: { keepSelection?: boolean; selectionId?: string }) => {
      setLoading(true);
      setError(null);
      const result = await withAuthRetry(
        () =>
          supabase
            .from('orders')
            .select(ORDER_SELECT_WITH_ITEMS)
            .eq('status', statusFilter)
            .order('created_at', { ascending: false }),
        { label: 'load-orders' }
      );
      let data = result.data as unknown;
      let fetchError = result.error;

      if (shouldFallbackOrderSelect(fetchError)) {
        const fallback = await withAuthRetry(
          () =>
            supabase
              .from('orders')
              .select(ORDER_SELECT_BASE_WITH_ITEMS)
              .eq('status', statusFilter)
              .order('created_at', { ascending: false }),
          { label: 'load-orders-fallback' }
        );
        data = fallback.data as unknown;
        fetchError = fallback.error;
      }

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

      const selectionId = opts?.selectionId ?? (opts?.keepSelection ? selectedOrder?.id : null);
      if (selectionId) {
        const refreshed = rows.find((o) => o.id === selectionId);
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
      const address = formatOrderAddress(order).toLowerCase();
      const id = order.id.toLowerCase();
      return name.includes(term) || phone.includes(term) || address.includes(term) || id.includes(term);
    });
  }, [orders, search]);

  const hasOrders = filteredOrders.length > 0;

  const handleCreatedOrder = useCallback(
    (order: Order) => {
      setCreateModalOpen(false);
      setSelectedOrder(order);
      void loadOrders({ keepSelection: true, selectionId: order.id });
      pushToast('Pedido criado com sucesso.', { variant: 'success', durationMs: 5000 });
    },
    [loadOrders, pushToast]
  );

  return (
    <div className="admin-page admin-orders-page">
      <AdminToastStack toasts={toasts} onDismiss={removeToast} />
      <AdminPageHeader
        kicker="Operação"
        title="Pedidos"
      />

      <div className="admin-orders-create-action">
        <button
          type="button"
          className="admin-button admin-orders-create-button"
          onClick={() => setCreateModalOpen(true)}
        >
          Adicionar Pedido
        </button>
      </div>

      <div className="admin-orders-mobile-only">
        <div className="admin-table-shell admin-orders-table-shell admin-orders-mobile-shell">
          <div className="admin-table-headerbar admin-orders-filter-bar admin-orders-mobile-filter-bar">
            <div className="admin-orders-filter-heading">
              <p className="admin-section-kicker">Filtro</p>
              <h3 className="admin-table-title">Selecione um status</h3>
            </div>
            <div className="admin-section-actions admin-orders-filter-controls">
              <label className="admin-field admin-orders-mobile-status-field">
                <span>Status do pedido</span>
                <select
                  className="admin-select"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as OrderStatus)}
                >
                  {STATUS_TABS.map((tab) => {
                    const count = statusCounts[tab.value] ?? 0;
                    return (
                      <option key={tab.value} value={tab.value}>
                        {tab.label} ({count})
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="admin-field admin-orders-mobile-search-field">
                <span>Campo de busca</span>
                <div className="admin-input-inline admin-orders-search admin-orders-search-mobile">
                  <FaSearch />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="admin-input"
                    placeholder="Buscar por nome, telefone ou ID"
                  />
                </div>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3 p-2" role="list" aria-label="Lista de pedidos">

            {loading &&
              Array.from({ length: 4 }, (_, index) => (
                <article
                  key={`mobile-order-skeleton-${index}`}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-pulse"
                  aria-hidden="true"
                >
                  <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
                  <div className="h-5 w-20 bg-gray-200 rounded-full mb-3" />
                  <div className="h-4 w-full bg-gray-200 rounded mb-2" />
                  <div className="h-4 w-32 bg-gray-200 rounded mb-3" />
                  <div className="h-10 w-full bg-gray-200 rounded-full" />
                </article>
              ))}

            {!loading &&
              hasOrders &&
              filteredOrders.map((order) => (
                <article
                  key={order.id}
                  role="listitem"
                  className="bg-white rounded-2xl p-4 shadow-sm border border-pink-600 flex flex-col gap-3"
                >
                  {/* HEADER */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <strong className="text-sm font-semibold text-black">
                        #{formatShortId(order.id)}
                      </strong>

                      <button
                        type="button"
                        onClick={() => handleCopyId(order.id)}
                        className="text-pink-600 hover:bg-pink-600 hover:text-white transition border rounded-full border-pink-600 p-1"
                      >
                        <FaRegCopy className="text-sm" />
                      </button>
                    </div>

                    <span className={`${statusClass(order.status)} text-xs px-2 py-1 rounded-full`}>
                      {STATUS_TABS.find((status) => status.value === order.status)?.label}
                    </span>
                  </div>

                  {/* CLIENTE */}
                  <h4 className="text-sm text-gray-700">
                    <span className="text-gray-500">Cliente:</span>{" "}
                    {order.customer_name ?? "Sem nome"}
                  </h4>
                  <p className="text-xs leading-relaxed text-gray-500">
                    <span className="text-gray-500">Endereço:</span>{" "}
                    {formatOrderAddress(order)}
                  </p>

                  {/* META */}
                  <p className="text-xs text-gray-500">
                    Pedido: {formatDate(order.created_at)} • Entrega:{" "}
                    {formatDate(order.delivery_date)}
                  </p>

                  {/* FOOTER */}
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-lg font-semibold text-pink-500">
                      {formatCurrency(order.total_cents)}
                    </span>

                    <button
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      className="flex items-center gap-2 px-3 py-2 rounded-full border border-pink-300 text-pink-500 text-xs font-medium hover:bg-pink-50 hover:border-pink-400 active:scale-95 transition-all"
                    >
                      Ver detalhes
                      <BiSolidDetail className="text-sm" />
                    </button>
                  </div>
                </article>
              ))}

            {!loading && !hasOrders && (
              <div className="text-center py-10 text-gray-500">
                <p className="font-medium text-gray-700">Nenhum pedido encontrado</p>
                <p className="text-sm">Ajuste filtros, status ou faça nova busca.</p>
              </div>
            )}
          </div>

          <div className="admin-table-footer admin-orders-mobile-footer">
            <span>
              {loading ? 'Carregando...' : hasOrders ? `${filteredOrders.length} pedido(s)` : 'Nenhum pedido listado'}
            </span>
            <div className="admin-table-actions">
              <button
                type="button"
                className="rounded-2xl bg-pink-600 text-white p-2 text-xs"
                onClick={() => loadOrders({ keepSelection: true })}
              >
                Atualizar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-orders-desktop-only">
        <section className="admin-table-shell admin-orders-table-shell admin-orders-desktop-panel">
          <div className="admin-table-headerbar admin-orders-filter-bar">
            <div className="admin-orders-filter-heading">
              <p className="admin-section-kicker">Filtro</p>
              <h3 className="admin-table-title">Selecione um status</h3>
              <p className="admin-table-subtitle">
                {loading ? 'Carregando pedidos...' : hasOrders ? `${filteredOrders.length} pedido(s) na selecao.` : 'Nenhum pedido listado.'}
              </p>
            </div>
            <div className="admin-section-actions admin-orders-filter-controls">
              <div className="admin-orders-status-grid">
                {STATUS_TABS.map((tab) => {
                  const count = statusCounts[tab.value] ?? 0;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      className={`admin-button-small admin-status-tab admin-orders-status-tab ${statusFilter === tab.value ? 'is-active' : 'admin-button-ghost'
                        }`}
                      onClick={() => setStatusFilter(tab.value)}
                      aria-pressed={statusFilter === tab.value}
                    >
                      <span className="admin-orders-status-label">{tab.label}</span>
                      <span className="admin-status-count admin-orders-status-count">{count}</span>
                    </button>
                  );
                })}
              </div>
              <div className="admin-input-inline admin-orders-search">
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

          <div className="admin-orders-desktop-grid" role="list" aria-label="Lista de pedidos">
            {loading &&
              Array.from({ length: 6 }, (_, index) => (
                <article key={`desktop-order-skeleton-${index}`} className="admin-orders-desktop-card admin-row-skeleton" aria-hidden="true">
                  <div className="admin-orders-desktop-card-head">
                    <div className="admin-skeleton-line short" />
                    <div className="admin-skeleton-pill" />
                  </div>
                  <div className="admin-skeleton-line" />
                  <div className="admin-skeleton-line short" />
                  <div className="admin-orders-desktop-card-meta">
                    <div className="admin-skeleton-block" />
                    <div className="admin-skeleton-block" />
                  </div>
                  <div className="admin-orders-desktop-card-footer">
                    <div className="admin-skeleton-line short" />
                    <div className="admin-skeleton-button" />
                  </div>
                </article>
              ))}

            {!loading &&
              hasOrders &&
              filteredOrders.map((order) => (
                <article key={order.id} className="admin-orders-desktop-card" role="listitem">
                  <div className="admin-orders-desktop-card-head">
                    <div className="admin-id-cell" title={order.id}>
                      <span className="admin-orders-desktop-id">#{formatShortId(order.id)}</span>
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
                    <span className={statusClass(order.status)}>
                      {STATUS_TABS.find((s) => s.value === order.status)?.label}
                    </span>
                  </div>

                  <div className="admin-orders-desktop-card-copy">
                    <span>Cliente</span>
                    <h3 title={order.customer_name ?? 'Sem nome'}>{order.customer_name ?? 'Sem nome'}</h3>
                    <p title={order.customer_phone ?? EMPTY_LABEL}>{order.customer_phone ?? EMPTY_LABEL}</p>
                    <p title={formatOrderAddress(order)}>{formatOrderAddress(order)}</p>
                  </div>

                  <div className="admin-orders-desktop-card-meta">
                    <div>
                      <span>Pedido</span>
                      <strong>{formatDate(order.created_at)}</strong>
                    </div>
                    <div>
                      <span>Entrega</span>
                      <strong>{formatDate(order.delivery_date)}</strong>
                    </div>
                  </div>

                  <div className="admin-orders-desktop-card-footer">
                    <span className="admin-orders-desktop-total">{formatCurrency(order.total_cents)}</span>
                    <button
                      type="button"
                      className="admin-button-small admin-button-ghost admin-orders-desktop-detail"
                      onClick={() => setSelectedOrder(order)}
                    >
                      Ver detalhes
                      <BiSolidDetail aria-hidden="true" focusable="false" />
                    </button>
                  </div>
                </article>
              ))}

            {!loading && !hasOrders && (
              <div className="admin-orders-desktop-empty">
                <p className="admin-empty-title">Nenhum pedido encontrado</p>
                <p className="admin-empty-helper">Ajuste filtros, status ou faça nova busca.</p>
              </div>
            )}
          </div>

          <div className="admin-table-footer admin-orders-desktop-footer">
            <span>
              {loading ? 'Carregando...' : hasOrders ? `${filteredOrders.length} pedido(s)` : 'Nenhum pedido listado'}
            </span>
            <div className="admin-table-actions">
              <button
                type="button"
                className="admin-button-ghost admin-button-small"
                onClick={() => loadOrders({ keepSelection: true })}
              >
                Atualizar
              </button>
            </div>
          </div>
        </section>
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

      {createModalOpen && (
        <CreateOrderModal
          onClose={() => setCreateModalOpen(false)}
          onCreated={handleCreatedOrder}
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

type CreateOrderModalProps = {
  onClose: () => void;
  onCreated: (order: Order) => void;
  onToast: (message: string, options?: { variant?: ToastVariant; durationMs?: number }) => void;
};

type CreateOrderItemEditorMode = 'create' | 'edit';

type ItemEditorState = {
  mode: CreateOrderItemEditorMode;
  targetId?: string;
};

type CreateOrderItemEditorModalProps = {
  mode: CreateOrderItemEditorMode;
  products: CreateOrderProduct[];
  initialItem?: CreateOrderItemDraft;
  loadDetailFields: (productId: string) => Promise<ProductDetailField[]>;
  onClose: () => void;
  onSave: (item: CreateOrderItemDraft) => void;
  onDelete?: () => void;
};

function CreateOrderModal({ onClose, onCreated, onToast }: CreateOrderModalProps) {
  const { withAuthRetry } = useAuth();
  const detailFieldsCacheRef = useRef<Record<string, ProductDetailField[]>>({});
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<CreateOrderStatus>('pending');
  const [items, setItems] = useState<CreateOrderItemDraft[]>([]);
  const [products, setProducts] = useState<CreateOrderProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemEditor, setItemEditor] = useState<ItemEditorState | null>(null);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  const totalCents = useMemo(
    () => items.reduce((acc, item) => acc + (Number(item.subtotal_cents) || 0), 0),
    [items]
  );

  useEffect(() => {
    let ignore = false;
    const loadCatalog = async () => {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const { data: productRows, error: productError } = await withAuthRetry(
          () =>
            supabase
              .from('products')
              .select('id, name, base_price_cents, min_quantity')
              .eq('is_active', true)
              .order('name', { ascending: true }),
          { label: 'create-order-load-products' }
        );
        if (productError) throw productError;
        if (ignore) return;
        setProducts((productRows ?? []) as CreateOrderProduct[]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Não foi possível carregar produtos.';
        if (!ignore) setCatalogError(message);
      } finally {
        if (!ignore) setCatalogLoading(false);
      }
    };

    void loadCatalog();
    return () => {
      ignore = true;
    };
  }, [withAuthRetry]);

  const loadDetailFieldsForProduct = useCallback(async (productId: string) => {
    const cached = detailFieldsCacheRef.current[productId];
    if (cached) return cached;
    const fields = await fetchProductDetailFields(productId, { onlyActive: true, withOptions: true });
    const normalized = fields.map((field) => ({
      ...field,
      options: [...(field.options ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    }));
    detailFieldsCacheRef.current[productId] = normalized;
    return normalized;
  }, []);

  const handleOpenCreateItem = () => {
    setItemEditor({ mode: 'create' });
  };

  const handleOpenEditItem = (itemId: string) => {
    setItemEditor({ mode: 'edit', targetId: itemId });
  };

  const handleSaveItem = (nextItem: CreateOrderItemDraft) => {
    setItems((prev) => {
      const index = prev.findIndex((item) => item.client_id === nextItem.client_id);
      if (index === -1) return [...prev, nextItem];
      return prev.map((item) => (item.client_id === nextItem.client_id ? nextItem : item));
    });
    setItemEditor(null);
  };

  const handleDeleteEditingItem = () => {
    if (!itemEditor?.targetId) return;
    setItems((prev) => prev.filter((item) => item.client_id !== itemEditor.targetId));
    setItemEditor(null);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);

    const name = customerName.trim();
    const phone = customerPhone.trim();
    const email = customerEmail.trim();
    const event = eventDate.trim();
    const delivery = deliveryDate.trim();
    const observation = note.trim();

    if (!name) {
      setError('Informe o nome do cliente.');
      setSaving(false);
      return;
    }
    if (!phone) {
      setError('Informe o telefone do cliente.');
      setSaving(false);
      return;
    }
    if (status === 'in_progress' && !delivery) {
      setError('Para iniciar em andamento, informe a data de entrega.');
      setSaving(false);
      return;
    }
    if (!items.length) {
      setError('Adicione ao menos um item.');
      setSaving(false);
      return;
    }

    const normalizedItems = items.map((item) => {
      const quantity = Number.isFinite(item.quantity) ? Math.max(1, item.quantity) : 1;
      const unitPrice = Number.isFinite(item.unit_price_cents) ? Math.max(0, item.unit_price_cents) : 0;
      const details = (item.details ?? [])
        .filter((detail) => detail.field_id && detail.value?.trim())
        .map((detail) => ({
          field_id: detail.field_id,
          value: detail.value.trim(),
        }));
      return {
        product_id: item.product_id.trim(),
        quantity,
        unit_price_cents: unitPrice,
        subtotal_cents: quantity * unitPrice,
        details,
      };
    });

    const hasInvalidItem =
      normalizedItems.length === 0 ||
      normalizedItems.some((item) => !item.product_id || item.quantity < 1);
    if (hasInvalidItem) {
      setError('Todos os itens devem ter produto e quantidade válida.');
      setSaving(false);
      return;
    }

    const totalCentsPayload = normalizedItems.reduce((acc, item) => acc + item.subtotal_cents, 0);
    let createdOrderId: string | null = null;
    let createdOrderItemIds: string[] = [];
    let shouldRollback = false;

    try {
      const orderPayload = {
        customer_name: name,
        customer_phone: phone,
        customer_email: email || null,
        note: observation || null,
        event_date: event || null,
        delivery_date: status === 'in_progress' ? delivery || null : null,
        status,
        total_cents: totalCentsPayload,
        payment_method: null,
        payment_status: status === 'in_progress' ? 'due' : null,
        payment_due: status === 'in_progress' ? true : null,
      };

      const { data: insertedOrder, error: orderError } = await withAuthRetry(
        () => supabase.from('orders').insert(orderPayload).select('id').single(),
        { label: 'create-order' }
      );
      if (orderError || !insertedOrder) {
        throw new Error(extractSupabaseErrorMessage(orderError, 'Não foi possível criar o pedido.'));
      }
      createdOrderId = insertedOrder.id as string;
      shouldRollback = true;

      const itemsPayload = normalizedItems.map((item) => ({
        order_id: createdOrderId,
        product_id: item.product_id,
        product_option_id: null,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        subtotal_cents: item.subtotal_cents,
        flavor: null,
        coverage: null,
        size: null,
        ribbon_width: null,
        ribbon_color: null,
        form_color: null,
      }));

      const { error: itemsError } = await withAuthRetry(
        () => supabase.from('order_items').insert(itemsPayload),
        { label: 'create-order-items' }
      );
      if (itemsError) {
        throw new Error(
          extractSupabaseErrorMessage(itemsError, 'Não foi possível salvar os itens do pedido.')
        );
      }

      const hasItemDetails = normalizedItems.some((item) => item.details.length > 0);
      const detailRows: Array<{ order_item_id: string; field_id: string; value: string }> = [];
      if (hasItemDetails) {
        const { data: orderItemsRows, error: lookupError } = await withAuthRetry(
          () =>
            supabase
              .from('order_items')
              .select('id, product_id, quantity, unit_price_cents, subtotal_cents')
              .eq('order_id', createdOrderId as string),
          { label: 'create-order-items-lookup' }
        );

        if (lookupError) {
          throw new Error(
            extractSupabaseErrorMessage(
              lookupError,
              'Não foi possível localizar os itens criados para vincular as customizações.'
            )
          );
        }

        const candidates = ((orderItemsRows ?? []) as Array<{
          id: string;
          product_id: string | null;
          quantity: number;
          unit_price_cents: number;
          subtotal_cents: number;
        }>).slice();
        const usedIds = new Set<string>();

        const findItemId = (item: {
          product_id: string;
          quantity: number;
          unit_price_cents: number;
          subtotal_cents: number;
        }) => {
          const match = candidates.find(
            (row) =>
              !usedIds.has(row.id) &&
              row.product_id === item.product_id &&
              Number(row.quantity) === Number(item.quantity) &&
              Number(row.unit_price_cents) === Number(item.unit_price_cents) &&
              Number(row.subtotal_cents) === Number(item.subtotal_cents)
          );
          if (!match) return null;
          usedIds.add(match.id);
          return match.id;
        };

        normalizedItems.forEach((item) => {
          if (!item.details.length) return;
          const itemId = findItemId(item);
          if (!itemId) {
            throw new Error('Não foi possível associar as customizações aos itens do pedido.');
          }
          item.details.forEach((detail) => {
            detailRows.push({
              order_item_id: itemId,
              field_id: detail.field_id,
              value: detail.value,
            });
          });
        });
      }

      if (detailRows.length > 0) {
        const { error: detailError } = await withAuthRetry(
          () => supabase.from('order_item_details').insert(detailRows),
          { label: 'create-order-item-details' }
        );
        if (detailError) {
          throw new Error(
            extractSupabaseErrorMessage(
              detailError,
              'Não foi possível salvar as customizações dos itens.'
            )
          );
        }
      }

      shouldRollback = false;

      const { data: fullOrder, error: fullOrderError } = await withAuthRetry(
        () =>
          supabase
            .from('orders')
            .select(ORDER_SELECT_BASE_WITH_ITEMS)
            .eq('id', createdOrderId as string)
            .single(),
        { label: 'create-order-fetch' }
      );
      if (fullOrderError || !fullOrder) {
        throw new Error(
          extractSupabaseErrorMessage(
            fullOrderError,
            'Pedido criado, mas não foi possível carregar os detalhes.'
          )
        );
      }

      onCreated(fullOrder as Order);
    } catch (err) {
      if (shouldRollback && createdOrderId) {
        let rollbackItemIds = [...createdOrderItemIds];
        if (rollbackItemIds.length === 0) {
          const { data: rollbackRows, error: rollbackLookupError } = await withAuthRetry(
            () => supabase.from('order_items').select('id').eq('order_id', createdOrderId as string),
            { label: 'create-order-rollback-items-lookup' }
          );
          if (!rollbackLookupError) {
            rollbackItemIds = ((rollbackRows ?? []) as Array<{ id: string }>).map((row) => row.id);
          }
        }

        if (rollbackItemIds.length > 0) {
          const { error: detailRollbackError } = await withAuthRetry(
            () => supabase.from('order_item_details').delete().in('order_item_id', rollbackItemIds),
            { label: 'create-order-details-rollback' }
          );
          if (detailRollbackError && import.meta.env.DEV) {
            console.error('Erro ao reverter customizações dos itens', {
              message: detailRollbackError.message,
              details: (detailRollbackError as any)?.details,
              hint: (detailRollbackError as any)?.hint,
              code: (detailRollbackError as any)?.code,
            });
          }
        }

        const { error: itemsRollbackError } = await withAuthRetry(
          () => supabase.from('order_items').delete().eq('order_id', createdOrderId as string),
          { label: 'create-order-items-rollback' }
        );
        if (itemsRollbackError && import.meta.env.DEV) {
          console.error('Erro ao reverter itens do pedido', {
            message: itemsRollbackError.message,
            details: (itemsRollbackError as any)?.details,
            hint: (itemsRollbackError as any)?.hint,
            code: (itemsRollbackError as any)?.code,
          });
        }

        const { error: orderRollbackError } = await withAuthRetry(
          () => supabase.from('orders').delete().eq('id', createdOrderId as string),
          { label: 'create-order-rollback' }
        );
        if (orderRollbackError && import.meta.env.DEV) {
          console.error('Erro ao reverter pedido', {
            message: orderRollbackError.message,
            details: (orderRollbackError as any)?.details,
            hint: (orderRollbackError as any)?.hint,
            code: (orderRollbackError as any)?.code,
          });
        }
      }

      if (import.meta.env.DEV) {
        console.error('Erro ao criar pedido no admin', err);
      }

      const message = extractSupabaseErrorMessage(err, 'Não foi possível criar o pedido agora.');
      setError(message);
      onToast(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const editingItem =
    itemEditor?.mode === 'edit'
      ? items.find((item) => item.client_id === itemEditor.targetId)
      : undefined;

  return (
    <div className="admin-modal-backdrop admin-modal-backdrop-full admin-order-create-backdrop" onClick={() => !saving && onClose()}>
      <div className="admin-modal admin-order-create-modal" onClick={(event) => event.stopPropagation()}>
        <div className="admin-modal-header admin-order-create-header">
          <div className="admin-order-create-header-copy">
            <div className="admin-order-create-header-topline">
              <span className="admin-order-create-header-spacer" aria-hidden="true" />
              <p className="admin-modal-subtitle">Pedido manual</p>
              <button
                type="button"
                className="admin-modal-close-icon"
                onClick={onClose}
                disabled={saving}
                aria-label="Fechar modal"
              >
                <FaTimes aria-hidden="true" focusable="false" />
              </button>
            </div>
            <h2 className="admin-modal-title">Adicionar Pedido</h2>
          </div>
        </div>

        <div className="admin-modal-body admin-order-create-body">
          <section className="admin-section">
            <div className="admin-section-header admin-orders-section-header">
              <div className="admin-orders-centered-heading">
                <p className="admin-section-kicker">Cliente</p>
                <h3 className="admin-section-title">Dados principais</h3>
              </div>
            </div>

            <div className="admin-form-grid">
              <label className="admin-field">
                <span>Nome *</span>
                <input
                  type="text"
                  className="admin-input"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nome do cliente"
                />
              </label>
              <label className="admin-field">
                <span>Telefone *</span>
                <input
                  type="text"
                  className="admin-input"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </label>
              <label className="admin-field">
                <span>Email</span>
                <input
                  type="email"
                  className="admin-input"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="cliente@email.com"
                />
              </label>
              <label className="admin-field">
                <span>Data do evento</span>
                <input
                  type="date"
                  className="admin-input"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </label>
              <label className="admin-field">
                <span>Status inicial *</span>
                <select
                  className="admin-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CreateOrderStatus)}
                >
                  {CREATE_ORDER_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-field">
                <span>Data de entrega {status === 'in_progress' ? '*' : ''}</span>
                <input
                  type="date"
                  className="admin-input"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </label>
              <label className="admin-field admin-field-full">
                <span>Observações</span>
                <textarea
                  className="admin-textarea"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Informações adicionais do pedido"
                />
              </label>
            </div>
          </section>

          <section className="admin-section">
            <div className="admin-section-header admin-orders-section-header">
              <div className="admin-orders-centered-heading">
                <p className="admin-section-kicker">Itens</p>
                <h3 className="admin-section-title">Produtos do pedido</h3>
              </div>
            </div>
            <div className="admin-section-actions admin-orders-section-actions-block">
              <button
                type="button"
                className="rounded-full font-sans font-bold bg-pink-500 text-white w-full py-2 mb-2"
                onClick={handleOpenCreateItem}
              >
                + Adicionar item
              </button>
            </div>

            {catalogLoading && <p className="admin-card-copy">Carregando produtos...</p>}
            {catalogError && <div className="admin-inline-error">{catalogError}</div>}

            <div className="admin-order-create-items-grid">
              {items.length === 0 ? (
                <div className="admin-order-create-items-empty">
                  Nenhum item adicionado. Clique em "Adicionar item" para começar.
                </div>
              ) : (
                items.map((item) => (
                  <article key={item.client_id} className="admin-order-create-item-card">
                    <div className="admin-order-create-item-card-copy">
                      <p className="admin-order-create-item-card-title">
                        {productById.get(item.product_id)?.name ?? 'Produto não selecionado'}
                      </p>
                      <p className="admin-order-create-item-card-price">{formatCurrency(item.subtotal_cents)}</p>
                    </div>
                    <button
                      type="button"
                      className="admin-order-create-item-card-edit"
                      onClick={() => handleOpenEditItem(item.client_id)}
                      aria-label="Editar item"
                      title="Editar item"
                    >
                      <FaEdit aria-hidden="true" focusable="false" />
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>

          <div className="admin-order-create-total">
            <span>Total do pedido</span>
            <strong>{formatCurrency(totalCents)}</strong>
          </div>

          {error && <div className="admin-inline-error">{error}</div>}

          <button
            type="button"
            className="admin-button admin-order-create-submit"
            onClick={handleSave}
            disabled={saving || catalogLoading}
          >
            {saving ? 'Salvando...' : 'Criar pedido'}
          </button>
        </div>
      </div>

      {itemEditor && (
        <CreateOrderItemEditorModal
          mode={itemEditor.mode}
          products={products}
          initialItem={editingItem}
          loadDetailFields={loadDetailFieldsForProduct}
          onClose={() => setItemEditor(null)}
          onSave={handleSaveItem}
          onDelete={itemEditor.mode === 'edit' ? handleDeleteEditingItem : undefined}
        />
      )}
    </div>
  );
}

function CreateOrderItemEditorModal({
  mode,
  products,
  initialItem,
  loadDetailFields,
  onClose,
  onSave,
  onDelete,
}: CreateOrderItemEditorModalProps) {
  const [productId, setProductId] = useState(initialItem?.product_id ?? '');
  const [quantity, setQuantity] = useState(Math.max(1, initialItem?.quantity ?? 1));
  const [unitPriceInput, setUnitPriceInput] = useState(initialItem?.unitPriceInput ?? '');
  const [unitPriceCents, setUnitPriceCents] = useState(initialItem?.unit_price_cents ?? 0);
  const [manualPrice, setManualPrice] = useState(initialItem?.manualPrice ?? false);
  const [detailFields, setDetailFields] = useState<ProductDetailField[]>([]);
  const [detailValues, setDetailValues] = useState<Record<string, DetailValueDraft>>({});
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [optionFilters, setOptionFilters] = useState<Record<string, string>>({});
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productId),
    [products, productId]
  );

  const detailSelections = useMemo(
    () => buildDetailSelections(detailFields, detailValues),
    [detailFields, detailValues]
  );

  const detailExtraPriceCents = useMemo(
    () =>
      detailSelections.reduce(
        (acc, selection) =>
          acc + (Number.isFinite(selection.extraPriceDeltaCents) ? selection.extraPriceDeltaCents : 0),
        0
      ),
    [detailSelections]
  );

  const subtotalCents = useMemo(
    () => Math.max(1, quantity) * Math.max(0, unitPriceCents),
    [quantity, unitPriceCents]
  );

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      if (!productId) {
        setDetailFields([]);
        setDetailValues({});
        setDetailErrors({});
        return;
      }

      setLoadingDetails(true);
      setDetailsError(null);
      try {
        const fields = await loadDetailFields(productId);
        if (ignore) return;
        setDetailFields(fields);
        setDetailValues(() => {
          const nextValues: Record<string, DetailValueDraft> = {};
          fields.forEach((field) => {
            const key = field.id ?? field.field_key;
            const initialValue =
              initialItem && initialItem.product_id === productId
                ? getInitialDetailValueFromItem(field, initialItem.details)
                : undefined;
            nextValues[key] = normalizeDetailValueForField(field, initialValue);
          });
          return nextValues;
        });
        setDetailErrors({});
        setOptionFilters({});
      } catch (err) {
        if (ignore) return;
        const message = err instanceof Error ? err.message : 'Não foi possível carregar as customizações.';
        setDetailsError(message);
      } finally {
        if (!ignore) setLoadingDetails(false);
      }
    };

    void load();
    return () => {
      ignore = true;
    };
  }, [initialItem, loadDetailFields, productId]);

  useEffect(() => {
    if (!productId || manualPrice) return;
    let ignore = false;
    const syncAutoPrice = async () => {
      let basePriceCents: number | null = null;
      try {
        const resolved = await resolveUnitPriceCents(productId, Math.max(1, quantity));
        if (typeof resolved === 'number' && Number.isFinite(resolved)) {
          basePriceCents = Math.max(0, Math.round(resolved));
        }
      } catch {
        basePriceCents = null;
      }

      if (basePriceCents === null) {
        const fallback = Number(selectedProduct?.base_price_cents);
        basePriceCents = Number.isFinite(fallback) ? Math.max(0, fallback) : 0;
      }

      const nextUnitPrice = Math.max(0, basePriceCents + detailExtraPriceCents);
      if (ignore) return;
      setUnitPriceCents(nextUnitPrice);
      setUnitPriceInput(centsToInput(nextUnitPrice));
    };

    void syncAutoPrice();
    return () => {
      ignore = true;
    };
  }, [detailExtraPriceCents, manualPrice, productId, quantity, selectedProduct?.base_price_cents]);

  const updateDetailValue = (key: string, value: DetailValueDraft) => {
    setDetailValues((prev) => ({ ...prev, [key]: value }));
    setDetailErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleChangeProduct = (nextProductId: string) => {
    setProductId(nextProductId);
    setManualPrice(false);
    setError(null);
    const product = products.find((entry) => entry.id === nextProductId);
    const minQuantity = Math.max(1, Number(product?.min_quantity) || 1);
    setQuantity(minQuantity);
    if (!nextProductId) {
      setUnitPriceCents(0);
      setUnitPriceInput('');
    }
  };

  const handleChangePrice = (value: string) => {
    setManualPrice(true);
    setUnitPriceInput(value);
    setUnitPriceCents(parseCurrencyInput(value));
  };

  const handleResetAutoPrice = () => {
    setManualPrice(false);
  };

  const validateDetails = () => {
    const nextErrors: Record<string, string> = {};
    detailFields.forEach((field) => {
      const key = field.id ?? field.field_key;
      if (field.input_type === 'multi_select') {
        const selectedValues = getDetailSelectedValues(detailValues[key]);
        if (field.is_required && selectedValues.length === 0) {
          nextErrors[key] = 'Obrigatório';
          return;
        }
        const validOptions = new Set((field.options ?? []).map((option) => option.value));
        if (selectedValues.some((value) => !validOptions.has(value))) {
          nextErrors[key] = 'Selecione opções válidas';
        }
        return;
      }

      const value = getDetailTextValue(detailValues[key]);
      if (field.is_required && !value) {
        nextErrors[key] = 'Obrigatório';
        return;
      }

      if (field.input_type === 'select' && value) {
        const optionExists = field.options?.some((option) => option.value === value);
        if (!optionExists) {
          nextErrors[key] = 'Selecione uma opção válida';
        }
      }
    });

    setDetailErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = () => {
    setError(null);
    if (!productId) {
      setError('Selecione um produto.');
      return;
    }
    if (quantity < 1) {
      setError('A quantidade mínima é 1.');
      return;
    }
    if (!validateDetails()) {
      setError('Preencha as customizações obrigatórias.');
      return;
    }

    const normalizedSelections = mapSelectionsToDetailDraft(detailSelections);
    const normalizedUnitPrice = Number.isFinite(unitPriceCents) ? Math.max(0, unitPriceCents) : 0;
    const normalizedQuantity = Math.max(1, quantity);

    onSave({
      client_id: initialItem?.client_id ?? createTempId(),
      product_id: productId,
      quantity: normalizedQuantity,
      unit_price_cents: normalizedUnitPrice,
      unitPriceInput: manualPrice ? unitPriceInput : centsToInput(normalizedUnitPrice),
      subtotal_cents: normalizedQuantity * normalizedUnitPrice,
      manualPrice,
      details: normalizedSelections,
    });
  };

  return (
    <div
      className="admin-modal-backdrop admin-order-item-editor-backdrop"
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <div className="admin-modal admin-order-item-editor-modal" onClick={(event) => event.stopPropagation()}>
        <div className="admin-modal-header admin-order-item-editor-header">
          <div className="admin-order-create-header-copy">
            <div className="admin-order-create-header-topline">
              <span className="admin-order-create-header-spacer" aria-hidden="true" />
              <p className="admin-modal-subtitle">{mode === 'create' ? 'Novo item' : 'Editar item'}</p>
              <button
                type="button"
                className="admin-modal-close-icon"
                onClick={onClose}
                aria-label="Fechar modal"
              >
                <FaTimes aria-hidden="true" focusable="false" />
              </button>
            </div>
            <h2 className="admin-modal-title">{mode === 'create' ? 'Adicionar item' : 'Editar item'}</h2>
          </div>
        </div>

        <div className="admin-modal-body admin-order-item-editor-body">
          <div className="admin-form-grid">
            <label className="admin-field">
              <span>Produto *</span>
              <select
                className="admin-select"
                value={productId}
                onChange={(event) => handleChangeProduct(event.target.value)}
              >
                <option value="">Selecione</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="admin-field">
              <span>Quantidade *</span>
              <input
                type="number"
                min={1}
                className="admin-input"
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
              />
            </label>

            <label className="admin-field">
              <span>Preço unitário (R$)</span>
              <input
                type="text"
                className="admin-input"
                inputMode="decimal"
                value={unitPriceInput}
                onChange={(event) => handleChangePrice(event.target.value)}
                placeholder="0,00"
              />
            </label>

            <div className="admin-field">
              <span>&nbsp;</span>
              <button
                type="button"
                className="admin-button-ghost admin-button-small"
                onClick={handleResetAutoPrice}
                disabled={!productId}
              >
                Preço automático
              </button>
            </div>
          </div>

          <div className="admin-order-item-editor-subtotal">
            Subtotal: <strong>{formatCurrency(subtotalCents)}</strong>
          </div>

          <section className="admin-section">
            <div className="admin-section-header admin-orders-section-header">
              <div className="admin-orders-centered-heading">
                <p className="admin-section-kicker">Customização</p>
                <h3 className="admin-section-title">Campos do produto</h3>
              </div>
            </div>

            {loadingDetails && <p className="admin-card-copy">Carregando customizações...</p>}
            {detailsError && <div className="admin-inline-error">{detailsError}</div>}

            {!loadingDetails && !detailsError && (
              <>
                {detailFields.length === 0 ? (
                  <p className="admin-card-copy">Esse produto não possui customizações ativas.</p>
                ) : (
                  <div className="admin-order-item-detail-grid">
                    {detailFields.map((field) => {
                      const key = field.id ?? field.field_key;
                      const rawValue = detailValues[key];
                      const value = Array.isArray(rawValue) ? rawValue[0] ?? '' : rawValue ?? '';
                      const selectedValues = getDetailSelectedValues(rawValue);
                      const options = field.options ?? [];
                      const currentFilter = optionFilters[key] ?? '';
                      const filteredOptions = options.filter((option) => {
                        if (!currentFilter.trim()) return true;
                        const term = currentFilter.toLowerCase();
                        return (
                          option.label.toLowerCase().includes(term) ||
                          option.value.toLowerCase().includes(term)
                        );
                      });
                      const selectedOption =
                        field.input_type === 'select' && value
                          ? options.find((option) => option.value === value)
                          : undefined;
                      const optionsForSelect =
                        field.input_type === 'select' &&
                        selectedOption &&
                        !filteredOptions.some((option) => option.value === value)
                          ? [...filteredOptions, selectedOption]
                          : filteredOptions;

                      return (
                        <div key={key} className="admin-order-item-detail-card">
                          <label className="admin-field">
                            <span>
                              {field.label}
                              {field.is_required ? ' *' : ''}
                            </span>

                            {options.length > 8 && (field.input_type === 'select' || field.input_type === 'multi_select') && (
                              <input
                                type="text"
                                className="admin-input admin-order-item-option-filter"
                                placeholder="Buscar opção..."
                                value={currentFilter}
                                onChange={(event) =>
                                  setOptionFilters((prev) => ({ ...prev, [key]: event.target.value }))
                                }
                              />
                            )}

                            {field.input_type === 'textarea' ? (
                              <textarea
                                className="admin-textarea"
                                value={value}
                                onChange={(event) => updateDetailValue(key, event.target.value)}
                                placeholder="Digite aqui"
                              />
                            ) : field.input_type === 'select' ? (
                              <select
                                className="admin-select"
                                value={value}
                                onChange={(event) => updateDetailValue(key, event.target.value)}
                              >
                                <option value="">Selecione</option>
                                {optionsForSelect.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                    {option.extra_price_delta_cents
                                      ? ` (+${formatCurrency(option.extra_price_delta_cents)})`
                                      : ''}
                                  </option>
                                ))}
                              </select>
                            ) : field.input_type === 'multi_select' ? (
                              <div className="admin-order-item-multi-options">
                                {filteredOptions.length === 0 ? (
                                  <p className="admin-card-copy">Nenhuma opção encontrada.</p>
                                ) : (
                                  filteredOptions.map((option) => {
                                    const checked = selectedValues.includes(option.value);
                                    return (
                                      <label key={option.value} className="admin-order-item-multi-option-row">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={(event) => {
                                            const currentValues = getDetailSelectedValues(detailValues[key]);
                                            const nextValues = event.target.checked
                                              ? Array.from(new Set([...currentValues, option.value]))
                                              : currentValues.filter((itemValue) => itemValue !== option.value);
                                            updateDetailValue(key, nextValues);
                                          }}
                                        />
                                        <span>
                                          {option.label}
                                          {option.extra_price_delta_cents
                                            ? ` (+${formatCurrency(option.extra_price_delta_cents)})`
                                            : ''}
                                        </span>
                                      </label>
                                    );
                                  })
                                )}
                              </div>
                            ) : (
                              <input
                                type="text"
                                className="admin-input"
                                value={value}
                                onChange={(event) => updateDetailValue(key, event.target.value)}
                                placeholder="Digite aqui"
                              />
                            )}
                          </label>

                          {detailErrors[key] ? (
                            <p className="admin-inline-error" style={{ margin: 0 }}>
                              {detailErrors[key]}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </section>

          {error && <div className="admin-inline-error">{error}</div>}

          <div className="admin-order-item-editor-actions">
            {mode === 'edit' && onDelete ? (
              <button
                type="button"
                className="admin-order-item-delete-button"
                onClick={onDelete}
              >
                <FaTrash aria-hidden="true" focusable="false" />
                Excluir item
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              className="admin-button admin-order-item-save-button"
              onClick={handleSave}
            >
              Salvar item
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderDetailModal({ order, onClose, onUpdated, setSelectedOrder, onToast }: OrderDetailModalProps) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const canDelete = order.status === 'rejected' || order.status === 'canceled';

  const renderPayment = () => (
    <div className="admin-section">
      <div className="admin-section-header admin-orders-section-header">
        <div className="admin-orders-centered-heading">
          <p className="admin-section-kicker">Pagamento</p>
          <h3 className="admin-section-title pb-4">Status financeiro</h3>
        </div>
      </div>
      <div className="admin-card-grid">
        <div className="admin-card ">
          <p className="admin-card-title">Método</p>
          <p className="admin-card-copy text-center pt-2">{formatPaymentMethod(order.payment_method)}</p>
        </div>
        <div className="admin-card">
          <p className="admin-card-title">Status</p>
          <p className="admin-card-copy text-center pt-2">{formatPaymentStatus(order.payment_status)}</p>
        </div>
        <div className="admin-card">
          <p className="admin-card-title">Pagamento em aberto?</p>
          <p className="admin-card-copy text-center pt-2">{formatPaymentDue(order.payment_due)}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="admin-modal-backdrop">
      <div className="admin-modal admin-order-detail-modal" style={{ maxHeight: '90vh' }}>
        <div className="admin-modal-header admin-order-modal-header-inline">
          <div className="admin-order-modal-header-copy">
            <div className="admin-order-modal-subtitle-row">
              <p className="admin-modal-subtitle">Pedido</p>
              <button type="button" className="admin-modal-close-icon" onClick={onClose} aria-label="Fechar modal">
                <FaTimes aria-hidden="true" focusable="false" />
              </button>
            </div>
            <h2 className="admin-modal-title">#{order.id}</h2>
            <p className="admin-modal-helper pt-2">Criado em {formatDateTime(order.created_at)}</p>
          </div>
        </div>

        <div className="admin-modal-body">
          <div className="admin-order-modal-status-row">
            <span className={statusClass(order.status)}>{STATUS_TABS.find((s) => s.value === order.status)?.label}</span>
          </div>

          <div className="admin-card-grid admin-order-info-grid">
            <div className="admin-card admin-order-info-card">
              <p className="admin-card-title admin-order-info-title">
                <FaUser aria-hidden="true" focusable="false" />
                <span>Cliente</span>
              </p>
              <p className="admin-card-copy">{formatOptionalText(order.customer_name)}</p>
              <p className="admin-card-copy">Telefone: {formatOptionalText(order.customer_phone)}</p>
            </div>
            <div className="admin-card admin-order-info-card">
              <p className="admin-card-title admin-order-info-title">
                <FaMapMarkerAlt aria-hidden="true" focusable="false" />
                <span>Endereço</span>
              </p>
              <p className="admin-card-copy">{formatOrderAddress(order)}</p>
            </div>
            <div className="admin-card admin-order-info-card">
              <p className="admin-card-title admin-order-info-title">
                <FaCalendarAlt aria-hidden="true" focusable="false" />
                <span>Datas</span>
              </p>
              <p className="admin-card-copy">Entrega: {formatDate(order.delivery_date)}</p>
            </div>
            <div className="admin-card admin-order-info-card">
              <p className="admin-card-title admin-order-info-title">
                <FaRegCommentDots aria-hidden="true" focusable="false" />
                <span>Observações</span>
              </p>
              <p className="admin-card-copy">{formatOptionalText(order.note)}</p>
            </div>
          </div>

          <div className="admin-section">
            <div className="admin-section-header admin-orders-section-header">
              <div className="admin-orders-centered-heading">
                <p className="admin-section-kicker">Itens</p>
                <h3 className="admin-section-title pb-4">Produtos do pedido</h3>
              </div>
            </div>
            <div className="admin-section-actions admin-orders-section-actions-block">
              <p className="text-center rounded-full bg-pink-600 text-white font-sans font-bold bold py-4 mb-4">
                Total: {formatCurrency(order.total_cents)}
              </p>
            </div>

            <div className="admin-orders-desktop-only">
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

            <div className="admin-orders-mobile-only">
              <div className="admin-order-mobile-item-list" role="list" aria-label="Itens do pedido">
                {order.order_items && order.order_items.length > 0 ? (
                  order.order_items.map((item) => {
                    const meta = getOrderItemMetaText(item);
                    return (
                      <article
                        key={item.id ?? `${item.product_id}-${item.product_option_id}`}
                        role="listitem"
                        className="admin-order-mobile-item-card"
                      >
                        <div className="admin-order-mobile-item-head">
                          <p className="admin-order-mobile-item-name">{getOrderItemDisplayName(item)}</p>
                          <span className="admin-order-mobile-item-qty">Qtd {item.quantity}</span>
                        </div>
                        {meta ? <p className="admin-order-mobile-item-meta">{meta}</p> : null}
                        <div className="admin-order-mobile-item-values">
                          <p>
                            <span>Preço</span>
                            <strong>{formatCurrency(item.unit_price_cents)}</strong>
                          </p>
                          <p>
                            <span>Subtotal</span>
                            <strong>{formatCurrency(item.subtotal_cents)}</strong>
                          </p>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="admin-order-mobile-empty-card">Sem itens listados.</div>
                )}
              </div>
            </div>
          </div>

          {renderPayment()}

          {(order.rejection_reason_text || order.cancellation_reason_code || order.cancellation_reason_text) && (
            <div className="admin-section">
              <div className="admin-section-header admin-orders-section-header">
                <div className="admin-orders-centered-heading">
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
          <div className="admin-order-detail-actions-block">
            <span className="admin-card-copy admin-order-modal-total bg-pink-600 mb-2">Total: {formatCurrency(order.total_cents)}</span>
            <div className="admin-footer-actions">
              {order.status === 'pending' && (
                <div className="admin-order-pending-actions">

                  <button
                    type="button"
                    className="flex flex-col items-center justify-center gap-1 rounded-full font-sans font-bold text-white bg-red-600 py-3 px-4"
                    onClick={() => setRejectOpen(true)}
                  >
                    <IoClose className="text-2xl font-bold" />
                    <span>Reprovar Pedido</span>
                  </button>
                  <button
                    type="button"
                    className="flex flex-col items-center justify-center gap-1 rounded-full font-sans font-bold text-white bg-green-600 py-3 px-4"
                    onClick={() => setApproveOpen(true)}
                  >
                    <FaCheck className="text-lg" />
                    <span>Aprovar e iniciar</span>
                  </button>
                </div>
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
  const [paymentMethod, setPaymentMethod] = useState<string>(order.payment_method ?? 'pix');
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
    const confirmed = window.confirm('Confirmar aprovação e início do pedido? Esta ação não pode ser desfeita.');
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
        payment_method: paymentMethod,
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
            .select(ORDER_SELECT_BASE_WITH_ITEMS)
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
    <div className="admin-modal-backdrop admin-order-action-backdrop">
      <div className="admin-modal admin-order-approve-modal admin-order-action-modal" style={{ maxHeight: '90vh' }}>
        <div className="admin-modal-header admin-order-modal-header-inline">
          <div className="admin-order-modal-header-copy">
            <div className="admin-order-modal-subtitle-row">
              <p className="admin-modal-subtitle">Aprovar pedido</p>
              <button type="button" className="admin-modal-close-icon" onClick={onClose} aria-label="Fechar modal">
                <FaTimes aria-hidden="true" focusable="false" />
              </button>
            </div>
            <h2 className="admin-modal-title">#{order.id}</h2>
          </div>
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
            <div className="admin-section-header admin-orders-section-header">
              <div className="admin-orders-centered-heading">
                <p className="admin-section-kicker">Itens</p>
                <h3 className="admin-section-title">Ajustar quantidades/preços</h3>
              </div>
            </div>
            <div className="admin-section-actions admin-orders-section-actions-block">
              <p className="admin-card-copy admin-order-section-total">Total: {formatCurrency(totalCents)}</p>
            </div>

            <div className="admin-orders-desktop-only">
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

            <div className="admin-orders-mobile-only">
              <div className="admin-order-mobile-item-list admin-order-mobile-item-list-editable" role="list" aria-label="Ajuste de itens">
                {items.map((item, index) => {
                  const meta = getOrderItemMetaText(item);
                  return (
                    <article key={item.id ?? index} role="listitem" className="admin-order-mobile-item-card">
                      <div className="admin-order-mobile-item-head">
                        <p className="admin-order-mobile-item-name">{getOrderItemDisplayName(item)}</p>
                        <span className="admin-order-mobile-item-qty">Qtd {item.quantity}</span>
                      </div>
                      {meta ? <p className="admin-order-mobile-item-meta">{meta}</p> : null}
                      <div className="admin-order-mobile-edit-grid">
                        <label className="admin-field">
                          <span>Quantidade</span>
                          <input
                            type="number"
                            min={1}
                            className="admin-input"
                            value={item.quantity}
                            onChange={(e) => handleChangeItem(index, 'quantity', e.target.value)}
                          />
                        </label>
                        <label className="admin-field">
                          <span>Preço unitário (R$)</span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="admin-input"
                            value={item.unit_price_cents / 100}
                            onChange={(e) => handleChangeItem(index, 'unit_price_cents', e.target.value)}
                          />
                        </label>
                      </div>
                      <p className="admin-order-mobile-item-subtotal">
                        Subtotal: <strong>{formatCurrency(item.subtotal_cents)}</strong>
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
          {error && <div className="admin-inline-error">{error}</div>}
        </div>
        <div className="admin-modal-footer">
          <div className="admin-footer-actions">
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
    const confirmed = window.confirm('Confirmar reprovação do pedido? Esta ação não pode ser desfeita.');
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
            .select(ORDER_SELECT_BASE_WITH_ITEMS)
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
    <div className="admin-modal-backdrop admin-order-action-backdrop admin-order-reject-backdrop">
      <div className="admin-modal admin-order-reject-modal admin-order-action-modal">
        <div className="admin-modal-header admin-order-modal-header-inline">
          <div className="admin-order-modal-header-copy">
            <div className="admin-order-modal-subtitle-row">
              <p className="admin-modal-subtitle">Reprovar pedido</p>
              <button type="button" className="admin-modal-close-icon" onClick={onClose} aria-label="Fechar modal">
                <FaTimes aria-hidden="true" focusable="false" />
              </button>
            </div>
            <h2 className="admin-modal-title">#{order.id}</h2>
          </div>
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
        <div className="admin-modal-footer admin-order-reject-footer">
          <div className="admin-footer-actions">
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
            .select(ORDER_SELECT_BASE_WITH_ITEMS)
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
    <div className="admin-modal-backdrop admin-order-action-backdrop">
      <div className="admin-modal admin-order-action-modal admin-order-cancel-modal">
        <div className="admin-modal-header admin-order-modal-header-inline">
          <div className="admin-order-modal-header-copy">
            <div className="admin-order-modal-subtitle-row">
              <p className="admin-modal-subtitle">Cancelar pedido</p>
              <button type="button" className="admin-modal-close-icon" onClick={onClose} aria-label="Fechar modal">
                <FaTimes aria-hidden="true" focusable="false" />
              </button>
            </div>
            <h2 className="admin-modal-title">#{order.id}</h2>
          </div>
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
    <div className="admin-modal-backdrop admin-order-action-backdrop">
      <div className="admin-modal admin-order-action-modal admin-order-delete-modal">
        <div className="admin-modal-header admin-order-modal-header-inline">
          <div className="admin-order-modal-header-copy">
            <div className="admin-order-modal-subtitle-row">
              <p className="admin-modal-subtitle">Excluir pedido</p>
              <button type="button" className="admin-modal-close-icon" onClick={onClose} aria-label="Fechar modal">
                <FaTimes aria-hidden="true" focusable="false" />
              </button>
            </div>
            <h2 className="admin-modal-title">#{order.id}</h2>
          </div>
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
            .select(ORDER_SELECT_BASE_WITH_ITEMS)
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
    <div className="admin-modal-backdrop admin-order-action-backdrop">
      <div className="admin-modal admin-order-action-modal admin-order-finish-modal">
        <div className="admin-modal-header admin-order-modal-header-inline">
          <div className="admin-order-modal-header-copy">
            <div className="admin-order-modal-subtitle-row">
              <p className="admin-modal-subtitle">Concluir pedido</p>
              <button type="button" className="admin-modal-close-icon" onClick={onClose} aria-label="Fechar modal">
                <FaTimes aria-hidden="true" focusable="false" />
              </button>
            </div>
            <h2 className="admin-modal-title">#{order.id}</h2>
          </div>
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
