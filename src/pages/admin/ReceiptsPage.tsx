import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { FaRegCopy, FaSearch } from 'react-icons/fa';
import { jsPDF } from 'jspdf';
import { AdminPageHeader } from '../../components/admin/AdminPrimitives';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/AuthProvider';

type OrderStatus = 'pending' | 'in_progress' | 'finished' | 'rejected' | 'canceled';

type OrderItemDetail = {
  id: string;
  value: string;
  field?: { label?: string | null } | null;
};

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
  details?: OrderItemDetail[];
};

type Order = {
  id: string;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email?: string | null;
  total_cents: number;
  status: OrderStatus;
  delivery_date?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  payment_due?: boolean | null;
  order_items?: OrderItem[];
};

type ReceiptPayloadItem = {
  description: string;
  quantity: number;
  unit_price_cents: number;
  subtotal_cents: number;
};

type ReceiptPayload = {
  order_id: string;
  receipt_number: string;
  customer_name: string;
  customer_phone: string;
  order_date: string | null;
  delivery_date: string | null;
  payment_date: string | null;
  payment_method: string | null;
  amount_paid_cents: number;
  items: ReceiptPayloadItem[];
};

type ReceiptRecord = {
  id: string;
  order_id: string;
  receipt_number: string;
  issued_at: string | null;
  receipt_payload?: ReceiptPayload | null;
};

type ReceiptEntry = {
  kind: 'issued' | 'pending';
  receipt: ReceiptRecord | null;
  order: Order | null;
  payload: ReceiptPayload | null;
};

type ReceiptDraftItem = ReceiptPayloadItem & {
  id: string;
  unitPriceInput: string;
};

type ReceiptDraft = {
  id?: string;
  order_id: string;
  receipt_number: string;
  issued_at: string;
  order_date: string;
  delivery_date: string;
  payment_date: string;
  customer_name: string;
  customer_phone: string;
  payment_method: string;
  amount_paid_cents: number;
  amountPaidInput: string;
  items: ReceiptDraftItem[];
};

type ReceiptPdfData = ReceiptPayload & {
  issued_at: string | null;
};

const SHORT_ID_LENGTH = 8;
const RECEIPT_NUMBER_START = 1000;
const EMPTY_LABEL = 'Não informado';

const STATUS_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'issued', label: 'Emitidos' },
  { value: 'pending', label: 'Pendentes' },
] as const;

const DATE_FILTER_OPTIONS = [
  { value: 'issued_at', label: 'Data de emissão' },
  { value: 'order_date', label: 'Data do pedido' },
  { value: 'payment_date', label: 'Data do pagamento' },
  { value: 'delivery_date', label: 'Data de entrega' },
] as const;

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

