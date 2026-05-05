import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { FaTrashCan, FaXmark } from 'react-icons/fa6';
import { fetchProductQuantityPrices } from '../../lib/api/products';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useDocumentScrollLock } from '../../hooks/useDocumentScrollLock';
import type { ProductDetailInputType } from '../../types/productDetail';

type EditableProduct = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category_id: string | null;
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
  extraPriceInput?: string;
  clientId?: string;
};

type ProductDetailField = {
  id?: string;
  product_id?: string;
  field_key: string;
  label: string;
  input_type: ProductDetailInputType;
  help_text: string | null;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
  options: ProductDetailOption[];
  clientId?: string;
};
type CategoryOption = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  sort_order: number | null;
};

type ValidationToast = {
  durationMs: number;
  id: string;
  message: string;
};

type MobileQuantityFormState = {
  errorMessage: string | null;
  isOpen: boolean;
  maxQuantity: string;
  minQuantity: string;
  mode: 'add' | 'edit';
  noMax: boolean;
  targetIndex: number | null;
  unitPriceInput: string;
};

type MobileQuestionFormState = {
  errorMessage: string | null;
  inputType: ProductDetailField['input_type'];
  isActive: boolean;
  isOpen: boolean;
  isRequired: boolean;
  label: string;
  options: ProductDetailOption[];
};

const DETAIL_INPUT_TYPES: Array<{ value: ProductDetailField['input_type']; label: string }> = [
  { value: 'select', label: 'Escolha única' },
  { value: 'multi_select', label: 'Escolha múltipla' },
  { value: 'text', label: 'Texto curto' },
  { value: 'textarea', label: 'Texto longo' },
];

const STEP_ITEMS = [
  { key: 'basic', label: 'Básico', shortLabel: 'Básico', helper: 'Nome e preço' },
  { key: 'pricing', label: 'Preço e quantidade', shortLabel: 'Preço', helper: 'Faixas' },
  { key: 'custom', label: 'Personalizações', shortLabel: 'Personal', helper: 'Opções' },
];

const createValidationError = (message: string) => {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
};

const createInitialMobileQuantityFormState = (): MobileQuantityFormState => ({
  errorMessage: null,
  isOpen: false,
  maxQuantity: '',
  minQuantity: '1',
  mode: 'add',
  noMax: true,
  targetIndex: null,
  unitPriceInput: '',
});

const createInitialMobileQuestionFormState = (): MobileQuestionFormState => ({
  errorMessage: null,
  inputType: 'text',
  isActive: true,
  isOpen: false,
  isRequired: false,
  label: '',
  options: [],
});

const isValidationError = (error: unknown): error is Error =>
  error instanceof Error && error.name === 'ValidationError';

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

