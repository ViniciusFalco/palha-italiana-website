import { useEffect, useMemo, useState } from 'react';
import { FaArrowLeft, FaArrowRight, FaChevronDown, FaChevronRight, FaTimes, FaWhatsapp } from 'react-icons/fa';
import type { CheckoutProps, FormData, CartItem } from '../types';

const LOCATION_SUGGESTIONS = [
  'Avenida Astolfo Dutra - Centro, Cataguases',
  'Rua Coronel João Duarte - Centro, Cataguases',
  'Rua Doutor Laureano - Centro, Cataguases',
  'Rua Coronel Vieira - Centro, Cataguases',
  'Rua Alferes Botelho - Centro, Cataguases',
  'Rua Prefeito Carlos Alberto Dutra Nicácio - Centro, Cataguases',
  'Rua Nilo Peçanha - Centro, Cataguases',
  'Rua Professor Alcântara - Granjaria, Cataguases',
  'Rua Rabelo Horta - Granjaria, Cataguases',
  'Rua José Peres - Granjaria, Cataguases',
  'Rua Major Vieira - Centro, Cataguases',
  'Rua Meia Pataca - Bela Vista, Cataguases',
  'Rua Tenente Fortunato - Haidée, Cataguases',
  'Rua Guido Marliere - Vila Domingos Lopes, Cataguases',
  'Rua Geraldo Marques - Paraíso, Cataguases',
  'Rua José Maria Bello - Popular, Cataguases',
  'Rua Silva Jardim - Pouso Alegre, Cataguases',
  'Rua Treze de Maio - Pouso Alegre, Cataguases',
  'Rua Joaquim de Oliveira - Pouso Alegre, Cataguases',
  'Rua Francisco Duarte - Paraíso, Cataguases',
  'Rua Doutor Cid Gonçalves - Paraíso, Cataguases',
  'Rua Clarindo de Melo - Bandeirantes, Cataguases',
  'Rua Nova Independência - Bandeirantes, Cataguases',
  'Rua Presidente Kennedy - Bela Vista, Cataguases',
  'Rua José do Carmo Martins - Bela Vista, Cataguases',
  'Rua José Teles - São Vicente, Cataguases',
  'Rua Luís Cerqueira - São Vicente, Cataguases',
  'Rua Vitor Lopes - São Vicente, Cataguases',
  'Avenida Eudaldo Lessa - Beira Rio, Cataguases',
  'Rua Afonso Pena - Beira Rio, Cataguases',
  'Rua José Inácio Peixoto - Beira Rio, Cataguases',
  'Rua João Teixeira - Pampulha, Cataguases',
  'Rua Marcílio Dias - Pampulha, Cataguases',
  'Rua Monsenhor Marciano - Pampulha, Cataguases',
  'Rua João de Souza Neves - Primavera, Cataguases',
  'Rua Joaquim Peixoto - Primavera, Cataguases',
  'Rua Edgard Vieira Lima - Primavera, Cataguases',
  'Rua Pastor Attila Almeida - Primavera, Cataguases',
  'Rua Padre João Emílio - Bandeirantes, Cataguases',
  'Rua Orlando Lessa - Sol Nascente, Cataguases',
  'Rua Santa Terezinha - Sol Nascente, Cataguases',
  'Rua São Paulo - Sol Nascente, Cataguases',
  'Rua Aparecida - Ana Carrara, Cataguases',
  'Rua Estrela Dalva - Ana Carrara, Cataguases',
  'Rua do Contorno - Haidée, Cataguases',
  'Rua Doutor Coutinho - Haidée, Cataguases',
  'Rua Dona Olinda - Haidée, Cataguases',
  'Rua Horácio Melo - Paraíso, Cataguases',
  'Rua Projetada 1 - São Cristóvão, Cataguases',
  'Rua Projetada 2 - São Cristóvão, Cataguases',
  'Rua Professora Maria da Conceição - São Cristóvão, Cataguases',
  'Rua Orlando Milane - São Cristóvão, Cataguases',
  'Rua Dr. João Drumond - Bela Vista, Leopoldina',
  'Rua Governador Valadares - Centro, Leopoldina',
  'Rua Presidente Carlos Luz - Centro, Leopoldina',
  'Rua Barão de Cotegipe - Centro, Leopoldina',
  'Rua do Beco - Praça da Bandeira, Muriaé',
  'Rua João Pinheiro - Centro, Muriaé',
  'Rua Gil Moreira - Barra, Muriaé',
  'Rua Doutor Ivan Costa - São Francisco, Além Paraíba',
  'Rua Coronel João Duarte - Centro, Além Paraíba',
  'Rua do Comércio - Recreio, MG',
];

