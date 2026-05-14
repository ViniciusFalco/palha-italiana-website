import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { FaArrowLeft, FaArrowRight, FaPen, FaTimes, FaTrash, FaWhatsapp } from 'react-icons/fa';
import type { CartItem, CheckoutProps, FormData } from '../types';
import { useDocumentScrollLock } from '../hooks/useDocumentScrollLock';
import MapAddressSelector from './MapAddressSelector';
import { formatCheckoutAddress, isAllowedDeliveryArea } from '../lib/deliveryAreas';
import {
  fetchCheckoutSettings,
  validateDiscountCoupon,
  type AppliedDiscountCoupon,
} from '../lib/api/checkoutSettings';

const PAYMENT_LABELS: Record<FormData['paymentMethod'], string> = {
  pix: 'Pix',
  credit: 'Cartão de crédito',
  debit: 'Cartão de débito',
  cash: 'Dinheiro',
};

const PAYMENT_OPTIONS: Array<{ value: FormData['paymentMethod']; label: string }> = [
  { value: 'pix', label: PAYMENT_LABELS.pix },
  { value: 'credit', label: PAYMENT_LABELS.credit },
  { value: 'debit', label: PAYMENT_LABELS.debit },
  { value: 'cash', label: PAYMENT_LABELS.cash },
];

const CHECKOUT_PROGRESS_KEY = 'checkout_progress_v1';
const SHIPPING_CENTS = 200;
const CHECKOUT_STEPS = [1, 2] as const;
type CheckoutStep = (typeof CHECKOUT_STEPS)[number];

interface CheckoutProgressDraft {
  step: CheckoutStep;
  activeItemIndex: number | null;
  formData: FormData;
}

const initialFormState: FormData = {
  name: '',
  phone: '',
  deliveryDate: '',
  street: '',
  houseNumber: '',
  addressComplement: '',
  noComplement: false,
  paymentMethod: 'pix',
  cashChangeNeeded: false,
  cashChangeForCents: null,
  address: '',
  cep: '',
  neighborhood: '',
  city: '',
  state: 'MG',
  addressLatitude: null,
  addressLongitude: null,
  addressSource: '',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatCurrencyFromCents = (cents: number) => formatCurrency(Math.max(0, cents) / 100);

const isCheckoutStep = (value: unknown): value is CheckoutStep => value === 1 || value === 2;

const sanitizeNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const parseCurrencyToCents = (value: string) => {
  const parsed = Number(value.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : NaN;
};

const centsToInputValue = (cents: number | null | undefined) =>
  cents && cents > 0 ? (cents / 100).toFixed(2).replace('.', ',') : '';

const toInputDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const sanitizeFormData = (value: unknown): FormData => {
  if (!value || typeof value !== 'object') return initialFormState;
  const parsed = value as Partial<FormData>;
  const paymentMethod =
    parsed.paymentMethod === 'credit' || parsed.paymentMethod === 'debit' || parsed.paymentMethod === 'cash'
      ? parsed.paymentMethod
      : 'pix';

  return {
    name: typeof parsed.name === 'string' ? parsed.name : '',
    phone: typeof parsed.phone === 'string' ? parsed.phone : '',
    deliveryDate: typeof parsed.deliveryDate === 'string' ? parsed.deliveryDate : '',
    street: typeof parsed.street === 'string' ? parsed.street : '',
    houseNumber: typeof parsed.houseNumber === 'string' ? parsed.houseNumber : '',
    addressComplement: typeof parsed.addressComplement === 'string' ? parsed.addressComplement : '',
    noComplement: Boolean(parsed.noComplement),
    paymentMethod,
    cashChangeNeeded: Boolean(parsed.cashChangeNeeded),
    cashChangeForCents: sanitizeNumber(parsed.cashChangeForCents),
    address: typeof parsed.address === 'string' ? parsed.address : '',
    cep: typeof parsed.cep === 'string' ? parsed.cep : '',
    neighborhood: typeof parsed.neighborhood === 'string' ? parsed.neighborhood : '',
    city: typeof parsed.city === 'string' ? parsed.city : '',
    state: typeof parsed.state === 'string' ? parsed.state : 'MG',
    addressLatitude: sanitizeNumber(parsed.addressLatitude),
    addressLongitude: sanitizeNumber(parsed.addressLongitude),
    addressSource:
      parsed.addressSource === 'mapbox' ||
      parsed.addressSource === 'viacep' ||
      parsed.addressSource === 'map' ||
      parsed.addressSource === 'manual'
        ? parsed.addressSource
        : '',
  };
};

const loadCheckoutProgress = (): CheckoutProgressDraft => {
  if (typeof window === 'undefined') {
    return {
      step: 1,
      activeItemIndex: null,
      formData: initialFormState,
    };
  }

  try {
    const raw = window.localStorage.getItem(CHECKOUT_PROGRESS_KEY);
    if (!raw) {
      return {
        step: 1,
        activeItemIndex: null,
        formData: initialFormState,
      };
    }

    const parsed = JSON.parse(raw) as Partial<CheckoutProgressDraft>;
    const step = isCheckoutStep(parsed.step) ? parsed.step : 1;
    const activeItemIndex =
      typeof parsed.activeItemIndex === 'number' &&
      Number.isInteger(parsed.activeItemIndex) &&
      parsed.activeItemIndex >= 0
        ? parsed.activeItemIndex
        : null;

    return {
      step,
      activeItemIndex,
      formData: sanitizeFormData(parsed.formData),
    };
  } catch {
    return {
      step: 1,
      activeItemIndex: null,
      formData: initialFormState,
    };
  }
};

const saveCheckoutProgress = (draft: CheckoutProgressDraft) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CHECKOUT_PROGRESS_KEY, JSON.stringify(draft));
  } catch {
    // Local storage can fail in private browsing; checkout still works without persistence.
  }
};

