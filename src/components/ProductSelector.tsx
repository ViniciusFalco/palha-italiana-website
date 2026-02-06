import { useEffect, useMemo, useRef, useState } from 'react';
import { FaChevronLeft, FaMinus, FaPlus, FaShoppingCart } from 'react-icons/fa';
import type { CartItem, ProductOption } from '../types';
import type { ProductDetailField, ProductDetailSelection } from '../types/productDetail';
import { resolveUnitPriceCents } from '../lib/api/pricing';
import { fetchProductDetailFields } from '../lib/api/products';
import { supabase } from '../lib/supabase';

interface ProductSelectorProps {
  product: ProductOption;
  onAddToCart: (item: CartItem) => void;
  onClose: () => void;
}

const ProductSelector = ({ product, onAddToCart, onClose }: ProductSelectorProps) => {
  const [quantity, setQuantity] = useState(product.minQuantity || 1);
  const [subtotal, setSubtotal] = useState(0);
  const [notes, setNotes] = useState('');
  const [detailFields, setDetailFields] = useState<ProductDetailField[]>([]);
  const [detailValues, setDetailValues] = useState<Record<string, string>>({});
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [resolvedProductId, setResolvedProductId] = useState<string | null>((product as any).id ?? null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [thumb, setThumb] = useState({ top: 0, height: 0, visible: false });
  const minQuantity = product.minQuantity || 1;

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
          const next: Record<string, string> = {};
          nextFields.forEach((field) => {
            const key = field.id ?? field.field_key;
            next[key] = prev[key] ?? '';
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
  }, [product.id, product.name, product.sku, resolvedProductId]);

  const detailSelections: ProductDetailSelection[] = useMemo(() => {
    return sortedDetailFields
      .map((field) => {
        const key = field.id ?? field.field_key;
        const rawValue = detailValues[key] ?? '';
        const value = typeof rawValue === 'string' ? rawValue.trim() : '';
        if (!value) return null;
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
      const tier = sorted.filter((t) => quantity >= t.minQuantity).pop();
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

  const handleAddToCart = async () => {
    if (product.minQuantity && quantity < product.minQuantity) {
      alert(`Quantidade minima e ${product.minQuantity}`);
      return;
    }

    const errors: Record<string, string> = {};
    sortedDetailFields.forEach((field) => {
      const key = field.id ?? field.field_key;
      const value = (detailValues[key] ?? '').trim();
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
    const value = (detailValues[key] ?? '').trim();
    return field.is_required && !value;
  });

  const canAddToCart = !hasMissingRequired && (!product.minQuantity || quantity >= product.minQuantity);

  const formatPrice = (price: number) => `R$ ${price.toFixed(2).replace('.', ',')}`;
  const titleSizeClass = product.name.length > 22 ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl';
  const labelClass =
    'flex items-center gap-1 text-[13px] sm:text-sm font-semibold text-pink-200 uppercase tracking-[0.08em] whitespace-nowrap';
  const selectClass = (hasError?: boolean) =>
    `w-full p-3 text-sm border rounded-xl shadow-sm bg-black text-white focus:ring-2 focus:ring-pink-500 focus:border-pink-400 appearance-none placeholder:text-pink-100/60 ${
      hasError ? 'border-red-400/70' : 'border-primary/35'
    }`;
  const tierStartQuantity =
    product.priceTiers && product.priceTiers.length > 0
      ? Math.min(...product.priceTiers.map((t) => t.minQuantity))
      : minQuantity;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center px-3 py-4 animate-fade-in">
      <div className="relative w-full max-w-5xl h-full md:h-[94vh] bg-gradient-to-b from-gray-950 via-black to-gray-950 border border-primary/40 shadow-[0_18px_70px_rgba(0,0,0,0.6)] rounded-3xl overflow-hidden flex flex-col text-white">
        <header className="relative flex items-center px-5 py-4 border-b border-primary/25 bg-black/70 backdrop-blur">
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-white bg-primary hover:bg-pink-600 rounded-full shadow transition-colors"
            title="Voltar"
          >
            <FaChevronLeft size={18} />
          </button>
          <h3
            className={`absolute left-1/2 -translate-x-1/2 font-bebas text-primary tracking-wide drop-shadow-sm whitespace-nowrap truncate ${titleSizeClass}`}
            style={{ maxWidth: 'calc(100% - 150px)' }}
          >
            {product.name}
          </h3>
        </header>

        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex gap-5 px-6 py-5 border-b border-primary/20 bg-gradient-to-r from-black via-gray-950 to-black">
            <div className="flex gap-4 items-start w-full">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-28 h-28 sm:w-32 sm:h-32 object-cover rounded-xl border border-primary/30 shadow-md bg-black/70"
                />
              ) : (
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl bg-black text-primary flex items-center justify-center font-bebas text-3xl border border-primary/30 shadow-sm">
                  {product.name.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-3">
                <p className="text-sm sm:text-base leading-relaxed text-pink-50/90">
                  {product.description || 'Personalize este produto com as opcoes ao lado.'}
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center flex-wrap gap-2 text-[11px] uppercase tracking-[0.14em]">
                  <span className="px-3 py-1 rounded-full bg-primary text-black font-bold shadow-sm">
                    {`${formatPrice(unitPriceWithExtras)} und.`}
                  </span>
                  <span className="px-3 py-1 rounded-full border border-primary/50 text-primary bg-white/5">
                    {`a partir de ${tierStartQuantity} unidades.`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex-1 min-h-0 px-4 md:px-6 py-5">
            <div
              ref={scrollRef}
              className="h-full max-h-full overflow-y-auto space-y-4 pr-6 md:pr-8 [-ms-overflow-style:'none'] [scrollbar-width:'none'] [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarGutter: 'stable' }}
            >
              <div className="flex items-center text-[12px] uppercase tracking-[0.2em] text-pink-200/80 px-1 gap-3">
                <span>Detalhes do pedido</span>
                <div className="h-px flex-1 bg-primary/30" />
              </div>
              <div className="bg-black/60 border border-primary/25 shadow-[0_12px_40px_rgba(0,0,0,0.45)] rounded-2xl p-4 md:p-5">
                {detailLoading ? (
                  <div className="text-sm text-white/80">Carregando campos adicionais...</div>
                ) : detailError ? (
                  <div className="text-sm text-red-300">{detailError}</div>
                ) : (
                  <div className="space-y-4">
                    {sortedDetailFields.length === 0 ? (
                      <div className="text-sm text-white/70">Nenhum campo extra para este produto.</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sortedDetailFields.map((field) => {
                          const key = field.id ?? field.field_key;
                          const value = detailValues[key] ?? '';
                          const error = detailErrors[key];
                          const options = field.options ?? [];
                          const priceDeltaLabel = (delta: number | undefined) => {
                            if (!delta) return '';
                            const formatted = (delta / 100).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            });
                            return ` (+R$ ${formatted})`;
                          };

                          return (
                            <div key={key} className="space-y-1.5">
                              <label className={labelClass}>
                                <span>{field.label}</span>
                                {field.is_required && <span className="text-red-400">*</span>}
                              </label>

                              {field.input_type === 'textarea' ? (
                                <textarea
                                  value={value}
                                  onChange={(e) =>
                                    setDetailValues((prev) => ({ ...prev, [key]: e.target.value }))
                                  }
                                  className="w-full rounded-xl border border-primary/35 bg-black text-white p-3 text-sm focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-pink-100/60"
                                  placeholder="Digite aqui"
                                  rows={3}
                                />
                              ) : field.input_type === 'select' ? (
                                <div className="relative">
                                  <select
                                    value={value}
                                    onChange={(e) =>
                                      setDetailValues((prev) => ({ ...prev, [key]: e.target.value }))
                                    }
                                    className={selectClass(Boolean(error))}
                                  >
                                    <option value="" style={{ color: '#f5f5f5', backgroundColor: '#000' }}>
                                      Selecione uma opção
                                    </option>
                                    {options.map((option) => (
                                      <option
                                        key={option.value}
                                        value={option.value}
                                        style={{ color: '#f5f5f5', backgroundColor: '#000' }}
                                      >
                                        {option.label}
                                        {priceDeltaLabel(option.extra_price_delta_cents)}
                                      </option>
                                    ))}
                                  </select>
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-primary pointer-events-none">
                                    <svg width="18" height="18" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M7 7l3 3 3-3" />
                                    </svg>
                                  </span>
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  value={value}
                                  onChange={(e) =>
                                    setDetailValues((prev) => ({ ...prev, [key]: e.target.value }))
                                  }
                                  className="w-full rounded-xl border border-primary/35 bg-black text-white p-3 text-sm focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-pink-100/60"
                                  placeholder="Digite aqui"
                                />
                              )}

                              {field.help_text && (
                                <p className="text-xs text-pink-100/80 leading-relaxed">{field.help_text}</p>
                              )}
                              {error && <p className="text-red-400 text-xs">{error}</p>}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="space-y-2 pt-2">
                      <label className="text-[13px] sm:text-sm font-semibold text-pink-200 uppercase tracking-[0.08em]">
                        Observação (opcional)
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value.slice(0, 300))}
                        maxLength={300}
                        className="w-full min-h-[110px] rounded-xl border border-primary/30 p-3 text-sm text-white focus:ring-2 focus:ring-primary focus:border-primary bg-black shadow-sm placeholder:text-pink-100/60 resize-none"
                        placeholder="Adicione detalhes de entrega ou personalização"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            {thumb.visible && (
              <div className="pointer-events-none absolute right-3 top-12 bottom-10 w-[4px] rounded-full bg-primary/15">
                <span className="absolute left-1/2 -translate-x-1/2 -top-4 text-primary/80 text-xs font-bold leading-none">^</span>
                <span className="absolute left-1/2 -translate-x-1/2 -bottom-4 text-primary/80 text-xs font-bold leading-none">v</span>
                <div
                  className="absolute left-0 right-0 rounded-full bg-primary shadow-[0_0_10px_rgba(255,0,127,0.5)]"
                  style={{ top: thumb.top, height: thumb.height }}
                />
              </div>
            )}
          </div>

          <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-r from-black via-gray-950 to-black px-4 md:px-6 py-4 border-t border-primary/20 shadow-[0_-12px_32px_rgba(0,0,0,0.5)] space-y-3">
            <div className="flex flex-col gap-3 items-center bg-black/70 border border-primary/25 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => setQuantity((prev) => (prev > minQuantity ? prev - 1 : minQuantity))}
                  className="w-11 h-11 flex items-center justify-center text-black bg-primary hover:bg-pink-400 border border-primary/60 rounded-lg transition-colors shadow-md"
                >
                  <FaMinus size={14} />
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={quantity}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    setQuantity(Number.isNaN(value) ? minQuantity : Math.max(minQuantity, value));
                  }}
                  min={minQuantity}
                  className="w-24 p-2.5 text-center border border-primary/60 rounded-lg shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-400 text-lg font-semibold bg-black text-white"
                />
                <button
                  type="button"
                  onClick={() => setQuantity((prev) => prev + 1)}
                  className="w-11 h-11 flex items-center justify-center text-black bg-primary hover:bg-pink-400 border border-primary/60 rounded-lg transition-colors shadow-md"
                >
                  <FaPlus size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setQuantity((prev) => prev + 10)}
                  className="px-3 h-11 flex items-center justify-center text-black bg-primary hover:bg-pink-400 border border-primary/60 rounded-lg transition-colors font-semibold text-sm shadow-md"
                >
                  +10
                </button>
              </div>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={!canAddToCart}
              className={`w-full px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-semibold shadow-lg transition-colors ${
                canAddToCart
                  ? 'bg-pink-500 text-white hover:bg-pink-400 hover:shadow-[0_12px_32px_rgba(255,0,127,0.4)]'
                  : 'bg-black text-gray-500 border border-primary/30 cursor-not-allowed'
              }`}
            >
              <FaShoppingCart size={16} />
              {`Adicionar ${formatPrice(subtotal)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductSelector;
