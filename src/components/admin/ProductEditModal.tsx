import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { fetchProductQuantityPrices } from '../../lib/api/products';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/AuthProvider';
import type { ProductCategory } from '../../types/product';

type EditableProduct = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category: ProductCategory;
  base_price_cents: number;
  min_quantity: number | null;
  is_active: boolean;
};

type ProductEditModalProps = {
  productId?: string | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
};

type QuantityPriceRow = {
  id: string;
  product_id: string;
  min_quantity: number;
  max_quantity: number | null;
  unit_price_cents: number;
  currency: string | null;
  unitPriceInput: string;
};

type ProductDetailOption = {
  id?: string;
  field_id?: string;
  label: string;
  value: string;
  extra_price_delta_cents: number;
  sort_order: number;
  clientId?: string;
};

type ProductDetailField = {
  id?: string;
  product_id?: string;
  field_key: string;
  label: string;
  input_type: 'text' | 'textarea' | 'select';
  help_text: string | null;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
  options: ProductDetailOption[];
  clientId?: string;
};

const CATEGORY_OPTIONS: { value: ProductCategory; label: string }[] = [
  { value: 'packaging', label: 'Embalagens' },
  { value: 'party', label: 'Docinhos' },
  { value: 'cake', label: 'Tortas' },
];

const DETAIL_INPUT_TYPES: Array<{ value: ProductDetailField['input_type']; label: string }> = [
  { value: 'select', label: 'Escolha única' },
  { value: 'text', label: 'Texto curto' },
  { value: 'textarea', label: 'Texto longo' },
];

const STEP_ITEMS = [
  { key: 'basic', label: 'Básico', helper: 'Nome, imagem e preço' },
  { key: 'pricing', label: 'Preço e quantidade', helper: 'Descontos por volume' },
  { key: 'custom', label: 'Personalizações', helper: 'Perguntas do cliente' },
];

