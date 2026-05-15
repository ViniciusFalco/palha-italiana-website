import { useEffect, useMemo, useRef, useState } from 'react';
import { FaChevronDown, FaChevronLeft, FaMinus, FaPlus, FaShoppingCart } from 'react-icons/fa';
import type { CartItem, ProductOption } from '../types';
import type { ProductDetailField, ProductDetailSelection } from '../types/productDetail';
import { resolveUnitPriceCents } from '../lib/api/pricing';
import { fetchProductDetailFields } from '../lib/api/products';
import { useDocumentScrollLock } from '../hooks/useDocumentScrollLock';
import { supabase } from '../lib/supabase';

interface ProductSelectorProps {
  product: ProductOption;
  onAddToCart: (item: CartItem) => void;
  onClose: () => void;
  initialItem?: CartItem;
  isClosing?: boolean;
}

type DetailValue = string | string[];

const getDetailTextValue = (value: DetailValue | undefined) =>
  (Array.isArray(value) ? value[0] ?? '' : value ?? '').trim();

const getDetailSelectedValues = (value: DetailValue | undefined) =>
  Array.isArray(value)
    ? value.map((item) => item.trim()).filter(Boolean)
    : typeof value === 'string' && value.trim()
      ? [value.trim()]
      : [];

const normalizeDetailValueForField = (field: ProductDetailField, value: DetailValue | undefined): DetailValue =>
  field.input_type === 'multi_select' ? getDetailSelectedValues(value) : Array.isArray(value) ? value[0] ?? '' : value ?? '';

