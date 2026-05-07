import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { FaBoxOpen, FaLayerGroup, FaMagnifyingGlass, FaPlus, FaTrashCan, FaXmark } from 'react-icons/fa6';
import CategoryModal from '../../components/admin/CategoryModal';
import ProductEditModal from '../../components/admin/ProductEditModal';
import {
  AdminBadge,
  AdminButton,
  AdminEmptyState,
  AdminPageHeader,
} from '../../components/admin/AdminPrimitives';
import { useAuth } from '../../lib/auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import type { Category } from '../../types/product';

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category_id: string | null;
  base_price_cents: number;
  min_quantity: number | null;
  is_active: boolean;
};
type CategoryRow = Category & {
  description: string | null;
  image_url: string | null;
  sort_order: number | null;
  is_active: boolean;
};

type MobileSectionHeaderProps = {
  helper: string;
  title: string;
};

type MobileProductCardProps = {
  categoryName: string;
  onEdit: (id: string) => void;
  product: ProductRow;
};

type MobileCategoryCardProps = {
  category: CategoryRow;
  deleting: boolean;
  onDelete: (id: string) => void;
  onEdit: (category: CategoryRow) => void;
};

type DesktopProductCardProps = {
  categoryName: string;
  deleting: boolean;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  product: ProductRow;
};

type DesktopCategoryCardProps = {
  category: CategoryRow;
  deleting: boolean;
  onDelete: (id: string) => void;
  onEdit: (category: CategoryRow) => void;
};

type NameSortDirection = 'asc' | 'desc';
type PriceSortDirection = 'asc' | 'desc';

function formatCurrency(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function MobileSectionHeader({ helper, title }: MobileSectionHeaderProps) {
  return (
    <div className="admin-products-mobile-section-header">
      <h2 className="admin-products-mobile-section-title">{title}</h2>
      <p className="admin-products-mobile-section-helper">{helper}</p>
    </div>
  );
}

function MobileProductCard({ categoryName, onEdit, product }: MobileProductCardProps) {
  return (
    <article className="admin-products-mobile-card">
      <div className="admin-products-mobile-avatar" aria-hidden="true">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} />
        ) : (
          <div className="admin-products-mobile-avatar-fallback">
            <img src="/logo.svg" alt="" />
            <span>Sem imagem disponível</span>
          </div>
        )}
      </div>

      <h3 className="admin-products-mobile-card-title" title={product.name}>
        {product.name}
      </h3>
      <p className="admin-products-mobile-card-price" title={formatCurrency(product.base_price_cents)}>
        {formatCurrency(product.base_price_cents)}
      </p>
      <p className="admin-products-mobile-card-meta admin-products-mobile-card-meta-product" title={categoryName}>
        {categoryName}
      </p>

      <AdminBadge
        tone={product.is_active ? 'success' : 'danger'}
        className="admin-products-mobile-status"
      >
        {product.is_active ? 'Ativo' : 'Inativo'}
      </AdminBadge>

      <AdminButton
        size="sm"
        variant="primary"
        className="admin-products-mobile-edit"
        onClick={() => onEdit(product.id)}
      >
        Editar
      </AdminButton>
    </article>
  );
}

function MobileCategoryCard({ category, deleting, onDelete, onEdit }: MobileCategoryCardProps) {
  const categorySummary = category.slug?.trim() || category.description?.trim() || 'Sem resumo';

  return (
    <article className="admin-products-mobile-card">
      <div className="admin-products-mobile-avatar" aria-hidden="true">
        {category.image_url ? (
          <img src={category.image_url} alt={category.name} />
        ) : (
          <div className="admin-products-mobile-avatar-fallback">
            <img src="/logo.svg" alt="" />
            <span>Sem imagem disponível</span>
          </div>
        )}
      </div>

      <h3 className="admin-products-mobile-card-title" title={category.name}>
        {category.name}
      </h3>
      <p className="admin-products-mobile-card-meta admin-products-mobile-card-meta-category" title={categorySummary}>
        {categorySummary}
      </p>

      <AdminBadge
        tone={category.is_active ? 'success' : 'danger'}
        className="admin-products-mobile-status"
      >
        {category.is_active ? 'Ativa' : 'Inativa'}
      </AdminBadge>

      <AdminButton
        size="sm"
        variant="primary"
        className="admin-products-mobile-edit"
        onClick={() => onEdit(category)}
      >
        Editar
      </AdminButton>
      <AdminButton
        size="sm"
        variant="dangerGhost"
        className="admin-products-mobile-delete"
        onClick={() => onDelete(category.id)}
        disabled={deleting}
      >
        {deleting ? 'Excluindo...' : 'Excluir'}
      </AdminButton>
    </article>
  );
}

