import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { FaArrowLeft, FaArrowRight, FaPen, FaTimes, FaTrash, FaWhatsapp } from 'react-icons/fa';
import type { CartItem, CheckoutProps, FormData } from '../types';
import { useDocumentScrollLock } from '../hooks/useDocumentScrollLock';
import MapAddressSelector, { formatCheckoutAddress, isAllowedDeliveryArea } from './MapAddressSelector';

const PAYMENT_LABELS: Record<FormData['paymentMethod'], string> = {
  pix: 'Pix',
  credit: 'Cartão de crédito',
  debit: 'Cartão de débito',
};

const PAYMENT_OPTIONS: Array<{ value: FormData['paymentMethod']; label: string }> = [
  { value: 'pix', label: PAYMENT_LABELS.pix },
  { value: 'credit', label: PAYMENT_LABELS.credit },
  { value: 'debit', label: PAYMENT_LABELS.debit },
];

const CHECKOUT_PROGRESS_KEY = 'checkout_progress_v1';
const CHECKOUT_STEPS = [1, 2, 3] as const;
type CheckoutStep = (typeof CHECKOUT_STEPS)[number];

interface CheckoutProgressDraft {
  step: CheckoutStep;
  activeItemIndex: number | null;
  formData: FormData;
}

const initialFormState: FormData = {
  name: '',
  phone: '',
  street: '',
  houseNumber: '',
  addressComplement: '',
  noComplement: false,
  paymentMethod: 'pix',
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

const isCheckoutStep = (value: unknown): value is CheckoutStep => value === 1 || value === 2 || value === 3;

const sanitizeNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const sanitizeFormData = (value: unknown): FormData => {
  if (!value || typeof value !== 'object') return initialFormState;
  const parsed = value as Partial<FormData>;
  const paymentMethod =
    parsed.paymentMethod === 'credit' || parsed.paymentMethod === 'debit' ? parsed.paymentMethod : 'pix';

  return {
    name: typeof parsed.name === 'string' ? parsed.name : '',
    phone: typeof parsed.phone === 'string' ? parsed.phone : '',
    street: typeof parsed.street === 'string' ? parsed.street : '',
    houseNumber: typeof parsed.houseNumber === 'string' ? parsed.houseNumber : '',
    addressComplement: typeof parsed.addressComplement === 'string' ? parsed.addressComplement : '',
    noComplement: Boolean(parsed.noComplement),
    paymentMethod,
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
  } catch {}
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
  const closeTimerRef = useRef<number | null>(null);

  const subtotal = useMemo(
    () => cartItems.reduce((total: number, item: CartItem) => total + item.price * item.quantity, 0),
    [cartItems]
  );
  const shipping = 5;
  const total = Math.max(0, subtotal + shipping);
  const formattedAddress = useMemo(() => {
    const derived = formatCheckoutAddress(formData);
    return formData.address?.trim() || derived;
  }, [formData]);

  const hasValidAddress = Boolean(
    formData.street.trim() &&
      formData.houseNumber.trim() &&
      formData.city?.trim() &&
      isAllowedDeliveryArea(formData.city)
  );
  const canProceedToSummary = Boolean(formData.name.trim() && formData.phone.trim() && hasValidAddress);
  const progressWidth = `${Math.round((step / CHECKOUT_STEPS.length) * 100)}%`;

  useEffect(() => {
    saveCheckoutProgress({
      step,
      activeItemIndex,
      formData,
    });
  }, [step, activeItemIndex, formData]);

  useEffect(() => {
    if (cartItems.length > 0) return;
    setActiveItemIndex(null);
    if (step !== 1) setStep(1);
  }, [cartItems.length, step]);

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
  useDocumentScrollLock(isVisible);

  const resetCheckoutState = () => {
    setStep(1);
    setActiveItemIndex(null);
    setFormData(initialFormState);
    setSavingOrder(false);
    setRedirectError(null);
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

  const handleProceedToStepTwo = (event: FormEvent) => {
    event.preventDefault();
    if (!canProceedToSummary) return;
    setStep(2);
  };

  const handleStartConfirmation = (event: FormEvent) => {
    event.preventDefault();
    if (!cartItems.length) return;
    setStep(3);
  };

  const handleRedirect = async () => {
    if (savingOrder || !cartItems.length) return;
    setRedirectError(null);
    setSavingOrder(true);
    try {
      await onCompleteOrder({ ...formData, address: formattedAddress }, total);
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
            <form onSubmit={handleProceedToStepTwo} className="flex min-h-full flex-col">
              <div className="flex-1 space-y-4 pb-28">
                <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
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
                  </div>
                </section>

                <MapAddressSelector value={formData} onChange={handleAddressChange} />

                {!hasValidAddress && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                    Escolha uma área de entrega válida e informe rua e número.
                  </p>
                )}
              </div>

              <div className="sticky bottom-0 -mx-4 border-t border-stone-200 bg-[#fbfaf9]/95 px-4 pb-4 pt-3 backdrop-blur md:-mx-5 md:px-5">
                <button
                  type="submit"
                  disabled={!canProceedToSummary}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3.5 text-sm font-extrabold transition ${
                    canProceedToSummary
                      ? 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-pink-600'
                      : 'cursor-not-allowed bg-stone-200 text-stone-500'
                  }`}
                >
                  Continuar
                  <FaArrowRight size={13} />
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleStartConfirmation} className="flex min-h-full flex-col">
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

                <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
                  <h3 className="mb-3 text-sm font-extrabold text-stone-950">Entrega</h3>
                  <div className="space-y-2 text-sm text-stone-700">
                    <p className="font-bold text-stone-950">{formData.name}</p>
                    <p>{formData.phone}</p>
                    <p className="leading-relaxed">{formattedAddress || 'Endereço não informado'}</p>
                  </div>
                </section>

                <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
                  <h3 className="mb-3 text-sm font-extrabold text-stone-950">Pagamento</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {PAYMENT_OPTIONS.map((method) => {
                      const selected = formData.paymentMethod === method.value;
                      return (
                        <button
                          key={method.value}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, paymentMethod: method.value }))}
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
                </section>

                <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between text-stone-600">
                      <span>Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-stone-600">
                      <span>Entrega</span>
                      <span>{formatCurrency(shipping)}</span>
                    </div>
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
                  className="flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-3 text-sm font-bold text-stone-800 transition hover:bg-stone-50"
                >
                  <FaArrowLeft size={13} />
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={!cartItems.length}
                  className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-extrabold transition ${
                    cartItems.length
                      ? 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-pink-600'
                      : 'cursor-not-allowed bg-stone-200 text-stone-500'
                  }`}
                >
                  Ir para envio
                  <FaArrowRight size={13} />
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="flex min-h-full flex-col">
              <div className="flex-1 space-y-4 pb-32">
                <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
                  <h3 className="text-lg font-extrabold text-stone-950">Pedido pronto</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-600">
                    O pedido será salvo no painel admin e o WhatsApp abrirá para finalizar o contato.
                  </p>
                  {redirectError && (
                    <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                      {redirectError}
                    </p>
                  )}
                </section>

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
                    <div className="flex items-center justify-between border-t border-stone-200 pt-3 text-base font-extrabold text-stone-950">
                      <span>Total</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border border-stone-200 bg-white p-3 text-sm leading-relaxed text-stone-700 shadow-sm">
                  <p className="font-bold text-stone-950">{formData.name}</p>
                  <p>{formData.phone}</p>
                  <p>{formattedAddress || 'Endereço não informado'}</p>
                  <a
                    href="https://wa.me/5521985767312"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block font-bold text-primary underline"
                  >
                    +55 32 98466-9122
                  </a>
                </section>
              </div>

              <div className="sticky bottom-0 -mx-4 grid grid-cols-[104px_1fr] gap-2 border-t border-stone-200 bg-[#fbfaf9]/95 px-4 pb-4 pt-3 backdrop-blur md:-mx-5 md:px-5">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={savingOrder}
                  className="flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-3 text-sm font-bold text-stone-800 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400"
                >
                  <FaArrowLeft size={13} />
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleRedirect}
                  disabled={savingOrder || !cartItems.length}
                  className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-extrabold transition ${
                    savingOrder || !cartItems.length
                      ? 'cursor-not-allowed bg-stone-200 text-stone-500'
                      : 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-pink-600'
                  }`}
                >
                  <FaWhatsapp />
                  {savingOrder ? 'Salvando...' : 'Confirmar pedido'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Checkout;