const clearCheckoutProgress = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(CHECKOUT_PROGRESS_KEY);
};

const getCartItemMeta = (item: CartItem) => {
  const parts = [
    item.flavor && `Sabor: ${item.flavor}`,
    item.coverage && `Cobertura: ${item.coverage}`,
    item.size && `Tamanho: ${item.size}`,
    item.ribbonWidth && `Fita: ${item.ribbonWidth}`,
    item.ribbonColor && `Cor da fita: ${item.ribbonColor}`,
    item.formColor && `Forminha: ${item.formColor}`,
    item.notes && `Obs.: ${item.notes}`,
  ].filter(Boolean) as string[];

  const details = (item.details ?? [])
    .map((detail) => `${detail.label}: ${detail.displayValue ?? detail.value}`)
    .filter(Boolean);

  return [...parts, ...details].join(' • ');
};

const Checkout = ({
  isOpen,
  onClose,
  cartItems,
  onCompleteOrder,
  removeCartItem,
  clearCart,
  onEditCartItem,
}: CheckoutProps) => {
  const initialDraftRef = useRef<CheckoutProgressDraft>(loadCheckoutProgress());
  const [step, setStep] = useState<CheckoutStep>(initialDraftRef.current.step);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(initialDraftRef.current.activeItemIndex);
  const [savingOrder, setSavingOrder] = useState(false);
  const [redirectError, setRedirectError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(initialDraftRef.current.formData);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [orderMinimumCents, setOrderMinimumCents] = useState(0);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedDiscountCoupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [cashChangeInput, setCashChangeInput] = useState(() =>
    centsToInputValue(initialDraftRef.current.formData.cashChangeForCents)
  );
  const [cashChangeError, setCashChangeError] = useState<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const subtotal = useMemo(
    () => cartItems.reduce((total: number, item: CartItem) => total + item.price * item.quantity, 0),
    [cartItems]
  );
  const subtotalCents = Math.round(subtotal * 100);
  const shippingCents = SHIPPING_CENTS;
  const discountCents = Math.min(appliedCoupon?.discountCentsApplied ?? 0, subtotalCents);
  const totalCents = Math.max(0, subtotalCents + shippingCents - discountCents);
  const shipping = shippingCents / 100;
  const total = totalCents / 100;
  const minimumEnabled = orderMinimumCents > 0;
  const minimumReached = !minimumEnabled || subtotalCents >= orderMinimumCents;
  const minimumRemainingCents = Math.max(0, orderMinimumCents - subtotalCents);
  const minimumProgressWidth = minimumEnabled
    ? `${Math.min(100, Math.round((subtotalCents / orderMinimumCents) * 100))}%`
    : '100%';
  const formattedAddress = useMemo(() => {
    const derived = formatCheckoutAddress(formData);
    return formData.address?.trim() || derived;
  }, [formData]);

  const todayInput = toInputDate(new Date());
  const hasValidAddress = Boolean(
    formData.street.trim() &&
      formData.houseNumber.trim() &&
      formData.city?.trim() &&
      isAllowedDeliveryArea(formData.city)
  );
  const hasValidDeliveryDate = Boolean(formData.deliveryDate && formData.deliveryDate >= todayInput);
  const hasValidCashPayment = Boolean(
    formData.paymentMethod !== 'cash' ||
      !formData.cashChangeNeeded ||
      ((formData.cashChangeForCents ?? 0) >= totalCents && (formData.cashChangeForCents ?? 0) > 0)
  );
  const canProceedToCustomer = Boolean(cartItems.length && minimumReached && hasValidCashPayment);
  const canConfirmOrder = Boolean(
    formData.name.trim() &&
      formData.phone.trim() &&
      hasValidDeliveryDate &&
      hasValidAddress &&
      cartItems.length &&
      minimumReached &&
      hasValidCashPayment
  );
  const progressWidth = `${Math.round((step / CHECKOUT_STEPS.length) * 100)}%`;
  const appliedCouponCode = appliedCoupon?.code;

  useEffect(() => {
    saveCheckoutProgress({
      step,
      activeItemIndex,
      formData,
    });
  }, [step, activeItemIndex, formData]);

  useEffect(() => {
    let ignore = false;
    const loadSettings = async () => {
      try {
        const settings = await fetchCheckoutSettings();
        if (!ignore) {
          setOrderMinimumCents(settings.orderMinimumCents);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Checkout: falha ao carregar configurações', error);
        }
      }
    };

    if (isOpen) {
      void loadSettings();
    }

    return () => {
      ignore = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (cartItems.length > 0) return;
    setActiveItemIndex(null);
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError(null);
    setCouponMessage(null);
    if (step !== 1) setStep(1);
  }, [cartItems.length, step]);

  useEffect(() => {
    if (!appliedCouponCode) return;
    let ignore = false;
    const refreshCoupon = async () => {
      try {
        const coupon = await validateDiscountCoupon(appliedCouponCode, subtotalCents);
        if (ignore) return;
        if (!coupon) {
          setAppliedCoupon(null);
          setCouponError('Cupom removido: ele não está mais disponível para este pedido.');
          setCouponMessage(null);
          return;
        }
        setAppliedCoupon(coupon);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Checkout: falha ao revalidar cupom', error);
        }
      }
    };

    void refreshCoupon();
    return () => {
      ignore = true;
    };
  }, [appliedCouponCode, subtotalCents]);

  useEffect(() => {
    if (isOpen) {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setShouldRender(true);
      setIsClosing(false);
      return;
    }

    if (shouldRender) {
      setIsClosing(true);
      closeTimerRef.current = window.setTimeout(() => {
        setIsClosing(false);
        setShouldRender(false);
        closeTimerRef.current = null;
      }, 220);
    }
  }, [isOpen, shouldRender]);

  const isVisible = isOpen || shouldRender;
  useDocumentScrollLock(isVisible || cashModalOpen);

  const resetCheckoutState = () => {
    setStep(1);
    setActiveItemIndex(null);
    setFormData(initialFormState);
    setSavingOrder(false);
    setRedirectError(null);
    setCouponCode('');
    setAppliedCoupon(null);
    setCouponLoading(false);
    setCouponError(null);
    setCouponMessage(null);
    setCashModalOpen(false);
    setCashChangeInput('');
    setCashChangeError(null);
    clearCheckoutProgress();
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddressChange = (patch: Partial<FormData>) => {
    setFormData((prev) => ({
      ...prev,
      ...patch,
    }));
  };

  const handleProceedToCustomer = (event: FormEvent) => {
    event.preventDefault();
    if (!canProceedToCustomer) return;
    setRedirectError(null);
    setStep(2);
  };

  const handlePaymentMethodSelect = (method: FormData['paymentMethod']) => {
    setFormData((prev) => ({
      ...prev,
      paymentMethod: method,
      cashChangeNeeded: method === 'cash' ? prev.cashChangeNeeded : false,
      cashChangeForCents: method === 'cash' ? prev.cashChangeForCents : null,
    }));
    if (method === 'cash') {
      setCashChangeInput(centsToInputValue(formData.cashChangeForCents));
      setCashChangeError(null);
      setCashModalOpen(true);
    }
  };

  const handleCashNoChange = () => {
    setFormData((prev) => ({
      ...prev,
      paymentMethod: 'cash',
      cashChangeNeeded: false,
      cashChangeForCents: null,
    }));
    setCashChangeInput('');
    setCashChangeError(null);
    setCashModalOpen(false);
  };

  const handleSaveCashChange = () => {
    const cents = parseCurrencyToCents(cashChangeInput);
    if (!Number.isFinite(cents) || cents <= 0) {
      setCashChangeError('Informe um valor válido para o troco.');
      return;
    }
    if (cents < totalCents) {
      setCashChangeError(`O valor do troco precisa ser pelo menos ${formatCurrencyFromCents(totalCents)}.`);
      return;
    }

    setFormData((prev) => ({
      ...prev,
      paymentMethod: 'cash',
      cashChangeNeeded: true,
      cashChangeForCents: cents,
    }));
    setCashChangeError(null);
    setCashModalOpen(false);
  };

  const handleApplyCoupon = async () => {
    const normalizedCode = couponCode.trim().toUpperCase();
    setCouponError(null);
    setCouponMessage(null);

    if (!normalizedCode) {
      setCouponError('Digite um cupom para aplicar.');
      return;
    }

    if (!cartItems.length) {
      setCouponError('Adicione itens ao carrinho antes de aplicar um cupom.');
      return;
    }

    setCouponLoading(true);
    try {
      const coupon = await validateDiscountCoupon(normalizedCode, subtotalCents);
      if (!coupon) {
        setAppliedCoupon(null);
        setCouponError('Cupom inválido, expirado ou indisponível para este pedido.');
        return;
      }

      setCouponCode(coupon.code);
      setAppliedCoupon(coupon);
      setCouponMessage(`Cupom ${coupon.code} aplicado.`);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Checkout: erro ao validar cupom', error);
      }
      setCouponError('Não foi possível validar o cupom agora.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError(null);
    setCouponMessage(null);
  };

  const handleRedirect = async () => {
    if (savingOrder || !cartItems.length) return;
    if (!canConfirmOrder) {
      setRedirectError('Preencha os dados obrigatórios para confirmar a encomenda.');
      return;
    }
    setRedirectError(null);
    setSavingOrder(true);
    try {
      let couponForOrder = appliedCoupon;
      if (couponForOrder) {
        const refreshedCoupon = await validateDiscountCoupon(couponForOrder.code, subtotalCents);
        if (!refreshedCoupon) {
          setAppliedCoupon(null);
          setCouponError('Cupom removido: ele expirou ou foi desativado antes do envio.');
          setCouponMessage(null);
          setStep(1);
          return;
        }
        couponForOrder = refreshedCoupon;
        setAppliedCoupon(refreshedCoupon);
      }

      const finalDiscountCents = Math.min(couponForOrder?.discountCentsApplied ?? 0, subtotalCents);
      const finalTotalCents = Math.max(0, subtotalCents + shippingCents - finalDiscountCents);

      await onCompleteOrder(
        { ...formData, address: formattedAddress },
        {
          subtotal_cents: subtotalCents,
          shipping_cents: shippingCents,
          discount_cents: finalDiscountCents,
          total_cents: finalTotalCents,
          coupon_id: couponForOrder?.id ?? null,
          coupon_code: couponForOrder?.code ?? null,
        }
      );
      resetCheckoutState();
    } catch (error) {
      if (import.meta.env.DEV && error) {
        console.error('Checkout: erro ao salvar pedido', error);
      }
      const message = error instanceof Error ? error.message : 'Não foi possível enviar o pedido. Tente novamente.';
      setRedirectError(message);
    } finally {
      setSavingOrder(false);
    }
  };

  if (!isVisible) return null;

  const inputClass =
    'w-full rounded-lg border border-stone-200 bg-white px-3 py-3 text-[15px] text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-primary focus:ring-2 focus:ring-primary/10';

  return (
    <div
      className={`fixed inset-0 z-50 flex bg-stone-950/70 backdrop-blur-sm transition-opacity duration-200 md:items-center md:justify-center md:p-6 ${
        isOpen && !isClosing ? 'opacity-100 fade-in' : 'opacity-0'
      }`}
    >
      <div
        className={`flex h-full min-h-[100dvh] w-full flex-col overflow-hidden bg-[#fbfaf9] text-stone-950 shadow-2xl transition-transform duration-200 md:h-[min(90dvh,780px)] md:min-h-0 md:max-w-[540px] md:rounded-2xl ${
          isOpen && !isClosing ? 'translate-y-0 scale-100' : 'translate-y-2 scale-[0.98]'
        }`}
      >
        <header className="sticky top-0 z-30 border-b border-stone-200 bg-[#fbfaf9]/95 px-4 pb-3 pt-4 backdrop-blur md:px-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold tracking-tight text-stone-950">Checkout</h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
              aria-label="Fechar checkout"
              title="Fechar"
            >
              <FaTimes size={16} />
            </button>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-stone-200">
            <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: progressWidth }} />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-5">
          {step === 1 && (
            <form onSubmit={handleProceedToCustomer} className="flex min-h-full flex-col">
              <div className="flex-1 space-y-4 pb-32">
                <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-extrabold text-stone-950">Carrinho</h3>
                    {cartItems.length > 0 && clearCart && (
                      <button
                        type="button"
                        className="text-xs font-bold text-red-600 hover:text-red-700"
                        onClick={() => {
                          if (!window.confirm('Deseja limpar todo o carrinho?')) return;
                          clearCart();
                          resetCheckoutState();
                        }}
                      >
                        Limpar
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {cartItems.length === 0 && (
                      <p className="rounded-lg bg-stone-50 px-3 py-3 text-center text-sm text-stone-500">
                        Seu carrinho está vazio.
                      </p>
                    )}
                    {cartItems.map((item: CartItem, index: number) => {
                      const isActive = activeItemIndex === index;
                      const metaText = getCartItemMeta(item);
                      return (
                        <article
                          key={`${item.name}-${index}`}
                          className={`rounded-lg border p-3 transition ${
                            isActive ? 'border-primary bg-pink-50' : 'border-stone-200 bg-stone-50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setActiveItemIndex(isActive ? null : index)}
                            className="flex w-full items-start justify-between gap-3 text-left"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-bold leading-snug text-stone-950">{item.name}</span>
                              {metaText && (
                                <span className="mt-1 block text-xs leading-relaxed text-stone-500">{metaText}</span>
                              )}
                            </span>
                            <span className="shrink-0 text-right">
                              <span className="block text-xs font-bold text-stone-500">x{item.quantity}</span>
                              <span className="block text-sm font-extrabold text-stone-950">
                                {formatCurrency(item.price * item.quantity)}
                              </span>
                            </span>
                          </button>

                          {isActive && (
                            <div className="mt-3 flex items-center gap-2">
                              {onEditCartItem && (
                                <button
                                  type="button"
                                  className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white text-sm font-bold text-stone-800 transition hover:bg-stone-50"
                                  onClick={() => onEditCartItem(index)}
                                >
                                  <FaPen size={12} />
                                  Editar
                                </button>
                              )}
                              {removeCartItem && (
                                <button
                                  type="button"
                                  className="flex h-10 w-12 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100"
                                  onClick={() => removeCartItem(index)}
                                  aria-label="Remover item"
                                  title="Remover"
                                >
                                  <FaTrash size={13} />
                                </button>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>

                {minimumEnabled && (
                  <section
                    className={`rounded-lg border p-3 shadow-sm ${
                      minimumReached ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
                    }`}
                    aria-live="polite"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs font-extrabold uppercase tracking-wide">
                      <span className={minimumReached ? 'text-emerald-800' : 'text-amber-800'}>
                        Pedido mínimo: {formatCurrencyFromCents(orderMinimumCents)}
                      </span>
                      <span className={minimumReached ? 'text-emerald-700' : 'text-amber-700'}>
                        {minimumReached ? 'Atingido' : `${formatCurrencyFromCents(minimumRemainingCents)} restantes`}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/80">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          minimumReached ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        style={{ width: minimumProgressWidth }}
                      />
                    </div>
                    <p className={`mt-2 text-xs font-semibold ${minimumReached ? 'text-emerald-800' : 'text-amber-800'}`}>
                      {minimumReached
                        ? 'Pedido mínimo atingido. Você já pode finalizar.'
                        : `Faltam ${formatCurrencyFromCents(minimumRemainingCents)} para realizar o pedido mínimo.`}
                    </p>
                  </section>
                )}

                <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
                  <h3 className="mb-3 text-sm font-extrabold text-stone-950">Pagamento</h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {PAYMENT_OPTIONS.map((method) => {
                      const selected = formData.paymentMethod === method.value;
                      return (
                        <button
                          key={method.value}
                          type="button"
                          onClick={() => handlePaymentMethodSelect(method.value)}
                          className={`min-h-12 rounded-lg border px-2 text-xs font-extrabold transition ${
                            selected
                              ? 'border-primary bg-primary text-white shadow-sm'
                              : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-white'
                          }`}
                          aria-pressed={selected}
                        >
                          {method.label}
                        </button>
                      );
                    })}
                  </div>
                  {formData.paymentMethod === 'cash' && (
                    <div className="mt-3 flex flex-col gap-2 rounded-lg bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-700 sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        {formData.cashChangeNeeded && formData.cashChangeForCents
                          ? `Troco para ${formatCurrencyFromCents(formData.cashChangeForCents)}`
                          : 'Sem troco'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setCashChangeInput(centsToInputValue(formData.cashChangeForCents));
                          setCashChangeError(null);
                          setCashModalOpen(true);
                        }}
                        className="font-extrabold text-primary"
                      >
                        Alterar troco
                      </button>
                    </div>
                  )}
                </section>

                <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
                  <div className="mb-4 rounded-lg border border-stone-200 bg-stone-50 p-3">
                    <h3 className="mb-3 text-sm font-extrabold text-stone-950">Cupom de desconto</h3>
                    {appliedCoupon ? (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-extrabold text-stone-950">{appliedCoupon.code}</p>
                          <p className="text-xs font-semibold text-emerald-700">
                            Desconto de {formatCurrencyFromCents(discountCents)} aplicado.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveCoupon}
                          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-extrabold text-stone-700 transition hover:bg-stone-100"
                        >
                          Remover
                        </button>
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                          placeholder="PALHA10"
                          className={inputClass}
                        />
                        <button
                          type="button"
                          onClick={handleApplyCoupon}
                          disabled={couponLoading || !cartItems.length}
                          className="rounded-lg bg-stone-950 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500"
                        >
                          {couponLoading ? 'Validando...' : 'Aplicar'}
                        </button>
                      </div>
                    )}
                    {couponError && <p className="mt-2 text-xs font-semibold text-red-600">{couponError}</p>}
                    {couponMessage && <p className="mt-2 text-xs font-semibold text-emerald-700">{couponMessage}</p>}
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between text-stone-600">
                      <span>Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-stone-600">
                      <span>Entrega</span>
                      <span>{formatCurrency(shipping)}</span>
                    </div>
                    {discountCents > 0 && (
                      <div className="flex items-center justify-between text-emerald-700">
                        <span>Desconto{appliedCoupon ? ` (${appliedCoupon.code})` : ''}</span>
                        <span>-{formatCurrencyFromCents(discountCents)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-stone-200 pt-3 text-base font-extrabold text-stone-950">
                      <span>Total</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>
                </section>
              </div>

              <div className="sticky bottom-0 -mx-4 border-t border-stone-200 bg-[#fbfaf9]/95 px-4 pb-4 pt-3 backdrop-blur md:-mx-5 md:px-5">
                <button
                  type="submit"
                  disabled={!canProceedToCustomer}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3.5 text-sm font-extrabold transition ${
                    canProceedToCustomer
                      ? 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-pink-600'
                      : 'cursor-not-allowed bg-stone-200 text-stone-500'
                  }`}
                >
                  Continuar para entrega
                  <FaArrowRight size={13} />
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleRedirect();
              }}
              className="flex min-h-full flex-col"
            >
              <div className="flex-1 space-y-4 pb-32">
                <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-sm font-extrabold text-stone-950">Dados da entrega</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Nome</span>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        placeholder="Maria Souza"
                        className={`${inputClass} mt-2`}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Telefone</span>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        required
                        placeholder="(32) 99999-9999"
                        className={`${inputClass} mt-2`}
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Data de entrega</span>
                      <input
                        type="date"
                        name="deliveryDate"
                        value={formData.deliveryDate}
                        min={todayInput}
                        onChange={handleInputChange}
                        required
                        className={`${inputClass} mt-2`}
                      />
                    </label>
                  </div>
                </section>

                <MapAddressSelector value={formData} onChange={handleAddressChange} />

                {!hasValidDeliveryDate && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                    Escolha a data de entrega para finalizar.
                  </p>
                )}

                {!hasValidAddress && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                    Escolha uma área de entrega válida e informe rua e número.
                  </p>
                )}

                {redirectError && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                    {redirectError}
                  </p>
                )}

                <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between text-stone-600">
                      <span>Itens</span>
                      <span>{cartItems.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-stone-600">
                      <span>Pagamento</span>
                      <span>{PAYMENT_LABELS[formData.paymentMethod]}</span>
                    </div>
                    {formData.paymentMethod === 'cash' && (
                      <div className="flex items-center justify-between text-stone-600">
                        <span>Troco</span>
                        <span>
                          {formData.cashChangeNeeded && formData.cashChangeForCents
                            ? `Para ${formatCurrencyFromCents(formData.cashChangeForCents)}`
                            : 'Sem troco'}
                        </span>
                      </div>
                    )}
                    {discountCents > 0 && (
                      <div className="flex items-center justify-between text-emerald-700">
                        <span>Desconto{appliedCoupon ? ` (${appliedCoupon.code})` : ''}</span>
                        <span>-{formatCurrencyFromCents(discountCents)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-stone-200 pt-3 text-base font-extrabold text-stone-950">
                      <span>Total</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>
                </section>
              </div>

              <div className="sticky bottom-0 -mx-4 grid grid-cols-[104px_1fr] gap-2 border-t border-stone-200 bg-[#fbfaf9]/95 px-4 pb-4 pt-3 backdrop-blur md:-mx-5 md:px-5">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={savingOrder}
                  className="flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-3 text-sm font-bold text-stone-800 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400"
                >
                  <FaArrowLeft size={13} />
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={savingOrder || !canConfirmOrder}
                  className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-extrabold transition ${
                    savingOrder || !canConfirmOrder
                      ? 'cursor-not-allowed bg-stone-200 text-stone-500'
                      : 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-pink-600'
                  }`}
                >
                  <FaWhatsapp />
                  {savingOrder ? 'Salvando...' : 'Confirmar encomenda'}
                </button>
              </div>
            </form>
          )}
        </div>

        {cashModalOpen && (
          <div
            className="fixed inset-0 z-[80] flex items-end bg-stone-950/70 backdrop-blur-sm md:items-center md:justify-center md:p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Troco para pagamento em dinheiro"
            onClick={() => setCashModalOpen(false)}
          >
            <div
              className="w-full rounded-t-2xl bg-[#fbfaf9] p-4 shadow-2xl md:max-w-[420px] md:rounded-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-extrabold text-stone-950">Troco para quanto?</h3>
                  <p className="text-sm text-stone-600">Total da encomenda: {formatCurrencyFromCents(totalCents)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCashModalOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700"
                  aria-label="Fechar troco"
                >
                  <FaTimes aria-hidden="true" />
                </button>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleCashNoChange}
                  className="flex w-full items-center justify-center rounded-lg border border-stone-300 bg-white px-4 py-3 text-sm font-extrabold text-stone-800 transition hover:bg-stone-50"
                >
                  Não preciso de troco
                </button>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Troco para</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={cashChangeInput}
                    onChange={(event) => setCashChangeInput(event.target.value)}
                    placeholder="100,00"
                    className={`${inputClass} mt-2`}
                  />
                </label>

                {cashChangeError && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                    {cashChangeError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleSaveCashChange}
                  className="flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-primary/20"
                >
                  Salvar troco
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Checkout;