function DesktopProductCard({ categoryName, deleting, onDelete, onEdit, product }: DesktopProductCardProps) {
  return (
    <article className="admin-products-desktop-card" role="listitem">
      <div className="admin-products-desktop-media" aria-hidden="true">
        {product.image_url ? (
          <img src={product.image_url} alt="" />
        ) : (
          <div className="admin-products-desktop-media-fallback">
            <img src="/logo.svg" alt="" />
            <span>Sweet Child</span>
          </div>
        )}
      </div>
      <div className="admin-products-desktop-card-body">
        <div className="admin-products-desktop-card-top">
          <AdminBadge tone={product.is_active ? 'success' : 'danger'}>
            {product.is_active ? 'Ativo' : 'Inativo'}
          </AdminBadge>
          <span className="admin-products-desktop-price">{formatCurrency(product.base_price_cents)}</span>
        </div>
        <div className="admin-products-desktop-copy">
          <h3 title={product.name}>{product.name}</h3>
          <p title={product.description ?? 'Sem descrição'}>{product.description ?? 'Sem descrição'}</p>
        </div>
        <div className="admin-products-desktop-meta">
          <span>Categoria</span>
          <strong title={categoryName}>{categoryName}</strong>
        </div>
      </div>
      <div className="admin-products-desktop-card-actions">
        <AdminButton size="sm" variant="secondary" onClick={() => onEdit(product.id)} title="Editar produto">
          Editar
        </AdminButton>
        <AdminButton
          size="sm"
          variant="dangerGhost"
          onClick={() => onDelete(product.id)}
          disabled={deleting}
          title="Excluir produto"
        >
          {deleting ? 'Excluindo...' : 'Excluir'}
        </AdminButton>
      </div>
    </article>
  );
}

function DesktopCategoryCard({ category, deleting, onDelete, onEdit }: DesktopCategoryCardProps) {
  const categorySummary = category.description?.trim() || category.slug?.trim() || 'Sem descrição';

  return (
    <article className="admin-products-desktop-card admin-products-desktop-category-card" role="listitem">
      <div className="admin-products-desktop-media" aria-hidden="true">
        {category.image_url ? (
          <img src={category.image_url} alt="" />
        ) : (
          <div className="admin-products-desktop-media-fallback">
            <img src="/logo.svg" alt="" />
            <span>Categoria</span>
          </div>
        )}
      </div>
      <div className="admin-products-desktop-card-body">
        <div className="admin-products-desktop-card-top">
          <AdminBadge tone={category.is_active ? 'success' : 'danger'}>
            {category.is_active ? 'Ativa' : 'Inativa'}
          </AdminBadge>
          <span className="admin-products-desktop-order">#{category.sort_order ?? 0}</span>
        </div>
        <div className="admin-products-desktop-copy">
          <h3 title={category.name}>{category.name}</h3>
          <p title={categorySummary}>{categorySummary}</p>
        </div>
        <div className="admin-products-desktop-meta">
          <span>Slug</span>
          <strong title={category.slug}>{category.slug}</strong>
        </div>
      </div>
      <div className="admin-products-desktop-card-actions">
        <AdminButton size="sm" variant="secondary" onClick={() => onEdit(category)} title="Editar categoria">
          Editar
        </AdminButton>
        <button
          type="button"
          className="admin-button-icon-delete"
          onClick={() => onDelete(category.id)}
          disabled={deleting}
          title={deleting ? 'Excluindo categoria...' : 'Excluir categoria'}
          aria-label={deleting ? 'Excluindo categoria...' : 'Excluir categoria'}
          aria-busy={deleting}
        >
          <FaTrashCan aria-hidden="true" focusable="false" />
        </button>
      </div>
    </article>
  );
}