const ProductSelector = ({ product, onAddToCart, onClose, initialItem, isClosing }: ProductSelectorProps) => {
  const initialQuantity = Math.max(product.minQuantity || 1, initialItem?.quantity ?? 0) || 1;
  const [quantity, setQuantity] = useState(initialQuantity);
  const [quantityInput, setQuantityInput] = useState(String(initialQuantity));
  const [subtotal, setSubtotal] = useState(0);
  const [notes, setNotes] = useState(initialItem?.notes ?? '');
  const [detailFields, setDetailFields] = useState<ProductDetailField[]>([]);
  const [detailValues, setDetailValues] = useState<Record<string, DetailValue>>({});
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [resolvedProductId, setResolvedProductId] = useState<string | null>(
    (product as any).id ?? initialItem?.product_id ?? null
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [thumb, setThumb] = useState({ top: 0, height: 0, visible: false });
  const minQuantity = product.minQuantity || 1;
  useDocumentScrollLock(true);

  const initialDetails = useMemo(() => {
    const map: Record<string, DetailValue> = {};
    (initialItem?.details ?? []).forEach((detail) => {
      const nextValue = detail.value ?? '';
      [detail.fieldId, detail.fieldKey]
        .filter(Boolean)
        .forEach((detailKey) => {
          const key = detailKey as string;
          const currentValue = map[key];

          if (Array.isArray(currentValue)) {
            map[key] = Array.from(new Set([...currentValue, nextValue].filter((item) => item.trim())));
            return;
          }

          if (typeof currentValue === 'string' && currentValue.trim() && currentValue !== nextValue) {
            map[key] = Array.from(new Set([currentValue, nextValue].filter((item) => item.trim())));
            return;
          }

          map[key] = nextValue;
        });
    });
    return map;
  }, [initialItem]);

  useEffect(() => {
    const nextQuantity = Math.max(product.minQuantity || 1, initialItem?.quantity ?? 0) || 1;
    setQuantity(nextQuantity);
    setQuantityInput(String(nextQuantity));
    setNotes(initialItem?.notes ?? '');
  }, [initialItem, product.minQuantity, product.name, product.id]);

  const sortedDetailFields = useMemo(
    () => [...detailFields].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [detailFields]
  );

  useEffect(() => {
    let ignore = false;
    async function loadDetailFields() {
      setDetailError(null);
      let productId = resolvedProductId;

      if (!productId && product.sku) {
        try {
          const { data } = await supabase
            .from('products')
            .select('id')
            .eq('sku', product.sku)
            .maybeSingle();
          if (data?.id) {
            productId = data.id;
          }
        } catch (err) {
          console.error('Erro ao buscar ID do produto para detalhes.', err);
        }
      }

      if (ignore) return;
      setResolvedProductId(productId ?? null);

      if (!productId) {
        setDetailFields([]);
        setDetailValues({});
        return;
      }

      setDetailLoading(true);
      try {
        const fields = await fetchProductDetailFields(productId, { onlyActive: true, withOptions: true });
        if (ignore) return;
        const nextFields = (fields ?? []).map((field) => ({
          ...field,
          options: (field.options ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
        }));
        setDetailFields(nextFields);
        setDetailValues((prev) => {
          const next: Record<string, DetailValue> = {};
          nextFields.forEach((field) => {
            const key = field.id ?? field.field_key;
            next[key] = normalizeDetailValueForField(field, initialDetails[key] ?? prev[key]);
          });
          return next;
        });
      } catch (err) {
        if (ignore) return;
        const message = err instanceof Error ? err.message : 'Erro ao carregar detalhes do produto.';
        setDetailError(message);
        setDetailFields([]);
      } finally {
        if (!ignore) {
          setDetailLoading(false);
        }
      }
    }

    loadDetailFields();
    return () => {
      ignore = true;
    };
  }, [product.id, product.name, product.sku, resolvedProductId, initialDetails]);

  const detailSelections: ProductDetailSelection[] = useMemo(() => {
    return sortedDetailFields.flatMap((field) => {
        const key = field.id ?? field.field_key;
        if (field.input_type === 'multi_select') {
          return getDetailSelectedValues(detailValues[key]).map((value) => {
            const option = field.options?.find((opt) => opt.value === value);
            return {
              fieldId: field.id ?? key,
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
            fieldId: field.id ?? key,
            fieldKey: field.field_key,
            label: field.label,
            value,
            displayValue: option?.label ?? value,
            extraPriceDeltaCents: option?.extra_price_delta_cents ?? 0,
            inputType: field.input_type,
          },
        ];
      })
      .filter((item): item is ProductDetailSelection => Boolean(item));
  }, [sortedDetailFields, detailValues]);

  const detailExtraPriceCents = useMemo(
    () =>
      detailSelections.reduce(
        (acc, selection) =>
          acc + (Number.isFinite(selection.extraPriceDeltaCents) ? selection.extraPriceDeltaCents : 0),
        0
      ),
    [detailSelections]
  );

  const unitPrice = useMemo(() => {
    if (product.priceTiers && product.priceTiers.length > 0) {
      const sorted = [...product.priceTiers].sort((a, b) => a.minQuantity - b.minQuantity);
      const tier = sorted
        .filter((t) => quantity >= t.minQuantity && (t.maxQuantity == null || quantity <= t.maxQuantity))
        .pop();
      if (tier) return tier.price;
    }
    return product.basePrice;
  }, [product.basePrice, product.priceTiers, quantity]);

  const unitPriceWithExtras = useMemo(
    () => unitPrice + detailExtraPriceCents / 100,
    [unitPrice, detailExtraPriceCents]
  );

  useEffect(() => {
    setSubtotal(unitPriceWithExtras * quantity);
  }, [unitPriceWithExtras, quantity]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const updateThumb = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const needsScroll = scrollHeight > clientHeight;
      const height = needsScroll ? Math.max((clientHeight / scrollHeight) * clientHeight, 28) : 0;
      const maxTop = clientHeight - height;
      const top = needsScroll ? (scrollTop / (scrollHeight - clientHeight)) * maxTop : 0;
      setThumb({ top, height, visible: needsScroll });
    };

    updateThumb();
    el.addEventListener('scroll', updateThumb);
    window.addEventListener('resize', updateThumb);
    return () => {
      el.removeEventListener('scroll', updateThumb);
      window.removeEventListener('resize', updateThumb);
    };
  }, []);

  const updateDetailValue = (key: string, value: DetailValue) => {
    setDetailValues((prev) => ({ ...prev, [key]: value }));
    setDetailErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleAddToCart = async () => {
    if (product.minQuantity && quantity < product.minQuantity) {
      alert(`Quantidade minima e ${product.minQuantity}`);
      return;
    }

    const errors: Record<string, string> = {};
    sortedDetailFields.forEach((field) => {
      const key = field.id ?? field.field_key;
      if (field.input_type === 'multi_select') {
        const selectedValues = getDetailSelectedValues(detailValues[key]);
        if (field.is_required && selectedValues.length === 0) {
          errors[key] = 'Obrigatório';
          return;
        }

        if (selectedValues.length > 0) {
          const validOptions = new Set((field.options ?? []).map((option) => option.value));
          const hasInvalidOption = selectedValues.some((value) => !validOptions.has(value));
          if (hasInvalidOption) {
            errors[key] = 'Selecione opções válidas';
          }
        }
        return;
      }

      const value = getDetailTextValue(detailValues[key]);
      if (field.is_required && !value) {
        errors[key] = 'Obrigatório';
      }
      if (field.input_type === 'select' && value) {
        const optionExists = field.options?.some((opt) => opt.value === value);
        if (!optionExists) {
          errors[key] = 'Selecione uma opção válida';
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      setDetailErrors(errors);
      return;
    }
    setDetailErrors({});

    const productId = resolvedProductId ?? (product as any).id ?? (product as any).sku ?? '';
    const fallbackBasePriceCents =
      (product as any).base_price_cents ?? Math.round(product.basePrice * 100);

    let unitPriceCents = fallbackBasePriceCents;
    if (productId) {
      try {
        const resolved = await resolveUnitPriceCents(productId, quantity);
        if (typeof resolved === 'number' && Number.isFinite(resolved)) {
          unitPriceCents = resolved;
        }
      } catch (err) {
        console.error('resolveUnitPriceCents error', err);
        unitPriceCents = fallbackBasePriceCents;
      }
    }

    const adjustedUnitPriceCents = unitPriceCents + detailExtraPriceCents;
    const adjustedUnitPrice = adjustedUnitPriceCents / 100;

    const cartItem: CartItem = {
      name: product.name,
      description: product.description,
      price: adjustedUnitPrice,
      unit_price_cents: adjustedUnitPriceCents,
      image: product.image,
      details: detailSelections,
      notes: notes.trim() || undefined,
      quantity,
      product_id: productId || undefined,
    };

    onAddToCart(cartItem);
    onClose();
  };

  const hasMissingRequired = sortedDetailFields.some((field) => {
    const key = field.id ?? field.field_key;
    if (field.input_type === 'multi_select') {
      return field.is_required && getDetailSelectedValues(detailValues[key]).length === 0;
    }
    return field.is_required && !getDetailTextValue(detailValues[key]);
  });

  const canAddToCart = !hasMissingRequired && (!product.minQuantity || quantity >= product.minQuantity);

  const formatPrice = (price: number) => `R$ ${price.toFixed(2).replace('.', ',')}`;
  const formatExtraPriceLabel = (delta: number | undefined) => {
    if (!delta) return '';
    const formatted = (delta / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `+R$ ${formatted}`;
  };
  const titleSizeClass = product.name.length > 22 ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl';
  const labelClass =
    'flex items-center gap-1 text-[12px] sm:text-[13px] font-semibold text-stone-500 uppercase tracking-[0.14em] whitespace-nowrap';
  const selectLabelClass =
    'flex items-center gap-1 text-[12px] sm:text-[13px] font-semibold text-stone-500 uppercase tracking-[0.16em] whitespace-nowrap';
  const selectClass = (hasError?: boolean) =>
    `w-full min-w-0 rounded-lg border bg-white p-3 text-sm text-stone-950 shadow-sm outline-none appearance-none placeholder:text-stone-400 transition focus:border-primary focus:ring-2 focus:ring-primary/10 overflow-hidden text-ellipsis whitespace-nowrap ${
      hasError ? 'border-red-400/80' : 'border-stone-200'
    }`;
  const tierStartQuantity =
    product.priceTiers && product.priceTiers.length > 0
      ? Math.min(...product.priceTiers.map((t) => t.minQuantity))
      : minQuantity;
  const nextTier = useMemo(() => {
    if (!product.priceTiers?.length) return null;
    const sorted = [...product.priceTiers].sort((a, b) => a.minQuantity - b.minQuantity);
    return sorted.find((tier) => quantity < tier.minQuantity) ?? null;
  }, [product.priceTiers, quantity]);
  const updateQuantity = (nextValue: number) => {
    const normalized = Number.isFinite(nextValue) ? nextValue : minQuantity;
    const clamped = Math.max(minQuantity, normalized);
    setQuantity(clamped);
    setQuantityInput(String(clamped));
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex bg-stone-950/70 backdrop-blur-sm transition-opacity duration-200 md:items-center md:justify-center md:p-6 ${
        isClosing ? 'opacity-0' : 'opacity-100 fade-in'
      }`}
    >
      <div
        className={`relative flex h-full min-h-[100dvh] w-full flex-col overflow-hidden bg-[#fbfaf9] text-stone-950 shadow-2xl transition-transform duration-200 md:h-[min(92dvh,820px)] md:min-h-0 md:max-w-[720px] md:rounded-2xl ${
          isClosing ? 'translate-y-2 scale-[0.98]' : 'translate-y-0 scale-100'
        }`}
      >
        <div className="relative h-full">
          <div
            ref={scrollRef}
            className="h-full overflow-y-auto overflow-x-hidden pr-4 md:pr-6 [-ms-overflow-style:'none'] [scrollbar-width:'none'] [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarGutter: 'stable' }}
          >
            <div className="space-y-5 px-4 pb-8 pt-4 md:px-6">
              <header className="sticky top-0 z-20 -mx-4 -mt-4 border-b border-stone-200 bg-[#fbfaf9]/95 px-4 py-4 backdrop-blur md:-mx-6 md:px-6">
                <button
                  onClick={onClose}
                  className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-stone-600 transition hover:text-primary"
                  title="Voltar"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 shadow-sm">
                    <FaChevronLeft size={16} />
                  </span>
                  <span>Voltar</span>
                </button>
              </header>

              <section className="grid gap-4 pt-1 md:grid-cols-[240px,1fr] md:items-start">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-52 w-full rounded-lg border border-stone-200 object-cover shadow-sm md:h-64"
                  />
                ) : (
                  <div className="flex h-52 w-full items-center justify-center rounded-lg border border-stone-200 bg-white text-4xl font-bebas text-primary shadow-sm md:h-64">
                    {product.name.charAt(0)}
                  </div>
                )}
                <div className="space-y-2">
                  <h3 className={`font-bebas tracking-wide text-primary text-center ${titleSizeClass}`}>
                    {product.name}
                  </h3>
                  <p className="text-sm leading-relaxed text-stone-600 sm:text-base text-center">
                    {product.description || 'Personalize este produto com as opções abaixo.'}
                  </p>
                  <div className="rounded-lg border border-stone-200 bg-pink-500 p-3 shadow-sm text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white">Preço unitário</p>
                    <p className="mt-1 text-2xl font-extrabold text-white">{formatPrice(unitPriceWithExtras)}</p>
                    <p className="mt-1 text-sm text-white">
                      {nextTier
                        ? `A partir de ${nextTier.minQuantity} un: ${formatPrice(nextTier.price)} cada`
                        : `Pedido mínimo: ${tierStartQuantity} unidades`}
                    </p>
                  </div>
                </div>
              </section>

              <div className="flex items-center gap-3 px-1 text-[12px] uppercase tracking-[0.2em] text-primary">
                <span>Detalhes do pedido</span>
                <div className="h-px flex-1 bg-primary/30" />
              </div>
              <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm md:p-5">
                {detailLoading ? (
                  <div className="text-sm text-stone-600">Carregando campos adicionais...</div>
                ) : detailError ? (
                  <div className="text-sm text-red-600">{detailError}</div>
                ) : (
                  <div className="space-y-4">
                    {sortedDetailFields.length === 0 ? (
                      <div className="text-sm text-stone-500">Nenhum campo extra para este produto.</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sortedDetailFields.map((field) => {
                          const key = field.id ?? field.field_key;
                          const rawValue = detailValues[key];
                          const value = Array.isArray(rawValue) ? rawValue[0] ?? '' : rawValue ?? '';
                          const selectedValues = getDetailSelectedValues(rawValue);
                          const error = detailErrors[key];
                          const options = field.options ?? [];
                          const isChoiceField =
                            field.input_type === 'select' || field.input_type === 'multi_select';
                          const priceDeltaLabel = (delta: number | undefined) =>
                            delta ? ` (${formatExtraPriceLabel(delta)})` : '';

                          return (
                            <div key={key} className="space-y-1.5 min-w-0">
                              <label className={isChoiceField ? selectLabelClass : labelClass}>
                                <span>{field.label}</span>
                                {field.is_required && <span className="text-red-500">* Obrigatório</span>}
                              </label>

                              {field.input_type === 'textarea' ? (
                                <textarea
                                  value={value}
                                  onChange={(e) => updateDetailValue(key, e.target.value)}
                                  className="w-full rounded-lg border border-stone-200 bg-white p-3 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
                                  placeholder="Digite aqui"
                                  rows={3}
                                />
                              ) : field.input_type === 'select' ? (
                                <div className="relative">
                                  <select
                                    value={value}
                                    onChange={(e) => updateDetailValue(key, e.target.value)}
                                    className={selectClass(Boolean(error))}
                                  >
                                    <option value="">
                                      Selecione uma opção
                                    </option>
                                    {options.map((option) => (
                                      <option
                                        key={option.value}
                                        value={option.value}
                                      >
                                        {option.label}
                                        {priceDeltaLabel(option.extra_price_delta_cents)}
                                      </option>
                                    ))}
                                  </select>
                                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-500">
                                    <FaChevronDown size={13} />
                                  </span>
                                </div>
                              ) : field.input_type === 'multi_select' ? (
                                <div
                                  className={`space-y-2 rounded-lg border p-3 ${
                                    error ? 'border-red-400/70 bg-red-50' : 'border-stone-200 bg-stone-50'
                                  }`}
                                >
                                  {options.length === 0 ? (
                                    <div className="text-xs text-stone-500">Nenhuma opção cadastrada.</div>
                                  ) : (
                                    options.map((option) => {
                                      const checked = selectedValues.includes(option.value);

                                      return (
                                        <label
                                          key={option.value}
                                          className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition ${
                                            checked
                                              ? 'border-primary/45 bg-primary/10'
                                              : 'border-stone-200 bg-white hover:border-stone-300'
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={(e) => {
                                              const currentValues = getDetailSelectedValues(detailValues[key]);
                                              const nextValues = e.target.checked
                                                ? Array.from(new Set([...currentValues, option.value]))
                                                : currentValues.filter((item) => item !== option.value);
                                              updateDetailValue(key, nextValues);
                                            }}
                                            className="mt-0.5 h-4 w-4 rounded border-stone-300 text-primary focus:ring-primary/30"
                                          />
                                          <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-semibold text-stone-950">
                                              {option.label}
                                            </span>
                                            {option.extra_price_delta_cents ? (
                                              <span className="block text-xs text-primary">
                                                {formatExtraPriceLabel(option.extra_price_delta_cents)}/un
                                              </span>
                                            ) : null}
                                          </span>
                                        </label>
                                      );
                                    })
                                  )}
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  value={value}
                                  onChange={(e) => updateDetailValue(key, e.target.value)}
                                  className="w-full rounded-lg border border-stone-200 bg-white p-3 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
                                  placeholder="Digite aqui"
                                />
                              )}

                              {field.help_text && (
                                <p className="text-xs leading-relaxed text-stone-500">{field.help_text}</p>
                              )}
                              {error && <p className="text-xs text-red-600">{error}</p>}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="space-y-2 pt-2">
                      <label className="text-[12px] font-semibold uppercase tracking-[0.14em] text-stone-500 sm:text-[13px]">
                        Observação (opcional)
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value.slice(0, 300))}
                        maxLength={300}
                        className="min-h-[110px] w-full resize-none rounded-lg border border-stone-200 bg-white p-3 text-sm text-stone-950 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
                        placeholder="Adicione detalhes de entrega ou personalização"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 px-1 text-[12px] uppercase tracking-[0.2em] text-primary">
                  <span>Quantidade</span>
                  <div className="h-px flex-1 bg-primary/30" />
                </div>
                <div className="flex flex-col items-center gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => updateQuantity(quantity - 1)}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-stone-700 shadow-sm transition-colors hover:bg-stone-100"
                      aria-label="Diminuir quantidade"
                    >
                      <FaMinus size={14} />
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={quantityInput}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          setQuantityInput('');
                          return;
                        }
                        if (!/^\d+$/.test(raw)) return;
                        const parsed = parseInt(raw, 10);
                        setQuantityInput(raw);
                        if (!Number.isNaN(parsed)) {
                          setQuantity(Math.max(minQuantity, parsed));
                        }
                      }}
                      onBlur={() => {
                        if (!quantityInput) {
                          updateQuantity(minQuantity);
                          return;
                        }
                        const parsed = parseInt(quantityInput, 10);
                        updateQuantity(Number.isNaN(parsed) ? minQuantity : parsed);
                      }}
                      className="w-24 rounded-lg border border-stone-200 bg-white p-2.5 text-center text-lg font-semibold text-stone-950 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                    <button
                      type="button"
                      onClick={() => updateQuantity(quantity + 1)}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-stone-700 shadow-sm transition-colors hover:bg-stone-100"
                      aria-label="Aumentar quantidade"
                    >
                      <FaPlus size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateQuantity(quantity + 10)}
                      className="flex h-11 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 px-4 text-sm font-semibold text-stone-700 shadow-sm transition-colors hover:bg-stone-100"
                    >
                      +10
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={!canAddToCart}
                className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold shadow-lg transition-colors ${
                  canAddToCart
                    ? 'bg-primary text-white hover:bg-pink-600 hover:shadow-[0_12px_32px_rgba(255,0,127,0.28)]'
                    : 'cursor-not-allowed border border-stone-200 bg-stone-100 text-stone-400'
                }`}
              >
                <FaShoppingCart size={16} />
                {`${initialItem ? 'Atualizar' : 'Adicionar'} ${formatPrice(subtotal)}`}
              </button>
            </div>
          </div>

          {thumb.visible && (
            <div className="pointer-events-none absolute bottom-6 right-3 top-6 w-[4px] rounded-full bg-stone-200">
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-xs font-bold leading-none text-stone-400">^</span>
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-xs font-bold leading-none text-stone-400">v</span>
              <div
                className="absolute left-0 right-0 rounded-full bg-primary shadow-[0_0_10px_rgba(255,0,127,0.35)]"
                style={{ top: thumb.top, height: thumb.height }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductSelector;
