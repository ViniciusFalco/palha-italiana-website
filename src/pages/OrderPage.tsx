import { useState, useEffect, useMemo, useRef } from 'react';
import Footer from '../components/Footer';
import Checkout from '../components/Checkout';
import ProductSelector from '../components/ProductSelector';
import { FaShoppingCart, FaPlus, FaArrowLeft, FaUserShield } from 'react-icons/fa';
import type { CartItem, FormData, ProductOption } from '../types';
import type { Category } from '../types/product';
import { supabase } from '../lib/supabase';
import { createPublicUuid, insertPublicRows } from '../lib/supabasePublic';
import { fetchCatalog, type UIProduct } from '../lib/catalog';
<link href="https://fonts.googleapis.com/css2?family=DM+Sans&display=swap" rel="stylesheet"></link>

const CART_STORAGE_KEY = 'order_page_cart_v1';

const loadPersistedCartItems = (): CartItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof item.name === 'string' &&
        typeof item.price === 'number' &&
        typeof item.quantity === 'number'
    ) as CartItem[];
  } catch {
    return [];
  }
};

const OrderPage = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>(() => loadPersistedCartItems());
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [overrideMap, setOverrideMap] = useState<Map<string, number>>(new Map());
  const [deltaMap, setDeltaMap] = useState<Map<string, number>>(new Map());
  const [remoteItems, setRemoteItems] = useState<UIProduct[] | null>(null);
  const bottomBarVisible = activeCategory !== null || cartItems.length > 0;
  const showFooter = activeCategory !== null;
  const popStateRef = useRef(false);
  const lastSelectedProductRef = useRef<ProductOption | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [checkoutPreserveState, setCheckoutPreserveState] = useState(false);
  const [productClosing, setProductClosing] = useState(false);
  const productCloseTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    try {
      if (cartItems.length === 0) {
        window.localStorage.removeItem(CART_STORAGE_KEY);
        return;
      }
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch {}
  }, [cartItems]);

  // Inicializa estado do histórico para controlar "voltar"
  useEffect(() => {
    const state = window.history.state ?? {};
    if (state.orderCategoryId === undefined || state.orderOverlay === undefined) {
      window.history.replaceState(
        {
          ...state,
          orderCategoryId: state.orderCategoryId ?? null,
          orderOverlay: state.orderOverlay ?? null,
        },
        ''
      );
    }
  }, []);

  // Carrega categorias ativas
  useEffect(() => {
    let ignore = false;
    const loadCategories = async () => {
      setCategoriesLoading(true);
      setCategoriesError(null);
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('id, slug, name, description, image_url, sort_order, is_active')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true });

        if (ignore) return;
        if (error) {
          setCategoriesError('Não foi possível carregar as categorias agora.');
          setCategories([]);
        } else {
          setCategories((data ?? []) as Category[]);
        }
      } catch {
        if (!ignore) {
          setCategoriesError('Não foi possível carregar as categorias agora.');
          setCategories([]);
        }
      } finally {
        if (!ignore) {
          setCategoriesLoading(false);
        }
      }
    };

    loadCategories();

    return () => {
      ignore = true;
    };
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
      categorySlug: 'packaging',
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
      categorySlug: 'packaging',
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
      categorySlug: 'packaging',
      requiresFlavor: true,
      minQuantity: 20,
    },
    {
      name: 'Caixa Milk com Tema',
      description: 'Caixa milk com tema à escolha',
      basePrice: 16.90,
      image: '/images/embalagem-milkcomtema.jpg',
      categorySlug: 'packaging',
      requiresFlavor: true,
      requiresRibbonWidth: true,
      requiresRibbonColor: true,
    },
    {
      name: 'Palhas Juta e Fita',
      description: 'Palhas juta e fita - Tamanho 5x5',
      basePrice: 5.50,
      image: '/images/embalagem-jutaefita.jpg',
      categorySlug: 'packaging',
      requiresFlavor: true,
      requiresRibbonWidth: true,
      requiresRibbonColor: true,
    },
    {
      name: 'Palhas picadinhas (Kg)',
      description: 'Palhas picadinhas por Kg - 1Kg R$ 69,90 | 1/2 Kg R$ 40,00',
      basePrice: 69.90,
      image: '/images/embalagem-colherpote100ml.jpg',
      categorySlug: 'packaging',
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
      categorySlug: 'party',
      requiresFlavor: true,
      requiresFormColor: true,
      minQuantity: 100,
    },
    {
      name: 'Docinho de Palha Italiana - Embaladas com Fita',
      description: 'Docinho de palha italiana embaladas com fita - R$ 1,50 cada',
      basePrice: 1.50,
      image: '/images/docesdefestas-fita.jpg',
      categorySlug: 'party',
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
      categorySlug: 'cake',
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
      categorySlug: 'cake',
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
          id: item.id,
          sku: item.sku,
          name: item.name,
          description: item.description ?? '',
          image: item.image,
          categoryId: item.categoryId ?? null,
          categorySlug: item.categorySlug ?? null,
          categoryName: item.categoryName ?? null,
          basePrice: item.basePrice,
          minQuantity: item.minQuantity,
          requiresFlavor: item.requiresFlavor,
          requiresCoverage: item.requiresCoverage,
          requiresSize: item.requiresSize,
          requiresRibbonWidth: item.requiresRibbonWidth,
          requiresRibbonColor: item.requiresRibbonColor,
          requiresFormColor: item.requiresFormColor,
          sizeOptions,
          priceTiers: item.priceTiers,
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
    const editingIndexSnapshot = editingIndex;
    setCartItems(prev => {
      if (editingIndexSnapshot !== null && prev[editingIndexSnapshot]) {
        const next = [...prev];
        next[editingIndexSnapshot] = { ...item };
        return next;
      }

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
    if (editingIndexSnapshot !== null) {
      setEditingIndex(null);
    }
  };

  const handleCompleteOrder = async (formData: FormData, total: number) => {
    const addressLine =
      (formData.address && formData.address.trim()) ||
      [
        [formData.street, formData.houseNumber].filter(Boolean).join(', '),
        formData.noComplement ? '' : formData.addressComplement,
        formData.neighborhood,
        [formData.city, formData.state].filter(Boolean).join(' - '),
        formData.cep ? `CEP ${formData.cep}` : '',
      ]
        .filter(Boolean)
        .join(' • ');

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
    const noteWithCheckoutDetails = [
      orderNote,
      addressLine ? `Endereço: ${addressLine}` : null,
      `Pagamento: ${paymentLabel}`,
    ]
      .filter(Boolean)
      .join('\n');
    const orderId = createPublicUuid();

    const baseOrderPayload = {
      id: orderId,
      customer_name: formData.name,
      customer_phone: formData.phone,
      customer_email: customerEmail || null,
      event_date: eventDate || null,
      note: noteWithCheckoutDetails || null,
      status: 'pending',
      total_cents: totalCents,
      payment_method: formData.paymentMethod,
      payment_status: 'pending',
      payment_due: true,
    };

    const addressOrderPayload = {
      ...baseOrderPayload,
      customer_address: addressLine || null,
      address_street: formData.street?.trim() || null,
      address_number: formData.houseNumber?.trim() || null,
      address_complement:
        formData.noComplement || !formData.addressComplement?.trim() ? null : formData.addressComplement.trim(),
      address_neighborhood: formData.neighborhood?.trim() || null,
      address_city: formData.city?.trim() || null,
      address_state: formData.state?.trim() || null,
      address_cep: formData.cep?.trim() || null,
      address_latitude: typeof formData.addressLatitude === 'number' ? formData.addressLatitude : null,
      address_longitude: typeof formData.addressLongitude === 'number' ? formData.addressLongitude : null,
      address_source: formData.addressSource || null,
    };

    let { error: orderError } = await insertPublicRows<null>('orders', addressOrderPayload);

    if (orderError?.code === 'PGRST204' || orderError?.code === '42703') {
      const retry = await insertPublicRows<null>('orders', baseOrderPayload);
      orderError = retry.error;
    }

    if (orderError) {
      if (import.meta.env.DEV && orderError) {
        console.error('Erro ao criar pedido', {
          message: orderError.message,
          details: (orderError as any)?.details,
          hint: (orderError as any)?.hint,
          code: (orderError as any)?.code,
        });
      }
      throw orderError;
    }

    if (cartItems.length > 0) {
      const itemIds = cartItems.map(() => createPublicUuid());
      const itemsPayload = cartItems.map((item, index) => {
        const unitPriceCents = item.unit_price_cents ?? Math.round(item.price * 100);
        const subtotalCents = Math.round(unitPriceCents * item.quantity);
        return {
          id: itemIds[index],
          order_id: orderId,
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

      const { error: itemsError } = await insertPublicRows<null>('order_items', itemsPayload);

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
        const insertedItemId = itemIds[index];
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
        const { error: detailsError } = await insertPublicRows<null>('order_item_details', detailRows);

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
  const hasCart = cartItems.length > 0;
  const bottomPadClass = bottomBarVisible ? 'pb-40 md:pb-44' : 'pb-12';
  const footerPaddingClass = bottomBarVisible ? 'pb-40 md:pb-44' : '';
  const overlayType = selectedProduct ? 'product' : isCheckoutOpen ? 'checkout' : null;

  const getProductsByCategory = (category: Category) =>
    products.filter((product) => {
      if (category.id && product.categoryId) return product.categoryId === category.id;
      if (category.slug && product.categorySlug) return product.categorySlug === category.slug;
      return false;
    });

  const categoryProductCounts = useMemo(() => {
    const counts = new Map<string, number>();
    categories.forEach((category) => {
      counts.set(category.id, getProductsByCategory(category).length);
    });
    return counts;
  }, [categories, products]);

  // Sincroniza navegação do navegador (botão voltar) com a categoria selecionada
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      popStateRef.current = true;
      window.setTimeout(() => {
        popStateRef.current = false;
      }, 0);

      const nextId = (event.state as any)?.orderCategoryId ?? null;
      const nextOverlay = (event.state as any)?.orderOverlay ?? null;

      if (!nextOverlay) {
        setProductClosing(false);
        setEditingIndex(null);
        setSelectedProduct(null);
        setIsCheckoutOpen(false);
      } else if (nextOverlay === 'checkout') {
        setProductClosing(false);
        setEditingIndex(null);
        setSelectedProduct(null);
        setIsCheckoutOpen(true);
      } else if (nextOverlay === 'product') {
        setIsCheckoutOpen(false);
        setSelectedProduct(lastSelectedProductRef.current ?? null);
      }

      if (!nextId) {
        setActiveCategory(null);
        return;
      }
      const match = categories.find((category) => category.id === nextId) ?? null;
      setActiveCategory(match);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [categories]);

  useEffect(() => {
    if (popStateRef.current) return;
    const state = window.history.state ?? {};
    const currentId = state.orderCategoryId ?? null;
    if (activeCategory?.id && currentId !== activeCategory.id) {
      window.history.pushState({ ...state, orderCategoryId: activeCategory.id }, '');
    } else if (!activeCategory && currentId) {
      window.history.pushState({ ...state, orderCategoryId: null }, '');
    }
  }, [activeCategory]);

  useEffect(() => {
    if (popStateRef.current) return;
    if (!overlayType) return;
    const state = window.history.state ?? {};
    if (state.orderOverlay !== overlayType) {
      window.history.pushState({ ...state, orderOverlay: overlayType }, '');
    }
  }, [overlayType]);

  useEffect(() => {
    const stateId = (window.history.state as any)?.orderCategoryId;
    if (!stateId || activeCategory) return;
    const match = categories.find((category) => category.id === stateId) ?? null;
    if (match) {
      setActiveCategory(match);
    }
  }, [activeCategory, categories]);

  useEffect(() => {
    if (selectedProduct) {
      lastSelectedProductRef.current = selectedProduct;
    }
  }, [selectedProduct]);

  const handleEditCartItem = (index: number) => {
    const item = cartItems[index];
    if (!item) return;
    const byId = item.product_id
      ? products.find((product) => product.id === item.product_id)
      : undefined;
    const product =
      byId ?? products.find((product) => product.name === item.name) ?? null;

    if (!product) return;
    setEditingIndex(index);
    setCheckoutPreserveState(true);
    setIsCheckoutOpen(false);
    handleOpenProduct(product);
  };

  const handleOpenProduct = (product: ProductOption) => {
    lastSelectedProductRef.current = product;
    if (productCloseTimerRef.current) {
      window.clearTimeout(productCloseTimerRef.current);
      productCloseTimerRef.current = null;
    }
    setProductClosing(false);
    setSelectedProduct(product);
  };

  const handleCloseProduct = () => {
    if (productCloseTimerRef.current) {
      window.clearTimeout(productCloseTimerRef.current);
      productCloseTimerRef.current = null;
    }
    setProductClosing(true);
    if (editingIndex !== null) {
      setEditingIndex(null);
    }
    const state = window.history.state ?? {};
    productCloseTimerRef.current = window.setTimeout(() => {
      if (state.orderOverlay) {
        window.history.back();
        return;
      }
      setProductClosing(false);
      setSelectedProduct(null);
      productCloseTimerRef.current = null;
    }, 220);
  };

  const handleOpenCheckout = () => {
    setCheckoutPreserveState(false);
    setIsCheckoutOpen(true);
  };

  const handleCloseCheckout = () => {
    setCheckoutPreserveState(false);
    const state = window.history.state ?? {};
    if (state.orderOverlay) {
      window.history.back();
      return;
    }
    setIsCheckoutOpen(false);
  };

  const handleBackToCategories = () => {
    if (!activeCategory) return;
    const state = window.history.state ?? {};
    if (state.orderCategoryId) {
      window.history.back();
      return;
    }
    setActiveCategory(null);
  };

  const formatPrice = (price: number) => `R$ ${price.toFixed(2).replace('.', ',')}`;
  const activeProducts = activeCategory ? getProductsByCategory(activeCategory) : [];

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col overflow-x-hidden">
      {showSuccessMessage && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg">
          Pedido enviado com sucesso! Aguarde nosso contato.
        </div>
      )}

      <header className="fixed top-0 left-0 right-0 z-40">
        <div className="bg-black/70 backdrop-blur-xl border-b border-white/10">
          <div className="container mx-auto px-4 py-3">
            <div
              key={activeCategory ? activeCategory.id : 'categories'}
              className="relative w-full flex items-center justify-center gap-3 fade-in"
            >
              <img
                src="/logo.svg"
                alt="Sweet Child"
                className="h-11 w-auto object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/logo.png';
                }}
              />
              {activeCategory && (
                <span className="text-sm md:text-base font-semibold text-white uppercase tracking-[0.18em] text-center">
                  {activeCategory.name}
                </span>
              )}
              <a
                href="/admin"
                className="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/35 transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                aria-label="Acessar painel admin"
                title="Admin"
              >
                <FaUserShield size={14} />
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col pt-20 md:pt-24">
        <div className="container mx-auto flex w-full flex-1 flex-col">
          <h1 className="sr-only">FAÇA SUA ENCOMENDA</h1>

          <div className="mt-3 mb-5 px-4 md:mt-8 md:mb-8">
            {activeCategory ? (
              <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 text-center">
                <span className="rounded-full border border-primary/30 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                  Categoria selecionada
                </span>
                <h2 className="font-bebas text-4xl leading-none tracking-wide text-white md:text-6xl">
                  {activeCategory.name}
                </h2>
                {activeCategory.description?.trim() ? (
                  <p className="max-w-2xl text-sm leading-relaxed text-white/70 md:text-base">
                    {activeCategory.description}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 text-center">
                <span className="rounded-full border border-primary/35 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                  Encomendas
                </span>
                <h2 className="font-bebas text-5xl leading-none tracking-wide text-white md:text-7xl">
                  Escolha uma categoria
                </h2>
               
              </div>
            )}
          </div>

          {!activeCategory && (
            <section className={`flex-1 flex flex-col ${bottomPadClass} fade-in`}>
              {categoriesLoading && (
                <div className="flex-1 flex items-center justify-center text-white/70 text-sm md:text-base">
                  Carregando categorias...
                </div>
              )}

              {!categoriesLoading && (categoriesError || categories.length === 0) && (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-white/70 gap-2">
                  <p className="text-base md:text-lg font-semibold text-white">Nenhuma categoria disponível</p>
                  <p className="text-sm md:text-base max-w-md">
                    {categoriesError ?? 'Em breve teremos novidades por aqui.'}
                  </p>
                </div>
              )}

              {!categoriesLoading && !categoriesError && categories.length > 0 && (
                <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3 lg:px-0">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => {
                        setActiveCategory(category);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="group flex min-h-[260px] flex-col overflow-hidden rounded-lg border border-stone-200 bg-[#fbfaf9] text-left shadow-[0_18px_55px_rgba(0,0,0,0.28)] transition duration-200 hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_22px_70px_rgba(255,0,127,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    >
                      <div className="relative h-36 w-full overflow-hidden bg-stone-100 md:h-44">
                        {category.image_url ? (
                          <img src={category.image_url} alt={category.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/12 via-white to-stone-100">
                            <img
                              src="/logo.svg"
                              alt=""
                              className="h-16 w-auto opacity-70"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = '/logo.png';
                              }}
                            />
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent" />
                      </div>
                      <div className="flex flex-1 flex-col gap-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-lg font-extrabold leading-tight text-stone-950 md:text-xl">
                            {category.name}
                          </h3>
                          <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                            {categoryProductCounts.get(category.id) ?? 0}
                          </span>
                        </div>
                        {category.description?.trim() ? (
                          <p
                            className="text-sm leading-relaxed text-stone-600"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {category.description}
                          </p>
                        ) : null}
                        <span className="mt-auto inline-flex items-center justify-between border-t border-stone-200 pt-3 text-sm font-bold text-primary">
                          Ver produtos
                          <FaPlus size={12} className="transition group-hover:rotate-90" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeCategory && (
            <section className={`flex-1 flex flex-col ${bottomPadClass} fade-in`}>
              {activeProducts.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-white/70 gap-2">
                  <p className="text-base md:text-lg font-semibold text-white">Nenhum produto nesta categoria</p>
                  <p className="text-sm md:text-base max-w-md">
                    Em breve teremos novidades por aqui. Escolha outra categoria.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:gap-6">
                  {activeProducts.map((product, index) => {
                    const hasSizes = product.requiresSize || (product.sizeOptions?.length ?? 0) > 0;
                    const lowestTierPrice = product.priceTiers?.length
                      ? Math.min(...product.priceTiers.map((tier) => tier.price))
                      : null;
                    const isParty = product.categorySlug === 'party';
                    const displayBasePrice =
                      lowestTierPrice !== null ? Math.min(product.basePrice, lowestTierPrice) : product.basePrice;
                    const priceLabel = product.priceTiers?.length
                      ? `A partir de ${formatPrice(displayBasePrice)}`
                      : isParty
                      ? `${formatPrice(product.basePrice)} cada`
                      : hasSizes
                        ? `A partir de ${formatPrice(product.basePrice)}`
                        : formatPrice(product.basePrice);
                    return (
                      <div
                        key={index}
                        className="w-full max-w-5xl mx-auto rounded-2xl border-2 border-primary/40 bg-gradient-to-r from-primary/10 via-gray-900 to-gray-950 shadow-2xl overflow-hidden transition-transform hover:-translate-y-1"
                      >
                        <div className="flex flex-col md:flex-row gap-4 md:gap-6 p-5 md:p-8">
                          <div className="w-full md:w-72 h-40 md:h-48 overflow-hidden rounded-xl bg-gray-800">
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
                            <div className="flex flex-col gap-3">
                              <h3 className="text-primary font-bebas text-2xl md:text-3xl text-center uppercase tracking-[0.18em]">
                                {product.name}
                              </h3>
                              <p className="text-gray-200 text-sm md:text-base leading-relaxed text-left">
                                {product.description}
                              </p>
                            </div>

                            <div className="flex items-center justify-between gap-3 pt-1">
                              <button
                                onClick={() => handleOpenProduct(product)}
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
              )}
            </section>
          )}
        </div>
      </main>

      {bottomBarVisible && (
        <div className="fixed bottom-0 left-0 right-0 z-50 pb-4 md:pb-6">
          <div className="container mx-auto px-4">
            <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.45)] p-2 md:p-3 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!activeCategory) return;
                  handleBackToCategories();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={!activeCategory}
                className={`flex-1 flex items-center gap-3 rounded-xl border border-white/20 bg-black/40 px-4 py-3 text-left text-white transition ${
                  activeCategory ? 'hover:bg-white/10' : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <FaArrowLeft size={18} />
                <span className="flex flex-col leading-tight">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-white/70">Voltar p/</span>
                  <span className="text-sm md:text-base font-semibold">Categorias</span>
                </span>
              </button>

              <button
                type="button"
                onClick={handleOpenCheckout}
                disabled={!hasCart}
                className={`flex-1 flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/20 px-4 py-3 text-left text-white transition ${
                  hasCart ? 'hover:bg-primary/30' : 'opacity-60 cursor-not-allowed'
                }`}
              >
                <FaShoppingCart size={18} className={hasCart ? '' : 'opacity-40'} />
                <span className="flex-1 flex flex-col leading-tight">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-white/70">Carrinho</span>
                  <span className={`text-sm md:text-base font-semibold ${hasCart ? 'text-white' : 'text-white/50'}`}>
                    {hasCart ? cartTotalLabel : '—'}
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedProduct && (
        <ProductSelector
          product={selectedProduct}
          onAddToCart={addToCart}
          onClose={handleCloseProduct}
          initialItem={editingIndex !== null ? cartItems[editingIndex] : undefined}
          isClosing={productClosing}
        />
      )}

      <Checkout
        isOpen={isCheckoutOpen}
        onClose={handleCloseCheckout}
        cartItems={cartItems}
        onCompleteOrder={handleCompleteOrder}
        removeCartItem={(index) => setCartItems(prev => prev.filter((_, i) => i !== index))}
        updateItemQuantity={updateItemQuantity}
        clearCart={() => setCartItems([])}
        onEditCartItem={handleEditCartItem}
        preserveStateOnClose={checkoutPreserveState}
      />

      {showFooter && <Footer className={footerPaddingClass} />}
    </div>
  );
};

export default OrderPage;