const IMAGE_BUCKET = import.meta.env.VITE_IMAGE_BUCKET?.trim() || 'product-images';
const createTempId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
const createUuid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex
    .slice(8, 10)
    .join('')}-${hex.slice(10, 16).join('')}`;
};
const toSlug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '';
  const value = (cents / 100).toFixed(2);
  return value.replace('.', ',');
}

function parseCurrencyInput(value: string): number {
  const normalized = value.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  return Number(normalized);
}

function formatCurrencyFromCents(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatQuantityPreview(row: QuantityPriceRow) {
  if (!row.min_quantity || row.min_quantity < 1 || row.unit_price_cents <= 0) {
    return 'Defina mínimo e preço válidos.';
  }
  const priceLabel = formatCurrencyFromCents(row.unit_price_cents);
  if (row.max_quantity && row.max_quantity >= row.min_quantity) {
    return `De ${row.min_quantity} a ${row.max_quantity}: ${priceLabel}/un`;
  }
  return `A partir de ${row.min_quantity}: ${priceLabel}/un`;
}

function formatOptionsPreview(field: ProductDetailField) {
  if (field.input_type !== 'select') return '';
  const label = field.label?.trim() || 'Pergunta';
  const options = field.options
    .filter((opt) => opt.label?.trim())
    .map((opt) => {
      const delta = opt.extra_price_delta_cents ?? 0;
      const deltaLabel = delta
        ? ` (${delta > 0 ? '+' : ''}${formatCurrencyFromCents(delta)}/un)`
        : '';
      return `${opt.label.trim()}${deltaLabel}`;
    });
  if (options.length === 0) {
    return `${label}: sem opções configuradas.`;
  }
  return `${label}: ${options.map((option) => `( ) ${option}`).join(' ')}`;
}

export default function ProductEditModal({ productId, onClose, onSaved, onDeleted }: ProductEditModalProps) {
  const { withAuthRetry } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generatingSku, setGeneratingSku] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [showDescription, setShowDescription] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [productTitle, setproductTitle] = useState('Editar produto');
  const [sku, setSku] = useState('');
  const [skuEditable, setSkuEditable] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ProductCategory>('packaging');
  const [priceInput, setPriceInput] = useState('');
  const [minQuantity, setMinQuantity] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [quantityPrices, setQuantityPrices] = useState<QuantityPriceRow[]>([]);
  const [fields, setFields] = useState<ProductDetailField[]>([]);
  const [initialFields, setInitialFields] = useState<ProductDetailField[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isCreateMode = !productId;
  const authRetryRef = useRef(withAuthRetry);
  const runQuery = useCallback(
    <R extends { error: any }>(operation: () => PromiseLike<R>, label: string) =>
      authRetryRef.current(operation, { label }),
    []
  );
  const markDirty = useCallback(() => {
    setIsDirty(true);
    setErrorMessage(null);
  }, []);

  useEffect(() => {
    authRetryRef.current = withAuthRetry;
  }, [withAuthRetry]);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      setErrorMessage(null);
      setLoadError(null);
      setCurrentStep(0);
      setIsDirty(false);
      if (!productId) {
        setproductTitle('Novo produto');
        setSku('');
        setSkuEditable(false);
        setName('');
        setDescription('');
        setCategory('packaging');
        setPriceInput('');
        setMinQuantity('');
        setIsActive(true);
        setImageUrl('');
        setQuantityPrices([]);
        setFields([]);
        setInitialFields([]);
        setShowDescription(false);
        setIsDirty(true);
        setLoading(false);
        return;
      }
      try {
        const { data: productData, error: productError } = await runQuery(
          () =>
            supabase
              .from('products')
              .select(
                [
                  'id',
                  'sku',
                  'name',
                  'description',
                  'image_url',
                  'category',
                  'base_price_cents',
                  'min_quantity',
                  'is_active',
                ].join(', ')
              )
              .eq('id', productId)
              .single(),
          'load-product'
        );

        const product = (productData ?? null) as EditableProduct | null;
        if (productError || !product) {
          throw productError ?? new Error('Produto não encontrado.');
        }

        const { data: fieldsData, error: fieldsError } = await runQuery(
          () =>
            supabase
              .from('product_detail_fields')
              .select(
                'id, product_id, field_key, label, input_type, help_text, is_required, sort_order, is_active'
              )
              .eq('product_id', productId)
              .order('sort_order', { ascending: true }),
          'load-product-fields'
        );

        if (fieldsError) {
          throw fieldsError;
        }

        let optionsData: ProductDetailOption[] = [];
        const fieldIds = (fieldsData ?? []).map((f) => f.id).filter(Boolean) as string[];
        if (fieldIds.length > 0) {
          const { data: opts, error: optionsError } = await runQuery(
            () =>
              supabase
                .from('product_detail_options')
                .select('id, field_id, label, value, extra_price_delta_cents, sort_order')
                .in('field_id', fieldIds),
            'load-field-options'
          );

          if (optionsError) {
            throw optionsError;
          }

          optionsData = (opts ?? []) as ProductDetailOption[];
        }

        const quantityPriceData = await fetchProductQuantityPrices(productId, { withAuthRetry });

        if (!isMounted) return;

        setproductTitle(product.name || 'Editar produto');
        setSku(product.sku ?? '');
        setName(product.name ?? '');
        setDescription(product.description ?? '');
        setCategory(product.category);
        setPriceInput(centsToInput(product.base_price_cents));
        setMinQuantity(product.min_quantity !== null ? String(product.min_quantity) : '');
        setIsActive(product.is_active);
        setImageUrl(product.image_url ?? '');
        setSkuEditable(false);
        setShowDescription(Boolean(product.description?.trim()));
        setIsDirty(false);
        const parsedQuantityPrices = (quantityPriceData ?? []).map((row) => ({
          ...(row as unknown as Omit<QuantityPriceRow, 'unitPriceInput'>),
          unitPriceInput: centsToInput((row as { unit_price_cents: number }).unit_price_cents),
        }));
        setQuantityPrices(parsedQuantityPrices as QuantityPriceRow[]);

        const mappedFields = ((fieldsData ?? []) as ProductDetailField[]).map((field) => {
          const clientId = field.id ?? createTempId('field');
          const fieldOptions = optionsData
            .filter((opt) => opt.field_id === field.id)
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((opt) => ({
              ...opt,
              clientId: opt.id ?? createTempId('opt'),
              extra_price_delta_cents: Number.isFinite(opt.extra_price_delta_cents)
                ? opt.extra_price_delta_cents
                : 0,
            }));
          return {
            ...field,
            input_type: field.input_type ?? 'text',
            help_text: field.help_text ?? null,
            clientId,
            options: fieldOptions,
          };
        });
        setFields(mappedFields);
        setInitialFields(mappedFields);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar produto.';
        setLoadError(message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [productId, runQuery]);

  const handleSelectImage = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageUploading(true);
    setErrorMessage(null);

    try {
      const extension = file.name.split('.').pop() || 'jpg';
      const targetId = productId ?? 'new';
      const filePath = `products/${targetId}-${Date.now()}.${extension}`;

      const { error: uploadError } = await withAuthRetry(
        () => supabase.storage.from(IMAGE_BUCKET).upload(filePath, file, { upsert: true }),
        { label: 'upload-product-image' }
      );

      if (uploadError) {
        if (uploadError.message?.toLowerCase().includes('bucket not found')) {
          throw new Error(
            `Bucket "${IMAGE_BUCKET}" não encontrado no Supabase Storage. Crie-o no Storage ou defina VITE_IMAGE_BUCKET com o nome correto.`
          );
        }
        throw uploadError;
      }

      const { data: publicData } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(filePath);
      if (publicData?.publicUrl) {
        setImageUrl(publicData.publicUrl);
        markDirty();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar imagem.';
      setErrorMessage(message);
    } finally {
      setImageUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleQuantityPriceChange = (
    index: number,
    field: 'min_quantity' | 'max_quantity' | 'unitPriceInput',
    value: string
  ) => {
    markDirty();
    setQuantityPrices((prev) => {
      const next = [...prev];
      const row = { ...next[index] };

      if (field === 'unitPriceInput') {
        row.unitPriceInput = value;
        const parsed = parseCurrencyInput(value || '0');
        row.unit_price_cents = Number.isNaN(parsed) ? 0 : Math.round(parsed * 100);
      } else if (field === 'max_quantity') {
        const trimmed = value.trim();
        row.max_quantity = trimmed === '' ? null : Number.parseInt(trimmed, 10) || null;
      } else {
        row.min_quantity = Number.parseInt(value, 10) || 0;
      }

      next[index] = row;
      return next;
    });
  };

  const handleToggleMaxQuantity = (index: number, noMax: boolean) => {
    markDirty();
    setQuantityPrices((prev) => {
      const next = [...prev];
      const row = { ...next[index] };
      row.max_quantity = noMax ? null : row.min_quantity || 1;
      next[index] = row;
      return next;
    });
  };

  const handleAddQuantityPrice = () => {
    markDirty();
    setQuantityPrices((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        product_id: productId ?? '',
        min_quantity: 1,
        max_quantity: null,
        unit_price_cents: 0,
        currency: null,
        unitPriceInput: '',
      },
    ]);
  };

  const handleRemoveQuantityPrice = (index: number) => {
    const row = quantityPrices[index];
    if (!row) return;
    const hasValues =
      row.unitPriceInput.trim() !== '' || row.max_quantity !== null || row.min_quantity !== 1;
    if (hasValues && !window.confirm('Remover esta faixa de preço?')) {
      return;
    }
    markDirty();
    setQuantityPrices((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddField = () => {
    const clientId = createTempId('field');
    markDirty();
    setFields((prev) => [
      ...prev,
      {
        clientId,
        field_key: '',
        label: '',
        input_type: 'text',
        help_text: null,
        is_required: false,
        sort_order: (prev.at(-1)?.sort_order ?? 0) + 1,
        is_active: true,
        options: [],
      },
    ]);
  };

  const handleUpdateField = (
    clientId: string,
    key: keyof Omit<ProductDetailField, 'clientId' | 'product_id' | 'id' | 'options'>,
    value: string | boolean | number | null
  ) => {
    markDirty();
    setFields((prev) =>
      prev.map((field) => {
        if (field.clientId !== clientId) {
          return field;
        }
        const normalizedValue =
          key === 'sort_order'
            ? typeof value === 'number'
              ? value
              : Number(value) || 0
            : key === 'help_text'
              ? value && String(value).trim() !== ''
                ? String(value)
                : null
              : value;
        const nextField = {
          ...field,
          options: key === 'input_type' && value !== 'select' ? [] : field.options,
          [key]: normalizedValue,
        } as ProductDetailField;
        if (key === 'label' && !field.field_key.trim()) {
          nextField.field_key = toSlug(String(normalizedValue ?? ''));
        }
        return nextField;
      })
    );
  };

  const handleRemoveField = (clientId: string) => {
    markDirty();
    setFields((prev) => prev.filter((field) => field.clientId !== clientId));
  };

  const generateSku = async () => {
    const base = toSlug(name || '');
    if (!base) {
      setErrorMessage('Preencha o nome para gerar o SKU automaticamente.');
      return;
    }
    setGeneratingSku(true);
    try {
      const { data, error } = await runQuery(
        () => supabase.from('products').select('sku').ilike('sku', `${base}%`),
        'generate-sku'
      );
      if (error) {
        throw error;
      }
      const existing = new Set((data ?? []).map((p: any) => String(p.sku).toLowerCase()));
      let candidate = base;
      let suffix = 2;
      while (existing.has(candidate.toLowerCase())) {
        candidate = `${base}-${suffix}`;
        suffix += 1;
      }
      setSku(candidate);
      setSkuEditable(false);
      markDirty();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao gerar SKU.';
      setErrorMessage(message);
    } finally {
      setGeneratingSku(false);
    }
  };

  const handleToggleSkuEdit = () => {
    if (skuEditable) {
      setSkuEditable(false);
      return;
    }
    const message = isCreateMode
      ? 'Deseja liberar a edição do SKU? Só altere se souber o que está fazendo.'
      : 'Editar o SKU pode causar conflitos e afetar relatórios. Deseja liberar a edição manual?';
    if (!window.confirm(message)) {
      return;
    }
    setSkuEditable(true);
  };

  const handleAddOption = (fieldClientId: string) => {
    markDirty();
    setFields((prev) =>
      prev.map((field) =>
        field.clientId === fieldClientId
          ? {
              ...field,
              options: [
                ...field.options,
                {
                  id: createUuid(),
                  clientId: createTempId('opt'),
                  label: '',
                  value: '',
                  extra_price_delta_cents: 0,
                  sort_order: (field.options.at(-1)?.sort_order ?? 0) + 1,
                },
              ],
            }
          : field
      )
    );
  };

  const handleUpdateOption = (
    fieldClientId: string,
    optionClientId: string,
    key: keyof Omit<ProductDetailOption, 'clientId' | 'field_id' | 'id'>,
    value: string | number
  ) => {
    markDirty();
    setFields((prev) =>
      prev.map((field) =>
        field.clientId === fieldClientId
          ? {
              ...field,
              options: field.options.map((opt) =>
                opt.clientId === optionClientId
                  ? (() => {
                      const normalizedValue =
                        key === 'sort_order' || key === 'extra_price_delta_cents'
                          ? typeof value === 'number'
                            ? value
                            : Number(value) || 0
                          : value;
                      const nextOption = {
                        ...opt,
                        [key]: normalizedValue,
                      } as ProductDetailOption;
                      if (key === 'label' && !opt.value?.trim()) {
                        nextOption.value = toSlug(String(normalizedValue ?? ''));
                      }
                      return nextOption;
                    })()
                  : opt
              ),
            }
          : field
      )
    );
  };

  const handleRemoveOption = (fieldClientId: string, optionClientId: string) => {
    markDirty();
    setFields((prev) =>
      prev.map((field) =>
        field.clientId === fieldClientId
          ? {
              ...field,
              options: field.options.filter((opt) => opt.clientId !== optionClientId),
            }
          : field
      )
    );
  };

  const getQuantityRowErrors = (
    row: QuantityPriceRow,
    minCountMap: Record<number, number>
  ): { min: string[]; max: string[]; price: string[] } => {
    const errors = { min: [], max: [], price: [] } as {
      min: string[];
      max: string[];
      price: string[];
    };
    if (!row.min_quantity || row.min_quantity < 1) {
      errors.min.push('Mínimo deve ser 1 ou mais.');
    }
    if (row.max_quantity !== null && row.max_quantity < row.min_quantity) {
      errors.max.push('Máximo deve ser maior ou igual ao mínimo.');
    }
    if (!row.unit_price_cents || row.unit_price_cents <= 0) {
      errors.price.push('Preço deve ser maior que 0.');
    }
    if (minCountMap[row.min_quantity] > 1) {
      errors.min.push('Mínimo repetido nesta tabela.');
    }
    return errors;
  };

  const getQuantityRowErrorList = (
    row: QuantityPriceRow,
    minCountMap: Record<number, number>
  ) => {
    const errors = getQuantityRowErrors(row, minCountMap);
    return [...errors.min, ...errors.max, ...errors.price];
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage(null);

    try {
      const minCountMap = quantityPrices.reduce<Record<number, number>>((acc, row) => {
        acc[row.min_quantity] = (acc[row.min_quantity] ?? 0) + 1;
        return acc;
      }, {});

      const hasInvalidQuantity = quantityPrices.some(
        (row) => getQuantityRowErrorList(row, minCountMap).length > 0
      );
      if (hasInvalidQuantity) {
        throw new Error('Corrija as faixas de preço por quantidade antes de salvar.');
      }

      const parsedPrice = parseCurrencyInput(priceInput || '0');
      if (Number.isNaN(parsedPrice)) {
        throw new Error('Informe um preço base válido.');
      }

      const trimmedName = name.trim();
      const trimmedSku = sku.trim();
      const trimmedDescription = description.trim();

      if (!trimmedName) {
        throw new Error('Informe um nome para o produto.');
      }
      if (!trimmedSku) {
        throw new Error('Informe um SKU.');
      }

      const normalizedFields = fields.map((field, index) => {
        const sortOrder = Number.isFinite(Number(field.sort_order)) ? Number(field.sort_order) : index + 1;
        const validInputType =
          DETAIL_INPUT_TYPES.find((opt) => opt.value === field.input_type)?.value ?? 'text';
        const normalizedLabel = field.label.trim();
        const normalizedFieldKey = field.field_key.trim() || toSlug(normalizedLabel);
        const normalizedOptions = field.options.map((opt, optIndex) => {
          const normalizedOptionLabel = opt.label?.trim() ?? '';
          const normalizedOptionValue = opt.value?.trim() || toSlug(normalizedOptionLabel);
          return {
            ...opt,
            label: normalizedOptionLabel,
            value: normalizedOptionValue,
            extra_price_delta_cents: Number.isFinite(opt.extra_price_delta_cents)
              ? opt.extra_price_delta_cents
              : 0,
            sort_order: Number.isFinite(opt.sort_order) ? opt.sort_order : optIndex + 1,
          };
        });
        return {
          ...field,
          field_key: normalizedFieldKey,
          label: normalizedLabel,
          input_type: validInputType,
          help_text: field.help_text ? field.help_text.trim() : null,
          sort_order: sortOrder,
          options: validInputType === 'select' ? normalizedOptions : [],
        };
      });

      const fieldKeyCounts: Record<string, number> = {};
      for (const field of normalizedFields) {
        if (!field.field_key || !field.label) {
          throw new Error('Preencha o nome de todas as perguntas.');
        }
        const key = field.field_key.toLowerCase();
        fieldKeyCounts[key] = (fieldKeyCounts[key] ?? 0) + 1;
      }

      if (Object.values(fieldKeyCounts).some((count) => count > 1)) {
        throw new Error('Duas perguntas estão com o mesmo nome. Ajuste para ficar único.');
      }

      for (const field of normalizedFields) {
        if (field.input_type === 'select') {
          const hasInvalidOption = field.options.some((opt) => !opt.label?.trim() || !opt.value?.trim());
          if (hasInvalidOption) {
            throw new Error('Preencha o nome de todas as opções.');
          }
        }
      }

      const { data: existingSku, error: skuError } = await runQuery(
        () =>
          supabase
            .from('products')
            .select('id')
            .eq('sku', trimmedSku)
            .limit(1)
            .maybeSingle(),
        'check-sku'
      );

      if (skuError) {
        throw skuError;
      }
      if (existingSku && existingSku.id !== productId) {
        throw new Error('SKU já está em uso. Escolha outro valor.');
      }

      const minQtyNumber = minQuantity ? parseInt(minQuantity, 10) : null;
      const payload = {
        sku: trimmedSku,
        name: trimmedName,
        description: trimmedDescription || null,
        category,
        base_price_cents: Math.round(parsedPrice * 100),
        min_quantity: Number.isNaN(minQtyNumber) ? null : minQtyNumber,
        is_active: isActive,
        image_url: imageUrl || null,
      };

      let currentProductId = productId ?? '';
      if (isCreateMode) {
        try {
          const { data: inserted, error: insertError, status, statusText } = await runQuery(
            () =>
              supabase
                .from('products')
                .insert(payload)
                .select()
                .single(),
            'insert-product'
          );

          if (insertError || !inserted) {
            console.error('Erro ao criar produto', {
              status,
              statusText,
              endpoint: `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/products`,
              payload,
              error: insertError,
            });
            const duplicateSku =
              insertError?.code === '23505' ||
              insertError?.message?.toLowerCase().includes('duplicate');
            const msg =
              insertError?.message?.includes('Failed to fetch') || insertError?.message?.includes('ERR_CONNECTION')
                ? 'Falha de rede ao criar produto. Verifique sua conexão e a URL do Supabase.'
                : duplicateSku
                  ? 'SKU já está em uso. Escolha outro valor.'
                  : insertError;
            throw msg ?? new Error('Não foi possível criar o produto.');
          }
          currentProductId = (inserted as { id: string }).id;
        } catch (e: any) {
          if (e?.message?.includes('Failed to fetch') || e?.message?.includes('ERR_CONNECTION')) {
            throw new Error('Falha de rede ao criar produto. Verifique a conexão com o Supabase.');
          }
          throw e;
        }
      } else {
        const { error: updateError, status, statusText } = await runQuery(
          () => supabase.from('products').update(payload).eq('id', productId),
          'update-product'
        );

        if (updateError) {
          console.error('Erro ao atualizar produto', {
            status,
            statusText,
            endpoint: `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/products`,
            payload,
            error: updateError,
          });
          const duplicateSku =
            updateError?.code === '23505' ||
            updateError?.message?.toLowerCase().includes('duplicate');
          if (duplicateSku) {
            throw new Error('SKU já está em uso. Escolha outro valor.');
          }
          throw updateError;
        }
      }

      if (!currentProductId) {
        throw new Error('ID do produto não encontrado após salvar.');
      }

      const { error: deleteQuantityError } = await runQuery(
        () => supabase.from('product_quantity_prices').delete().eq('product_id', currentProductId),
        'delete-quantity-prices'
      );

      if (deleteQuantityError) {
        console.error(deleteQuantityError);
        throw deleteQuantityError;
      }

      if (quantityPrices.length > 0) {
        const quantityPayload = quantityPrices.map((row) => ({
          product_id: currentProductId,
          min_quantity: row.min_quantity,
          max_quantity: row.max_quantity === null ? null : row.max_quantity,
          unit_price_cents: row.unit_price_cents,
          currency: 'BRL',
        }));

        const { error: insertQuantityError } = await runQuery(
          () => supabase.from('product_quantity_prices').insert(quantityPayload),
          'insert-quantity-prices'
        );

        if (insertQuantityError) {
          console.error(insertQuantityError);
          throw insertQuantityError;
        }
      }

      const initialFieldIds = initialFields
        .map((field) => field.id)
        .filter(Boolean) as string[];
      const currentFieldIds = normalizedFields
        .map((field) => field.id)
        .filter(Boolean) as string[];
      const fieldsToDelete = initialFieldIds.filter((id) => !currentFieldIds.includes(id));

      if (fieldsToDelete.length > 0) {
        const { error: deleteFieldOptionsError } = await runQuery(
          () => supabase.from('product_detail_options').delete().in('field_id', fieldsToDelete),
          'delete-field-options-by-field'
        );
        if (deleteFieldOptionsError) {
          throw deleteFieldOptionsError;
        }
        const { error: deleteFieldsError } = await runQuery(
          () => supabase.from('product_detail_fields').delete().in('id', fieldsToDelete),
          'delete-fields'
        );
        if (deleteFieldsError) {
          throw deleteFieldsError;
        }
      }

      const optionsToDelete = initialFields
        .flatMap((field) => field.options ?? [])
        .filter(
          (opt) =>
            opt.id &&
            !normalizedFields.some((field) => field.options.some((currentOpt) => currentOpt.id === opt.id))
        )
        .map((opt) => opt.id as string);

      if (optionsToDelete.length > 0) {
        const { error: deleteOptionsError } = await runQuery(
          () => supabase.from('product_detail_options').delete().in('id', optionsToDelete),
          'delete-orphan-options'
        );
        if (deleteOptionsError) {
          throw deleteOptionsError;
        }
      }

      const existingFieldsPayload = normalizedFields
        .filter((field) => field.id)
        .map((field) => ({
          id: field.id,
          product_id: currentProductId,
          field_key: field.field_key.trim(),
          label: field.label.trim(),
          input_type: field.input_type,
          help_text: field.help_text,
          is_required: field.is_required,
          sort_order: Number.isFinite(field.sort_order) ? field.sort_order : 0,
          is_active: field.is_active,
        }));

      const newFields = normalizedFields.filter((field) => !field.id);
      const newFieldsPayload = newFields.map((field) => ({
        product_id: currentProductId,
        field_key: field.field_key.trim(),
        label: field.label.trim(),
        input_type: field.input_type,
        help_text: field.help_text,
        is_required: field.is_required,
        sort_order: Number.isFinite(field.sort_order) ? field.sort_order : 0,
        is_active: field.is_active,
      }));

      const fieldIdMap: Record<string, string> = {};

      if (existingFieldsPayload.length > 0) {
        const { data: updatedFields, error: updateFieldsError } = await runQuery(
          () => supabase.from('product_detail_fields').upsert(existingFieldsPayload, { onConflict: 'id' }).select(),
          'upsert-fields'
        );

        if (updateFieldsError) {
          throw updateFieldsError;
        }

        (updatedFields ?? []).forEach((field) => {
          const clientId = (fields.find((f) => f.id === field.id)?.clientId ??
            field.id) as string;
          fieldIdMap[clientId] = field.id;
        });
      }

      if (newFieldsPayload.length > 0) {
        const { data: insertedFields, error: insertFieldsError } = await runQuery(
          () => supabase.from('product_detail_fields').insert(newFieldsPayload).select(),
          'insert-fields'
        );

        if (insertFieldsError) {
          throw insertFieldsError;
        }

        (insertedFields ?? []).forEach((field, index) => {
          const clientId = newFields[index]?.clientId ?? createTempId('field');
          fieldIdMap[clientId] = field.id;
        });
      }

      const resolvedOptions = normalizedFields.flatMap((field) => {
        const fieldId = field.id ?? fieldIdMap[field.clientId ?? ''];
        if (!fieldId || field.input_type !== 'select') {
          return [];
        }
        return field.options
          .filter((opt) => opt.id && opt.label?.trim() && opt.value?.trim())
          .map((opt) => ({
            id: opt.id as string,
            field_id: fieldId,
            label: opt.label?.trim() || opt.value.trim(),
            value: opt.value.trim(),
            extra_price_delta_cents: Math.round(
              Number.isFinite(opt.extra_price_delta_cents) ? opt.extra_price_delta_cents : 0
            ),
            sort_order: Number.isFinite(opt.sort_order) ? opt.sort_order : 0,
          }));
      });

      if (resolvedOptions.length > 0) {
        const { error: upsertOptionsError } = await runQuery(
          () => supabase.from('product_detail_options').upsert(resolvedOptions, { onConflict: 'id' }),
          'upsert-field-options'
        );
        if (upsertOptionsError) {
          throw upsertOptionsError;
        }
      }

      setIsDirty(false);
      onSaved();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Não foi possível salvar o produto. Tente novamente.';
      if (err) {
        console.error(err);
      }
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!productId) return;
    const confirmed = window.confirm('Tem certeza que deseja excluir (desativar) este produto?');
    if (!confirmed) return;
    setDeleting(true);
    setErrorMessage(null);
    try {
      const { error } = await runQuery(
        () => supabase.from('products').update({ is_active: false }).eq('id', productId),
        'soft-delete-product'
      );
      if (error) {
        throw error;
      }
      if (onDeleted) {
        onDeleted();
      } else {
        onSaved();
      }
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir produto.';
      setErrorMessage(message);
    } finally {
      setDeleting(false);
    }
  };

  const saveStatus = saving ? 'Salvando...' : isDirty ? 'Alterações não salvas' : 'Salvo';
  const saveStatusClass = saving ? 'is-saving' : isDirty ? 'is-dirty' : 'is-saved';
  const minCountMap = quantityPrices.reduce<Record<number, number>>((acc, row) => {
    acc[row.min_quantity] = (acc[row.min_quantity] ?? 0) + 1;
    return acc;
  }, {});
  const questionsSummary =
    fields.length === 0
      ? 'Nenhuma pergunta configurada'
      : fields.length === 1
        ? '1 pergunta configurada'
        : `${fields.length} perguntas configuradas`;

  return (
    <div className="admin-modal-backdrop">
      <div className="admin-modal">
        <div className="admin-modal-header">
          <div>
            <p className="admin-modal-subtitle">Edição de produto</p>
            <h2 className="admin-modal-title">{productTitle || 'Editar produto'}</h2>
            <p className="admin-modal-helper">
              Preencha o básico e configure preços e personalizações.
            </p>
          </div>
          <div className="admin-modal-header-actions">
            <span className={`admin-save-status ${saveStatusClass}`}>{saveStatus}</span>
            <button type="button" className="admin-button-ghost" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="admin-modal-loading">Carregando dados do produto...</div>
        ) : loadError ? (
          <div className="admin-alert">
            <p>{loadError}</p>
            <button type="button" className="admin-button" onClick={onClose}>
              Voltar
            </button>
          </div>
        ) : (
          <>
            <div className="admin-modal-body">
              {errorMessage && <div className="admin-inline-error">{errorMessage}</div>}

              <nav className="admin-stepper" aria-label="Etapas de edição">
                {STEP_ITEMS.map((step, index) => {
                  const isActive = currentStep === index;
                  return (
                    <button
                      key={step.key}
                      type="button"
                      className={`admin-step${isActive ? ' is-active' : ''}`}
                      onClick={() => setCurrentStep(index)}
                      aria-current={isActive ? 'step' : undefined}
                    >
                      <span className="admin-step-index">{index + 1}</span>
                      <span className="admin-step-text">
                        <span className="admin-step-label">{step.label}</span>
                        <span className="admin-step-helper">{step.helper}</span>
                      </span>
                    </button>
                  );
                })}
              </nav>

              {currentStep === 0 && (
                <section className="admin-step-panel">
                  <div className="admin-step-header">
                    <div>
                      <p className="admin-section-kicker">Passo 1</p>
                      <h3 className="admin-section-title">Básico do produto</h3>
                      <p className="admin-section-helper">
                        O essencial que aparece para o cliente e no catálogo.
                      </p>
                    </div>
                  </div>

                  <div className="admin-basic-grid">
                    <div className="admin-image-card">
                      <div className="admin-image-wrapper">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={name || 'Imagem do produto'}
                            className="admin-image-preview"
                          />
                        ) : (
                          <div className="admin-image-placeholder">
                            <span>Sem imagem</span>
                          </div>
                        )}
                      </div>
                      <div className="admin-image-actions">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="admin-file-input"
                          onChange={handleImageChange}
                        />
                        <button
                          type="button"
                          className="admin-button-outline"
                          onClick={handleSelectImage}
                          disabled={imageUploading}
                        >
                          {imageUploading ? 'Enviando...' : 'Trocar imagem'}
                        </button>
                        <p className="admin-helper-text">Prefira imagens quadradas e nítidas.</p>
                      </div>
                    </div>

                    <div className="admin-basic-fields">
                      <label className="admin-field">
                        <span>Nome do produto *</span>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                            markDirty();
                          }}
                          className="admin-input"
                          placeholder="Ex.: Palha italiana tradicional"
                        />
                      </label>
                      <label className="admin-field">
                        <span>Categoria</span>
                        <select
                          value={category}
                          onChange={(e) => {
                            setCategory(e.target.value as ProductCategory);
                            markDirty();
                          }}
                          className="admin-select"
                        >
                          {CATEGORY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="admin-field">
                        <span>Preço base (R$)</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={priceInput}
                          onChange={(e) => {
                            setPriceInput(e.target.value);
                            markDirty();
                          }}
                          className="admin-input"
                          placeholder="Ex.: 29,90"
                        />
                      </label>
                      <label className="admin-field">
                        <span>
                          Quantidade mínima
                          <span className="admin-tooltip" title="Se vazio, não exige mínimo.">
                            ?
                          </span>
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={minQuantity}
                          onChange={(e) => {
                            setMinQuantity(e.target.value);
                            markDirty();
                          }}
                          className="admin-input"
                          placeholder="Ex.: 10"
                        />
                      </label>
                      <label className="admin-switch">
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={(e) => {
                            setIsActive(e.target.checked);
                            markDirty();
                          }}
                        />
                        <span className="admin-switch-track" aria-hidden="true" />
                        <span>Ativo para vendas</span>
                      </label>
                    </div>
                  </div>

                  <div className="admin-description-block">
                    {showDescription || description.trim() ? (
                      <label className="admin-field admin-textarea-field">
                        <span>Descrição (opcional)</span>
                        <textarea
                          value={description}
                          onChange={(e) => {
                            setDescription(e.target.value);
                            markDirty();
                          }}
                          className="admin-textarea"
                          rows={3}
                          placeholder="Resumo simples para o catálogo"
                        />
                      </label>
                    ) : (
                      <button
                        type="button"
                        className="admin-button-outline"
                        onClick={() => setShowDescription(true)}
                      >
                        Adicionar descrição
                      </button>
                    )}
                  </div>

                  <details className="admin-advanced-panel">
                    <summary>Avançado: SKU</summary>
                    <div className="admin-advanced-body">
                      <label className="admin-field">
                        <span>SKU *</span>
                        <div className="admin-input-inline">
                          <input
                            type="text"
                            value={sku}
                            onChange={(e) => {
                              if (skuEditable) {
                                setSku(e.target.value);
                                markDirty();
                              }
                            }}
                            className={`admin-input${skuEditable ? '' : ' is-readonly'}`}
                            placeholder={skuEditable ? 'ex.: palha-tradicional-kg' : 'Clique em Gerar SKU'}
                            readOnly={!skuEditable}
                          />
                          <button
                            type="button"
                            className="admin-button-outline"
                            onClick={generateSku}
                            disabled={generatingSku}
                          >
                            {generatingSku ? 'Gerando...' : 'Gerar SKU'}
                          </button>
                          <button
                            type="button"
                            className="admin-button-ghost"
                            onClick={handleToggleSkuEdit}
                          >
                            {skuEditable ? 'Bloquear edição' : 'Liberar edição'}
                          </button>
                        </div>
                        <small className="admin-helper-text">
                          {skuEditable
                            ? 'Edição liberada. Confirme o valor antes de salvar.'
                            : 'SKU protegido. Use “Gerar SKU” ou libere a edição manual.'}
                        </small>
                      </label>
                    </div>
                  </details>
                </section>
              )}

              {currentStep === 1 && (
                <section className="admin-step-panel">
                  <div className="admin-step-header">
                    <div>
                      <p className="admin-section-kicker">Passo 2</p>
                      <h3 className="admin-section-title">Preço por quantidade (opcional)</h3>
                      <p className="admin-section-helper">
                        Use para dar desconto por quantidade. Se não usar, deixe vazio.
                      </p>
                    </div>
                    <div className="admin-section-actions">
                      <button
                        type="button"
                        className="admin-button-outline"
                        onClick={handleAddQuantityPrice}
                      >
                        Adicionar faixa
                      </button>
                    </div>
                  </div>

                  {quantityPrices.length === 0 ? (
                    <div className="admin-empty-state">
                      <p className="admin-empty-title">Nenhuma faixa configurada.</p>
                      <p className="admin-empty-helper">Você pode manter apenas o preço base.</p>
                    </div>
                  ) : (
                    <div className="admin-quantity-list">
                      {quantityPrices.map((row, index) => {
                        const rowErrors = getQuantityRowErrors(row, minCountMap);
                        const rowErrorList = getQuantityRowErrorList(row, minCountMap);
                        const noMax = row.max_quantity === null;
                        return (
                          <div key={`row-${row.id}`} className="admin-quantity-card">
                            <div className="admin-quantity-fields">
                              <label className="admin-field">
                                <span>A partir de (mínimo)</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={row.min_quantity}
                                  onChange={(e) =>
                                    handleQuantityPriceChange(index, 'min_quantity', e.target.value)
                                  }
                                  className={`admin-input${rowErrors.min.length ? ' has-error' : ''}`}
                                  aria-invalid={rowErrors.min.length > 0}
                                />
                                {rowErrors.min.length > 0 && (
                                  <small className="admin-field-error">{rowErrors.min.join(' ')}</small>
                                )}
                              </label>
                              <div className="admin-field">
                                <span>Até (máximo)</span>
                                <input
                                  type="number"
                                  min={row.min_quantity || 1}
                                  value={row.max_quantity ?? ''}
                                  onChange={(e) =>
                                    handleQuantityPriceChange(index, 'max_quantity', e.target.value)
                                  }
                                  className={`admin-input${rowErrors.max.length ? ' has-error' : ''}`}
                                  aria-invalid={rowErrors.max.length > 0}
                                  aria-label="Até (máximo)"
                                  placeholder="Sem máximo"
                                  disabled={noMax}
                                />
                                <div className="admin-quantity-toggle">
                                  <label className="admin-quantity-toggle-label">
                                    <input
                                      type="checkbox"
                                      checked={noMax}
                                      onChange={(e) =>
                                        handleToggleMaxQuantity(index, e.target.checked)
                                      }
                                    />
                                    <span>Sem máximo</span>
                                  </label>
                                </div>
                                {rowErrors.max.length > 0 && (
                                  <small className="admin-field-error">{rowErrors.max.join(' ')}</small>
                                )}
                              </div>
                              <label className="admin-field">
                                <span>Preço por unidade (R$)</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={row.unitPriceInput}
                                  onChange={(e) =>
                                    handleQuantityPriceChange(index, 'unitPriceInput', e.target.value)
                                  }
                                  className={`admin-input${rowErrors.price.length ? ' has-error' : ''}`}
                                  aria-invalid={rowErrors.price.length > 0}
                                  placeholder="Ex.: 5,50"
                                />
                                <small className="admin-helper-text">
                                  {row.unit_price_cents > 0
                                    ? formatCurrencyFromCents(row.unit_price_cents)
                                    : 'Digite o preço em R$'}
                                </small>
                                {rowErrors.price.length > 0 && (
                                  <small className="admin-field-error">{rowErrors.price.join(' ')}</small>
                                )}
                              </label>
                            </div>
                            <div className="admin-quantity-footer">
                              <span
                                className={`admin-quantity-preview${
                                  rowErrorList.length > 0 ? ' has-error' : ''
                                }`}
                              >
                                {formatQuantityPreview(row)}
                              </span>
                              <button
                                type="button"
                                className="admin-button-ghost"
                                onClick={() => handleRemoveQuantityPrice(index)}
                              >
                                Remover faixa
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {currentStep === 2 && (
                <section className="admin-step-panel">
                  <div className="admin-step-header">
                    <div>
                      <p className="admin-section-kicker">Passo 3</p>
                      <h3 className="admin-section-title">Personalizações do cliente (opcional)</h3>
                      <p className="admin-section-helper">
                        Crie perguntas para o cliente escolher no pedido. Ex.: Recheio, Cobertura,
                        Mensagem no cartão.
                      </p>
                      <span className="admin-step-count">{questionsSummary}</span>
                    </div>
                    <div className="admin-section-actions">
                      <button
                        type="button"
                        className="admin-button-outline admin-button-wide"
                        onClick={handleAddField}
                      >
                        + Adicionar pergunta
                      </button>
                    </div>
                  </div>

                  {fields.length === 0 ? (
                    <div className="admin-empty-state">
                      <p className="admin-empty-title">Nenhuma pergunta configurada.</p>
                      <p className="admin-empty-helper">
                        Use o botão “Adicionar pergunta” para começar.
                      </p>
                    </div>
                  ) : (
                    <div className="admin-question-list">
                      {fields.map((field, index) => (
                        <div key={field.clientId} className="admin-question-card">
                          <div className="admin-question-header">
                            <div>
                              <p className="admin-section-kicker">Pergunta {index + 1}</p>
                              <h4 className="admin-section-title">
                                {field.label?.trim() ? field.label : `Pergunta ${index + 1}`}
                              </h4>
                              <p className="admin-section-helper">
                                Defina o texto e o tipo de resposta para o cliente.
                              </p>
                            </div>
                          </div>

                          <div className="admin-question-grid">
                            <label className="admin-field admin-field-full">
                              <span>Nome da pergunta *</span>
                              <input
                                type="text"
                                value={field.label}
                                onChange={(e) => handleUpdateField(field.clientId!, 'label', e.target.value)}
                                className="admin-input"
                                placeholder="Ex.: Escolha o recheio"
                              />
                            </label>
                            <label className="admin-field">
                              <span>Tipo de resposta</span>
                              <select
                                value={field.input_type}
                                onChange={(e) =>
                                  handleUpdateField(field.clientId!, 'input_type', e.target.value)
                                }
                                className="admin-select"
                              >
                                {DETAIL_INPUT_TYPES.map((typeOption) => (
                                  <option key={typeOption.value} value={typeOption.value}>
                                    {typeOption.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="admin-question-toggles">
                              <label className="admin-switch">
                                <input
                                  type="checkbox"
                                  checked={field.is_required}
                                  onChange={(e) =>
                                    handleUpdateField(field.clientId!, 'is_required', e.target.checked)
                                  }
                                />
                                <span className="admin-switch-track" aria-hidden="true" />
                                <span>Obrigatório</span>
                              </label>
                              <label className="admin-switch">
                                <input
                                  type="checkbox"
                                  checked={field.is_active}
                                  onChange={(e) =>
                                    handleUpdateField(field.clientId!, 'is_active', e.target.checked)
                                  }
                                />
                                <span className="admin-switch-track" aria-hidden="true" />
                                <span>Ativo</span>
                              </label>
                            </div>
                          </div>

                          <label className="admin-field admin-detail-help">
                            <span>Texto de ajuda (opcional)</span>
                            <input
                              type="text"
                              value={field.help_text ?? ''}
                              onChange={(e) => handleUpdateField(field.clientId!, 'help_text', e.target.value)}
                              className="admin-input"
                              placeholder="Ex.: Esta informação aparece no resumo do pedido."
                            />
                          </label>

                          {field.input_type === 'select' && (
                            <div className="admin-option-section">
                              <div className="admin-option-header">
                                <div>
                                  <p className="admin-section-kicker">Opções</p>
                                  <h4 className="admin-section-title">Escolhas disponíveis</h4>
                                  <p className="admin-section-helper">
                                    Informe o adicional por unidade, se houver.
                                  </p>
                                </div>
                                <div className="admin-section-actions">
                                  <button
                                    type="button"
                                    className="admin-button-outline"
                                    onClick={() => handleAddOption(field.clientId!)}
                                  >
                                    + Adicionar opção
                                  </button>
                                </div>
                              </div>

                              {field.options.length === 0 ? (
                                <div className="admin-empty">Nenhuma opção cadastrada.</div>
                              ) : (
                                <div className="admin-option-list">
                                  {field.options.map((opt) => (
                                    <div key={opt.clientId} className="admin-option-card">
                                      <div className="admin-option-row">
                                        <label className="admin-field">
                                          <span>Nome da opção</span>
                                          <input
                                            type="text"
                                            value={opt.label}
                                            onChange={(e) =>
                                              handleUpdateOption(
                                                field.clientId!,
                                                opt.clientId!,
                                                'label',
                                                e.target.value
                                              )
                                            }
                                            className="admin-input"
                                            placeholder="Ex.: Chocolate"
                                          />
                                        </label>
                                        <label className="admin-field">
                                          <span>Adicional por unidade (R$)</span>
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            value={centsToInput(opt.extra_price_delta_cents ?? 0)}
                                            onChange={(e) =>
                                              handleUpdateOption(
                                                field.clientId!,
                                                opt.clientId!,
                                                'extra_price_delta_cents',
                                                Math.round(parseCurrencyInput(e.target.value || '0') * 100)
                                              )
                                            }
                                            className="admin-input"
                                            placeholder="0,00"
                                          />
                                        </label>
                                        <div className="admin-option-actions">
                                          <button
                                            type="button"
                                            className="admin-button-ghost"
                                            onClick={() => handleRemoveOption(field.clientId!, opt.clientId!)}
                                          >
                                            Remover
                                          </button>
                                        </div>
                                      </div>
                                      <details className="admin-advanced-panel admin-option-advanced">
                                        <summary>Avançado</summary>
                                        <div className="admin-advanced-body admin-option-advanced-fields">
                                          <label className="admin-field">
                                            <span>Código interno (opcional)</span>
                                            <input
                                              type="text"
                                              value={opt.value}
                                              onChange={(e) =>
                                                handleUpdateOption(
                                                  field.clientId!,
                                                  opt.clientId!,
                                                  'value',
                                                  e.target.value
                                                )
                                              }
                                              className="admin-input"
                                              placeholder="Gerado automaticamente"
                                            />
                                          </label>
                                          <label className="admin-field">
                                            <span>Ordem (opcional)</span>
                                            <input
                                              type="number"
                                              value={opt.sort_order}
                                              onChange={(e) =>
                                                handleUpdateOption(
                                                  field.clientId!,
                                                  opt.clientId!,
                                                  'sort_order',
                                                  e.target.value
                                                )
                                              }
                                              className="admin-input"
                                            />
                                          </label>
                                        </div>
                                      </details>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="admin-option-preview">
                                <span className="admin-helper-text">Prévia para o cliente</span>
                                <p className="admin-preview-text">{formatOptionsPreview(field)}</p>
                              </div>
                            </div>
                          )}

                          <details className="admin-advanced-panel">
                            <summary>Avançado</summary>
                            <div className="admin-advanced-body admin-advanced-fields">
                              <label className="admin-field">
                                <span>Identificador interno (automático)</span>
                                <input
                                  type="text"
                                  value={field.field_key}
                                  onChange={(e) =>
                                    handleUpdateField(field.clientId!, 'field_key', e.target.value)
                                  }
                                  className="admin-input"
                                  placeholder="Ex.: recheio"
                                />
                                <small className="admin-helper-text">
                                  Gerado a partir do nome da pergunta.
                                </small>
                              </label>
                              <label className="admin-field">
                                <span>Ordem (opcional)</span>
                                <input
                                  type="number"
                                  value={field.sort_order}
                                  onChange={(e) =>
                                    handleUpdateField(field.clientId!, 'sort_order', e.target.value)
                                  }
                                  className="admin-input"
                                />
                              </label>
                            </div>
                          </details>

                          <div className="admin-question-footer">
                            <button
                              type="button"
                              className="admin-button admin-button-danger"
                              onClick={() => handleRemoveField(field.clientId!)}
                            >
                              Remover pergunta
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>

            <div className="admin-modal-footer">
              <div className="admin-footer-actions">
                <button type="button" className="admin-button-ghost" onClick={onClose}>
                  Cancelar
                </button>
                {!isCreateMode && (
                  <button
                    type="button"
                    className="admin-button-outline admin-button-danger-outline"
                    onClick={handleSoftDelete}
                    disabled={deleting || saving || imageUploading}
                  >
                    {deleting ? 'Excluindo...' : 'Excluir'}
                  </button>
                )}
                <button
                  type="button"
                  className="admin-button"
                  onClick={handleSave}
                  disabled={saving || imageUploading || deleting}
                >
                  {saving ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