const ORDER_SELECT_WITH_ITEMS = `
  id,
  created_at,
  customer_name,
  customer_phone,
  customer_email,
  total_cents,
  status,
  delivery_date,
  payment_method,
  payment_status,
  payment_due,
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

const createTempId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;

const formatShortId = (id: string, length = SHORT_ID_LENGTH) =>
  id.length > length ? `${id.slice(0, length)}...` : id;

const formatCurrencyFromCents = (cents: number | null | undefined) => {
  const value = Number.isFinite(cents) ? Number(cents) : 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value / 100);
};

const centsToInput = (cents: number | null | undefined) => {
  if (cents === null || cents === undefined) return '';
  const value = (cents / 100).toFixed(2);
  return value.replace('.', ',');
};

const parseCurrencyInput = (value: string) => {
  const normalized = value.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  return Number(normalized);
};

const parseDateOnly = (value: string | null | undefined) => {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toInputDate = (value: string | null | undefined) => {
  const date = parseDateOnly(value);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toIsoFromInputDate = (value: string) => {
  if (!value) return null;
  const date = parseDateOnly(value);
  if (!date) return null;
  const safe = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  return safe.toISOString();
};

const formatDisplayDate = (value: string | null | undefined) => {
  const date = parseDateOnly(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('pt-BR').format(date);
};

const formatPaymentMethod = (value: string | null | undefined) => {
  if (!value) return EMPTY_LABEL;
  const normalized = value.toLowerCase();
  return PAYMENT_METHOD_LABELS[normalized] ?? value;
};

const getOrderItemDescription = (item: OrderItem) => {
  const baseName = item.product?.name?.trim() || 'Item';
  const optionName = item.product_option?.option_name?.trim();
  const base = optionName ? `${baseName} (${optionName})` : baseName;

  const detailParts = [
    item.flavor && `Sabor: ${item.flavor}`,
    item.coverage && `Cobertura: ${item.coverage}`,
    item.size && `Tamanho: ${item.size}`,
    item.ribbon_width && `Fita: ${item.ribbon_width}`,
    item.ribbon_color && `Cor: ${item.ribbon_color}`,
    item.form_color && `Forminha: ${item.form_color}`,
  ].filter(Boolean) as string[];

  const extraDetails = (item.details ?? [])
    .map((detail) => {
      const label = detail.field?.label ?? 'Detalhe';
      const value = detail.value?.trim();
      if (!value) return null;
      return `${label}: ${value}`;
    })
    .filter(Boolean) as string[];

  const details = [...detailParts, ...extraDetails];
  return details.length ? `${base} - ${details.join(', ')}` : base;
};

const buildReceiptPayloadFromOrder = (order: Order | null, receiptNumber: string): ReceiptPayload => {
  const items = (order?.order_items ?? []).map((item) => {
    const quantity = Number.isFinite(item.quantity) ? item.quantity : 1;
    const unitPrice = Number.isFinite(item.unit_price_cents) ? item.unit_price_cents : 0;
    const subtotal = Number.isFinite(item.subtotal_cents) ? item.subtotal_cents : quantity * unitPrice;
    return {
      description: getOrderItemDescription(item),
      quantity,
      unit_price_cents: unitPrice,
      subtotal_cents: subtotal,
    };
  });

  return {
    order_id: order?.id ?? '',
    receipt_number: receiptNumber,
    customer_name: order?.customer_name ?? '',
    customer_phone: order?.customer_phone ?? '',
    order_date: order?.created_at ? toInputDate(order.created_at) : null,
    delivery_date: order?.delivery_date ? toInputDate(order.delivery_date) : null,
    payment_date: null,
    payment_method: order?.payment_method ?? null,
    amount_paid_cents: Number.isFinite(order?.total_cents) ? order!.total_cents : 0,
    items,
  };
};

const normalizeReceiptPayload = (
  payload: ReceiptPayload | null | undefined,
  order: Order | null,
  receiptNumber: string
): ReceiptPayload => {
  const base = buildReceiptPayloadFromOrder(order, receiptNumber);
  const safeItems = (payload?.items ?? [])
    .filter((item) => item && typeof item.description === 'string')
    .map((item) => {
      const quantity = Number.isFinite(item.quantity) ? item.quantity : 1;
      const unitPrice = Number.isFinite(item.unit_price_cents) ? item.unit_price_cents : 0;
      const subtotal = Number.isFinite(item.subtotal_cents) ? item.subtotal_cents : quantity * unitPrice;
      return {
        description: item.description,
        quantity,
        unit_price_cents: unitPrice,
        subtotal_cents: subtotal,
      };
    });

  return {
    ...base,
    ...payload,
    order_id: payload?.order_id ?? base.order_id,
    receipt_number: payload?.receipt_number?.trim() || receiptNumber,
    customer_name: payload?.customer_name?.trim() || base.customer_name,
    customer_phone: payload?.customer_phone?.trim() || base.customer_phone,
    order_date: payload?.order_date ?? base.order_date,
    delivery_date: payload?.delivery_date ?? base.delivery_date,
    payment_date: payload?.payment_date ?? base.payment_date,
    payment_method: payload?.payment_method ?? base.payment_method,
    amount_paid_cents: Number.isFinite(payload?.amount_paid_cents) ? payload!.amount_paid_cents : base.amount_paid_cents,
    items: safeItems.length > 0 ? safeItems : base.items,
  };
};

const buildReceiptDraft = (
  receipt: ReceiptRecord | null,
  order: Order | null,
  fallbackNumber: string
): ReceiptDraft => {
  const receiptNumber = receipt?.receipt_number?.trim() || fallbackNumber;
  const payload = normalizeReceiptPayload(receipt?.receipt_payload, order, receiptNumber);

  const resolvedItems =
    payload.items.length > 0
      ? payload.items
      : [
          {
            description: '',
            quantity: 1,
            unit_price_cents: 0,
            subtotal_cents: 0,
          },
        ];

  const items = resolvedItems.map((item) => ({
    ...item,
    id: createTempId('item'),
    unitPriceInput: centsToInput(item.unit_price_cents),
  }));

  const amountPaid = Number.isFinite(payload.amount_paid_cents) ? payload.amount_paid_cents : 0;

  return {
    id: receipt?.id,
    order_id: receipt?.order_id ?? order?.id ?? '',
    receipt_number: receiptNumber,
    issued_at: toInputDate(receipt?.issued_at ?? new Date().toISOString()),
    order_date: payload.order_date ?? '',
    delivery_date: payload.delivery_date ?? '',
    payment_date: payload.payment_date ?? '',
    customer_name: payload.customer_name ?? '',
    customer_phone: payload.customer_phone ?? '',
    payment_method: payload.payment_method ?? '',
    amount_paid_cents: amountPaid,
    amountPaidInput: centsToInput(amountPaid),
    items,
  };
};

const getNextReceiptNumber = (receipts: ReceiptRecord[]) => {
  const numbers = receipts
    .map((receipt) => Number.parseInt(receipt.receipt_number?.replace(/\D/g, '') ?? '', 10))
    .filter((value) => Number.isFinite(value));
  const next = numbers.length > 0 ? Math.max(...numbers) + 1 : RECEIPT_NUMBER_START;
  return `R-${next}`;
};

const buildPdfDataFromDraft = (draft: ReceiptDraft): ReceiptPdfData => ({
  order_id: draft.order_id,
  receipt_number: draft.receipt_number,
  customer_name: draft.customer_name,
  customer_phone: draft.customer_phone,
  order_date: draft.order_date || null,
  delivery_date: draft.delivery_date || null,
  payment_date: draft.payment_date || null,
  payment_method: draft.payment_method || null,
  amount_paid_cents: draft.amount_paid_cents,
  items: draft.items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unit_price_cents: item.unit_price_cents,
    subtotal_cents: item.subtotal_cents,
  })),
  issued_at: draft.issued_at || null,
});

const buildPdfDataFromEntry = (entry: ReceiptEntry): ReceiptPdfData => {
  const receiptNumber = entry.receipt?.receipt_number ?? entry.payload?.receipt_number ?? '';
  const payload = normalizeReceiptPayload(entry.payload, entry.order, receiptNumber);
  return {
    ...payload,
    issued_at: entry.receipt?.issued_at ?? null,
  };
};

const buildReceiptPdf = async (data: ReceiptPdfData) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  let cursorY = margin;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  const brandText = 'Sweet Child - Palhas artesanais';
  const titleText = 'Recibo do pedido';
  const brandSize = 20;
  const titleSize = 14;
  const lineGap = 6;
  const headerTop = margin;
  const contentCenterX = pageWidth / 2;
  const brandY = headerTop + brandSize;
  const titleY = brandY + lineGap + titleSize;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(brandSize);
  doc.text(brandText, contentCenterX, brandY, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(titleSize);
  doc.text(titleText, contentCenterX, titleY, { align: 'center' });
  cursorY = titleY + 18;

  doc.setFontSize(12);
  doc.text('Dados do pedido', margin, cursorY);
  cursorY += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Recibo: ${data.receipt_number || '-'}`, margin, cursorY);
  cursorY += 14;
  doc.text(`Pedido: ${data.order_id || '-'}`, margin, cursorY);
  cursorY += 14;
  doc.text(`Cliente: ${data.customer_name || EMPTY_LABEL}`, margin, cursorY);
  cursorY += 14;
  doc.text(`Telefone: ${data.customer_phone || EMPTY_LABEL}`, margin, cursorY);
  cursorY += 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Datas', margin, cursorY);
  cursorY += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Pedido: ${formatDisplayDate(data.order_date)}`, margin, cursorY);
  cursorY += 14;
  doc.text(`Entrega: ${formatDisplayDate(data.delivery_date)}`, margin, cursorY);
  cursorY += 14;
  doc.text(`Pagamento: ${formatDisplayDate(data.payment_date)}`, margin, cursorY);
  cursorY += 14;
  doc.text(`Emissão: ${formatDisplayDate(data.issued_at)}`, margin, cursorY);
  cursorY += 20;

  const items =
    data.items.length > 0
      ? data.items
      : [{ description: 'Item', quantity: 1, unit_price_cents: 0, subtotal_cents: 0 }];
  const tableHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const qtyX = margin;
    const descX = margin + 60;
    const unitX = pageWidth - margin - 150;
    const subX = pageWidth - margin - 60;

    doc.text('QTD', qtyX, cursorY);
    doc.text('Descrição', descX, cursorY);
    doc.text('Unitário', unitX, cursorY, { align: 'right' });
    doc.text('Subtotal', subX, cursorY, { align: 'right' });
    cursorY += 8;
    doc.setLineWidth(0.5);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 12;
    doc.setFont('helvetica', 'normal');
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Itens do pedido', margin, cursorY);
  cursorY += 16;

  tableHeader();

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  items.forEach((item) => {
    const qtyX = margin;
    const descX = margin + 60;
    const unitX = pageWidth - margin - 150;
    const subX = pageWidth - margin - 60;
    const descWidth = unitX - descX - 12;
    const descriptionLines = doc.splitTextToSize(item.description || 'Item', descWidth);
    const rowHeight = descriptionLines.length * 12;

    if (cursorY + rowHeight + 80 > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
      tableHeader();
    }

    doc.text(String(item.quantity), qtyX, cursorY);
    doc.text(descriptionLines, descX, cursorY);
    doc.text(formatCurrencyFromCents(item.unit_price_cents), unitX, cursorY, { align: 'right' });
    doc.text(formatCurrencyFromCents(item.subtotal_cents), subX, cursorY, { align: 'right' });
    cursorY += rowHeight + 6;
  });

  const totalCents = items.reduce((sum, item) => sum + (item.subtotal_cents ?? 0), 0);
  cursorY += 8;
  doc.setFont('helvetica', 'bold');
  doc.text(`Total final: ${formatCurrencyFromCents(totalCents)}`, margin, cursorY);
  cursorY += 20;

  doc.setFont('helvetica', 'bold');
  doc.text('Pagamento', margin, cursorY);
  cursorY += 14;
  doc.setFont('helvetica', 'normal');
  doc.text(`Método: ${formatPaymentMethod(data.payment_method)}`, margin, cursorY);
  cursorY += 14;
  doc.text(`Valor pago: ${formatCurrencyFromCents(data.amount_paid_cents)}`, margin, cursorY);

  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text('Esse documento não conta como Nota Fiscal.', margin, pageHeight - margin);
  doc.setTextColor(0);

  return doc;
};

export default function ReceiptsPage() {
  const { withAuthRetry } = useAuth();
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [finishedOrders, setFinishedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]['value']>('all');
  const [dateFilter, setDateFilter] = useState<(typeof DATE_FILTER_OPTIONS)[number]['value']>('issued_at');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [modalState, setModalState] = useState<{ receipt: ReceiptRecord | null; order: Order | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReceiptRecord | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const { data: receiptRows, error: receiptsError } = await withAuthRetry(
      () =>
        supabase
          .from('receipts')
          .select('id, order_id, receipt_number, issued_at, receipt_payload')
          .order('issued_at', { ascending: false }),
      { label: 'load-receipts' }
    );

    if (receiptsError) {
      setError('Não foi possível carregar os recibos.');
      setLoading(false);
      return;
    }

    const receiptsData = (receiptRows ?? []) as ReceiptRecord[];
    setReceipts(receiptsData);

    const { data: orderRows, error: ordersError } = await withAuthRetry(
      () =>
        supabase
          .from('orders')
          .select(ORDER_SELECT_WITH_ITEMS)
          .eq('status', 'finished')
          .order('created_at', { ascending: false }),
      { label: 'load-finished-orders' }
    );

    if (ordersError) {
      setError('Não foi possível carregar os pedidos concluídos.');
      setOrders([]);
      setFinishedOrders([]);
      setLoading(false);
      return;
    }

    const finishedData = (orderRows ?? []) as Order[];
    const receiptOrderIds = receiptsData.map((receipt) => receipt.order_id);
    const finishedIds = new Set(finishedData.map((order) => order.id));
    const missingReceiptOrders = receiptOrderIds.filter((id) => id && !finishedIds.has(id));

    let allOrders = [...finishedData];

    if (missingReceiptOrders.length > 0) {
      const { data: extraRows } = await withAuthRetry(
        () => supabase.from('orders').select(ORDER_SELECT_WITH_ITEMS).in('id', missingReceiptOrders),
        { label: 'load-receipt-orders' }
      );
      allOrders = [...allOrders, ...((extraRows ?? []) as Order[])];
    }

    setFinishedOrders(finishedData);
    setOrders(allOrders);
    setLoading(false);
  }, [withAuthRetry]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const ordersById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);
  const receiptsByOrderId = useMemo(
    () => new Map(receipts.map((receipt) => [receipt.order_id, receipt])),
    [receipts]
  );

  const pendingOrders = useMemo(
    () => finishedOrders.filter((order) => !receiptsByOrderId.has(order.id)),
    [finishedOrders, receiptsByOrderId]
  );

  const receiptEntries = useMemo<ReceiptEntry[]>(() => {
    const issuedEntries = receipts.map((receipt) => ({
      kind: 'issued' as const,
      receipt,
      order: ordersById.get(receipt.order_id) ?? null,
      payload: receipt.receipt_payload ?? null,
    }));
    const pendingEntries = pendingOrders.map((order) => ({
      kind: 'pending' as const,
      receipt: null,
      order,
      payload: null,
    }));
    return [...issuedEntries, ...pendingEntries];
  }, [ordersById, pendingOrders, receipts]);

  const handleCopyId = useCallback(async (id: string) => {
    if (!id) return;
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
    } catch {
      // ignore copy errors
    }
  }, []);

  const nextReceiptNumber = useMemo(() => getNextReceiptNumber(receipts), [receipts]);

  const statusCounts = useMemo(() => {
    const issued = receipts.length;
    const pending = pendingOrders.length;
    return {
      all: issued + pending,
      issued,
      pending,
    };
  }, [pendingOrders.length, receipts.length]);

  const filteredEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    const start = startDate ? parseDateOnly(startDate) : null;
    const end = endDate ? parseDateOnly(endDate) : null;
    const endOfDay = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59) : null;

    const filtered = receiptEntries.filter((entry) => {
      if (statusFilter !== 'all' && entry.kind !== statusFilter) {
        return false;
      }

      const order = entry.order;
      const receipt = entry.receipt;
      const payload = normalizeReceiptPayload(entry.payload, order, receipt?.receipt_number ?? nextReceiptNumber);
      const customerName = payload.customer_name ?? order?.customer_name ?? '';
      const customerPhone = payload.customer_phone ?? order?.customer_phone ?? '';
      const receiptNumber = receipt?.receipt_number ?? payload.receipt_number ?? '';
      const orderId = order?.id ?? receipt?.order_id ?? '';

      if (term) {
        const haystack = `${customerName} ${customerPhone} ${receiptNumber} ${orderId}`.toLowerCase();
        if (!haystack.includes(term)) {
          return false;
        }
      }

      const dateValueMap: Record<(typeof DATE_FILTER_OPTIONS)[number]['value'], string | null | undefined> = {
        issued_at: receipt?.issued_at ?? null,
        order_date: payload.order_date ?? order?.created_at ?? null,
        payment_date: payload.payment_date ?? null,
        delivery_date: payload.delivery_date ?? order?.delivery_date ?? null,
      };

      const dateValue = parseDateOnly(dateValueMap[dateFilter]);

      if (start && (!dateValue || dateValue < start)) {
        return false;
      }

      if (endOfDay && (!dateValue || dateValue > endOfDay)) {
        return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      const resolveSortDate = (entry: ReceiptEntry) => {
        const order = entry.order;
        const receipt = entry.receipt;
        const payload = normalizeReceiptPayload(entry.payload, order, receipt?.receipt_number ?? nextReceiptNumber);

        const dateValueMap: Record<(typeof DATE_FILTER_OPTIONS)[number]['value'], string | null | undefined> = {
          issued_at: receipt?.issued_at ?? null,
          order_date: payload.order_date ?? order?.created_at ?? null,
          payment_date: payload.payment_date ?? null,
          delivery_date: payload.delivery_date ?? order?.delivery_date ?? null,
        };

        const fallback = entry.kind === 'issued' ? receipt?.issued_at : order?.created_at;
        return parseDateOnly(dateValueMap[dateFilter] ?? fallback ?? null);
      };

      const dateA = resolveSortDate(a);
      const dateB = resolveSortDate(b);

      return (dateB?.getTime() ?? 0) - (dateA?.getTime() ?? 0);
    });

    return filtered;
  }, [dateFilter, endDate, nextReceiptNumber, receiptEntries, search, startDate, statusFilter]);

  const dateColumnLabel =
    DATE_FILTER_OPTIONS.find((option) => option.value === dateFilter)?.label ?? 'Data';

  const hasEntries = filteredEntries.length > 0;

  const emptyState = useMemo(() => {
    if (statusFilter === 'pending') {
      return {
        title: 'Nenhum pedido concluído pendente de recibo.',
        helper: 'Conclua pedidos na aba de Pedidos para gerar novos recibos.',
      };
    }
    if (statusFilter === 'issued') {
      return {
        title: 'Nenhum recibo emitido ainda.',
        helper: 'Gere um recibo a partir de um pedido concluído.',
      };
    }
    return {
      title: 'Nenhum recibo encontrado.',
      helper: 'Ajuste os filtros ou conclua pedidos para emitir recibos.',
    };
  }, [statusFilter]);

  return (
    <div className="admin-page">
      <AdminPageHeader
        kicker="Financeiro"
        title="Recibos"
        subtitle="Visualize, emita e revise recibos dos pedidos concluidos sem perder contexto."
        actions={
          <button type="button" className="admin-button-outline" onClick={loadData} disabled={loading}>
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        }
      />

      {successMessage && <div className="admin-alert">{successMessage}</div>}
      {error && <div className="admin-inline-error">{error}</div>}

      <div className="admin-table-shell">
        <div className="admin-table-headerbar admin-receipts-header">
          <div>
            <p className="admin-section-kicker">Gestão</p>
            <h3 className="admin-table-title">Recibos emitidos e pendentes</h3>
            <p className="admin-table-subtitle">
              Acompanhe recibos emitidos e gere novos a partir de pedidos concluídos.
            </p>
          </div>
          <div className="admin-receipts-filters">
            <div className="admin-receipts-filter">
              <span className="admin-filter-label">Status</span>
              <div className="admin-table-actions admin-receipts-status">
                {STATUS_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    className={`admin-button-small admin-status-tab ${
                      statusFilter === filter.value ? '' : 'admin-button-ghost'
                    }`}
                    onClick={() => setStatusFilter(filter.value)}
                    aria-pressed={statusFilter === filter.value}
                  >
                    <span>{filter.label}</span>
                    <span className="admin-status-count">({statusCounts[filter.value] ?? 0})</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-receipts-filter">
              <span className="admin-filter-label">Busca</span>
              <div className="admin-input-inline">
                <FaSearch />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="admin-input"
                  placeholder="Buscar por cliente, telefone, ID ou recibo"
                />
              </div>
            </div>

            <div className="admin-receipts-filter">
              <span className="admin-filter-label">Período</span>
              <div className="admin-receipts-date">
                <select
                  value={dateFilter}
                  onChange={(event) =>
                    setDateFilter(event.target.value as (typeof DATE_FILTER_OPTIONS)[number]['value'])
                  }
                  className="admin-select"
                >
                  {DATE_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="admin-input"
                />
                <span className="admin-date-separator">até</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="admin-input"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="admin-table-scroll">
          <div className="admin-table">
            <div className="admin-table-header admin-table-header-receipts">
              <div className="admin-cell-left">ID do Recibo</div>
              <div className="admin-cell-left">ID do Pedido</div>
              <div className="admin-cell-left">Cliente</div>
              <div>Status</div>
              <div>{dateColumnLabel}</div>
              <div className="admin-col-actions">Ações</div>
            </div>

            {loading && (
              <div className="admin-table-row admin-table-row-receipts admin-row-skeleton">
                <div className="admin-skeleton-line" />
                <div className="admin-skeleton-line" />
                <div className="admin-skeleton-line" />
                <div className="admin-skeleton-pill" />
                <div className="admin-skeleton-line short" />
                <div className="admin-table-actions">
                  <div className="admin-skeleton-button" />
                </div>
              </div>
            )}

            {!loading && hasEntries ? (
              filteredEntries.map((entry) => {
                const order = entry.order;
                const receipt = entry.receipt;
                const receiptNumber = receipt?.receipt_number ?? '—';
                const payload = normalizeReceiptPayload(entry.payload, order, receipt?.receipt_number ?? nextReceiptNumber);
                const customerName = payload.customer_name || order?.customer_name || 'Cliente não informado';
                const customerPhone = payload.customer_phone || order?.customer_phone || '';
                const orderId = order?.id ?? receipt?.order_id ?? '';
                const displayDate =
                  entry.kind === 'issued'
                    ? receipt?.issued_at ?? payload.order_date ?? order?.created_at ?? null
                    : payload.order_date ?? order?.created_at ?? null;

                return (
                  <div key={`${entry.kind}-${receipt?.id ?? order?.id}`} className="admin-table-row admin-table-row-receipts">
                    <div className="admin-cell-strong admin-cell-left">{receiptNumber}</div>
                    <div className="admin-cell-strong admin-id-cell" title={orderId}>
                      <span className="admin-id-text">{orderId ? formatShortId(orderId) : '—'}</span>
                      {orderId && (
                        <button
                          type="button"
                          className="admin-copy-button"
                          onClick={() => handleCopyId(orderId)}
                          aria-label="Copiar ID completo"
                          title="Copiar ID completo"
                        >
                          <FaRegCopy aria-hidden="true" focusable="false" />
                        </button>
                      )}
                    </div>
                    <div className="admin-cell-stack admin-cell-left">
                      <span className="admin-cell-strong">{customerName}</span>
                      <span className="admin-cell-text">{customerPhone || EMPTY_LABEL}</span>
                    </div>
                    <div>
                      <span
                        className={`admin-pill ${
                          entry.kind === 'issued' ? 'admin-pill-emitido' : 'admin-pill-pendente'
                        }`}
                      >
                        {entry.kind === 'issued' ? 'Emitido' : 'Pendente'}
                      </span>
                    </div>
                    <div>{formatDisplayDate(displayDate)}</div>
                    <div className="admin-table-actions">
                      {entry.kind === 'issued' ? (
                        <>
                          <button
                            type="button"
                            className="admin-button-small admin-button-ghost"
                            onClick={() => setModalState({ receipt, order })}
                          >
                            Ver / Editar
                          </button>
                          <button
                            type="button"
                            className="admin-button-small admin-button-outline"
                            onClick={async () => {
                              const pdf = await buildReceiptPdf(buildPdfDataFromEntry(entry));
                              pdf.save(`recibo-${receiptNumber || orderId}.pdf`);
                            }}
                          >
                            PDF
                          </button>
                          <button
                            type="button"
                            className="admin-button-small admin-button-danger"
                            onClick={() => receipt && setDeleteTarget(receipt)}
                          >
                            Excluir
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="admin-button-small admin-button-outline"
                          onClick={() => setModalState({ receipt: null, order })}
                        >
                          Gerar recibo
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              !loading && (
                <div className="admin-empty-row">
                  <div>
                    <p className="admin-empty-title">{emptyState.title}</p>
                    <p className="admin-empty-helper">{emptyState.helper}</p>
                    {statusFilter !== 'pending' && pendingOrders.length > 0 && (
                      <button
                        type="button"
                        className="admin-button"
                        onClick={() => setStatusFilter('pending')}
                      >
                        Ver pendentes
                      </button>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
        <div className="admin-table-footer">
          <span>
            {loading
              ? 'Carregando...'
              : hasEntries
                ? `${filteredEntries.length} registro(s) encontrados`
                : 'Nenhum recibo listado'}
          </span>
          <div className="admin-table-actions">
            <span className="admin-cell-text">
              {receipts.length} emitido(s) • {pendingOrders.length} pendente(s)
            </span>
          </div>
        </div>
      </div>

      {modalState && (
        <ReceiptModal
          receipt={modalState.receipt}
          order={modalState.order}
          defaultReceiptNumber={nextReceiptNumber}
          onClose={() => setModalState(null)}
          onSaved={() => {
            setSuccessMessage('Recibo salvo com sucesso.');
            loadData();
          }}
        />
      )}

      {deleteTarget && (
        <DeleteReceiptModal
          receipt={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            setSuccessMessage('Recibo excluído com sucesso.');
            loadData();
          }}
        />
      )}
    </div>
  );
}

type ReceiptModalProps = {
  receipt: ReceiptRecord | null;
  order: Order | null;
  defaultReceiptNumber: string;
  onClose: () => void;
  onSaved: () => void;
};

function ReceiptModal({ receipt, order, defaultReceiptNumber, onClose, onSaved }: ReceiptModalProps) {
  const { withAuthRetry } = useAuth();
  const [draft, setDraft] = useState<ReceiptDraft>(() =>
    buildReceiptDraft(receipt, order, defaultReceiptNumber)
  );
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [sendHint, setSendHint] = useState(false);

  useEffect(() => {
    setDraft(buildReceiptDraft(receipt, order, defaultReceiptNumber));
    setSaving(false);
    setPdfLoading(false);
    setError(null);
    setSuccessMessage(null);
    setIsDirty(false);
    setSendHint(false);
  }, [receipt, order, defaultReceiptNumber]);

  const markDirty = useCallback(() => {
    setIsDirty(true);
    setError(null);
    setSuccessMessage(null);
  }, []);

  const handleFieldChange = useCallback(
    (key: keyof ReceiptDraft, value: string) => {
      markDirty();
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    [markDirty]
  );

  const handleAmountPaidChange = useCallback(
    (value: string) => {
      markDirty();
      const parsed = parseCurrencyInput(value || '0');
      setDraft((prev) => ({
        ...prev,
        amountPaidInput: value,
        amount_paid_cents: Number.isNaN(parsed) ? 0 : Math.round(parsed * 100),
      }));
    },
    [markDirty]
  );

  const handleItemChange = useCallback(
    (itemId: string, field: 'description' | 'quantity' | 'unitPriceInput', value: string) => {
      markDirty();
      setDraft((prev) => {
        const items = prev.items.map((item) => {
          if (item.id !== itemId) return item;
          if (field === 'description') {
            return { ...item, description: value };
          }
          if (field === 'quantity') {
            const qty = Number.parseInt(value, 10);
            const quantity = Number.isFinite(qty) && qty > 0 ? qty : 0;
            return {
              ...item,
              quantity,
              subtotal_cents: quantity * item.unit_price_cents,
            };
          }
          const parsed = parseCurrencyInput(value || '0');
          const unitPrice = Number.isNaN(parsed) ? 0 : Math.round(parsed * 100);
          return {
            ...item,
            unitPriceInput: value,
            unit_price_cents: unitPrice,
            subtotal_cents: item.quantity * unitPrice,
          };
        });
        return { ...prev, items };
      });
    },
    [markDirty]
  );

  const handleAddItem = useCallback(() => {
    markDirty();
    setDraft((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: createTempId('item'),
          description: '',
          quantity: 1,
          unit_price_cents: 0,
          subtotal_cents: 0,
          unitPriceInput: '',
        },
      ],
    }));
  }, [markDirty]);

  const handleRemoveItem = useCallback(
    (itemId: string) => {
      markDirty();
      setDraft((prev) => ({
        ...prev,
        items: prev.items.filter((item) => item.id !== itemId),
      }));
    },
    [markDirty]
  );

  const itemsTotal = useMemo(
    () => draft.items.reduce((sum, item) => sum + (item.subtotal_cents ?? 0), 0),
    [draft.items]
  );

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);

    const trimmedName = draft.customer_name.trim();
    const trimmedPhone = draft.customer_phone.trim();
    const trimmedReceiptNumber = draft.receipt_number.trim();

    if (!draft.order_id) {
      setError('ID do pedido não encontrado.');
      setSaving(false);
      return;
    }
    if (!trimmedReceiptNumber) {
      setError('Número do recibo é obrigatório.');
      setSaving(false);
      return;
    }
    if (!trimmedName) {
      setError('Informe o nome do cliente.');
      setSaving(false);
      return;
    }
    if (draft.items.length === 0) {
      setError('Adicione ao menos um item.');
      setSaving(false);
      return;
    }

    const issuedAtIso = toIsoFromInputDate(draft.issued_at);
    if (!issuedAtIso) {
      setError('Informe a data de emissão do recibo.');
      setSaving(false);
      return;
    }

    const normalizedItems = draft.items.map((item) => {
      const quantity = Number.isFinite(item.quantity) ? item.quantity : 0;
      const unitPrice = Number.isFinite(item.unit_price_cents) ? item.unit_price_cents : 0;
      const subtotal = quantity * unitPrice;
      return {
        description: item.description.trim(),
        quantity,
        unit_price_cents: unitPrice,
        subtotal_cents: subtotal,
      };
    });

    if (normalizedItems.some((item) => !item.description || item.quantity < 1)) {
      setError('Preencha a descrição e a quantidade de todos os itens.');
      setSaving(false);
      return;
    }

    const payload: ReceiptPayload = {
      order_id: draft.order_id,
      receipt_number: trimmedReceiptNumber,
      customer_name: trimmedName,
      customer_phone: trimmedPhone,
      order_date: draft.order_date || null,
      delivery_date: draft.delivery_date || null,
      payment_date: draft.payment_date || null,
      payment_method: draft.payment_method || null,
      amount_paid_cents: draft.amount_paid_cents,
      items: normalizedItems,
    };

    try {
      if (draft.id) {
        const { error: updateError } = await withAuthRetry(
          () =>
            supabase
              .from('receipts')
              .update({
                receipt_number: trimmedReceiptNumber,
                issued_at: issuedAtIso,
                receipt_payload: payload,
              })
              .eq('id', draft.id),
          { label: 'update-receipt' }
        );

        if (updateError) {
          throw updateError;
        }
      } else {
        const { data: inserted, error: insertError } = await withAuthRetry(
          () =>
            supabase
              .from('receipts')
              .insert({
                order_id: draft.order_id,
                receipt_number: trimmedReceiptNumber,
                issued_at: issuedAtIso,
                receipt_payload: payload,
              })
              .select()
              .single(),
          { label: 'insert-receipt' }
        );

        if (insertError || !inserted) {
          const duplicate =
            insertError?.code === '23505' ||
            insertError?.message?.toLowerCase().includes('duplicate');
          throw duplicate ? new Error('Já existe um recibo para este pedido.') : insertError;
        }

        setDraft((prev) => ({ ...prev, id: inserted.id }));
      }

      setIsDirty(false);
      setSuccessMessage('Recibo salvo com sucesso.');
      onSaved();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Não foi possível salvar o recibo. Tente novamente.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handlePdf = async (mode: 'open' | 'download') => {
    setPdfLoading(true);
    try {
      const pdf = await buildReceiptPdf(buildPdfDataFromDraft(draft));
      if (mode === 'open') {
        const url = pdf.output('bloburl');
        window.open(url, '_blank', 'noopener');
      } else {
        pdf.save(`recibo-${draft.receipt_number || draft.order_id}.pdf`);
      }
    } finally {
      setPdfLoading(false);
    }
  };

  const handleSendToClient = async () => {
    setSendHint(true);
    await handlePdf('download');
  };

  const saveStatus = saving ? 'Salvando...' : isDirty ? 'Alterações não salvas' : 'Salvo';
  const saveStatusClass = saving ? 'is-saving' : isDirty ? 'is-dirty' : 'is-saved';

  return (
    <div className="admin-modal-backdrop">
      <div className="admin-modal">
        <div className="admin-modal-header">
          <div>
            <p className="admin-modal-subtitle">{draft.id ? 'Editar recibo' : 'Emitir recibo'}</p>
            <h2 className="admin-modal-title">{draft.receipt_number || 'Recibo'}</h2>
            <p className="admin-modal-helper">Confira e ajuste os dados antes de gerar o PDF.</p>
          </div>
          <div className="admin-modal-header-actions">
            <span className={`admin-save-status ${saveStatusClass}`}>{saveStatus}</span>
            <button type="button" className="admin-button-ghost" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>

        <div className="admin-modal-body">
          {error && <div className="admin-inline-error">{error}</div>}
          {successMessage && <div className="admin-alert">{successMessage}</div>}

          <section className="admin-section">
            <div className="admin-section-header">
              <div>
                <p className="admin-section-kicker">Pedido</p>
                <h3 className="admin-section-title">Dados do cliente</h3>
              </div>
            </div>
            <div className="admin-receipt-grid">
              <label className="admin-field">
                <span>ID do pedido</span>
                <input type="text" className="admin-input" value={draft.order_id} readOnly />
              </label>
              <label className="admin-field">
                <span>Nome do cliente *</span>
                <input
                  type="text"
                  className="admin-input"
                  value={draft.customer_name}
                  onChange={(event) => handleFieldChange('customer_name', event.target.value)}
                  placeholder="Coloque seu nome aqui"
                />
              </label>
              <label className="admin-field">
                <span>Telefone</span>
                <input
                  type="tel"
                  className="admin-input"
                  value={draft.customer_phone}
                  onChange={(event) => handleFieldChange('customer_phone', event.target.value)}
                  placeholder="(11) 91234-5678"
                />
              </label>
            </div>
          </section>

          <section className="admin-section">
            <div className="admin-section-header">
              <div>
                <p className="admin-section-kicker">Datas</p>
                <h3 className="admin-section-title">Linha do tempo do pedido</h3>
              </div>
            </div>
            <div className="admin-receipt-grid admin-receipt-dates">
              <label className="admin-field">
                <span>Data de emissão</span>
                <input
                  type="date"
                  className="admin-input"
                  value={draft.issued_at}
                  onChange={(event) => handleFieldChange('issued_at', event.target.value)}
                />
              </label>
              <label className="admin-field">
                <span>Data do pedido</span>
                <input
                  type="date"
                  className="admin-input"
                  value={draft.order_date}
                  onChange={(event) => handleFieldChange('order_date', event.target.value)}
                />
              </label>
              <label className="admin-field">
                <span>Data de entrega</span>
                <input
                  type="date"
                  className="admin-input"
                  value={draft.delivery_date}
                  onChange={(event) => handleFieldChange('delivery_date', event.target.value)}
                />
              </label>
              <label className="admin-field">
                <span>Data do pagamento</span>
                <input
                  type="date"
                  className="admin-input"
                  value={draft.payment_date}
                  onChange={(event) => handleFieldChange('payment_date', event.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="admin-section">
            <div className="admin-section-header">
              <div>
                <p className="admin-section-kicker">Pagamento</p>
                <h3 className="admin-section-title">Informações financeiras</h3>
              </div>
            </div>
            <div className="admin-receipt-grid">
              <label className="admin-field">
                <span>Método de pagamento</span>
                <select
                  value={draft.payment_method}
                  onChange={(event) => handleFieldChange('payment_method', event.target.value)}
                  className="admin-select"
                >
                  <option value="">Selecione</option>
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-field">
                <span>Valor pago (R$)</span>
                <input
                  type="text"
                  className="admin-input"
                  inputMode="decimal"
                  value={draft.amountPaidInput}
                  onChange={(event) => handleAmountPaidChange(event.target.value)}
                  placeholder="0,00"
                />
                <small className="admin-helper-text">{formatCurrencyFromCents(draft.amount_paid_cents)}</small>
              </label>
            </div>
          </section>

          <section className="admin-section">
            <div className="admin-section-header">
              <div>
                <p className="admin-section-kicker">Itens</p>
                <h3 className="admin-section-title">Produtos do pedido</h3>
              </div>
              <div className="admin-section-actions">
                <button type="button" className="admin-button-outline" onClick={handleAddItem}>
                  Adicionar item
                </button>
              </div>
            </div>

            <div className="admin-receipt-items">
              <div className="admin-receipt-item-header">
                <span>Qtd</span>
                <span>Descrição</span>
                <span>Unitário</span>
                <span>Subtotal</span>
                <span />
              </div>
              {draft.items.map((item) => (
                <div key={item.id} className="admin-receipt-item-row">
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(event) => handleItemChange(item.id, 'quantity', event.target.value)}
                    className="admin-input"
                  />
                  <input
                    type="text"
                    value={item.description}
                    onChange={(event) => handleItemChange(item.id, 'description', event.target.value)}
                    className="admin-input"
                    placeholder="Descrição do item"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={item.unitPriceInput}
                    onChange={(event) => handleItemChange(item.id, 'unitPriceInput', event.target.value)}
                    className="admin-input"
                    placeholder="0,00"
                  />
                  <div className="admin-receipt-subtotal">{formatCurrencyFromCents(item.subtotal_cents)}</div>
                  <button
                    type="button"
                    className="admin-button-ghost"
                    onClick={() => handleRemoveItem(item.id)}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>

            <div className="admin-receipt-total">
              <span>Total calculado</span>
              <strong>{formatCurrencyFromCents(itemsTotal)}</strong>
            </div>
          </section>

          <div className="admin-receipt-send">
            <button type="button" className="admin-button-outline" onClick={handleSendToClient} disabled={pdfLoading}>
              {pdfLoading ? 'Preparando PDF...' : 'Enviar ao cliente'}
            </button>
            <span className="admin-helper-text">
              {sendHint
                ? 'Envio direto indisponível. O PDF foi baixado para você enviar no WhatsApp.'
                : 'Envio direto indisponível. Baixe o PDF para enviar no WhatsApp.'}
            </span>
          </div>
        </div>

        <div className="admin-modal-footer">
          <div className="admin-footer-actions">
            <button type="button" className="admin-button-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="admin-button-outline"
              onClick={() => handlePdf('open')}
              disabled={pdfLoading}
            >
              {pdfLoading ? 'Gerando...' : 'Gerar PDF'}
            </button>
            <button
              type="button"
              className="admin-button-outline"
              onClick={() => handlePdf('download')}
              disabled={pdfLoading}
            >
              {pdfLoading ? 'Baixando...' : 'Baixar PDF'}
            </button>
            <button
              type="button"
              className="admin-button"
              onClick={handleSave}
              disabled={saving || pdfLoading}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type DeleteReceiptModalProps = {
  receipt: ReceiptRecord;
  onClose: () => void;
  onDeleted: () => void;
};

function DeleteReceiptModal({ receipt, onClose, onDeleted }: DeleteReceiptModalProps) {
  const { user, withAuthRetry } = useAuth();
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (deleting) return;
    if (!password.trim()) {
      setError('Informe a senha do admin.');
      return;
    }
    if (!user?.email) {
      setError('Não foi possível validar a senha. Faça login novamente.');
      return;
    }

    setDeleting(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });

    if (signInError) {
      setError('Senha incorreta.');
      setDeleting(false);
      return;
    }

    const { error: deleteError } = await withAuthRetry(
      () => supabase.from('receipts').delete().eq('id', receipt.id),
      { label: 'delete-receipt' }
    );

    if (deleteError) {
      setError('Não foi possível excluir o recibo.');
      setDeleting(false);
      return;
    }

    onDeleted();
  };

  return (
    <div className="admin-modal-backdrop">
      <div className="admin-modal">
        <div className="admin-modal-header">
          <div>
            <p className="admin-modal-subtitle">Excluir recibo</p>
            <h2 className="admin-modal-title">{receipt.receipt_number}</h2>
            <p className="admin-modal-helper">A exclusão é permanente e exige a senha do admin.</p>
          </div>
          <button type="button" className="admin-button-ghost" onClick={onClose}>
            Fechar
          </button>
        </div>
        <div className="admin-modal-body">
          <label className="admin-field">
            <span>Senha do admin</span>
            <input
              type="password"
              className="admin-input"
              value={password}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setPassword(event.target.value);
                setError(null);
              }}
              placeholder="Digite a senha para confirmar"
            />
          </label>
          {error && <div className="admin-inline-error">{error}</div>}
        </div>
        <div className="admin-modal-footer">
          <div className="admin-footer-actions">
            <button type="button" className="admin-button-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="admin-button admin-button-danger"
              onClick={handleConfirm}
              disabled={deleting}
            >
              {deleting ? 'Excluindo...' : 'Confirmar exclusão'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
