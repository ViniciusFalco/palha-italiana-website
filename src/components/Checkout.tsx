import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  FaArrowLeft,
  FaArrowRight,
  FaCheck,
  FaPen,
  FaTimes,
  FaTrash,
  FaWhatsapp,
  FaInfoCircle,
  FaExclamationCircle,
  FaShoppingBag,
  FaQrcode,
  FaCreditCard,
  FaMoneyBillWave,
  FaTicketAlt,
  FaPlus,
  FaShoppingCart,
} from 'react-icons/fa';
import type { CartItem, CheckoutProps, FormData } from '../types';
import { useDocumentScrollLock } from '../hooks/useDocumentScrollLock';
import MapAddressSelector from './MapAddressSelector';
import { formatCheckoutAddress, isAllowedDeliveryArea } from '../lib/deliveryAreas';
import {
  fetchCheckoutSettings,
  validateDiscountCoupon,
  type AppliedDiscountCoupon,
} from '../lib/api/checkoutSettings';


type PaymentMethod = Exclude<FormData['paymentMethod'], ''>;

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: 'Pix',
  credit: 'Cartão de crédito',
  debit: 'Cartão de débito',
  cash: 'Dinheiro',
};

const PAYMENT_OPTIONS: Array<{ value: PaymentMethod; label: string; icon: typeof FaQrcode }> = [
  { value: 'pix', label: PAYMENT_LABELS.pix, icon: FaQrcode },
  { value: 'credit', label: PAYMENT_LABELS.credit, icon: FaCreditCard },
  { value: 'debit', label: PAYMENT_LABELS.debit, icon: FaCreditCard },
  { value: 'cash', label: PAYMENT_LABELS.cash, icon: FaMoneyBillWave },
];

const CHECKOUT_PROGRESS_KEY = 'checkout_progress_v2';
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
  paymentMethod: '',
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

const formatPhoneInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : '';
  if (digits.length <= 3) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}`;
};

const getPhoneDigits = (value: string) => value.replace(/\D/g, '');

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
    parsed.paymentMethod === 'pix' ||
    parsed.paymentMethod === 'credit' ||
    parsed.paymentMethod === 'debit' ||
    parsed.paymentMethod === 'cash'
      ? parsed.paymentMethod
      : '';

  return {
    name: typeof parsed.name === 'string' ? parsed.name : '',
    phone: typeof parsed.phone === 'string' ? formatPhoneInput(parsed.phone) : '',
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

const cleanCartDetailLabel = (label: string) => {
  const normalized = label.replace(/\?/g, '').trim();
  const lower = normalized.toLowerCase();

  if (lower.includes('tamanho') && lower.includes('torta')) return 'Tamanho';
  if (lower.startsWith('qual tamanho')) return 'Tamanho';
  if (lower.startsWith('qual sabor')) return 'Sabor';
  if (lower.startsWith('qual cobertura')) return 'Cobertura';

  return normalized.replace(/^qual\s+/i, '').trim();
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
    .map((detail) => {
      const value = detail.displayValue ?? detail.value;
      if (!value) return null;

      return `${cleanCartDetailLabel(detail.label)}: ${value}`;
    })
    .filter(Boolean) as string[];

  return [...parts, ...details].join(' • ');
};

const resolveCartItemImageSrc = (image?: string | null) => {
  const src = image?.trim();
  if (!src) return null;
  if (/^(https?:|data:|blob:)/i.test(src) || src.startsWith('/')) return src;
  if (src.startsWith('public/')) return `/${src.slice('public/'.length)}`;
  return `/${src.replace(/^\.?\//, '')}`;
};

const CartItemImagePreview = ({ item }: { item: CartItem }) => {
  const src = resolveCartItemImageSrc(item.image);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const visibleSrc = src && failedSrc !== src ? src : null;

  useEffect(() => {
    setFailedSrc(null);
  }, [src]);

  return (
    <span className="relative flex h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-pink-100 ring-1 ring-stone-200">
      <span className="absolute inset-0 flex items-center justify-center text-base font-extrabold text-primary">
        {item.name.slice(0, 1).toUpperCase()}
      </span>
      {visibleSrc && (
        <img
          key={visibleSrc}
          src={visibleSrc}
          alt={item.name}
          className="relative z-10 h-full w-full object-cover"
          loading="eager"
          decoding="async"
          onError={() => setFailedSrc(visibleSrc)}
        />
      )}
    </span>
  );
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
  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [couponSuccessAnimating, setCouponSuccessAnimating] = useState(false);
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [clearCartModalOpen, setClearCartModalOpen] = useState(false);
  const [cashChangeInput, setCashChangeInput] = useState(() =>
    centsToInputValue(initialDraftRef.current.formData.cashChangeForCents)
  );
  const [cashChangeError, setCashChangeError] = useState<string | null>(null);
  const [paymentExpanded, setPaymentExpanded] = useState(true);
  const [deliveryExpanded, setDeliveryExpanded] = useState(true);
  const [addressExpanded, setAddressExpanded] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const wasDeliveryDetailsCompleteRef = useRef(false);
  const enteredDeliveryStepRef = useRef(false);
  const hasValidAddressRef = useRef(false);

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
      formData.neighborhood?.trim() &&
      formData.city?.trim() &&
      isAllowedDeliveryArea(formData.city)
  );
  const hasValidDeliveryDate = Boolean(formData.deliveryDate && formData.deliveryDate >= todayInput);
  const hasValidDeliveryDetails = Boolean(
    formData.name.trim().length >= 2 && getPhoneDigits(formData.phone).length >= 10 && hasValidDeliveryDate
  );
  const hasSelectedPayment = Boolean(formData.paymentMethod);
  const hasValidCashPayment = Boolean(
    formData.paymentMethod !== 'cash' ||
      !formData.cashChangeNeeded ||
      ((formData.cashChangeForCents ?? 0) >= totalCents && (formData.cashChangeForCents ?? 0) > 0)
  );
  const canProceedToCustomer = Boolean(cartItems.length && minimumReached && hasSelectedPayment && hasValidCashPayment);
  const canConfirmOrder = Boolean(
    hasValidDeliveryDetails &&
      hasValidAddress &&
      cartItems.length &&
      minimumReached &&
      hasSelectedPayment &&
      hasValidCashPayment
  );
  const progressWidth = `${Math.round((step / CHECKOUT_STEPS.length) * 100)}%`;
  const appliedCouponCode = appliedCoupon?.code;
  const deliveryDateLabel = formData.deliveryDate ? formData.deliveryDate.split('-').reverse().join('/') : '';
  const addressCompleteCollapsed = hasValidAddress && !addressExpanded;
  const deliveryCompleteCollapsed = hasValidDeliveryDetails && !deliveryExpanded;
  const checkoutDetailsComplete = deliveryCompleteCollapsed && addressCompleteCollapsed;
  const paymentCompleteCollapsed = hasSelectedPayment && !paymentExpanded;
  const paymentLabel = formData.paymentMethod ? PAYMENT_LABELS[formData.paymentMethod] : 'Escolha uma forma de pagamento';

  useEffect(() => {
    saveCheckoutProgress({
      step,
      activeItemIndex,
      formData,
    });
  }, [step, activeItemIndex, formData]);

  useEffect(() => {
    hasValidAddressRef.current = hasValidAddress;
  }, [hasValidAddress]);

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
    if (step !== 2) {
      enteredDeliveryStepRef.current = false;
      return;
    }
    if (enteredDeliveryStepRef.current) return;
    enteredDeliveryStepRef.current = true;
    setDeliveryExpanded(!hasValidDeliveryDetails);
    setAddressExpanded(hasValidDeliveryDetails);
    wasDeliveryDetailsCompleteRef.current = hasValidDeliveryDetails;
  }, [hasValidDeliveryDetails, step]);

  useEffect(() => {
    if (step !== 2) return;
    const wasComplete = wasDeliveryDetailsCompleteRef.current;
    if (hasValidDeliveryDetails && !wasComplete) {
      setDeliveryExpanded(false);
      setAddressExpanded(true);
    }
    if (!hasValidDeliveryDetails && wasComplete) {
      setDeliveryExpanded(true);
      setAddressExpanded(false);
    }
    wasDeliveryDetailsCompleteRef.current = hasValidDeliveryDetails;
  }, [hasValidDeliveryDetails, step]);

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
  useDocumentScrollLock(isVisible || cashModalOpen || couponModalOpen || clearCartModalOpen);

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
    setCouponModalOpen(false);
    setCouponSuccessAnimating(false);
    setCashModalOpen(false);
    setClearCartModalOpen(false);
    setCashChangeInput('');
    setCashChangeError(null);
    setPaymentExpanded(true);
    setDeliveryExpanded(true);
    setAddressExpanded(false);
    wasDeliveryDetailsCompleteRef.current = false;
    enteredDeliveryStepRef.current = false;
    clearCheckoutProgress();
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'phone' ? formatPhoneInput(value) : value,
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

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
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
      return;
    }
    setPaymentExpanded(false);
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
    setPaymentExpanded(false);
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
    setPaymentExpanded(false);
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
      setCouponSuccessAnimating(true);
      window.setTimeout(() => {
        setCouponSuccessAnimating(false);
        setCouponModalOpen(false);
      }, 700);
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
    setCouponSuccessAnimating(false);
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
                <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
  <div className="mb-4 flex items-start justify-between gap-3">
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-100 text-primary">
        <FaShoppingBag size={18} />
      </span>

      <div>
        <h3 className="text-lg font-extrabold leading-tight text-stone-950">
          Carrinho
        </h3>

        <p className="mt-0.5 text-sm font-semibold text-stone-500">
          {cartItems.length === 1
            ? '1 item no pedido'
            : `${cartItems.length} itens no pedido`}
        </p>
      </div>
    </div>

    {cartItems.length > 0 && clearCart && (
      <button
        type="button"
        className="pt-1 text-sm font-extrabold text-primary hover:text-pink-600"
        onClick={() => setClearCartModalOpen(true)}
      >
        Limpar
      </button>
    )}
  </div>

  <div className="space-y-3">
    {cartItems.length === 0 && (
      <p className="rounded-xl bg-stone-50 px-4 py-4 text-center text-sm font-medium text-stone-500">
        Seu carrinho está vazio.
      </p>
    )}

    {cartItems.map((item: CartItem, index: number) => {
      const isActive = activeItemIndex === index;
      const metaText = getCartItemMeta(item);

      return (
        <article
          key={`${item.name}-${index}`}
          className={`rounded-2xl border p-4 transition ${
            isActive
              ? 'border-primary bg-pink-50'
              : 'border-stone-200 bg-stone-50'
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveItemIndex(isActive ? null : index)}
            className="flex w-full items-start justify-between gap-3 text-left"
          >
            <span className="flex min-w-0 flex-1 gap-3">
              <CartItemImagePreview item={item} />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-extrabold leading-tight text-stone-950">
                  {item.name}
                </span>

                {metaText && (
                  <span className="mt-1 block text-sm font-medium leading-relaxed text-stone-500">
                    {metaText}
                  </span>
                )}
              </span>
            </span>

            <span className="shrink-0 text-right">
              <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-stone-500 ring-1 ring-stone-200">
                x{item.quantity}
              </span>

              <span className="mt-2 block text-base font-extrabold text-stone-950">
                {formatCurrency(item.price * item.quantity)}
              </span>
            </span>
          </button>

          {isActive && (
            <div className="mt-4 flex items-center gap-2 border-t border-stone-200 pt-3">
              {onEditCartItem && (
                <button
                  type="button"
                  className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white text-sm font-bold text-stone-800 transition hover:bg-stone-50"
                  onClick={() => onEditCartItem(index)}
                >
                  <FaPen size={12} />
                  Editar
                </button>
              )}

              {removeCartItem && (
                <button
                  type="button"
                  className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-sm font-bold text-red-600 transition hover:bg-red-100"
                  onClick={() => removeCartItem(index)}
                >
                  <FaTrash size={12} />
                  Remover
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
                    className={`overflow-hidden rounded-lg border p-3 shadow-sm transition-all duration-300 ease-out ${
                      minimumReached ? 'border-pink-600 bg-pink-600' : 'border-amber-200 bg-amber-50'
                    }`}
                    aria-live="polite"
                  >
                    <div
                      className={`flex items-center justify-between gap-3 text-xs font-extrabold uppercase tracking-wide transition-colors duration-300 ${
                        minimumReached ? 'text-white' : 'text-amber-800'
                      }`}
                    >
                      <span>
                        Pedido mínimo: {formatCurrencyFromCents(orderMinimumCents)}
                      </span>
                      <span
                        className={`inline-flex items-center gap-2 ${
                          minimumReached ? 'text-white' : 'text-amber-700'
                        }`}
                      >
                        {minimumReached ? (
                          <>
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm">
                              <FaCheck size={10} aria-hidden="true" />
                            </span>
                            Atingido
                          </>
                        ) : (
                          `${formatCurrencyFromCents(minimumRemainingCents)} restantes`
                        )}
                      </span>
                    </div>
                    <div
                      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                        minimumReached ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
                      }`}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80">
                          <div
                            className="h-full rounded-full bg-amber-500 transition-all duration-300"
                            style={{ width: minimumProgressWidth }}
                          />
                        </div>
                        <p className="mt-2 text-xs font-semibold text-amber-800">
                          Faltam {formatCurrencyFromCents(minimumRemainingCents)} para realizar o pedido mínimo.
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                <section
                  className={`overflow-hidden rounded-lg border shadow-sm transition-all duration-300 ease-out ${
                    paymentCompleteCollapsed
                      ? 'border-pink-600 bg-pink-600'
                      : 'border-stone-200 bg-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setPaymentExpanded((current) => !current)}
                    className={`relative flex w-full gap-3 px-4 transition-all duration-300 ease-out ${
                      paymentCompleteCollapsed
                        ? 'items-center justify-center py-2.5 text-center'
                        : 'items-start justify-between py-3 text-left'
                    }`}
                    aria-expanded={paymentExpanded}
                  >
                    <span className="min-w-0">
                      <span
                        className={`flex items-center gap-2 text-sm font-extrabold transition-all duration-300 ${
                          paymentCompleteCollapsed ? 'justify-center text-white' : 'text-stone-950'
                        }`}
                      >
                        Pagamento
                        {paymentCompleteCollapsed && (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm">
                            <FaCheck size={10} aria-hidden="true" />
                          </span>
                        )}
                      </span>
                      <span
                        className={`mt-0.5 block text-xs font-semibold leading-relaxed transition-colors duration-300 ${
                          paymentCompleteCollapsed ? 'text-white/90' : 'text-stone-500'
                        }`}
                      >
                        {paymentLabel}
                      </span>
                    </span>
                    <FaArrowRight
                      size={13}
                      className={`shrink-0 transition-transform duration-300 ${
                        paymentCompleteCollapsed ? 'absolute right-4 text-white/80' : 'text-stone-500'
                      } ${paymentExpanded ? 'rotate-90' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                      paymentExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className={`min-h-0 overflow-hidden px-3 ${paymentExpanded ? 'pb-3' : 'pb-0'}`}>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {PAYMENT_OPTIONS.map((method) => {
                          const selected = formData.paymentMethod === method.value;
                          const Icon = method.icon;
                          return (
                            <button
                              key={method.value}
                              type="button"
                              onClick={() => handlePaymentMethodSelect(method.value)}
                              className={`flex min-h-16 flex-col items-center justify-center gap-2 rounded-lg border px-2 text-xs font-extrabold transition ${
                                selected
                                  ? 'border-primary bg-primary text-white shadow-sm'
                                  : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-white'
                              }`}
                              aria-pressed={selected}
                            >
                              <Icon size={16} aria-hidden="true" />
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
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setCouponModalOpen(true);
                      setCouponError(null);
                      setCouponMessage(null);
                    }}
                    className={`mb-4 flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-extrabold transition-all duration-300 ${
                      appliedCoupon
                        ? 'border-pink-600 bg-pink-600 text-white shadow-sm'
                        : 'border-stone-200 bg-stone-50 text-stone-800 hover:border-primary/30 hover:bg-white hover:text-primary'
                    }`}
                  >
                    {appliedCoupon ? (
                      <>
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm">
                          <FaCheck size={10} aria-hidden="true" />
                        </span>
                        Cupom {appliedCoupon.code}: -{formatCurrencyFromCents(discountCents)}
                      </>
                    ) : (
                      <>
                        <FaPlus size={12} aria-hidden="true" />
                        Cupom de desconto
                      </>
                    )}
                  </button>

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
                <section
                  className={`overflow-hidden rounded-lg border shadow-sm transition-all duration-300 ease-out ${
                    hasValidDeliveryDetails
                      ? 'border-pink-600 bg-pink-600'
                      : 'border-stone-200 bg-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setDeliveryExpanded((current) => !current)}
                    className={`relative flex w-full gap-3 px-4 py-3 transition-all duration-300 ease-out ${
                      hasValidDeliveryDetails
                        ? 'items-center justify-center text-center'
                        : 'items-start justify-between text-left'
                    }`}
                    aria-expanded={deliveryExpanded}
                  >
                    <span className="min-w-0 transition-all duration-300 ease-out">
                      <span
                        className={`flex items-center gap-2 text-sm font-extrabold transition-all duration-300 ease-out ${
                          hasValidDeliveryDetails ? 'justify-center text-white' : 'text-stone-950'
                        }`}
                      >
                        Dados básicos
                        {hasValidDeliveryDetails && (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm">
                            <FaCheck size={10} aria-hidden="true" />
                          </span>
                        )}
                      </span>
                      <span
                        className={`mt-0.5 block whitespace-normal break-words text-xs font-semibold leading-relaxed transition-colors duration-300 ${
                          hasValidDeliveryDetails ? 'text-white/90' : 'text-stone-500'
                        }`}
                      >
                        {hasValidDeliveryDetails
                          ? `${formData.name.trim()} • ${deliveryDateLabel}`
                          : ''}
                      </span>
                    </span>
                    <FaArrowRight
                      size={13}
                      className={`shrink-0 transition-transform duration-300 ${
                        hasValidDeliveryDetails ? 'absolute right-4 text-white/80' : 'text-stone-500'
                      } ${
                        deliveryExpanded ? 'rotate-90' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                      deliveryExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className="grid grid-cols-1 gap-3 px-4 pb-4 sm:grid-cols-2">
                        <label className="block">
                          <span
                            className={`text-xs font-semibold uppercase tracking-wide transition-colors duration-300 ${
                              hasValidDeliveryDetails ? 'text-white/90' : 'text-stone-500'
                            }`}
                          >
                            Nome
                          </span>
                          <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            required
                            placeholder="Coloque seu nome aqui"
                            className={`${inputClass} mt-2`}
                          />
                        </label>
                        <label className="block">
                          <span
                            className={`text-xs font-semibold uppercase tracking-wide transition-colors duration-300 ${
                              hasValidDeliveryDetails ? 'text-white/90' : 'text-stone-500'
                            }`}
                          >
                            Telefone
                          </span>
                          <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleInputChange}
                            required
                            placeholder="(32) 9 9999-9999"
                            inputMode="tel"
                            maxLength={16}
                            className={`${inputClass} mt-2`}
                          />
                        </label>
                        <label className="block sm:col-span-2">
                          <span
                            className={`text-xs font-semibold uppercase tracking-wide transition-colors duration-300 ${
                              hasValidDeliveryDetails ? 'text-white/90' : 'text-stone-500'
                            }`}
                          >
                            Data de entrega
                          </span>
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
                    </div>
                  </div>
                </section>

                <section
                  className={`overflow-hidden rounded-lg border shadow-sm transition-all duration-300 ease-out ${
                    addressCompleteCollapsed
                      ? 'border-pink-600 bg-pink-600'
                      : hasValidDeliveryDetails
                        ? 'border-stone-200 bg-white'
                        : 'border-stone-200 bg-stone-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (!hasValidDeliveryDetails) return;
                      setAddressExpanded((current) => !current);
                    }}
                    disabled={!hasValidDeliveryDetails}
                    className={`relative flex w-full gap-3 px-4 py-3 transition-all duration-300 ease-out disabled:cursor-not-allowed ${
                      addressCompleteCollapsed
                        ? 'items-center justify-center text-center'
                        : 'items-start justify-between text-left'
                    }`}
                    aria-expanded={addressExpanded}
                  >
                    <span className="min-w-0 transition-all duration-300 ease-out">
                      <span
                        className={`flex items-center gap-2 text-sm font-extrabold transition-all duration-300 ease-out ${
                          addressCompleteCollapsed ? 'justify-center text-white' : 'text-stone-950'
                        }`}
                      >
                        Endereço
                        {addressCompleteCollapsed && (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm">
                            <FaCheck size={10} aria-hidden="true" />
                          </span>
                        )}
                      </span>
                      <span
                        className={`mt-0.5 block whitespace-normal break-words text-xs font-semibold leading-relaxed transition-colors duration-300 ${
                          addressCompleteCollapsed ? 'text-white/90' : 'text-stone-500'
                        }`}
                      >
                        {addressCompleteCollapsed
                          ? formattedAddress
                          : hasValidDeliveryDetails
                            ? 'Cidade, rua, número e bairro'
                            : 'Complete os dados básicos primeiro'}
                      </span>
                    </span>
                    <FaArrowRight
                      size={13}
                      className={`shrink-0 transition-transform duration-300 ${
                        addressCompleteCollapsed ? 'absolute right-4 text-white/80' : 'text-stone-500'
                      } ${
                        addressExpanded ? 'rotate-90' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                      addressExpanded && hasValidDeliveryDetails
                        ? 'grid-rows-[1fr] opacity-100'
                        : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="min-h-0 overflow-hidden px-3 pb-3">
                      <MapAddressSelector
                        value={formData}
                        onChange={handleAddressChange}
                        completed={addressCompleteCollapsed}
                        onFinalFieldBlur={() => {
                          window.setTimeout(() => {
                            if (!hasValidAddressRef.current) return;
                            setAddressExpanded(false);
                          }, 0);
                        }}
                      />
                    </div>
                  </div>
                </section>

                {!hasValidDeliveryDetails && (
                  <div className="flex items-start gap-3 rounded-xl border border-pink-200 bg-pink-50 px-4 py-3">
                    <FaInfoCircle className="mt-0.5 h-4 w-4 shrink-0 text-pink-600" />

                    <p className="text-sm font-semibold leading-snug text-zinc-800">
                      Preencha nome, telefone e data de entrega.
                    </p>
                  </div>
                )}

                {hasValidDeliveryDetails && !hasValidAddress && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <FaExclamationCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />

                    <p className="text-sm font-semibold leading-snug text-amber-900">
                      Escolha uma área de entrega válida e informe rua, número e bairro.
                    </p>
                  </div>
                )}

                {redirectError && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                    {redirectError}
                  </p>
                )}

                <section
                  className={`rounded-lg border p-3 shadow-sm transition-all duration-300 ease-out ${
                    checkoutDetailsComplete
                      ? 'border-pink-600 bg-pink-600'
                      : 'border-stone-200 bg-white'
                  }`}
                >
                  <div className="space-y-2 text-sm">
                    <div
                      className={`flex items-center justify-between transition-colors duration-300 ${
                        checkoutDetailsComplete ? 'text-white' : 'text-stone-600'
                      }`}
                    >
                      <span>Itens</span>
                      <span>{cartItems.length}</span>
                    </div>
                    <div
                      className={`flex items-center justify-between transition-colors duration-300 ${
                        checkoutDetailsComplete ? 'text-white' : 'text-stone-600'
                      }`}
                    >
                      <span>Pagamento</span>
                      <span>{paymentLabel}</span>
                    </div>
                    {formData.paymentMethod === 'cash' && (
                      <div
                        className={`flex items-center justify-between transition-colors duration-300 ${
                          checkoutDetailsComplete ? 'text-white' : 'text-stone-600'
                        }`}
                      >
                        <span>Troco</span>
                        <span>
                          {formData.cashChangeNeeded && formData.cashChangeForCents
                            ? `Para ${formatCurrencyFromCents(formData.cashChangeForCents)}`
                            : 'Sem troco'}
                        </span>
                      </div>
                    )}
                    {discountCents > 0 && (
                      <div
                        className={`flex items-center justify-between transition-colors duration-300 ${
                          checkoutDetailsComplete ? 'text-emerald-100' : 'text-emerald-700'
                        }`}
                      >
                        <span>Desconto{appliedCoupon ? ` (${appliedCoupon.code})` : ''}</span>
                        <span>-{formatCurrencyFromCents(discountCents)}</span>
                      </div>
                    )}
                    <div
                      className={`flex items-center justify-between border-t pt-3 text-base font-extrabold transition-colors duration-300 ${
                        checkoutDetailsComplete
                          ? 'border-white/30 text-white'
                          : 'border-stone-200 text-stone-950'
                      }`}
                    >
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

        {clearCartModalOpen && (
          <div
            className="fixed inset-0 z-[80] flex items-end bg-stone-950/70 backdrop-blur-sm md:items-center md:justify-center md:p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Limpar carrinho"
            onClick={() => setClearCartModalOpen(false)}
          >
            <div
              className="w-full rounded-t-2xl bg-[#fbfaf9] p-4 shadow-2xl md:max-w-[420px] md:rounded-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-pink-100 text-primary">
                  <FaShoppingCart size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-extrabold text-stone-950">Limpar carrinho?</h3>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600">
                    Todos os itens adicionados serão removidos do pedido atual.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setClearCartModalOpen(false)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700"
                  aria-label="Fechar confirmação"
                >
                  <FaTimes aria-hidden="true" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setClearCartModalOpen(false)}
                  className="flex items-center justify-center rounded-lg border border-stone-300 bg-white px-4 py-3 text-sm font-extrabold text-stone-800 transition hover:bg-stone-50"
                >
                  Manter itens
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearCart?.();
                    resetCheckoutState();
                  }}
                  className="flex items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-primary/20 transition hover:bg-pink-600"
                >
                  Limpar carrinho
                </button>
              </div>
            </div>
          </div>
        )}

        {couponModalOpen && (
          <div
            className="fixed inset-0 z-[80] flex items-end bg-stone-950/70 backdrop-blur-sm md:items-center md:justify-center md:p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Cupom de desconto"
            onClick={() => {
              if (couponLoading) return;
              setCouponModalOpen(false);
              setCouponSuccessAnimating(false);
            }}
          >
            <div
              className={`w-full rounded-t-2xl bg-[#fbfaf9] p-4 shadow-2xl transition-all duration-300 md:max-w-[420px] md:rounded-2xl ${
                couponSuccessAnimating ? 'scale-[0.98] ring-4 ring-emerald-300/60' : 'scale-100'
              }`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-lg transition-all duration-300 ${
                      couponSuccessAnimating ? 'bg-emerald-500 text-white' : 'bg-pink-100 text-primary'
                    }`}
                  >
                    {couponSuccessAnimating ? <FaCheck aria-hidden="true" /> : <FaTicketAlt aria-hidden="true" />}
                  </span>
                  <div>
                    <h3 className="text-lg font-extrabold text-stone-950">Cupom de desconto</h3>
                    <p className="text-sm text-stone-600">
                      {couponSuccessAnimating ? 'Cupom aplicado com sucesso.' : 'Informe o código do seu cupom.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCouponModalOpen(false);
                    setCouponSuccessAnimating(false);
                  }}
                  disabled={couponLoading}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 disabled:opacity-50"
                  aria-label="Fechar cupom"
                >
                  <FaTimes aria-hidden="true" />
                </button>
              </div>

              <div className="space-y-3">
                {appliedCoupon && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
                    {appliedCoupon.code} aplicado: -{formatCurrencyFromCents(discountCents)}
                  </div>
                )}

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Código do cupom</span>
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                    placeholder="PALHA10"
                    className={`${inputClass} mt-2`}
                    autoFocus
                  />
                </label>

                {couponError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{couponError}</p>}
                {couponMessage && (
                  <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                    {couponMessage}
                  </p>
                )}

                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={couponLoading || !cartItems.length || couponSuccessAnimating}
                    className="flex items-center justify-center rounded-lg bg-primary px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-primary/20 transition hover:bg-pink-600 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500"
                  >
                    {couponLoading ? 'Validando...' : couponSuccessAnimating ? 'Aplicado' : 'Aplicar'}
                  </button>
                  {appliedCoupon && (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      disabled={couponLoading || couponSuccessAnimating}
                      className="rounded-lg border border-stone-300 bg-white px-4 text-sm font-extrabold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

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