function formatCurrencyInputMask(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return (Number.parseInt(digits, 10) / 100).toFixed(2).replace('.', ',');
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

function isOptionBasedInputType(inputType: ProductDetailInputType) {
  return inputType === 'select' || inputType === 'multi_select';
}

function createDraftDetailOption(sortOrder: number): ProductDetailOption {
  return {
    id: createUuid(),
    clientId: createTempId('opt'),
    label: '',
    value: '',
    extra_price_delta_cents: 0,
    extraPriceInput: centsToInput(0),
    sort_order: sortOrder,
  };
}

function normalizeDetailOption(option: ProductDetailOption, optionIndex: number): ProductDetailOption {
  const label = option.label?.trim() ?? '';
  const value = option.value?.trim() || toSlug(label);
  const extraPriceDeltaCents = Number.isFinite(option.extra_price_delta_cents)
    ? option.extra_price_delta_cents
    : 0;

  return {
    ...option,
    label,
    value,
    extra_price_delta_cents: extraPriceDeltaCents,
    extraPriceInput: centsToInput(extraPriceDeltaCents),
    sort_order: Number.isFinite(option.sort_order) ? option.sort_order : optionIndex + 1,
  };
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
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);
  const [deleteQuestionId, setDeleteQuestionId] = useState<string | null>(null);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [validationToasts, setValidationToasts] = useState<ValidationToast[]>([]);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 760px)').matches;
  });

  const [productTitle, setproductTitle] = useState('Editar produto');
  const [sku, setSku] = useState('');
  const [skuEditable, setSkuEditable] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [minQuantity, setMinQuantity] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [quantityPrices, setQuantityPrices] = useState<QuantityPriceRow[]>([]);
  const [mobileQuantityForm, setMobileQuantityForm] = useState<MobileQuantityFormState>(
    createInitialMobileQuantityFormState
  );
  const [mobileQuestionForm, setMobileQuestionForm] = useState<MobileQuestionFormState>(
    createInitialMobileQuestionFormState
  );
  const [fields, setFields] = useState<ProductDetailField[]>([]);
  const [initialFields, setInitialFields] = useState<ProductDetailField[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const validationToastTimersRef = useRef<number[]>([]);
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
  const removeValidationToast = useCallback((id: string) => {
    setValidationToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);
  const clearValidationToastTimers = useCallback(() => {
    if (typeof window === 'undefined') return;
    validationToastTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    validationToastTimersRef.current = [];
  }, []);
  const pushValidationToast = useCallback(
    (message: string, durationMs = 3000) => {
      const id = `validation-toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setValidationToasts((prev) => [...prev, { id, message, durationMs }]);

      if (typeof window !== 'undefined') {
        const timer = window.setTimeout(() => {
          removeValidationToast(id);
          validationToastTimersRef.current = validationToastTimersRef.current.filter(
            (activeTimer) => activeTimer !== timer
          );
        }, durationMs);
        validationToastTimersRef.current.push(timer);
      }
    },
    [removeValidationToast]
  );
  const handleValidationIssue = useCallback(
    (message: string) => {
      if (isMobile) {
        setErrorMessage(null);
        pushValidationToast(message);
        return;
      }
      setErrorMessage(message);
    },
    [isMobile, pushValidationToast]
  );
  const requestClose = useCallback(() => {
    if (isMobile && isDirty) {
      setShowUnsavedConfirm(true);
      return;
    }
    setShowUnsavedConfirm(false);
    onClose();
  }, [isDirty, isMobile, onClose]);

  useDocumentScrollLock(isMobile);

  useEffect(() => {
    authRetryRef.current = withAuthRetry;
  }, [withAuthRetry]);

  useEffect(
    () => () => {
      clearValidationToastTimers();
    },
    [clearValidationToastTimers]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 760px)');
    const syncViewport = () => {
      setIsMobile(mediaQuery.matches);
    };
    syncViewport();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncViewport);
      return () => mediaQuery.removeEventListener('change', syncViewport);
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setShowUnsavedConfirm(false);
      setValidationToasts([]);
      clearValidationToastTimers();
      setMobileQuantityForm(createInitialMobileQuantityFormState());
      setMobileQuestionForm(createInitialMobileQuestionFormState());
    }
  }, [clearValidationToastTimers, isMobile]);

  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (!isMobile || event.key !== 'Escape') return;
      event.preventDefault();
      requestClose();
    };

    window.addEventListener('keydown', handleEscapeKey);
    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, [isMobile, requestClose]);

  useEffect(() => {
    let isMounted = true;
    const loadCategories = async () => {
      setCategoriesLoading(true);
      setCategoriesError(null);
      const { data, error } = await runQuery(
        () =>
          supabase
            .from('categories')
            .select('id, name, slug, is_active, sort_order')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true }),
        'load-categories'
      );

      if (!isMounted) return;
      if (error) {
        setCategoriesError('Não foi possível carregar as categorias.');
        setCategoryOptions([]);
      } else {
        setCategoryOptions((data ?? []) as CategoryOption[]);
      }
      setCategoriesLoading(false);
    };

    loadCategories();
    return () => {
      isMounted = false;
    };
  }, [runQuery]);

  useEffect(() => {
    if (!isCreateMode) return;
    if (categoryId) return;
    if (categoryOptions.length > 0) {
      setCategoryId(categoryOptions[0].id);
    }
  }, [categoryId, categoryOptions, isCreateMode]);

  useEffect(() => {
    let ignore = false;
    if (!categoryId) return undefined;
    if (categoryOptions.some((option) => option.id === categoryId)) return undefined;

    (async () => {
      const { data } = await runQuery(
        () =>
          supabase
            .from('categories')
            .select('id, name, slug, is_active, sort_order')
            .eq('id', categoryId)
            .maybeSingle(),
        'load-category-current'
      );
      if (!ignore && data) {
        setCategoryOptions((prev) => [...prev, data as CategoryOption]);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [categoryId, categoryOptions, runQuery]);

  useEffect(() => {
    setIsImageZoomed(false);
  }, [imageUrl]);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      setErrorMessage(null);
      setLoadError(null);
      setCurrentStep(0);
      setIsDirty(false);
      setShowUnsavedConfirm(false);
      setValidationToasts([]);
      clearValidationToastTimers();
      if (!productId) {
        setproductTitle('Novo produto');
        setSku('');
        setSkuEditable(false);
        setName('');
        setDescription('');
        setCategoryId('');
        setPriceInput('');
        setMinQuantity('');
        setIsActive(true);
        setImageUrl('');
        setQuantityPrices([]);
        setMobileQuantityForm(createInitialMobileQuantityFormState());
        setMobileQuestionForm(createInitialMobileQuestionFormState());
        setFields([]);
        setInitialFields([]);
        setShowDescription(false);
        setIsDirty(false);
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
                  'category_id',
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
        setCategoryId(product.category_id ?? '');
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
        setMobileQuantityForm(createInitialMobileQuantityFormState());
        setMobileQuestionForm(createInitialMobileQuestionFormState());

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
              extraPriceInput: centsToInput(
                Number.isFinite(opt.extra_price_delta_cents) ? opt.extra_price_delta_cents : 0
              ),
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
  }, [clearValidationToastTimers, productId, runQuery]);

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

  const openMobileQuantityForm = (mode: 'add' | 'edit', index?: number) => {
    if (mode === 'edit' && typeof index === 'number') {
      const row = quantityPrices[index];
      if (!row) return;
      setMobileQuantityForm({
        errorMessage: null,
        isOpen: true,
        maxQuantity: row.max_quantity === null ? '' : String(row.max_quantity),
        minQuantity: String(row.min_quantity || 1),
        mode,
        noMax: row.max_quantity === null,
        targetIndex: index,
        unitPriceInput: row.unitPriceInput,
      });
      return;
    }

    const latestRow = quantityPrices.at(-1);
    const suggestedMin = latestRow ? (latestRow.max_quantity ?? latestRow.min_quantity) + 1 : 1;

    setMobileQuantityForm({
      errorMessage: null,
      isOpen: true,
      maxQuantity: '',
      minQuantity: String(Math.max(1, suggestedMin)),
      mode: 'add',
      noMax: true,
      targetIndex: null,
      unitPriceInput: '',
    });
  };

  const handleCloseMobileQuantityForm = () => {
    setMobileQuantityForm(createInitialMobileQuantityFormState());
  };

  const handleMobileQuantityInputChange = (
    field: 'minQuantity' | 'maxQuantity' | 'unitPriceInput',
    value: string
  ) => {
    setMobileQuantityForm((prev) => ({
      ...prev,
      [field]: field === 'unitPriceInput' ? formatCurrencyInputMask(value) : value,
      errorMessage: null,
    }));
  };

  const handleMobileQuantityNoMaxChange = (checked: boolean) => {
    setMobileQuantityForm((prev) => ({
      ...prev,
      errorMessage: null,
      maxQuantity: checked ? '' : prev.maxQuantity || prev.minQuantity || '1',
      noMax: checked,
    }));
  };

  const handleSubmitMobileQuantityForm = () => {
    const parsedMin = Number.parseInt(mobileQuantityForm.minQuantity.trim(), 10);
    const parsedMax = Number.parseInt(mobileQuantityForm.maxQuantity.trim(), 10);
    const parsedPrice = parseCurrencyInput(mobileQuantityForm.unitPriceInput || '0');

    if (!Number.isFinite(parsedMin) || parsedMin < 1) {
      setMobileQuantityForm((prev) => ({ ...prev, errorMessage: 'Mínimo deve ser 1 ou mais.' }));
      return;
    }

    if (!mobileQuantityForm.noMax) {
      if (!Number.isFinite(parsedMax) || parsedMax < parsedMin) {
        setMobileQuantityForm((prev) => ({
          ...prev,
          errorMessage: 'Máximo deve ser maior ou igual ao mínimo.',
        }));
        return;
      }
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setMobileQuantityForm((prev) => ({ ...prev, errorMessage: 'Preço deve ser maior que 0.' }));
      return;
    }

    const duplicateMin = quantityPrices.some(
      (row, index) =>
        row.min_quantity === parsedMin &&
        (mobileQuantityForm.targetIndex === null || index !== mobileQuantityForm.targetIndex)
    );
    if (duplicateMin) {
      setMobileQuantityForm((prev) => ({
        ...prev,
        errorMessage: 'Já existe uma faixa iniciando nesta quantidade.',
      }));
      return;
    }

    const normalizedRow: QuantityPriceRow = {
      id:
        mobileQuantityForm.mode === 'edit' && mobileQuantityForm.targetIndex !== null
          ? quantityPrices[mobileQuantityForm.targetIndex]?.id ?? `new-${Date.now()}`
          : `new-${Date.now()}`,
      product_id:
        mobileQuantityForm.mode === 'edit' && mobileQuantityForm.targetIndex !== null
          ? quantityPrices[mobileQuantityForm.targetIndex]?.product_id ?? productId ?? ''
          : productId ?? '',
      min_quantity: parsedMin,
      max_quantity: mobileQuantityForm.noMax ? null : parsedMax,
      unit_price_cents: Math.round(parsedPrice * 100),
      currency:
        mobileQuantityForm.mode === 'edit' && mobileQuantityForm.targetIndex !== null
          ? quantityPrices[mobileQuantityForm.targetIndex]?.currency ?? null
          : null,
      unitPriceInput: mobileQuantityForm.unitPriceInput,
    };

    markDirty();
    setQuantityPrices((prev) => {
      if (mobileQuantityForm.mode === 'edit' && mobileQuantityForm.targetIndex !== null) {
        const next = [...prev];
        next[mobileQuantityForm.targetIndex] = normalizedRow;
        return next;
      }
      return [...prev, normalizedRow];
    });
    setMobileQuantityForm(createInitialMobileQuantityFormState());
  };

  const handleAddQuantityPrice = () => {
    if (isMobile) {
      openMobileQuantityForm('add');
      return;
    }
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
    setMobileQuantityForm((prev) => {
      if (!prev.isOpen || prev.targetIndex === null) {
        return prev;
      }
      if (prev.targetIndex === index) {
        return createInitialMobileQuantityFormState();
      }
      if (prev.targetIndex > index) {
        return { ...prev, targetIndex: prev.targetIndex - 1 };
      }
      return prev;
    });
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

  const handleOpenMobileQuestionForm = () => {
    setMobileQuestionForm({
      ...createInitialMobileQuestionFormState(),
      isOpen: true,
    });
  };

  const handleCloseMobileQuestionForm = () => {
    setMobileQuestionForm(createInitialMobileQuestionFormState());
  };

  const handleMobileQuestionFormChange = (
    key: keyof Omit<MobileQuestionFormState, 'isOpen' | 'errorMessage'>,
    value: string | boolean
  ) => {
    if (key === 'inputType') {
      const nextInputType = value as ProductDetailInputType;
      setMobileQuestionForm((prev) => {
        const shouldKeepOptions = isOptionBasedInputType(nextInputType);
        const nextOptions = shouldKeepOptions
          ? prev.options.length > 0
            ? prev.options
            : [createDraftDetailOption(1)]
          : [];

        return {
          ...prev,
          inputType: nextInputType,
          options: nextOptions,
          errorMessage: null,
        };
      });
      return;
    }

    setMobileQuestionForm((prev) => ({
      ...prev,
      [key]: value,
      errorMessage: null,
    }));
  };

  const handleAddMobileQuestionOption = () => {
    setMobileQuestionForm((prev) => ({
      ...prev,
      errorMessage: null,
      options: [...prev.options, createDraftDetailOption((prev.options.at(-1)?.sort_order ?? 0) + 1)],
    }));
  };

  const handleUpdateMobileQuestionOption = (
    optionClientId: string,
    key: 'label' | 'value',
    value: string
  ) => {
    setMobileQuestionForm((prev) => ({
      ...prev,
      errorMessage: null,
      options: prev.options.map((option) =>
        option.clientId !== optionClientId
          ? option
          : key === 'label' && !option.value?.trim()
            ? {
                ...option,
                [key]: value,
                value: toSlug(value),
              }
            : {
                ...option,
                [key]: value,
              }
      ),
    }));
  };

  const handleMobileQuestionOptionPriceChange = (optionClientId: string, value: string) => {
    const formattedValue = formatCurrencyInputMask(value);
    const parsed = parseCurrencyInput(formattedValue || '0');
    const nextCents = Number.isNaN(parsed) ? 0 : Math.round(parsed * 100);

    setMobileQuestionForm((prev) => ({
      ...prev,
      errorMessage: null,
      options: prev.options.map((option) =>
        option.clientId !== optionClientId
          ? option
          : {
              ...option,
              extraPriceInput: formattedValue,
              extra_price_delta_cents: nextCents,
            }
      ),
    }));
  };

  const handleMobileQuestionOptionPriceBlur = (optionClientId: string) => {
    setMobileQuestionForm((prev) => ({
      ...prev,
      options: prev.options.map((option) =>
        option.clientId !== optionClientId
          ? option
          : {
              ...option,
              extraPriceInput: centsToInput(option.extra_price_delta_cents ?? 0),
            }
      ),
    }));
  };

  const handleRemoveMobileQuestionOption = (optionClientId: string) => {
    setMobileQuestionForm((prev) => ({
      ...prev,
      errorMessage: null,
      options: prev.options.filter((option) => option.clientId !== optionClientId),
    }));
  };

  const handleSubmitMobileQuestionForm = () => {
    const trimmedLabel = mobileQuestionForm.label.trim();
    if (!trimmedLabel) {
      setMobileQuestionForm((prev) => ({
        ...prev,
        errorMessage: 'Informe o texto da pergunta.',
      }));
      return;
    }

    const normalizedOptions = mobileQuestionForm.options
      .map((option, optionIndex) => normalizeDetailOption(option, optionIndex))
      .filter(
        (option) =>
          option.label.trim() ||
          option.value.trim() ||
          Number(option.extra_price_delta_cents ?? 0) !== 0
      );

    if (isOptionBasedInputType(mobileQuestionForm.inputType)) {
      if (normalizedOptions.length === 0) {
        setMobileQuestionForm((prev) => ({
          ...prev,
          errorMessage: 'Adicione pelo menos uma opção.',
        }));
        return;
      }

      const hasInvalidOption = normalizedOptions.some((option) => !option.label.trim() || !option.value.trim());
      if (hasInvalidOption) {
        setMobileQuestionForm((prev) => ({
          ...prev,
          errorMessage: 'Preencha o nome de todas as opções.',
        }));
        return;
      }

      const optionValueCounts: Record<string, number> = {};
      normalizedOptions.forEach((option) => {
        const optionKey = option.value.trim().toLowerCase();
        optionValueCounts[optionKey] = (optionValueCounts[optionKey] ?? 0) + 1;
      });

      if (Object.values(optionValueCounts).some((count) => count > 1)) {
        setMobileQuestionForm((prev) => ({
          ...prev,
          errorMessage: 'As opções precisam ter nomes diferentes.',
        }));
        return;
      }
    }

    const clientId = createTempId('field');
    const fieldKey = toSlug(trimmedLabel);

    markDirty();
    setFields((prev) => [
      ...prev,
      {
        clientId,
        field_key: fieldKey,
        label: trimmedLabel,
        input_type: mobileQuestionForm.inputType,
        help_text: null,
        is_required: mobileQuestionForm.isRequired,
        sort_order: (prev.at(-1)?.sort_order ?? 0) + 1,
        is_active: mobileQuestionForm.isActive,
        options: isOptionBasedInputType(mobileQuestionForm.inputType) ? normalizedOptions : [],
      },
    ]);
    setMobileQuestionForm(createInitialMobileQuestionFormState());
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
        const nextInputType =
          key === 'input_type' ? (String(normalizedValue) as ProductDetailInputType) : field.input_type;
        const nextField = {
          ...field,
          options: key === 'input_type' && !isOptionBasedInputType(nextInputType) ? [] : field.options,
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
      handleValidationIssue('Preencha o nome para gerar o SKU automaticamente.');
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
              options: [...field.options, createDraftDetailOption((field.options.at(-1)?.sort_order ?? 0) + 1)],
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

  const handleOptionPriceInputChange = (
    fieldClientId: string,
    optionClientId: string,
    value: string
  ) => {
    markDirty();
    const parsed = parseCurrencyInput(value || '0');
    const nextCents = Number.isNaN(parsed) ? 0 : Math.round(parsed * 100);
    setFields((prev) =>
      prev.map((field) =>
        field.clientId === fieldClientId
          ? {
              ...field,
              options: field.options.map((opt) =>
                opt.clientId === optionClientId
                  ? {
                      ...opt,
                      extraPriceInput: value,
                      extra_price_delta_cents: nextCents,
                    }
                  : opt
              ),
            }
          : field
      )
    );
  };

  const handleOptionPriceInputBlur = (fieldClientId: string, optionClientId: string) => {
    setFields((prev) =>
      prev.map((field) =>
        field.clientId === fieldClientId
          ? {
              ...field,
              options: field.options.map((opt) =>
                opt.clientId === optionClientId
                  ? {
                      ...opt,
                      extraPriceInput: centsToInput(opt.extra_price_delta_cents ?? 0),
                    }
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

  const handleCloseQuestion = () => {
    setDeleteQuestionId(null);
    setOpenQuestionId(null);
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
    setShowUnsavedConfirm(false);
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
        throw createValidationError('Corrija as faixas de preço por quantidade antes de salvar.');
      }

      const parsedPrice = parseCurrencyInput(priceInput || '0');
      if (Number.isNaN(parsedPrice)) {
        throw createValidationError('Informe um preço base válido.');
      }

      const trimmedName = name.trim();
      const trimmedSku = sku.trim();
      const trimmedDescription = description.trim();

      if (!trimmedName) {
        throw createValidationError('Informe um nome para o produto.');
      }
      if (!trimmedSku) {
        throw createValidationError('Informe um SKU.');
      }
      if (!categoryId) {
        throw createValidationError('Selecione uma categoria.');
      }

      const normalizedFields = fields.map((field, index) => {
        const sortOrder = Number.isFinite(Number(field.sort_order)) ? Number(field.sort_order) : index + 1;
        const validInputType =
          DETAIL_INPUT_TYPES.find((opt) => opt.value === field.input_type)?.value ?? 'text';
        const normalizedLabel = field.label.trim();
        const normalizedFieldKey = field.field_key.trim() || toSlug(normalizedLabel);
        const normalizedOptions = field.options
          .map((opt, optIndex) => normalizeDetailOption(opt, optIndex))
          .filter(
            (opt) => opt.label.trim() || opt.value.trim() || Number(opt.extra_price_delta_cents ?? 0) !== 0
          );
        return {
          ...field,
          field_key: normalizedFieldKey,
          label: normalizedLabel,
          input_type: validInputType,
          help_text: field.help_text ? field.help_text.trim() : null,
          sort_order: sortOrder,
          options: isOptionBasedInputType(validInputType) ? normalizedOptions : [],
        };
      });

      const fieldKeyCounts: Record<string, number> = {};
      for (const field of normalizedFields) {
        if (!field.field_key || !field.label) {
          throw createValidationError('Preencha o nome de todas as perguntas.');
        }
        const key = field.field_key.toLowerCase();
        fieldKeyCounts[key] = (fieldKeyCounts[key] ?? 0) + 1;
      }

      if (Object.values(fieldKeyCounts).some((count) => count > 1)) {
        throw createValidationError('Duas perguntas estão com o mesmo nome. Ajuste para ficar único.');
      }

      for (const field of normalizedFields) {
        if (isOptionBasedInputType(field.input_type)) {
          if (field.options.length === 0) {
            throw createValidationError('Adicione pelo menos uma opção para as perguntas de escolha.');
          }
          const hasInvalidOption = field.options.some((opt) => !opt.label?.trim() || !opt.value?.trim());
          if (hasInvalidOption) {
            throw createValidationError('Preencha o nome de todas as opções.');
          }
          const optionValueCounts: Record<string, number> = {};
          field.options.forEach((opt) => {
            const optionKey = opt.value.trim().toLowerCase();
            optionValueCounts[optionKey] = (optionValueCounts[optionKey] ?? 0) + 1;
          });
          if (Object.values(optionValueCounts).some((count) => count > 1)) {
            throw createValidationError('As opções de uma mesma pergunta precisam ter nomes diferentes.');
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
        throw createValidationError('SKU já está em uso. Escolha outro valor.');
      }

      const minQtyNumber = minQuantity ? parseInt(minQuantity, 10) : null;
      const payload = {
        sku: trimmedSku,
        name: trimmedName,
        description: trimmedDescription || null,
        category_id: categoryId,
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
        if (!fieldId || !isOptionBasedInputType(field.input_type)) {
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
          () => supabase.from('product_detail_options').upsert(resolvedOptions, { onConflict: 'field_id,value' }),
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
      if (isValidationError(err)) {
        handleValidationIssue(err.message);
        return;
      }
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
    setShowUnsavedConfirm(false);
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
  const displayTitle = isCreateMode ? 'Novo produto' : name.trim() || productTitle || 'Produto';
  const validationToastStack =
    isMobile && validationToasts.length > 0 ? (
      <div className="admin-modal-validation-toast-stack" role="status" aria-live="polite">
        {validationToasts.map((toast) => (
          <div key={toast.id} className="admin-modal-validation-toast">
            <p>{toast.message}</p>
            <span
              className="admin-modal-validation-toast-progress"
              style={{ animationDuration: `${toast.durationMs}ms` }}
              aria-hidden="true"
            />
          </div>
        ))}
      </div>
    ) : null;
  const imageCard = (
    <div className="admin-card admin-card-image">
      <div className="admin-card-header">
        <h3 className="admin-card-title">Imagem</h3>
      </div>
      <div
        className={`admin-image-wrapper${isImageZoomed ? ' is-zoomed' : ''}`}
        onClick={() => {
          if (imageUrl) {
            setIsImageZoomed((prev) => !prev);
          }
        }}
        role={imageUrl ? 'button' : undefined}
        tabIndex={imageUrl ? 0 : undefined}
        onKeyDown={(event) => {
          if (!imageUrl) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsImageZoomed((prev) => !prev);
          }
        }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={name || 'Imagem do produto'} className="admin-image-preview" />
        ) : (
          <div className="admin-image-placeholder">
            <span>Sem imagem</span>
          </div>
        )}
      </div>
      <div className="admin-image-actions admin-image-actions-compact">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="admin-file-input"
          onChange={handleImageChange}
        />
        <button
          type="button"
          className="admin-button-outline admin-button-block"
          onClick={handleSelectImage}
          disabled={imageUploading}
        >
          {imageUploading ? 'Enviando...' : 'Trocar imagem'}
        </button>
      </div>
    </div>
  );
  const basicFieldsCard = (
    <div className="admin-card admin-card-fields">
      <div className="admin-card-header">
        <h3 className="admin-card-title">Dados básicos</h3>
      </div>
      <div className="admin-field-grid admin-field-grid-compact">
        <label className="admin-field">
          <span>Nome do produto</span>
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
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              markDirty();
            }}
            className="admin-select"
            disabled={categoriesLoading}
          >
            <option value="" disabled>
              {categoriesLoading ? 'Carregando categorias...' : 'Selecione uma categoria'}
            </option>
            {categoryOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
                {option.is_active ? '' : ' (inativa)'}
              </option>
            ))}
          </select>
          {categoriesError && <small className="admin-field-error">{categoriesError}</small>}
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
          <span>Quantidade mínima</span>
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
  );
  const advancedCard = (
    <details className="text-xs pl-4">
      <summary>Avançado</summary>
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
            <button type="button" className="admin-button-ghost" onClick={handleToggleSkuEdit}>
              {skuEditable ? 'Bloquear' : 'Editar'}
            </button>
          </div>
          <small className="admin-helper-text">
            {skuEditable ? 'Edição liberada.' : 'Use “Gerar SKU” ou libere a edição.'}
          </small>
        </label>
      </div>
    </details>
  );

  return (
    <div className="admin-modal-backdrop admin-modal-backdrop-full">
      <div className="admin-modal admin-modal-product">
        <header className="admin-modal-header-fixed">
          {isMobile ? (
            <div className="admin-modal-header-main admin-modal-header-main-mobile">
              <div className="admin-modal-header-top-row">
                <div className="admin-modal-title-group">
                  <h2 className="admin-modal-title-strong">{displayTitle}</h2>
                </div>
                <button
                  type="button"
                  className="admin-modal-close-icon"
                  aria-label="Fechar modal"
                  onClick={requestClose}
                >
                  <FaXmark aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : (
            <div className="admin-modal-header-main">
              <div className="admin-modal-title-group">
                <h2 className="admin-modal-title-strong">{displayTitle}</h2>
              </div>
              <div className="admin-modal-header-actions">
                <button type="button" className="admin-button-ghost" onClick={requestClose}>
                  Fechar
                </button>
              </div>
            </div>
          )}
          {!isMobile && (
            <nav className="admin-stepper admin-stepper-compact" aria-label="Etapas do produto">
              {STEP_ITEMS.map((step, index) => {
                const isActive = currentStep === index;
                return (
                  <button
                    key={step.key}
                    type="button"
                    className={`admin-step admin-step-compact${isActive ? ' is-active' : ''}`}
                    onClick={() => setCurrentStep(index)}
                    aria-current={isActive ? 'step' : undefined}
                    aria-label={`${index + 1} ${step.label}`}
                  >
                    <span className="admin-step-index">{index + 1}</span>
                    <span className="admin-step-text">
                      <span className="admin-step-label admin-step-label-full">{step.label}</span>
                      <span className="admin-step-label admin-step-label-short">{step.shortLabel}</span>
                      {step.helper ? <span className="admin-step-helper">{step.helper}</span> : null}
                    </span>
                  </button>
                );
              })}
            </nav>
          )}
        </header>
        {validationToastStack}

        {loading ? (
          <div className="admin-modal-body admin-modal-body-scroll">
            <div className="admin-modal-loading">Carregando dados do produto...</div>
          </div>
        ) : loadError ? (
          <div className="admin-modal-body admin-modal-body-scroll">
            <div className="admin-alert admin-alert-dark">
              <p>{loadError}</p>
              <button type="button" className="admin-button" onClick={requestClose}>
                Voltar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="admin-modal-body admin-modal-body-scroll">
              {errorMessage && (
                <div className="admin-inline-error admin-inline-error-dark" role="alert">
                  {errorMessage}
                </div>
              )}

              {(isMobile || currentStep === 0) && (
                <>
                  <section className="admin-step-panel admin-step-panel-basic">
                    <div className="admin-step-grid">
                      {isMobile ? (
                        <>
                          {basicFieldsCard}
                          {imageCard}
                        </>
                      ) : (
                        <>
                          {imageCard}
                          {basicFieldsCard}
                        </>
                      )}
                    </div>

                    <div className="admin-card admin-card-description">
                      <div className="admin-card-header admin-card-header-inline">
                        <h3 className="admin-card-title">Descrição</h3>
                        {!showDescription && !description.trim() && (
                          <button
                            type="button"
                            className="admin-button-outline admin-button-compact"
                            onClick={() => setShowDescription(true)}
                          >
                            + Descrição
                          </button>
                        )}
                      </div>
                      {(showDescription || description.trim()) && (
                        <label className="admin-field admin-textarea-field">
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
                      )}
                    </div>

                    {!isMobile && advancedCard}
                  </section>
                  {isMobile && <div className="admin-mobile-section-divider" aria-hidden="true" />}
                </>
              )}

              {(isMobile || currentStep === 1) && (
                <>
                  <section
                    className={`admin-step-panel admin-step-panel-pricing${
                      isMobile ? ' admin-step-panel-pricing-mobile' : ''
                    }`}
                  >
                    <div
                      className={`admin-step-header admin-step-header-compact${
                        isMobile ? ' admin-step-header-mobile-centered' : ''
                      }`}
                    >
                      <div>
                        <h3 className="admin-section-title">Preço por quantidade</h3>
                        <p className="admin-section-helper">Opcional</p>
                      </div>
                      <div className="admin-section-actions">
                        <button
                          type="button"
                          className="admin-button-outline"
                          onClick={handleAddQuantityPrice}
                        >
                          Adicionar Faixa
                        </button>
                      </div>
                    </div>

                    {isMobile && mobileQuantityForm.isOpen && (
                      <div
                        className="admin-quantity-mobile-overlay"
                        role="presentation"
                        onClick={handleCloseMobileQuantityForm}
                      >
                        <div
                          className="admin-quantity-mobile-popover"
                          role="dialog"
                          aria-modal="true"
                          aria-label="Formulário de faixa"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="admin-quantity-mobile-popover-header">
                            <div className="admin-quantity-mobile-popover-title-block">
                              <h4 className="admin-quantity-mobile-popover-title">
                                {mobileQuantityForm.mode === 'edit' ? 'Editar faixa' : 'Nova faixa'}
                              </h4>
                            </div>
                            <button
                              type="button"
                              className="admin-modal-close-icon admin-quantity-mobile-close"
                              aria-label="Fechar formulário"
                              onClick={handleCloseMobileQuantityForm}
                            >
                              <FaXmark aria-hidden="true" />
                            </button>
                          </div>

                          <div className="admin-quantity-mobile-grid">
                            <label className="admin-quantity-inline-field">
                              <span>De</span>
                              <input
                                type="number"
                                min={1}
                                value={mobileQuantityForm.minQuantity}
                                onChange={(event) => handleMobileQuantityInputChange('minQuantity', event.target.value)}
                                className={`admin-input${
                                  mobileQuantityForm.errorMessage?.includes('Mínimo') ||
                                  mobileQuantityForm.errorMessage?.includes('iniciando')
                                    ? ' has-error'
                                    : ''
                                }`}
                                aria-invalid={
                                  mobileQuantityForm.errorMessage?.includes('Mínimo') ||
                                  mobileQuantityForm.errorMessage?.includes('iniciando')
                                }
                              />
                            </label>
                            <label
                              className={`admin-quantity-inline-field${
                                mobileQuantityForm.noMax ? ' is-disabled' : ''
                              }`}
                            >
                              <span>Até</span>
                              <input
                                type="number"
                                min={mobileQuantityForm.minQuantity || '1'}
                                value={mobileQuantityForm.maxQuantity}
                                onChange={(event) => handleMobileQuantityInputChange('maxQuantity', event.target.value)}
                                className={`admin-input${
                                  mobileQuantityForm.errorMessage?.includes('Máximo') ? ' has-error' : ''
                                }`}
                                aria-invalid={mobileQuantityForm.errorMessage?.includes('Máximo')}
                                placeholder="Sem máximo"
                                disabled={mobileQuantityForm.noMax}
                              />
                            </label>
                          </div>

                          <div className="admin-quantity-mobile-toggle-line">
                            <label className="admin-quantity-mobile-switch">
                              <span className="admin-quantity-mobile-switch-text">Sem máximo</span>
                              <span className="admin-switch">
                                <input
                                  type="checkbox"
                                  checked={mobileQuantityForm.noMax}
                                  onChange={(event) => handleMobileQuantityNoMaxChange(event.target.checked)}
                                />
                                <span className="admin-switch-track" aria-hidden="true" />
                              </span>
                            </label>
                          </div>

                          <label className="admin-field admin-quantity-mobile-price-field">
                            <span>Preço por unidade</span>
                            <div className="admin-quantity-price-input-wrap">
                              <span className="admin-quantity-price-prefix">R$</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={mobileQuantityForm.unitPriceInput}
                                onChange={(event) =>
                                  handleMobileQuantityInputChange('unitPriceInput', event.target.value)
                                }
                                className={`admin-input${
                                  mobileQuantityForm.errorMessage?.includes('Preço') ? ' has-error' : ''
                                }`}
                                aria-invalid={mobileQuantityForm.errorMessage?.includes('Preço')}
                                placeholder="0,00"
                              />
                            </div>
                          </label>

                          {mobileQuantityForm.errorMessage && (
                            <small className="admin-field-error">{mobileQuantityForm.errorMessage}</small>
                          )}

                          <div className="admin-quantity-mobile-popover-actions">
                            <button type="button" className="admin-button" onClick={handleSubmitMobileQuantityForm}>
                              {mobileQuantityForm.mode === 'edit' ? 'Atualizar faixa' : 'Adicionar faixa'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {quantityPrices.length === 0 ? (
                      <div className="admin-empty-state admin-empty-state-compact">
                        <p className="admin-empty-title">Nenhuma faixa cadastrada</p>
                      </div>
                    ) : (
                      <div
                        className={`admin-quantity-list admin-quantity-list-compact${
                          isMobile ? ' admin-quantity-mobile-table' : ''
                        }`}
                      >
                        {isMobile && (
                          <div className="admin-quantity-mobile-table-head" aria-hidden="true">
                            <span>Quantidade</span>
                            <span>Preço</span>
                            <span />
                          </div>
                        )}
                        {quantityPrices.map((row, index) => {
                          const rowErrors = getQuantityRowErrors(row, minCountMap);
                          const rowErrorList = getQuantityRowErrorList(row, minCountMap);
                          const noMax = row.max_quantity === null;
                          return (
                            <div
                              key={`row-${row.id}`}
                              className={`admin-card admin-quantity-card admin-quantity-card-compact${
                                isMobile ? ' admin-quantity-card-mobile' : ''
                              }`}
                            >
                              {isMobile ? (
                                <>
                                  <div className="admin-quantity-mobile-table-row">
                                    <div className="admin-quantity-mobile-table-cell">
                                      <span className="admin-quantity-mobile-table-value-tag">
                                        De {row.min_quantity} | {noMax ? 'Até sem máximo' : `Até ${row.max_quantity} unidades`}
                                      </span>
                                    </div>
                                    <div className="admin-quantity-mobile-table-cell">
                                      <span className="admin-quantity-mobile-table-value-tag is-price">
                                        {formatCurrencyFromCents(row.unit_price_cents)}/un
                                      </span>
                                    </div>
                                    <div className="admin-quantity-mobile-table-cell admin-quantity-mobile-table-cell-delete">
                                      <button
                                        type="button"
                                        className="admin-quantity-remove-icon-button"
                                        onClick={() => handleRemoveQuantityPrice(index)}
                                        aria-label="Remover faixa"
                                        title="Remover faixa"
                                      >
                                        <FaTrashCan aria-hidden="true" />
                                      </button>
                                    </div>
                                  </div>
                                  {rowErrorList.length > 0 && (
                                    <small className="admin-field-error">{rowErrorList.join(' ')}</small>
                                  )}
                                </>
                              ) : (
                                <>
                                  <div className="admin-quantity-grid">
                                    <label className="admin-field">
                                      <span>A partir de</span>
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
                                      <span>Até</span>
                                      <input
                                        type="number"
                                        min={row.min_quantity || 1}
                                        value={row.max_quantity ?? ''}
                                        onChange={(e) =>
                                          handleQuantityPriceChange(index, 'max_quantity', e.target.value)
                                        }
                                        className={`admin-input${rowErrors.max.length ? ' has-error' : ''}`}
                                        aria-invalid={rowErrors.max.length > 0}
                                        aria-label="Até"
                                        placeholder="Sem máximo"
                                        disabled={noMax}
                                      />
                                      <div className="admin-quantity-toggle">
                                        <label className="admin-quantity-toggle-label">
                                          <input
                                            type="checkbox"
                                            checked={noMax}
                                            onChange={(e) => handleToggleMaxQuantity(index, e.target.checked)}
                                          />
                                          <span>Sem máximo</span>
                                        </label>
                                      </div>
                                      {rowErrors.max.length > 0 && (
                                        <small className="admin-field-error">{rowErrors.max.join(' ')}</small>
                                      )}
                                    </div>
                                    <label className="admin-field">
                                      <span>Preço por unidade</span>
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
                                      {rowErrors.price.length > 0 && (
                                        <small className="admin-field-error">{rowErrors.price.join(' ')}</small>
                                      )}
                                    </label>
                                  </div>
                                  <div className="admin-quantity-footer admin-quantity-footer-compact">
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
                                      Remover
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                  {isMobile && <div className="admin-mobile-section-divider" aria-hidden="true" />}
                </>
              )}

              {(isMobile || currentStep === 2) && (
                <section className="admin-step-panel admin-step-panel-custom admin-step-panel-custom-surface">
                  <div
                    className={`admin-step-header admin-step-header-compact${
                      isMobile ? ' admin-step-header-mobile-centered admin-step-header-custom-centered' : ''
                    }`}
                  >
                    <div>
                      <h3 className="admin-section-title">
                        Customização do cliente
                      </h3>
                      <span className="admin-step-count">{questionsSummary}</span>
                    </div>
                  </div>

                  <div
                    className={`admin-card-grid admin-card-grid-custom-questions${
                      isMobile ? ' admin-question-mobile-table' : ''
                    }`}
                  >
                    {isMobile && fields.length > 0 && (
                      <div className="admin-question-mobile-table-head" aria-hidden="true">
                        <span>Pergunta</span>
                        <span>Tipo</span>
                        <span>Opções</span>
                      </div>
                    )}
                    {fields.map((field, index) => {
                      const questionLabel = field.label?.trim() ? field.label : `Pergunta ${index + 1}`;
                      const questionTypeLabel =
                        DETAIL_INPUT_TYPES.find((typeOption) => typeOption.value === field.input_type)?.label ?? 'Texto';
                      const optionCount = isOptionBasedInputType(field.input_type) ? field.options.length : 0;
                      const optionLabel = `${optionCount} ${optionCount === 1 ? 'opção criada' : 'opções criadas'}`;

                      return (
                        <details
                          key={field.clientId}
                          name="question-editor"
                          open={openQuestionId === field.clientId}
                          className={isMobile ? 'admin-question-mobile-table-item' : undefined}
                        >
                          <summary
                            className={
                              isMobile
                                ? 'admin-question-mobile-table-row'
                                : 'admin-detail-card admin-detail-card-question-summary'
                            }
                            onClick={(event) => {
                              event.preventDefault();
                              setOpenQuestionId((prev) =>
                                prev === field.clientId ? null : (field.clientId ?? null)
                              );
                            }}
                          >
                            {isMobile ? (
                              <>
                                <span className="admin-question-mobile-table-cell admin-question-mobile-table-cell-title">
                                  {questionLabel}
                                </span>
                                <span className="admin-question-mobile-table-cell">
                                  {questionTypeLabel}
                                </span>
                                <span className="admin-question-mobile-table-cell">
                                  {optionCount}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="admin-section-kicker">Pergunta {index + 1}</span>
                                <h4 className="admin-card-title-custom">{questionLabel}</h4>
                                <span className="admin-helper-text admin-question-summary-helper">{optionLabel}</span>
                              </>
                            )}
                          </summary>

                          <div
                            className="admin-quantity-mobile-overlay admin-question-edit-overlay"
                            role="presentation"
                            onClick={handleCloseQuestion}
                          >
                            <div
                              className="admin-quantity-mobile-popover admin-question-edit-popover"
                              role="dialog"
                              aria-modal="true"
                              aria-label={`Editar pergunta ${index + 1}`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <div className="admin-quantity-mobile-popover-header">
                                <div className="admin-quantity-mobile-popover-title-block">
                                  <p className="admin-quantity-mobile-popover-kicker">Pergunta {index + 1}</p>
                                  <h4 className="admin-quantity-mobile-popover-title">Editar pergunta</h4>
                                </div>
                                <button
                                  type="button"
                                  className="admin-modal-close-icon admin-quantity-mobile-close"
                                  aria-label="Fechar formulário"
                                  onClick={handleCloseQuestion}
                                >
                                  <FaXmark aria-hidden="true" />
                                </button>
                              </div>

                              <label className="admin-field" aria-label="Pergunta">
                                <span>Pergunta</span>
                                <input
                                  type="text"
                                  value={field.label}
                                  onChange={(event) => handleUpdateField(field.clientId!, 'label', event.target.value)}
                                  className="admin-input"
                                  placeholder="Ex.: Escolha o recheio"
                                />
                              </label>

                              <label className="admin-field" aria-label="Tipo">
                                <span>Tipo</span>
                                <select
                                  value={field.input_type}
                                  onChange={(event) =>
                                    handleUpdateField(field.clientId!, 'input_type', event.target.value)
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

                              {isOptionBasedInputType(field.input_type) && (
                                <div className="admin-quantity-mobile-toggle-line admin-mobile-question-options-section">
                                  <div className="admin-mobile-question-options-header">
                                    <button
                                      type="button"
                                      className="admin-button-outline admin-button-small"
                                      onClick={() => handleAddOption(field.clientId!)}
                                    >
                                      Adicionar opção
                                    </button>
                                  </div>
                                  <small className="admin-helper-text admin-mobile-question-options-helper">
                                    Acréscimo soma ao valor base por unidade.
                                  </small>

                                  <div className="admin-mobile-question-options">
                                    {field.options.length === 0 ? (
                                      <div className="admin-empty admin-mobile-question-options-empty">
                                        Nenhuma opção cadastrada.
                                      </div>
                                    ) : (
                                      field.options.map((option, optionIndex) => (
                                        <div key={option.clientId} className="admin-mobile-question-option-row">
                                          <div className="admin-mobile-question-option-top">
                                            <span className="admin-section-kicker">Opção {optionIndex + 1}</span>
                                            <button
                                              type="button"
                                              className="admin-quantity-remove-icon-button"
                                              onClick={() => handleRemoveOption(field.clientId!, option.clientId!)}
                                              aria-label={`Remover opção ${optionIndex + 1}`}
                                            >
                                              <FaTrashCan aria-hidden="true" />
                                            </button>
                                          </div>

                                          <label className="admin-field">
                                            <span>Nome da opção</span>
                                            <input
                                              type="text"
                                              value={option.label}
                                              onChange={(event) =>
                                                handleUpdateOption(
                                                  field.clientId!,
                                                  option.clientId!,
                                                  'label',
                                                  event.target.value
                                                )
                                              }
                                              className="admin-input"
                                              placeholder="Ex.: Brigadeiro branco"
                                            />
                                          </label>

                                          <label className="admin-field admin-quantity-mobile-price-field">
                                            <span>Acréscimo</span>
                                            <div className="admin-quantity-price-input-wrap">
                                              <span className="admin-quantity-price-prefix">R$</span>
                                              <input
                                                type="text"
                                                inputMode="decimal"
                                                value={
                                                  option.extraPriceInput ??
                                                  centsToInput(option.extra_price_delta_cents ?? 0)
                                                }
                                                onChange={(event) =>
                                                  handleOptionPriceInputChange(
                                                    field.clientId!,
                                                    option.clientId!,
                                                    event.target.value
                                                  )
                                                }
                                                onBlur={() =>
                                                  handleOptionPriceInputBlur(field.clientId!, option.clientId!)
                                                }
                                                className="admin-input"
                                                placeholder="0,00"
                                              />
                                            </div>
                                          </label>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="admin-quantity-mobile-toggle-line admin-mobile-question-switches">
                                <label className="admin-quantity-mobile-switch">
                                  <span className="admin-quantity-mobile-switch-text">Obrigatório</span>
                                  <span className="admin-switch">
                                    <input
                                      type="checkbox"
                                      checked={field.is_required}
                                      onChange={(event) =>
                                        handleUpdateField(field.clientId!, 'is_required', event.target.checked)
                                      }
                                    />
                                    <span className="admin-switch-track" aria-hidden="true" />
                                  </span>
                                </label>
                                <label className="admin-quantity-mobile-switch">
                                  <span className="admin-quantity-mobile-switch-text">Ativo</span>
                                  <span className="admin-switch">
                                    <input
                                      type="checkbox"
                                      checked={field.is_active}
                                      onChange={(event) =>
                                        handleUpdateField(field.clientId!, 'is_active', event.target.checked)
                                      }
                                    />
                                    <span className="admin-switch-track" aria-hidden="true" />
                                  </span>
                                </label>
                              </div>

                              <details className="admin-advanced-panel admin-question-editor-advanced">
                                <summary>Avançado</summary>
                                <div className="admin-advanced-body admin-advanced-fields">
                                  <label className="admin-field">
                                    <span>Identificador interno</span>
                                    <input
                                      type="text"
                                      value={field.field_key}
                                      onChange={(event) =>
                                        handleUpdateField(field.clientId!, 'field_key', event.target.value)
                                      }
                                      className="admin-input"
                                      placeholder="Ex.: recheio"
                                    />
                                  </label>
                                  <label className="admin-field">
                                    <span>Ordem</span>
                                    <input
                                      type="number"
                                      value={field.sort_order}
                                      onChange={(event) =>
                                        handleUpdateField(field.clientId!, 'sort_order', event.target.value)
                                      }
                                      className="admin-input"
                                    />
                                  </label>
                                </div>
                              </details>

                              {deleteQuestionId === field.clientId && (
                                <div className="admin-modal-unsaved-confirm admin-question-delete-confirm" role="alertdialog">
                                  <p>Tem certeza que deseja excluir esta pergunta? Essa ação não pode ser desfeita.</p>
                                  <div className="admin-modal-unsaved-actions">
                                    <button
                                      type="button"
                                      className="admin-button-outline"
                                      onClick={() => setDeleteQuestionId(null)}
                                    >
                                      Voltar
                                    </button>
                                    <button
                                      type="button"
                                      className="admin-button admin-button-danger"
                                      onClick={() => {
                                        handleRemoveField(field.clientId!);
                                        setDeleteQuestionId(null);
                                        setOpenQuestionId(null);
                                      }}
                                    >
                                      Excluir pergunta
                                    </button>
                                  </div>
                                </div>
                              )}

                              <div className="admin-quantity-mobile-popover-actions admin-question-edit-actions">
                                <button
                                  type="button"
                                  className="admin-button-outline admin-button-danger-outline"
                                  onClick={() => setDeleteQuestionId(field.clientId!)}
                                >
                                  Excluir pergunta
                                </button>
                                <button type="button" className="admin-button" onClick={handleSave}>
                                  Salvar pergunta
                                </button>
                              </div>
                            </div>
                          </div>
                        </details>
                      );
                    })}

                    {isMobile ? (
                      <>
                        <button
                          type="button"
                          className="admin-button-outline admin-question-mobile-table-add"
                          onClick={handleOpenMobileQuestionForm}
                        >
                          + Nova pergunta
                        </button>

                        {mobileQuestionForm.isOpen && (
                          <div
                            className="admin-quantity-mobile-overlay"
                            role="presentation"
                            onClick={handleCloseMobileQuestionForm}
                          >
                            <div
                              className="admin-quantity-mobile-popover"
                              role="dialog"
                              aria-modal="true"
                              aria-label="Nova pergunta"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <div className="admin-quantity-mobile-popover-header">
                                <div className="admin-quantity-mobile-popover-title-block">
                                  <h4 className="admin-quantity-mobile-popover-title">Nova pergunta</h4>
                                </div>
                                <button
                                  type="button"
                                  className="admin-modal-close-icon admin-quantity-mobile-close"
                                  aria-label="Fechar formulário"
                                  onClick={handleCloseMobileQuestionForm}
                                >
                                  <FaXmark aria-hidden="true" />
                                </button>
                              </div>

                              <label className="admin-field">
                                <span>Pergunta</span>
                                <input
                                  type="text"
                                  value={mobileQuestionForm.label}
                                  onChange={(event) =>
                                    handleMobileQuestionFormChange('label', event.target.value)
                                  }
                                  className={`admin-input${
                                    mobileQuestionForm.errorMessage ? ' has-error' : ''
                                  }`}
                                  aria-invalid={Boolean(mobileQuestionForm.errorMessage)}
                                  placeholder="Ex.: Escolha o recheio"
                                />
                              </label>

                              <label className="admin-field">
                                <span>Tipo</span>
                                <select
                                  value={mobileQuestionForm.inputType}
                                  onChange={(event) =>
                                    handleMobileQuestionFormChange(
                                      'inputType',
                                      event.target.value as ProductDetailField['input_type']
                                    )
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

                              {isOptionBasedInputType(mobileQuestionForm.inputType) && (
                                <div className="admin-quantity-mobile-toggle-line admin-mobile-question-options-section">
                                  <div className="admin-mobile-question-options-header">
                                    <button
                                      type="button"
                                      className="admin-button-outline admin-button-small"
                                      onClick={handleAddMobileQuestionOption}
                                    >
                                      Adicionar Opção
                                    </button>
                                  </div>

                                  <div className="admin-mobile-question-options">
                                    {mobileQuestionForm.options.length === 0 ? (
                                      <div className="admin-empty admin-mobile-question-options-empty">
                                        Nenhuma opção cadastrada.
                                      </div>
                                    ) : (
                                      mobileQuestionForm.options.map((option, optionIndex) => (
                                        <div
                                          key={option.clientId}
                                          className="admin-mobile-question-option-row"
                                        >
                                          <div className="admin-mobile-question-option-top">
                                            <span className="admin-section-kicker">
                                              Opção {optionIndex + 1}
                                            </span>
                                            <button
                                              type="button"
                                              className="admin-quantity-remove-icon-button"
                                              onClick={() =>
                                                option.clientId &&
                                                handleRemoveMobileQuestionOption(option.clientId)
                                              }
                                              aria-label={`Remover opção ${optionIndex + 1}`}
                                            >
                                              <FaTrashCan aria-hidden="true" />
                                            </button>
                                          </div>

                                          <label className="admin-field">
                                            <span>Nome da opção</span>
                                            <input
                                              type="text"
                                              value={option.label}
                                              onChange={(event) =>
                                                option.clientId &&
                                                handleUpdateMobileQuestionOption(
                                                  option.clientId,
                                                  'label',
                                                  event.target.value
                                                )
                                              }
                                              className="admin-input"
                                              placeholder="Ex.: Brigadeiro branco"
                                            />
                                          </label>

                                          <label className="admin-field admin-quantity-mobile-price-field">
                                            <span>Acréscimo</span>
                                            <div className="admin-quantity-price-input-wrap">
                                              <span className="admin-quantity-price-prefix">R$</span>
                                              <input
                                                type="text"
                                                inputMode="decimal"
                                                value={
                                                  option.extraPriceInput ??
                                                  centsToInput(option.extra_price_delta_cents ?? 0)
                                                }
                                                onChange={(event) =>
                                                  option.clientId &&
                                                  handleMobileQuestionOptionPriceChange(
                                                    option.clientId,
                                                    event.target.value
                                                  )
                                                }
                                                onBlur={() =>
                                                  option.clientId &&
                                                  handleMobileQuestionOptionPriceBlur(option.clientId)
                                                }
                                                className="admin-input"
                                                placeholder="0,00"
                                              />
                                            </div>
                                          </label>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="admin-quantity-mobile-toggle-line admin-mobile-question-switches">
                                <label className="admin-quantity-mobile-switch">
                                  <span className="admin-quantity-mobile-switch-text">Obrigatório</span>
                                  <span className="admin-switch">
                                    <input
                                      type="checkbox"
                                      checked={mobileQuestionForm.isRequired}
                                      onChange={(event) =>
                                        handleMobileQuestionFormChange('isRequired', event.target.checked)
                                      }
                                    />
                                    <span className="admin-switch-track" aria-hidden="true" />
                                  </span>
                                </label>
                                <label className="admin-quantity-mobile-switch">
                                  <span className="admin-quantity-mobile-switch-text">Ativo</span>
                                  <span className="admin-switch">
                                    <input
                                      type="checkbox"
                                      checked={mobileQuestionForm.isActive}
                                      onChange={(event) =>
                                        handleMobileQuestionFormChange('isActive', event.target.checked)
                                      }
                                    />
                                    <span className="admin-switch-track" aria-hidden="true" />
                                  </span>
                                </label>
                              </div>

                              {mobileQuestionForm.errorMessage && (
                                <small className="admin-field-error">{mobileQuestionForm.errorMessage}</small>
                              )}

                              <div className="admin-quantity-mobile-popover-actions">
                                <button type="button" className="admin-button" onClick={handleSubmitMobileQuestionForm}>
                                  Adicionar pergunta
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <button type="button" className="admin-detail-card" onClick={handleAddField}>
                        <span className="admin-section-kicker">Nova pergunta</span>
                        <h4 className="admin-card-title-custom">+ Clique aqui para adicionar uma nova pergunta</h4>
                        <span className="admin-helper-text admin-question-summary-helper">Adicionar</span>
                      </button>
                    )}
                  </div>
                </section>
              )}

              {isMobile && advancedCard}
            </div>

            <footer
              className={`admin-modal-footer admin-modal-footer-fixed${isMobile ? ' admin-modal-footer-mobile' : ''}`}
            >
              {isMobile && showUnsavedConfirm && (
                <div className="admin-modal-unsaved-confirm" role="alertdialog" aria-live="polite">
                  <p>Existem itens não salvos, deseja cancelar as modificações?</p>
                  <div className="admin-modal-unsaved-actions">
                    <button
                      type="button"
                      className="admin-button-outline admin-button-danger-outline"
                      onClick={onClose}
                    >
                      Sair sem salvar
                    </button>
                    <button
                      type="button"
                      className="admin-button-ghost"
                      onClick={() => setShowUnsavedConfirm(false)}
                    >
                      Continuar editando
                    </button>
                  </div>
                </div>
              )}
              <div className={`admin-footer-actions${isMobile ? ' admin-footer-actions-mobile' : ''}`}>
                {!isMobile && (
                  <button type="button" className="admin-button-ghost" onClick={requestClose}>
                    Sair sem salvar
                  </button>
                )}
                {!isCreateMode &&
                  (isMobile ? (
                    <button
                      type="button"
                      className="admin-button-icon-delete"
                      onClick={handleSoftDelete}
                      disabled={deleting || saving || imageUploading}
                      aria-label="Excluir produto"
                      title="Excluir produto"
                    >
                      <FaTrashCan aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="admin-button-outline admin-button-danger-outline"
                      onClick={handleSoftDelete}
                      disabled={deleting || saving || imageUploading}
                    >
                      {deleting ? 'Excluindo...' : 'Excluir produto'}
                    </button>
                  ))}
                <button
                  type="button"
                  className="admin-button"
                  onClick={handleSave}
                  disabled={saving || imageUploading || deleting}
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
              <div className="admin-modal-footer-meta">
                <span className={`admin-save-status ${saveStatusClass} admin-save-status-micro`}>
                  {saveStatus}
                </span>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}


