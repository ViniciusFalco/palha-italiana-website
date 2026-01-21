import { useState, useEffect, useMemo } from 'react';
import Footer from '../components/Footer';
import Checkout from '../components/Checkout';
import ProductSelector from '../components/ProductSelector';
import { FaShoppingCart, FaPlus, FaArrowLeft } from 'react-icons/fa';
import type { CartItem, FormData, ProductOption } from '../types';
import { supabase } from '../lib/supabase';
import { fetchCatalog, type UIProduct } from '../lib/catalog';

type CategoryKey = 'packaging' | 'party' | 'cake';

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  packaging: 'Embalagens',
  party: 'Docinhos',
  cake: 'Tortas',
};
const BACKGROUND_ROTATION_MS = 7800;
const BACKGROUND_FADE_MS = 2000;

const OrderPage = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryKey | null>(null);
  const [bgIndexes, setBgIndexes] = useState<Record<CategoryKey, number>>({
    packaging: 0,
    party: 0,
    cake: 0,
  });
  const [overrideMap, setOverrideMap] = useState<Map<string, number>>(new Map());
  const [deltaMap, setDeltaMap] = useState<Map<string, number>>(new Map());
  const [remoteItems, setRemoteItems] = useState<UIProduct[] | null>(null);
  const showFooter = activeCategory !== null;

  // Checagem de pedidos pendentes
  useEffect(() => {
    const orderStatus = localStorage.getItem('order_status');
    if (orderStatus === 'pending') {
      setShowSuccessMessage(true);
      localStorage.removeItem('order_status');
      setTimeout(() => setShowSuccessMessage(false), 5000);
    }
  }, []);

  // Scroll para o topo ao carregar
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const updateItemQuantity = (index: number, newQuantity: number) => {
    setCartItems(prevItems => {
      const newItems = [...prevItems];
      newItems[index] = { ...newItems[index], quantity: newQuantity };
      return newItems;
    });
  };

  const HARDCODED: ProductOption[] = [
    // EMBALAGENS
    {
      name: 'Embalagem com Fita 5x5',
      description: 'Embalagem com fita - Tamanho 5x5',
      basePrice: 4.50,
      image: '/images/embalagem-fita.jpg',
      category: 'packaging',
      requiresFlavor: true,
      requiresRibbonWidth: true,
      requiresRibbonColor: true,
      minQuantity: 20,
    },
    {
      name: 'Palha Bem casado',
      description: 'Palha bem casado - Tamanho 5x5',
      basePrice: 5.50,
      image: '/images/bem_casado.jpg',
      category: 'packaging',
      requiresFlavor: true,
      minQuantity: 40,
      quickQuantities: [40, 60, 80, 100, 120, 150],
      priceTiers: [{ minQuantity: 100, price: 5.00 }],
    },
    {
      name: 'Embalagem com Adesivos',
      description: 'Embalagem com adesivos - Tamanho 5x5',
      basePrice: 4.50,
      image: '/images/embalagem-adesivos.jpg',
      category: 'packaging',
      requiresFlavor: true,
      minQuantity: 20,
    },
    {
      name: 'Caixa Milk com Tema',
      description: 'Caixa milk com tema à escolha',
      basePrice: 16.90,
      image: '/images/embalagem-milkcomtema.jpg',
      category: 'packaging',
      requiresFlavor: true,
      requiresRibbonWidth: true,
      requiresRibbonColor: true,
    },
    {
      name: 'Palhas Juta e Fita',
      description: 'Palhas juta e fita - Tamanho 5x5',
      basePrice: 5.50,
      image: '/images/embalagem-jutaefita.jpg',
      category: 'packaging',
      requiresFlavor: true,
      requiresRibbonWidth: true,
      requiresRibbonColor: true,
    },
    {
      name: 'Palhas picadinhas (Kg)',
      description: 'Palhas picadinhas por Kg - 1Kg R$ 69,90 | 1/2 Kg R$ 40,00',
      basePrice: 69.90,
      image: '/images/embalagem-colherpote100ml.jpg',
      category: 'packaging',
      requiresFlavor: true,
      requiresSize: true,
      sizeOptions: [
        { size: '1/2 Kg', price: 40.00 },
        { size: '1 Kg', price: 69.90 },
        { size: '2 Kg', price: 139.80 },
        { size: '3 Kg', price: 209.70 },
        { size: '4 Kg', price: 279.60 },
        { size: '5 Kg', price: 349.50 },
      ],
    },
    
    // DOCES DE FESTAS
    {
      name: 'Docinho de Palha Italiana - Na Forminha',
      description: 'Docinho de palha italiana na forminha - R$ 1,50 cada',
      basePrice: 1.50,
      image: '/images/docesdefestas-forminha.jpg',
      category: 'party',
      requiresFlavor: true,
      requiresFormColor: true,
      minQuantity: 100,
    },
    {
      name: 'Docinho de Palha Italiana - Embaladas com Fita',
      description: 'Docinho de palha italiana embaladas com fita - R$ 1,50 cada',
      basePrice: 1.50,
      image: '/images/docesdefestas-fita.jpg',
      category: 'party',
      requiresFlavor: true,
      requiresRibbonWidth: true,
      requiresRibbonColor: true,
      minQuantity: 100,
    },
    
    // TORTAS
    {
      name: 'Torta Rústica',
      description: 'Torta rústica com cobertura simples',
      basePrice: 69.90,
      image: '/images/tortas-rustica.jpg',
      category: 'cake',
      requiresFlavor: true,
      requiresSize: true,
      sizeOptions: [
        { size: '1Kg', price: 69.90 },
        { size: '2Kg', price: 89.90 },
      ],
    },
    {
      name: 'Torta Personalizada',
      description: 'Torta personalizada com cobertura à escolha',
      basePrice: 79.90,
      image: '/images/tortas-personalizada.jpg',
      category: 'cake',
      requiresFlavor: true,
      requiresCoverage: true,
      requiresSize: true,
      sizeOptions: [
        { size: '1Kg', price: 79.90 },
        { size: '2Kg', price: 99.90 },
      ],
    }
  ];

  // ---------- carregamento de overrides do Supabase ----------
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const { data: prices, error: e1 } = await supabase
          .from('price_overrides')
          .select('sku, price_cents');
        if (e1) throw e1;

        const { data: deltas, error: e2 } = await supabase
          .from('option_price_overrides')
          .select('option_id, price_delta_cents');
        if (e2) throw e2;

        if (ignore) return;
        setOverrideMap(new Map((prices ?? []).map((p: any) => [p.sku as string, (p.price_cents as number) / 100])));
        setDeltaMap(new Map((deltas ?? []).map((d: any) => [d.option_id as string, (d.price_delta_cents as number) / 100])));
      } catch (_e) {
        // silencia erros para não alterar UX; fallback usa preços base
      }
      return () => {
        ignore = true;
      };
    })();
  }, []);

  // ---------- fetch de catálogo da VIEW com fallback ----------
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const data = await fetchCatalog();
        if (!ignore && data && data.length > 0) {
          setRemoteItems(data);
        }
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Falha ao carregar catálogo remoto, usando fallback:', e);
        }
        // fallback automático: mantém remoteItems como null
      } finally {
      }
    })();

    // (Opcional) Realtime para refetch automático
    const channel = supabase.channel('catalog-updates');
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products' },
      () => {
        fetchCatalog().then((data) => {
          if (data && data.length > 0) setRemoteItems(data);
        }).catch(() => {});
      }
    ).on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'product_options' },
      () => {
        fetchCatalog().then((data) => {
          if (data && data.length > 0) setRemoteItems(data);
        }).catch(() => {});
      }
    ).on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'price_overrides' },
      () => {
        fetchCatalog().then((data) => {
          if (data && data.length > 0) setRemoteItems(data);
        }).catch(() => {});
      }
    ).subscribe();

    return () => {
      ignore = true;
      try { supabase.removeChannel(channel); } catch {}
    };
  }, []);

  // ---------- utilitários para chaves estáveis ----------
  const toSlug = (value: string) =>
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  const deriveSku = (product: ProductOption) => product.sku ?? toSlug(product.name);
  const deriveOptionId = (product: ProductOption, sizeLabel: string) => `${deriveSku(product)}:${toSlug(sizeLabel)}`;

  // ---------- aplica catálogo remoto (se disponível) + overrides (fallback) mantendo a mesma UI ----------
  const products: ProductOption[] = useMemo(() => {
    if (remoteItems && remoteItems.length > 0) {
      // Converter UIProduct -> ProductOption que a UI já entende
      return remoteItems.map((item) => {
        const sizeOptions = item.sizeOptions?.map((opt) => ({
          id: opt.id,
          size: opt.size,
          price: opt.price,
        }));
        return {
          sku: item.sku,
          name: item.name,
          description: item.description,
          image: item.image,
          category: item.category,
          basePrice: item.basePrice,
          minQuantity: item.minQuantity,
          requiresFlavor: item.requiresFlavor,
          requiresCoverage: item.requiresCoverage,
          requiresSize: item.requiresSize,
          requiresRibbonWidth: item.requiresRibbonWidth,
          requiresRibbonColor: item.requiresRibbonColor,
          requiresFormColor: item.requiresFormColor,
          sizeOptions,
        } as ProductOption;
      });
    }

    // fallback: HARDCODED + overrides de mapa (como já estava)
    return HARDCODED.map((p) => {
      const sku = deriveSku(p);
      const basePrice = overrideMap.get(sku) ?? p.basePrice;
      const sizeOptions = p.sizeOptions?.map((opt) => {
        const optionId = opt.id ?? deriveOptionId(p, opt.size);
        const delta = deltaMap.get(optionId) ?? 0;
        return { ...opt, id: opt.id ?? optionId, price: opt.price + delta };
      });
      return { ...p, sku, basePrice, sizeOptions };
    });
  }, [HARDCODED, overrideMap, deltaMap, remoteItems]);

  const addToCart = (item: CartItem) => {
    setCartItems(prev => {
      const existingItem = prev.find(cartItem => 
        cartItem.name === item.name && 
        cartItem.flavor === item.flavor && 
        cartItem.coverage === item.coverage &&
        cartItem.size === item.size &&
        cartItem.ribbonWidth === item.ribbonWidth &&
        cartItem.ribbonColor === item.ribbonColor &&
        cartItem.formColor === item.formColor
      );
      
      if (existingItem) {
        return prev.map(cartItem =>
          cartItem === existingItem
            ? { ...cartItem, quantity: cartItem.quantity + item.quantity }
            : cartItem
        );
      }
      return [...prev, item];
    });
  };

  const handleCompleteOrder = async (formData: FormData, total: number) => {
    const addressLine =
      (formData.address && formData.address.trim()) ||
      [formData.street, formData.houseNumber, formData.noComplement ? '' : formData.addressComplement]
        .filter(Boolean)
        .join(', ');
    const paymentLabel =
      formData.paymentMethod === 'credit'
        ? 'Cartão de Crédito'
        : formData.paymentMethod === 'debit'
          ? 'Cartão de Débito'
          : 'Pix';

    const orderItemsText = cartItems
      .map((item) => {
        let itemText = `${item.name} x${item.quantity}`;
        if (item.flavor) itemText += ` - Sabor: ${item.flavor}`;
        if (item.coverage) itemText += ` - Cobertura: ${item.coverage}`;
        if (item.size) itemText += ` - Tamanho: ${item.size}`;
        if (item.ribbonWidth) itemText += ` - Largura da fita: ${item.ribbonWidth}`;
        if (item.ribbonColor) itemText += ` - Cor da fita: ${item.ribbonColor}`;
        if (item.formColor) itemText += ` - Cor da forminha: ${item.formColor}`;
        if (item.notes) itemText += ` - Observação: ${item.notes}`;
        if (item.details?.length) {
          const extras = item.details.map((d) => `${d.label}: ${d.displayValue ?? d.value}`).join('; ');
          itemText += ` - Extras: ${extras}`;
        }
        itemText += ` - R$ ${(item.price * item.quantity).toFixed(2)}`;
        return itemText;
      })
      .join('\n');

    const totalCents = Math.round(total * 100);
    const customerEmail = (formData as any).email ?? null;
    const eventDate = (formData as any).eventDate ?? (formData as any).event_date ?? null;
    const orderNote = (formData as any).note ?? (formData as any).observation ?? null;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_name: formData.name,
        customer_phone: formData.phone,
        customer_email: customerEmail || null,
        event_date: eventDate || null,
        note: orderNote || null,
        status: 'pending',
        total_cents: totalCents,
      })
      .select('id')
      .single();

    if (orderError || !order) {
      if (import.meta.env.DEV && orderError) {
        console.error('Erro ao criar pedido', {
          message: orderError.message,
          details: (orderError as any)?.details,
          hint: (orderError as any)?.hint,
          code: (orderError as any)?.code,
        });
      }
      throw (orderError ?? new Error('Não foi possível registrar o pedido.'));
    }

    if (cartItems.length > 0) {
      const itemsPayload = cartItems.map((item) => {
        const unitPriceCents = item.unit_price_cents ?? Math.round(item.price * 100);
        const subtotalCents = Math.round(unitPriceCents * item.quantity);
        return {
          order_id: order.id,
          product_id: item.product_id ?? null,
          product_option_id: (item as any).option_id ?? null,
          quantity: item.quantity,
          unit_price_cents: unitPriceCents,
          subtotal_cents: subtotalCents,
          flavor: item.flavor ?? null,
          coverage: item.coverage ?? null,
          size: item.size ?? null,
          ribbon_width: item.ribbonWidth ?? (item as any).ribbon_width ?? null,
          ribbon_color: item.ribbonColor ?? (item as any).ribbon_color ?? null,
          form_color: item.formColor ?? (item as any).form_color ?? null,
        };
      });

      const { data: insertedItems, error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsPayload)
        .select('id, order_id, product_id, product_option_id');

      if (itemsError) {
        if (import.meta.env.DEV) {
          console.error('Erro ao inserir order_items', {
            message: itemsError.message,
            details: (itemsError as any)?.details,
            hint: (itemsError as any)?.hint,
            code: (itemsError as any)?.code,
          });
        }
        throw new Error('Não foi possível salvar os itens do pedido.');
      }

      const detailRows: Array<{
        order_item_id: string;
        field_id: string;
        value: string;
      }> = [];

      for (let index = 0; index < cartItems.length; index += 1) {
        const item = cartItems[index];
        const insertedItemId = (insertedItems ?? [])[index]?.id;
        if (!insertedItemId || !item.details?.length || !item.product_id) continue;

        const { data: fields } = await supabase
          .from('product_detail_fields')
          .select('id, field_key')
          .eq('product_id', item.product_id);

        const fieldMap = new Map((fields ?? []).map((f: any) => [f.field_key, f.id]));

        item.details.forEach((detail) => {
          const fieldId = fieldMap.get(detail.fieldKey);
          const value = detail.value ?? detail.displayValue;
          if (fieldId && value) {
            detailRows.push({
              order_item_id: insertedItemId,
              field_id: fieldId,
              value: String(value),
            });
          }
        });
      }

      if (detailRows.length > 0) {
        const { error: detailsError } = await supabase.from('order_item_details').insert(detailRows);
        if (detailsError) {
          if (import.meta.env.DEV) {
            console.error('Erro ao inserir order_item_details', {
              message: detailsError.message,
              details: (detailsError as any)?.details,
              hint: (detailsError as any)?.hint,
              code: (detailsError as any)?.code,
            });
          }
          throw new Error('Não foi possível salvar os detalhes do pedido.');
        }
      }
    }

    let message = `*NOVO PEDIDO - PALHA ITALIANA*\n\n*Cliente:* ${formData.name}\n*Telefone:* ${formData.phone}\n*Endereço:* ${
      addressLine || 'Não informado'
    }\n*Pagamento:* ${paymentLabel}\n\n*ITENS DO PEDIDO:*\n${orderItemsText}\n\n*TOTAL:* R$ ${total.toFixed(2)}\n`;
    message += `*Horário do pedido:* ${new Date().toLocaleString('pt-BR')}`;

    localStorage.setItem('order_status', 'pending');
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/5521985767312?text=${encodedMessage}`, '_blank');
    
    setIsCheckoutOpen(false);
    setCartItems([]);
  };

  const cartTotal = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  const cartTotalLabel = `R$ ${cartTotal.toFixed(2).replace('.', ',')}`;

  const getProductsByCategory = (category: CategoryKey) => products.filter(product => product.category === category);

  const categoryBackgrounds = useMemo(() => {
    const map: Record<CategoryKey, string[]> = {
      packaging: [],
      party: [],
      cake: [],
    };

    (['packaging', 'party', 'cake'] as const).forEach((cat) => {
      const uniqueImages = Array.from(
        new Set(
          products
            .filter((p) => p.category === cat && p.image)
            .map((p) => p.image)
        )
      );
      map[cat] = uniqueImages.slice(0, 5);
    });

    return map;
  }, [products]);

  useEffect(() => {
    const interval = setInterval(() => {
      setBgIndexes((prev) => ({
        packaging: categoryBackgrounds.packaging.length > 0
          ? (prev.packaging + 1) % categoryBackgrounds.packaging.length
          : 0,
        party: categoryBackgrounds.party.length > 0
          ? (prev.party + 1) % categoryBackgrounds.party.length
          : 0,
        cake: categoryBackgrounds.cake.length > 0
          ? (prev.cake + 1) % categoryBackgrounds.cake.length
          : 0,
      }));
    }, BACKGROUND_ROTATION_MS);
    // avanço inicial mais rápido para evitar espera longa na primeira exibição
    const kickoff = setTimeout(() => {
      setBgIndexes((prev) => ({
        packaging: categoryBackgrounds.packaging.length > 0
          ? (prev.packaging + 1) % categoryBackgrounds.packaging.length
          : 0,
        party: categoryBackgrounds.party.length > 0
          ? (prev.party + 1) % categoryBackgrounds.party.length
          : 0,
        cake: categoryBackgrounds.cake.length > 0
          ? (prev.cake + 1) % categoryBackgrounds.cake.length
          : 0,
      }));
    }, Math.min(2500, BACKGROUND_ROTATION_MS / 2));
    return () => {
      clearInterval(interval);
      clearTimeout(kickoff);
    };
  }, [categoryBackgrounds]);

  const formatPrice = (price: number) => `R$ ${price.toFixed(2).replace('.', ',')}`;

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      {showSuccessMessage && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg">
          Pedido enviado com sucesso! Aguarde nosso contato.
        </div>
      )}

      <main className="min-h-screen flex-1 flex flex-col overflow-hidden">
        <div className="container mx-auto px-4 h-full flex flex-col">
          <h1 className="sr-only">
            FAÇA SUA ENCOMENDA
          </h1>

          {!activeCategory && (
            <div className="text-center mt-6 mb-2">
              <h2 className="font-bebas text-4xl md:text-5xl text-primary mb-1">
                FAÇA SUA ENCOMENDA
              </h2>
              <p className="text-xs md:text-sm uppercase tracking-[0.3em] text-white/80">
                Toque para explorar
              </p>
            </div>
          )}

          {!activeCategory && (
            <section className="flex-1 flex flex-col h-full overflow-hidden min-h-[calc(100vh-150px)]">
              <div className="grid grid-rows-3 md:grid-rows-1 md:grid-cols-3 gap-3 md:gap-6 flex-1 min-h-0 h-full">
                {(['packaging', 'party', 'cake'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setActiveCategory(cat);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="group relative rounded-[26px] overflow-hidden shadow-2xl border-2 border-primary/50 hover:-translate-y-1 transition-all duration-500 flex items-center justify-center w-full h-full min-h-[26vh] md:min-h-0"
                  >
                    <div className="absolute inset-0">
                      {categoryBackgrounds[cat].length > 0 ? (
                        categoryBackgrounds[cat].map((url, idx) => (
                          <div
                            key={url}
                            className="absolute inset-0"
                            style={{
                              backgroundImage: `url(${url})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              filter: 'saturate(1.05) brightness(1.05)',
                              opacity: bgIndexes[cat] % categoryBackgrounds[cat].length === idx ? 1 : 0,
                              transition: `opacity ${BACKGROUND_FADE_MS}ms ease-in-out`,
                            }}
                          />
                        ))
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900" />
                      )}
                    </div>

                    <div className="relative z-10 w-full h-full flex items-end">
                      <div className="relative rounded-[14px] px-5 py-3 bg-white/12 border border-white/30 backdrop-blur-xl shadow-[0_14px_50px_rgba(0,0,0,0.32)] max-w-[200px] overflow-hidden ml-3 mb-3 md:ml-5 md:mb-5 text-left">
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/30 via-white/8 to-white/0 opacity-55" />
                        <div className="pointer-events-none absolute -left-16 -top-20 h-32 w-32 rounded-full bg-white/18 blur-3xl" />
                        <div className="pointer-events-none absolute -right-14 bottom-[-50px] h-28 w-28 rounded-full bg-primary/25 blur-3xl opacity-60" />
                        <h2 className="relative font-bebas text-2xl md:text-3xl text-white leading-none text-left drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                          {CATEGORY_LABELS[cat]}
                        </h2>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {activeCategory && (
            <section className="flex-1 flex flex-col pb-10 overflow-y-auto">
              <div className="flex flex-col items-center gap-3 mb-6 text-center mt-8 md:mt-10">
                <span className="px-4 py-1 rounded-full bg-primary text-white text-xs uppercase tracking-[0.25em]">
                  Categoria selecionada
                </span>
                <h2 className="font-bebas text-4xl text-primary leading-none">
                  {CATEGORY_LABELS[activeCategory]}
                </h2>
              </div>

              {/* grid de produtos*/}
              <div className="grid grid-cols-1 gap-4 md:gap-6">
                {getProductsByCategory(activeCategory).map((product, index) => {
                  const isCompact = activeCategory === 'packaging';
                  const priceLabel = activeCategory === 'party'
                    ? `${formatPrice(product.basePrice)} cada`
                    : isCompact
                      ? formatPrice(product.basePrice)
                      : `A partir de ${formatPrice(product.basePrice)}`;
                  return (
                    <div
                      key={index}
                      className={`${isCompact ? 'max-w-3xl' : 'max-w-5xl'} w-full mx-auto rounded-2xl border-2 border-primary/50 ${isCompact ? 'bg-gray-900/85' : 'bg-gradient-to-r from-primary/12 via-gray-900 to-gray-900'} shadow-2xl overflow-hidden transition-transform hover:-translate-y-1`}
                    >
                      <div className="flex flex-col md:flex-row gap-4 md:gap-6 p-5 md:p-8">
                        <div className={`${isCompact ? 'w-full md:w-48' : 'w-full md:w-72'} h-40 md:h-48 overflow-hidden rounded-xl bg-gray-800`}>
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        </div>

                        <div className="flex-1 flex flex-col gap-4">
                          <div className="flex flex-col gap-2">
                            <h3 className="text-white font-bold text-xl md:text-2xl leading-tight">
                              {product.name}
                            </h3>
                            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                              <p className="text-gray-200 text-sm md:text-base leading-relaxed">
                                {product.description}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {product.minQuantity && (
                                <span className="text-xs text-primary bg-primary/10 border border-primary/40 px-3 py-1 rounded-full">
                                  Mínimo: {product.minQuantity} unid.
                                </span>
                              )}
                              {product.requiresSize && (
                                <span className="text-xs text-gray-200 bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
                                  Tamanhos disponíveis
                                </span>
                              )}
                              {product.requiresFlavor && (
                                <span className="text-xs text-gray-200 bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
                                  Vários sabores
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 pt-1">
                          <button
                            onClick={() => setSelectedProduct(product)}
                              className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold shadow-lg transition-all px-4 py-3 bg-primary text-white hover:bg-pink-600"
                            >
                              <FaPlus size={14} />
                              <span>Adicionar</span>
                            </button>
                            <span className="text-primary font-extrabold text-lg md:text-xl whitespace-nowrap">
                              {priceLabel}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </main>

      {cartItems.length > 0 && (
        <button
          onClick={() => setIsCheckoutOpen(true)}
          className="fixed bottom-6 right-6 md:bottom-8 md:right-8 w-16 h-16 rounded-full bg-primary text-white shadow-[0_10px_30px_rgba(255,0,127,0.35)] flex items-center justify-center transition-transform hover:scale-105 z-50"
          aria-label="Abrir carrinho"
        >
          <FaShoppingCart size={22} />
          <span className="absolute -top-2 -right-2 min-w-[2.5rem] px-2 h-7 rounded-full bg-white text-primary text-xs font-bold flex items-center justify-center shadow-md leading-none">
            {cartTotalLabel}
          </span>
        </button>
      )}

      {activeCategory && (
        <button
          onClick={() => {
            setActiveCategory(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="fixed bottom-6 left-6 md:bottom-8 md:left-8 w-16 h-16 rounded-full bg-primary text-white shadow-[0_10px_30px_rgba(255,0,127,0.35)] flex items-center justify-center transition-transform hover:scale-105 z-50"
          aria-label="Voltar para as categorias"
        >
          <FaArrowLeft size={20} />
        </button>
      )}

      {selectedProduct && (
        <ProductSelector
          product={selectedProduct}
          onAddToCart={addToCart}
          onClose={() => setSelectedProduct(null)}
        />
      )}

      <Checkout
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cartItems={cartItems}
        onCompleteOrder={handleCompleteOrder}
        removeCartItem={(index) => setCartItems(prev => prev.filter((_, i) => i !== index))}
        updateItemQuantity={updateItemQuantity}
        clearCart={() => setCartItems([])}
      />

      {showFooter && <Footer />}
    </div>
  );
};

export default OrderPage;