const PAYMENT_LABELS: Record<FormData['paymentMethod'], string> = {
  pix: 'Pix',
  credit: 'Cartão de Crédito',
  debit: 'Cartão de Débito',
};

const formatCurrency = (value: number) => `R$ ${value.toFixed(2)}`;

const initialFormState: FormData = {
  name: '',
  phone: '',
  street: '',
  houseNumber: '',
  addressComplement: '',
  noComplement: false,
  paymentMethod: 'pix',
  address: '',
};

const Checkout = ({
  isOpen,
  onClose,
  cartItems,
  onCompleteOrder,
  removeCartItem,
  clearCart,
  updateItemQuantity,
  updateItemQuantityWithPricing,
}: CheckoutProps) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [expandedPayment, setExpandedPayment] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [hasSentOrder, setHasSentOrder] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [redirectError, setRedirectError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormState);

  const subtotal = useMemo(
    () => cartItems.reduce((total: number, item: CartItem) => total + item.price * item.quantity, 0),
    [cartItems]
  );
  const shipping = 5;
  const total = Math.max(0, subtotal + shipping);

  const formattedAddress = useMemo(() => {
    const complement =
      formData.noComplement || !formData.addressComplement?.trim()
        ? ''
        : `, ${formData.addressComplement.trim()}`;
    const base = [formData.street.trim(), formData.houseNumber.trim()].filter(Boolean).join(', ');
    return base ? `${base}${complement}` : '';
  }, [formData.street, formData.houseNumber, formData.addressComplement, formData.noComplement]);

  const filteredSuggestions = useMemo(() => {
    const query = formData.street.trim().toLowerCase();
    if (query.length < 2) return [];
    return LOCATION_SUGGESTIONS.filter((item) => item.toLowerCase().includes(query)).slice(0, 6);
  }, [formData.street]);

  useEffect(() => {
    if (step !== 3) return undefined;
    setCountdown(10);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  useEffect(() => {
    if (step === 3 && countdown === 0 && !hasSentOrder && !savingOrder && !redirectError) {
      handleRedirect();
    }
  }, [countdown, step, hasSentOrder, savingOrder, redirectError]);

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setHasSentOrder(false);
      setCountdown(10);
      setActiveItemIndex(null);
      setExpandedPayment(false);
      setFormData(initialFormState);
      setSavingOrder(false);
      setRedirectError(null);
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setFormData((prev) => ({ ...prev, street: suggestion }));
  };

  const canProceedToSummary = Boolean(
    formData.name.trim() && formData.phone.trim() && formData.street.trim() && formData.houseNumber.trim()
  );

  const handleProceedToStepTwo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canProceedToSummary) return;
    setStep(2);
  };

  const handleStartConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cartItems.length) return;
    setStep(3);
  };

  const handleRedirect = async () => {
    if (hasSentOrder || savingOrder) return;
    setRedirectError(null);
    setSavingOrder(true);
    try {
      await onCompleteOrder({ ...formData, address: formattedAddress }, total);
      setHasSentOrder(true);
    } catch (error) {
      if (import.meta.env.DEV && error) {
        console.error('Checkout: erro ao salvar pedido', error);
      }
      const message = error instanceof Error ? error.message : 'Não foi possível enviar o pedido. Tente novamente.';
      setRedirectError(message);
      setCountdown(10);
    } finally {
      setSavingOrder(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50">
      <div className="w-full h-full bg-gray-900 text-white flex flex-col overflow-hidden">
        <div className="sticky top-0 z-30 bg-gray-900 border-b border-primary/30">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-primary text-black font-bold flex items-center justify-center shadow">
                {step}
              </span>
              <h2 className="font-bebas text-2xl text-white tracking-wide">Finalizar Pedido</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-primary transition-colors p-2 rounded-full hover:bg-white/10"
            >
              <FaTimes size={20} />
            </button>
          </div>
          <div className="px-6 pb-4">
            <div className="flex items-center justify-center gap-3 text-xs uppercase tracking-[0.2em] text-pink-100/80">
              {[
                { label: 'Dados', value: 1 },
                { label: 'Revisão', value: 2 },
                { label: 'Envio', value: 3 },
              ].map((item, idx) => {
                const isActive = step === item.value;
                const isDone = step > item.value;
                return (
                  <div key={item.label} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStep(item.value as 1 | 2 | 3)}
                      className={`px-4 py-2 rounded-lg border font-semibold ${
                        isActive
                          ? 'border-primary bg-primary text-black'
                          : isDone
                          ? 'border-primary/50 bg-primary/10 text-white'
                          : 'border-gray-700 bg-gray-800 text-white/70'
                      }`}
                    >
                      {item.label}
                    </button>
                    {idx < 2 && <FaChevronRight className="text-primary/70" size={12} />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 space-y-6 overflow-y-auto">

          {step === 1 && (
            <form onSubmit={handleProceedToStepTwo} className="flex flex-col h-full">
              <div className="flex-1 space-y-5 pb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-pink-100 uppercase tracking-[0.1em]">
                      Nome completo
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      placeholder="Ex: Maria Souza"
                      className="w-full p-3 rounded-xl bg-black text-white border border-primary/40 focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-pink-100 uppercase tracking-[0.1em]">
                      Telefone para contato
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      required
                      placeholder="(32) 99999-9999"
                      className="w-full p-3 rounded-xl bg-black text-white border border-primary/40 focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-pink-100 uppercase tracking-[0.1em]">
                    Logradouro
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="street"
                      value={formData.street}
                      onChange={handleInputChange}
                      placeholder="Digite a rua e escolha uma referência em Cataguases e região"
                      className="w-full p-3 rounded-xl bg-black text-white border border-primary/40 focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                    {filteredSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 mt-2 rounded-xl bg-gray-900 border border-primary/30 shadow-xl max-h-56 overflow-y-auto z-10">
                        {filteredSuggestions.map((suggestion) => (
                          <button
                            type="button"
                            key={suggestion}
                            onClick={() => handleSelectSuggestion(suggestion)}
                            className="w-full text-left px-4 py-3 text-sm text-white hover:bg-primary/10"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-pink-100 uppercase tracking-[0.1em]">
                       Número
                    </label>
                    <input
                      type="text"
                      name="houseNumber"
                      value={formData.houseNumber}
                      onChange={handleInputChange}
                      placeholder="Ex: 120"
                      className="w-full p-3 rounded-xl bg-black text-white border border-primary/40 focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-pink-100 uppercase tracking-[0.1em]">
                      Complemento
                    </label>
                    <input
                      type="text"
                      name="addressComplement"
                      value={formData.addressComplement}
                      onChange={handleInputChange}
                      disabled={formData.noComplement}
                       placeholder="Nº do apartamento, bloco..."
                      className={`w-full p-3 rounded-xl bg-black text-white border focus:ring-2 focus:ring-primary focus:border-primary ${formData.noComplement ? 'border-gray-700 text-gray-500' : 'border-primary/40'}`}
                    />
                    <label className="flex items-center gap-2 text-xs text-white/80">
                      <input
                        type="checkbox"
                        checked={formData.noComplement}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            noComplement: e.target.checked,
                            addressComplement: e.target.checked ? '' : prev.addressComplement,
                          }))
                        }
                        className="h-4 w-4 accent-primary"
                      />
                       Não possui complemento
                    </label>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 left-0 right-0 -mx-6 px-6 pb-2 pt-4 bg-gradient-to-t from-gray-900 via-gray-900 to-transparent">
                <button
                  type="submit"
                  disabled={!canProceedToSummary}
                  className={`w-full px-6 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg transition-colors ${canProceedToSummary ? 'bg-primary text-black hover:bg-pink-500' : 'bg-gray-700 text-white/60 cursor-not-allowed'}`}
                >
                  Continuar
                  <FaArrowRight size={14} />
                </button>
              </div>
            </form>
          )}
          {step === 2 && (
            <form onSubmit={handleStartConfirmation} className="space-y-5">
              <div className="space-y-5 pb-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bebas text-xl text-white">Itens no carrinho</h3>
                    <span className="text-xs text-white/70">Clique em um item para modificar</span>
                  </div>
                  <div className="rounded-xl border border-primary/30 bg-black/60 max-h-64 overflow-y-auto p-3 space-y-3">
                    {cartItems.length === 0 && (
                      <p className="text-center text-sm text-white/60">Seu carrinho está vazio.</p>
                    )}
                    {cartItems.map((item: CartItem, index: number) => {
                      const isActive = activeItemIndex === index;
                      return (
                        <div
                          key={`${item.name}-${index}`}
                          className={`rounded-lg p-3 border cursor-pointer transition-colors ${isActive ? 'border-primary bg-primary/10' : 'border-gray-700 bg-gray-900/60 hover:border-primary/60'}`}
                          onClick={() => setActiveItemIndex(isActive ? null : index)}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-semibold truncate">{item.name}</p>
                              <p className="text-xs text-white/60 truncate">
                                {item.flavor || item.coverage || item.size || 'Personalize seu pedido'}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-white/80">x{item.quantity}</span>
                              <span className="font-semibold text-white">
                                {formatCurrency(item.price * item.quantity)}
                              </span>
                            </div>
                          </div>
                          {isActive && (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                className="px-3 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-700 border border-primary/40"
                                onClick={() => {
                                  const next = Math.max(1, item.quantity - 1);
                                  if (updateItemQuantityWithPricing && (item as any).id) {
                                    updateItemQuantityWithPricing((item as any).id, next);
                                  } else if (updateItemQuantity) {
                                    updateItemQuantity(index, next);
                                  }
                                }}
                              >
                                -1
                              </button>
                              <button
                                type="button"
                                className="px-3 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-700 border border-primary/40"
                                onClick={() => {
                                  const next = item.quantity + 1;
                                  if (updateItemQuantityWithPricing && (item as any).id) {
                                    updateItemQuantityWithPricing((item as any).id, next);
                                  } else if (updateItemQuantity) {
                                    updateItemQuantity(index, next);
                                  }
                                }}
                              >
                                +1
                              </button>
                              {removeCartItem && (
                                <button
                                  type="button"
                                  className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 border border-red-400/80"
                                  onClick={() => removeCartItem(index)}
                                >
                                  Remover
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {cartItems.length > 0 && clearCart && (
                    <button
                      type="button"
                      className="text-sm text-red-400 hover:text-red-200 underline"
                      onClick={() => {
                        if (window.confirm('Deseja limpar todo o carrinho?')) clearCart();
                      }}
                    >
                      Limpar carrinho
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-primary/30 bg-black/60 p-4 space-y-2">
                    <div className="flex justify-between text-white">
                      <span>Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-white">
                      <span>Taxa de entrega</span>
                      <span>{formatCurrency(shipping)}</span>
                    </div>
                    <div className="flex justify-between text-primary font-bold text-lg">
                      <span>Total</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-primary/30 bg-black/60 p-4">
                    <button
                      type="button"
                      onClick={() => setExpandedPayment((prev) => !prev)}
                      className="w-full flex items-center justify-between text-white font-semibold"
                    >
                      Formas de pagamento
                      <FaChevronDown
                        size={14}
                        className={`transition-transform ${expandedPayment ? 'rotate-180' : 'rotate-0'}`}
                      />
                    </button>
                    {expandedPayment && (
                      <div className="mt-4 space-y-3">
                        {(['pix', 'credit', 'debit'] as const).map((method) => (
                          <label
                            key={method}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${formData.paymentMethod === method ? 'border-primary bg-primary/10 text-white' : 'border-gray-700 bg-gray-900/60 text-white/80 hover:border-primary/50'}`}
                          >
                            <input
                              type="radio"
                              name="paymentMethod"
                              value={method}
                              checked={formData.paymentMethod === method}
                              onChange={() => setFormData((prev) => ({ ...prev, paymentMethod: method }))}
                              className="accent-primary h-4 w-4"
                            />
                            <span className="font-semibold">{PAYMENT_LABELS[method]}</span>
                          </label>
                        ))}
                        <p className="text-xs text-white/70 italic">
                          Pagamento ser? realizado na pr?xima etapa.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 left-0 right-0 -mx-6 px-6 pb-2 pt-4 bg-gradient-to-t from-gray-900 via-gray-900 to-transparent flex flex-col md:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full md:w-auto px-3 py-2 rounded-lg border border-gray-700 text-white bg-gray-800 hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <FaArrowLeft size={14} />
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={!cartItems.length}
                  className={`w-full md:w-auto px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg transition-colors ${cartItems.length ? 'bg-primary text-black hover:bg-pink-500' : 'bg-gray-700 text-white/60 cursor-not-allowed'}`}
                >
                  Fechar pedido
                  <FaArrowRight size={14} />
                </button>
              </div>
            </form>
          )}
          {step === 3 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-primary/40 bg-black/70 p-5 shadow-inner">
                <p className="text-primary font-bebas text-2xl">Pedido enviado!</p>
                <p className="text-white mt-2 leading-relaxed">
                  Seu pedido foi realizado e enviado à Sweet Child. Você será redirecionado ao WhatsApp da empresa em
                  <span className="text-primary font-semibold"> {countdown} segundos</span>, ou clique no botão abaixo
                  para ir agora.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center text-primary text-2xl font-bold">
                    {countdown}
                  </div>
                  <div className="flex-1">
                    <p className="text-white/70 text-sm">O redirecionamento abre o WhatsApp com seu pedido.</p>
                    <p className="text-white/70 text-sm">Pagamento será combinado na conversa.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRedirect}
                  disabled={hasSentOrder || savingOrder}
                  className={`mt-4 w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold shadow-lg transition-colors ${
                    hasSentOrder || savingOrder ? 'bg-gray-700 text-white/70 cursor-not-allowed' : 'bg-primary text-black hover:bg-pink-500'
                  }`}
                >
                  <FaWhatsapp />
                  {savingOrder ? 'Salvando pedido...' : 'Ir agora para o WhatsApp'}
                </button>
                {redirectError && (
                  <p className="mt-3 text-sm text-red-300">
                    {redirectError}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-primary/30 bg-gray-900/80 p-4 space-y-2 text-white">
                <p className="text-sm">
                  WhatsApp Business não permite comunicação direta, mas você pode clicar neste número e falar conosco:{' '}
                  <a
                    href="https://wa.me/5521985767312"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    +55 21 98576-7312
                  </a>
                  .
                </p>
                <p className="text-sm text-white/80">
                  O site envia o pedido automaticamente para o número <strong>+55 21 98576-7312</strong>.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Checkout;