function DesktopCatalogSkeletonCard() {
  return (
    <div className="admin-products-desktop-card admin-products-desktop-card-skeleton admin-row-skeleton" aria-hidden="true">
      <div className="admin-products-desktop-media admin-skeleton-block" />
      <div className="admin-products-desktop-card-body">
        <div className="admin-products-desktop-card-top">
          <div className="admin-skeleton-pill" />
          <div className="admin-skeleton-line short" />
        </div>
        <div className="admin-skeleton-line" />
        <div className="admin-skeleton-line short" />
        <div className="admin-skeleton-block" />
      </div>
      <div className="admin-products-desktop-card-actions">
        <div className="admin-skeleton-button" />
        <div className="admin-skeleton-button ghost" />
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [modalProductId, setModalProductId] = useState<string | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterPriceMin, setFilterPriceMin] = useState<number | null>(null);
  const [filterPriceMax, setFilterPriceMax] = useState<number | null>(null);
  const [draftFilterName, setDraftFilterName] = useState('');
  const [draftFilterCategoryId, setDraftFilterCategoryId] = useState('');
  const [draftFilterPriceMin, setDraftFilterPriceMin] = useState(0);
  const [draftFilterPriceMax, setDraftFilterPriceMax] = useState(0);
  const [nameSortDirection, setNameSortDirection] = useState<NameSortDirection>('asc');
  const [priceSortDirection, setPriceSortDirection] = useState<PriceSortDirection>('desc');
  const { withAuthRetry } = useAuth();

  const skeletonRows = useMemo(() => Array.from({ length: 3 }, (_, index) => index), []);
  const categorySkeletonRows = useMemo(() => Array.from({ length: 2 }, (_, index) => index), []);
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  const maxProductPriceCents = useMemo(
    () => products.reduce((max, product) => Math.max(max, product.base_price_cents ?? 0), 0),
    [products]
  );

  const hasActiveFilter = useMemo(
    () => Boolean(filterName.trim() || filterCategoryId || filterPriceMin !== null || filterPriceMax !== null),
    [filterCategoryId, filterName, filterPriceMax, filterPriceMin]
  );

  const filteredProducts = useMemo(() => {
    const normalizedName = filterName.trim().toLowerCase();

    return products.filter((product) => {
      if (normalizedName && !product.name.toLowerCase().includes(normalizedName)) {
        return false;
      }

      if (filterCategoryId && product.category_id !== filterCategoryId) {
        return false;
      }

      if (filterPriceMin !== null && product.base_price_cents < filterPriceMin) {
        return false;
      }

      if (filterPriceMax !== null && product.base_price_cents > filterPriceMax) {
        return false;
      }

      return true;
    });
  }, [filterCategoryId, filterName, filterPriceMax, filterPriceMin, products]);

  const sortedFilteredProducts = useMemo(() => {
    const rows = [...filteredProducts];
    rows.sort((a, b) => {
      const priceDelta = a.base_price_cents - b.base_price_cents;
      if (priceDelta !== 0) {
        return priceSortDirection === 'asc' ? priceDelta : -priceDelta;
      }

      const nameDelta = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      if (nameDelta !== 0) {
        return nameSortDirection === 'asc' ? nameDelta : -nameDelta;
      }

      return 0;
    });
    return rows;
  }, [filteredProducts, nameSortDirection, priceSortDirection]);

  const filteredCategories = useMemo(() => {
    if (!hasActiveFilter) return categories;

    const visibleCategoryIds = new Set(
      filteredProducts.map((product) => product.category_id).filter((categoryId): categoryId is string => Boolean(categoryId))
    );

    return categories.filter((category) => visibleCategoryIds.has(category.id));
  }, [categories, filteredProducts, hasActiveFilter]);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError(null);
    const { data, error: fetchError } = await withAuthRetry(
      () =>
        supabase
          .from('categories')
          .select('id, name, slug, description, image_url, sort_order, is_active')
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
      { label: 'load-categories' }
    );

    if (fetchError) {
      setCategoriesError('Não foi possível carregar as categorias agora.');
      setCategoriesLoading(false);
      return;
    }

    setCategories((data ?? []) as CategoryRow[]);
    setCategoriesLoading(false);
  }, [withAuthRetry]);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const { data, error: fetchError } = await withAuthRetry(
      () =>
        supabase
          .from('products')
          .select(
            ['id', 'name', 'description', 'image_url', 'category_id', 'base_price_cents', 'min_quantity', 'is_active'].join(
              ', '
            )
          )
          .eq('is_active', true)
          .order('name', { ascending: true }),
      { label: 'load-products' }
    );

    if (fetchError) {
      setError('Não foi possível carregar os produtos agora.');
      setIsLoading(false);
      return;
    }

    const rows = (data ?? []) as unknown as ProductRow[];
    setProducts(rows);
    setIsLoading(false);
  }, [withAuthRetry]);

  useEffect(() => {
    void loadCategories();
    void loadProducts();
  }, [loadCategories, loadProducts]);

  useEffect(() => {
    if (!isFabMenuOpen && !isFilterModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsFabMenuOpen(false);
      setIsFilterModalOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEsc);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isFabMenuOpen, isFilterModalOpen]);

  const closeModal = () => {
    setModalProductId(null);
    setIsCreateMode(false);
  };

  const closeCategoryModal = () => {
    setCategoryModalOpen(false);
    setEditingCategory(null);
  };

  const handleOpenNew = () => {
    setSuccessMessage(null);
    setModalProductId(null);
    setIsCreateMode(true);
  };

  const handleOpenNewCategory = () => {
    setSuccessMessage(null);
    setCategoriesError(null);
    setEditingCategory(null);
    setCategoryModalOpen(true);
  };

  const handleEditCategory = (category: CategoryRow) => {
    setSuccessMessage(null);
    setCategoriesError(null);
    setEditingCategory(category);
    setCategoryModalOpen(true);
  };

  const handleEdit = (id: string) => {
    setSuccessMessage(null);
    setModalProductId(id);
    setIsCreateMode(false);
  };

  const handleDeleteProduct = async (id: string) => {
    const confirmed = window.confirm('Deseja excluir este produto definitivamente? Esta ação remove o produto do banco de dados.');
    if (!confirmed) return;
    setDeletingId(id);
    setError(null);
    setSuccessMessage(null);
    const { error: deleteError } = await withAuthRetry(
      () => supabase.rpc('admin_delete_product', { p_product_id: id }),
      { label: 'delete-product' }
    );
    if (deleteError) {
      setError('Não foi possível excluir o produto agora.');
    } else {
      setSuccessMessage('Produto excluído definitivamente.');
      await loadProducts();
    }
    setDeletingId(null);
  };

  const handleCategoryDelete = async (id: string) => {
    const category = categoryById.get(id);
    if (!category) return;

    setDeletingCategoryId(id);
    setCategoriesError(null);
    setSuccessMessage(null);

    try {
      const { count, error: countError } = await withAuthRetry(
        () =>
          supabase
            .from('products')
            .select('id', { count: 'exact', head: true })
            .eq('category_id', id),
        { label: 'count-products-by-category' }
      );

      if (countError) throw countError;

      const linkedProductsCount = count ?? 0;
      const warning =
        linkedProductsCount > 0
          ? `Excluir a categoria "${category.name}" também vai excluir definitivamente ${linkedProductsCount} produto(s) vinculado(s). Deseja continuar?`
          : `Excluir a categoria "${category.name}" definitivamente?`;

      const confirmed = window.confirm(warning);
      if (!confirmed) {
        setDeletingCategoryId(null);
        return;
      }

      const { data: deleteResult, error: deleteError } = await withAuthRetry(
        () => supabase.rpc('admin_delete_category', { p_category_id: id }),
        { label: 'delete-category' }
      );

      if (deleteError) {
        setCategoriesError('Não foi possível excluir a categoria agora.');
      } else {
        const deletedProductsCount =
          Array.isArray(deleteResult) && deleteResult[0]?.deleted_products_count !== undefined
            ? Number(deleteResult[0].deleted_products_count)
            : linkedProductsCount;
        setSuccessMessage(
          deletedProductsCount > 0
            ? `Categoria excluída definitivamente com ${deletedProductsCount} produto(s).`
            : 'Categoria excluída definitivamente.'
        );
        await loadCategories();
        await loadProducts();
      }
    } catch {
      setCategoriesError('Não foi possível excluir a categoria agora.');
    }

    setDeletingCategoryId(null);
  };

  const openFilterModal = () => {
    const clampedMin = Math.min(filterPriceMin ?? 0, maxProductPriceCents);
    const clampedMax = Math.min(filterPriceMax ?? maxProductPriceCents, maxProductPriceCents);

    setDraftFilterName(filterName);
    setDraftFilterCategoryId(filterCategoryId);
    setDraftFilterPriceMin(Math.min(clampedMin, clampedMax));
    setDraftFilterPriceMax(Math.max(clampedMin, clampedMax));
    setIsFabMenuOpen(false);
    setIsFilterModalOpen(true);
  };

  const toggleFabMenu = () => {
    setIsFabMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        setIsFilterModalOpen(false);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setFilterName('');
    setFilterCategoryId('');
    setFilterPriceMin(null);
    setFilterPriceMax(null);
    setDraftFilterName('');
    setDraftFilterCategoryId('');
    setDraftFilterPriceMin(0);
    setDraftFilterPriceMax(maxProductPriceCents);
  };

  const handleCategorySelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setDraftFilterCategoryId(event.target.value);
  };

  const handleMinRangeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextMin = Number(event.target.value);
    setDraftFilterPriceMin(Math.min(nextMin, draftFilterPriceMax));
  };

  const handleMaxRangeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextMax = Number(event.target.value);
    setDraftFilterPriceMax(Math.max(nextMax, draftFilterPriceMin));
  };

  const handleToggleNameSort = () => {
    setNameSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleApplyFilter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedMin = Math.min(draftFilterPriceMin, draftFilterPriceMax);
    const normalizedMax = Math.max(draftFilterPriceMin, draftFilterPriceMax);
    const hasPriceWindow = maxProductPriceCents > 0;

    setFilterName(draftFilterName.trim());
    setFilterCategoryId(draftFilterCategoryId);
    setFilterPriceMin(hasPriceWindow && normalizedMin > 0 ? normalizedMin : null);
    setFilterPriceMax(hasPriceWindow && normalizedMax < maxProductPriceCents ? normalizedMax : null);
    setIsFilterModalOpen(false);
  };

  const noFilteredProducts = !isLoading && sortedFilteredProducts.length === 0;
  const noFilteredCategories = !categoriesLoading && filteredCategories.length === 0;
  const rangeStartPercent =
    maxProductPriceCents > 0 ? Math.round((Math.min(draftFilterPriceMin, draftFilterPriceMax) / maxProductPriceCents) * 100) : 0;
  const rangeEndPercent =
    maxProductPriceCents > 0 ? Math.round((Math.max(draftFilterPriceMin, draftFilterPriceMax) / maxProductPriceCents) * 100) : 100;

  return (
    <div className="admin-page admin-products-page text-black">
      <AdminPageHeader
        className="admin-products-page-header text-black"
        kicker="Catalogo"
        title="Produtos & Categorias"
        subtitle=""
        actions={
          <AdminButton onClick={handleOpenNew}>
            + Novo produto
          </AdminButton>
        }
      />

      {successMessage && <div className="admin-alert">{successMessage}</div>}
      {error && <div className="admin-inline-error">{error}</div>}
      {categoriesError && <div className="admin-inline-error">{categoriesError}</div>}

      <div className="admin-products-mobile-only">
        <section className="admin-products-mobile-section">
          <MobileSectionHeader
            title="Produtos"
            helper={isLoading ? 'Carregando produtos...' : `${sortedFilteredProducts.length} produto(s)`}
          />

          <div className="flex flex-wrap gap-2 px-1">
            <button
              type="button"
              onClick={handleToggleNameSort}
              className={`
      min-w-[90px] flex-1 sm:flex-none px-4 py-2 rounded-full text-sm font-medium
      transition-all duration-200
      ${nameSortDirection === 'asc'
                  ? 'bg-pink-500 text-white shadow-md ring-2 ring-pink-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
    `}
            >
              {nameSortDirection === 'asc' ? 'A - Z' : 'Z - A'}
            </button>

            <button
              type="button"
              onClick={() => setPriceSortDirection('asc')}
              className={`
      flex-1 px-4 py-2 rounded-full text-sm font-medium text-center
      transition-all duration-200
      ${priceSortDirection === 'asc'
                  ? 'bg-pink-500 text-white shadow-md ring-2 ring-pink-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
    `}
            >
              Menor preço ↑
            </button>

            <button
              type="button"
              onClick={() => setPriceSortDirection('desc')}
              className={`
      flex-1 px-4 py-2 rounded-full text-sm font-medium text-center
      transition-all duration-200
      ${priceSortDirection === 'desc'
                  ? 'bg-pink-500 text-white shadow-md ring-2 ring-pink-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
    `}
            >
              Maior preço ↓
            </button>
          </div>

          <div className="admin-products-mobile-grid" role="list" aria-label="Lista de produtos">
            {isLoading &&
              Array.from({ length: 4 }, (_, index) => (
                <div key={`mobile-product-skeleton-${index}`} className="admin-products-mobile-card admin-row-skeleton">
                  <div className="admin-products-mobile-avatar admin-skeleton-block" />
                  <div className="admin-skeleton-line" />
                  <div className="admin-skeleton-line short" />
                  <div className="admin-skeleton-pill" />
                  <div className="admin-skeleton-button" />
                </div>
              ))}

            {noFilteredProducts && (
              <div className="admin-products-mobile-empty">
                <AdminEmptyState
                  compact
                  icon={<FaBoxOpen />}
                  title="Nenhum produto encontrado"
                  description={
                    hasActiveFilter
                      ? 'Nenhum produto atende aos filtros selecionados.'
                      : 'Crie um novo produto para preencher o catalogo.'
                  }
                />
              </div>
            )}

            {!isLoading &&
              sortedFilteredProducts.map((product) => (
                <MobileProductCard
                  key={product.id}
                  product={product}
                  categoryName={product.category_id ? categoryById.get(product.category_id)?.name ?? 'Sem categoria' : 'Sem categoria'}
                  onEdit={handleEdit}
                />
              ))}
          </div>
        </section>

        <section className="admin-products-mobile-section">
          <MobileSectionHeader
            title="Categorias"
            helper={categoriesLoading ? 'Carregando categorias...' : `${filteredCategories.length} categoria(s)`}
          />

          <div className="admin-products-mobile-grid" role="list" aria-label="Lista de categorias">
            {categoriesLoading &&
              Array.from({ length: 4 }, (_, index) => (
                <div key={`mobile-category-skeleton-${index}`} className="admin-products-mobile-card admin-row-skeleton">
                  <div className="admin-products-mobile-avatar admin-skeleton-block" />
                  <div className="admin-skeleton-line" />
                  <div className="admin-skeleton-line short" />
                  <div className="admin-skeleton-pill" />
                  <div className="admin-skeleton-button" />
                </div>
              ))}

            {noFilteredCategories && (
              <div className="admin-products-mobile-empty">
                <AdminEmptyState
                  compact
                  icon={<FaLayerGroup />}
                  title="Nenhuma categoria encontrada"
                  description={
                    hasActiveFilter
                      ? 'Ajuste o filtro para visualizar outras categorias.'
                      : 'Crie sua primeira categoria para organizar o catalogo.'
                  }
                />
              </div>
            )}

            {!categoriesLoading &&
              filteredCategories.map((category) => (
                <MobileCategoryCard
                  key={category.id}
                  category={category}
                  deleting={deletingCategoryId === category.id}
                  onDelete={handleCategoryDelete}
                  onEdit={handleEditCategory}
                />
              ))}
          </div>
        </section>
      </div>

      <div className="admin-products-desktop-only">
        <section className="admin-products-desktop-panel admin-products-desktop-control-panel">
          <div className="admin-products-desktop-panel-heading">
            <p className="admin-section-kicker">Catalogo</p>
            <h2 className="admin-table-title">Produtos e categorias</h2>
            <p className="admin-table-subtitle">
              {isLoading || categoriesLoading
                ? 'Carregando catalogo...'
                : `${sortedFilteredProducts.length} produto(s) e ${filteredCategories.length} categoria(s) visiveis.`}
            </p>
          </div>

          <div className="admin-products-desktop-controls">
            <label className="admin-field admin-products-desktop-search">
              <span>Buscar produto</span>
              <input
                className="admin-input"
                value={filterName}
                placeholder="Ex.: Brigadeiro premium"
                onChange={(event) => setFilterName(event.target.value)}
              />
            </label>

            <label className="admin-field admin-products-desktop-category-filter">
              <span>Categoria</span>
              <select
                className="admin-select"
                value={filterCategoryId}
                onChange={(event) => setFilterCategoryId(event.target.value)}
              >
                <option value="">Todas as categorias</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="admin-products-desktop-sort-group" aria-label="Ordenacao do catalogo">
              <button
                type="button"
                className={`admin-products-desktop-sort-button${nameSortDirection === 'asc' ? ' is-active' : ''}`}
                onClick={handleToggleNameSort}
              >
                {nameSortDirection === 'asc' ? 'A - Z' : 'Z - A'}
              </button>
              <button
                type="button"
                className={`admin-products-desktop-sort-button${priceSortDirection === 'asc' ? ' is-active' : ''}`}
                onClick={() => setPriceSortDirection('asc')}
              >
                Menor preço
              </button>
              <button
                type="button"
                className={`admin-products-desktop-sort-button${priceSortDirection === 'desc' ? ' is-active' : ''}`}
                onClick={() => setPriceSortDirection('desc')}
              >
                Maior preço
              </button>
            </div>

            <AdminButton
              variant="ghost"
              className="admin-products-desktop-clear"
              onClick={clearFilters}
              disabled={!hasActiveFilter}
            >
              Limpar filtros
            </AdminButton>
          </div>
        </section>

        <section className="admin-products-desktop-panel">
          <div className="admin-products-desktop-section-header">
            <div>
              <p className="admin-section-kicker">Produtos</p>
              <h2 className="admin-table-title">Catalogo ativo</h2>
              <p className="admin-table-subtitle">
                {isLoading ? 'Carregando produtos...' : `${sortedFilteredProducts.length} produto(s) encontrado(s).`}
              </p>
            </div>
            <div className="admin-products-desktop-actions">
              <AdminButton variant="ghost" size="sm" onClick={loadProducts} disabled={isLoading}>
                Atualizar lista
              </AdminButton>
              <AdminButton size="sm" onClick={handleOpenNew}>
                Novo produto
              </AdminButton>
            </div>
          </div>

          <div className="admin-products-desktop-grid" role="list" aria-label="Lista de produtos">
            {isLoading && skeletonRows.map((row) => <DesktopCatalogSkeletonCard key={row} />)}

            {noFilteredProducts && (
              <div className="admin-products-desktop-empty">
                <AdminEmptyState
                  icon={<FaBoxOpen />}
                  title="Nenhum produto encontrado"
                  description={
                    hasActiveFilter
                      ? 'Nenhum produto atende aos filtros selecionados.'
                      : 'Crie um novo produto para comecar a preencher o catalogo premium da Sweet Child.'
                  }
                  action={<AdminButton onClick={handleOpenNew}>Novo produto</AdminButton>}
                />
              </div>
            )}

            {!isLoading &&
              sortedFilteredProducts.map((product) => (
                <DesktopProductCard
                  key={product.id}
                  product={product}
                  categoryName={product.category_id ? categoryById.get(product.category_id)?.name ?? 'Sem categoria' : 'Sem categoria'}
                  deleting={deletingId === product.id}
                  onDelete={handleDeleteProduct}
                  onEdit={handleEdit}
                />
              ))}
          </div>
        </section>

        <section className="admin-products-desktop-panel">
          <div className="admin-products-desktop-section-header">
            <div>
              <p className="admin-section-kicker">Categorias</p>
              <h2 className="admin-table-title">Organizacao do catalogo</h2>
              <p className="admin-table-subtitle">
                {categoriesLoading ? 'Carregando categorias...' : `${filteredCategories.length} categoria(s) encontrada(s).`}
              </p>
            </div>
            <div className="admin-products-desktop-actions">
              <AdminButton variant="ghost" size="sm" onClick={loadCategories} disabled={categoriesLoading}>
                Atualizar lista
              </AdminButton>
              <AdminButton size="sm" onClick={handleOpenNewCategory}>
                Nova categoria
              </AdminButton>
            </div>
          </div>

          <div className="admin-products-desktop-grid admin-products-desktop-category-grid" role="list" aria-label="Lista de categorias">
            {categoriesLoading && categorySkeletonRows.map((row) => <DesktopCatalogSkeletonCard key={row} />)}

            {noFilteredCategories && (
              <div className="admin-products-desktop-empty">
                <AdminEmptyState
                  icon={<FaLayerGroup />}
                  title="Nenhuma categoria encontrada"
                  description={
                    hasActiveFilter
                      ? 'Ajuste o filtro para visualizar outras categorias.'
                      : 'Crie sua primeira categoria para organizar o catalogo.'
                  }
                  action={<AdminButton onClick={handleOpenNewCategory}>Nova categoria</AdminButton>}
                />
              </div>
            )}

            {!categoriesLoading &&
              filteredCategories.map((category) => (
                <DesktopCategoryCard
                  key={category.id}
                  category={category}
                  deleting={deletingCategoryId === category.id}
                  onDelete={handleCategoryDelete}
                  onEdit={handleEditCategory}
                />
              ))}
          </div>
        </section>
      </div>

      <div className="admin-products-mobile-only">
        <button
          type="button"
          className="admin-products-mobile-fab admin-products-mobile-fab-filter"
          aria-label={hasActiveFilter ? 'Abrir filtros (filtro aplicado)' : 'Abrir filtros'}
          onClick={openFilterModal}
        >
          <FaMagnifyingGlass aria-hidden="true" />
          {hasActiveFilter ? <span className="admin-products-mobile-fab-badge">Filtro</span> : null}
        </button>

        <button
          type="button"
          className="admin-products-mobile-fab admin-products-mobile-fab-create"
          aria-label="Abrir menu de criação"
          onClick={toggleFabMenu}
        >
          <FaPlus aria-hidden="true" />
        </button>

        {isFabMenuOpen && (
          <div
            className="admin-products-mobile-overlay"
            role="presentation"
            onClick={() => setIsFabMenuOpen(false)}
          >
            <div
              className="admin-products-mobile-create-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Ações de criação"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="admin-products-mobile-create-header">
                <strong>Criar</strong>
                <button
                  type="button"
                  aria-label="Fechar menu de criação"
                  onClick={() => setIsFabMenuOpen(false)}
                >
                  <FaXmark aria-hidden="true" />
                </button>
              </div>

              <div className="admin-products-mobile-create-actions">
                <AdminButton
                  className="admin-products-mobile-create-action"
                  onClick={() => {
                    setIsFabMenuOpen(false);
                    handleOpenNew();
                  }}
                >
                  + Novo produto
                </AdminButton>

                <AdminButton
                  variant="secondary"
                  className="admin-products-mobile-create-action"
                  onClick={() => {
                    setIsFabMenuOpen(false);
                    handleOpenNewCategory();
                  }}
                >
                  + Nova categoria
                </AdminButton>
              </div>
            </div>
          </div>
        )}

        {isFilterModalOpen && (
          <div
            className="admin-products-mobile-overlay"
            role="presentation"
            onClick={() => setIsFilterModalOpen(false)}
          >
            <div
              className="admin-products-mobile-filter-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Filtro de produtos"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="admin-products-mobile-filter-header">
                <div>
                  <p>Filtro rápido</p>
                  <h3>Buscar produtos</h3>
                </div>
                <button
                  type="button"
                  aria-label="Fechar filtro"
                  onClick={() => setIsFilterModalOpen(false)}
                >
                  <FaXmark aria-hidden="true" />
                </button>
              </div>

              <form className="admin-products-mobile-filter-form" onSubmit={handleApplyFilter}>
                <label className="admin-field">
                  <span>Nome do produto</span>
                  <input
                    className="admin-input"
                    value={draftFilterName}
                    placeholder="Ex.: Brigadeiro premium"
                    onChange={(event) => setDraftFilterName(event.target.value)}
                  />
                </label>

                <label className="admin-field">
                  <span>Categoria</span>
                  <select
                    className="admin-select"
                    value={draftFilterCategoryId}
                    onChange={handleCategorySelectChange}
                  >
                    <option value="">Todas as categorias</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="admin-products-mobile-range-block">
                  <p className="admin-products-mobile-range-label">Faixa de preço</p>
                  <div className="admin-products-mobile-range-values">
                    <span>{formatCurrency(Math.min(draftFilterPriceMin, draftFilterPriceMax))}</span>
                    <span>{formatCurrency(Math.max(draftFilterPriceMin, draftFilterPriceMax))}</span>
                  </div>
                  <div className="admin-products-mobile-range-track-wrap">
                    <div className="admin-products-mobile-range-track-base" />
                    <div
                      className="admin-products-mobile-range-track-active"
                      style={{
                        left: `${rangeStartPercent}%`,
                        right: `${100 - rangeEndPercent}%`,
                      }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={maxProductPriceCents}
                      value={Math.min(draftFilterPriceMin, draftFilterPriceMax)}
                      onChange={handleMinRangeChange}
                      className="admin-products-mobile-range-slider"
                      disabled={maxProductPriceCents <= 0}
                    />
                    <input
                      type="range"
                      min={0}
                      max={maxProductPriceCents}
                      value={Math.max(draftFilterPriceMin, draftFilterPriceMax)}
                      onChange={handleMaxRangeChange}
                      className="admin-products-mobile-range-slider is-max"
                      disabled={maxProductPriceCents <= 0}
                    />
                  </div>
                  <div className="admin-products-mobile-range-limits">
                    <span>R$ 0,00</span>
                    <span>{formatCurrency(maxProductPriceCents)}</span>
                  </div>
                </div>

                <div className="admin-products-mobile-filter-actions">
                  <AdminButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="admin-products-mobile-filter-clear"
                    onClick={clearFilters}
                  >
                    Limpar
                  </AdminButton>
                  <AdminButton type="submit" className="admin-products-mobile-filter-submit">
                    Pesquisar
                  </AdminButton>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {(isCreateMode || modalProductId) && (
        <ProductEditModal
          productId={isCreateMode ? null : modalProductId}
          onClose={closeModal}
          onSaved={() => {
            closeModal();
            loadProducts();
            setSuccessMessage(isCreateMode ? 'Produto criado com sucesso.' : 'Produto salvo.');
          }}
          onDeleted={() => {
            closeModal();
            setSuccessMessage('Produto excluído com sucesso.');
            loadProducts();
          }}
        />
      )}

      {categoryModalOpen && (
        <CategoryModal
          isOpen={categoryModalOpen}
          initialCategory={editingCategory}
          onClose={closeCategoryModal}
          onSaved={() => {
            const wasEditing = Boolean(editingCategory);
            closeCategoryModal();
            loadCategories();
            setSuccessMessage(wasEditing ? 'Categoria atualizada com sucesso.' : 'Categoria criada com sucesso.');
          }}
        />
      )}
    </div>
  );
}
