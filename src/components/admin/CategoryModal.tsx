import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { FaTrashCan, FaUpload, FaXmark } from 'react-icons/fa6';
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminModal,
  AdminModalBackdrop,
  AdminModalBody,
  AdminModalFooter,
  AdminModalHeader,
  AdminSelect,
  AdminTextarea,
} from './AdminPrimitives';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useDocumentScrollLock } from '../../hooks/useDocumentScrollLock';
import type { Category } from '../../types/product';

type CategoryModalProps = {
  isOpen: boolean;
  initialCategory?: Category | null;
  onClose: () => void;
  onSaved: () => void;
};

const toSlug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const IMAGE_BUCKET = import.meta.env.VITE_IMAGE_BUCKET?.trim() || 'product-images';
const CATEGORY_ORDER_STEP = 10;

type CategoryOrderRow = {
  id: string;
  name: string;
  sort_order: number | null;
};

type CategorySnapshot = {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
};

const toSortOrderValue = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortCategoryRows = (rows: CategoryOrderRow[]) =>
  [...rows].sort((a, b) => {
    const sortA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const sortB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (sortA !== sortB) return sortA - sortB;
    return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
  });

const buildCategorySnapshot = (values: {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  sortOrder: string;
  isActive: boolean;
}): CategorySnapshot => ({
  name: values.name.trim(),
  slug: toSlug(values.slug),
  description: values.description.trim(),
  imageUrl: values.imageUrl.trim(),
  sortOrder: toSortOrderValue(values.sortOrder),
  isActive: values.isActive,
});

export default function CategoryModal({ isOpen, initialCategory, onClose, onSaved }: CategoryModalProps) {
  const { withAuthRetry } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [categoryOrderRows, setCategoryOrderRows] = useState<CategoryOrderRow[]>([]);
  const [categoryOrderLoading, setCategoryOrderLoading] = useState(false);
  const [categoryOrderError, setCategoryOrderError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [imageUploading, setImageUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState<CategorySnapshot | null>(null);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 760px)').matches;
  });

  const isEditMode = Boolean(initialCategory?.id);

  useDocumentScrollLock(isOpen && isMobile);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 760px)');
    const syncViewport = () => setIsMobile(mediaQuery.matches);
    syncViewport();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncViewport);
      return () => mediaQuery.removeEventListener('change', syncViewport);
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const nextSortOrder = '1';

    setName(initialCategory?.name ?? '');
    setSlug(initialCategory?.slug ?? '');
    setDescription(initialCategory?.description ?? '');
    setImageUrl(initialCategory?.image_url ?? '');
    setSortOrder(nextSortOrder);
    setCategoryOrderRows([]);
    setCategoryOrderLoading(false);
    setCategoryOrderError(null);
    setIsActive(initialCategory?.is_active ?? true);
    setImageUploading(false);
    setErrorMessage(null);
    setSlugTouched(Boolean(initialCategory?.slug));
    setShowUnsavedConfirm(false);
    setInitialSnapshot(
      buildCategorySnapshot({
        name: initialCategory?.name ?? '',
        slug: initialCategory?.slug ?? initialCategory?.name ?? '',
        description: initialCategory?.description ?? '',
        imageUrl: initialCategory?.image_url ?? '',
        sortOrder: nextSortOrder,
        isActive: initialCategory?.is_active ?? true,
      })
    );
  }, [initialCategory, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let ignore = false;

    const loadCategoryOrder = async () => {
      setCategoryOrderLoading(true);
      setCategoryOrderError(null);

      const { data, error } = await withAuthRetry(
        () =>
          supabase
            .from('categories')
            .select('id, name, sort_order')
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true }),
        { label: 'load-category-order' }
      );

      if (ignore) return;

      if (error) {
        setCategoryOrderRows([]);
        setCategoryOrderError('Não foi possível carregar a ordem atual das categorias.');
        setCategoryOrderLoading(false);
        return;
      }

      const rows = sortCategoryRows((data ?? []) as CategoryOrderRow[]);
      const currentId = initialCategory?.id ?? null;
      const currentIndex = currentId ? rows.findIndex((row) => row.id === currentId) : -1;
      const nextPosition = currentIndex >= 0 ? currentIndex + 1 : rows.length + 1;
      const nextSortOrder = String(Math.max(1, nextPosition));

      setCategoryOrderRows(rows);
      setSortOrder(nextSortOrder);
      setInitialSnapshot(
        buildCategorySnapshot({
          name: initialCategory?.name ?? '',
          slug: initialCategory?.slug ?? initialCategory?.name ?? '',
          description: initialCategory?.description ?? '',
          imageUrl: initialCategory?.image_url ?? '',
          sortOrder: nextSortOrder,
          isActive: initialCategory?.is_active ?? true,
        })
      );
      setCategoryOrderLoading(false);
    };

    void loadCategoryOrder();

    return () => {
      ignore = true;
    };
  }, [initialCategory, isOpen, withAuthRetry]);

  const normalizedSlug = useMemo(() => (slugTouched ? toSlug(slug) : toSlug(name)), [name, slug, slugTouched]);
  const currentSnapshot = useMemo(
    () =>
      buildCategorySnapshot({
        name,
        slug: normalizedSlug,
        description,
        imageUrl,
        sortOrder,
        isActive,
      }),
    [description, imageUrl, isActive, name, normalizedSlug, sortOrder]
  );
  const isDirty = useMemo(() => {
    if (!initialSnapshot) return false;
    return (
      currentSnapshot.name !== initialSnapshot.name ||
      currentSnapshot.slug !== initialSnapshot.slug ||
      currentSnapshot.description !== initialSnapshot.description ||
      currentSnapshot.imageUrl !== initialSnapshot.imageUrl ||
      currentSnapshot.sortOrder !== initialSnapshot.sortOrder ||
      currentSnapshot.isActive !== initialSnapshot.isActive
    );
  }, [currentSnapshot, initialSnapshot]);

  const orderedSiblingCategories = useMemo(
    () => sortCategoryRows(categoryOrderRows.filter((category) => category.id !== initialCategory?.id)),
    [categoryOrderRows, initialCategory?.id]
  );
  const maxOrderPosition = Math.max(1, orderedSiblingCategories.length + 1);
  const selectedOrderPosition = Math.min(Math.max(1, toSortOrderValue(sortOrder) || 1), maxOrderPosition);
  const orderOptions = useMemo(
    () =>
      Array.from({ length: maxOrderPosition }, (_, index) => {
        const position = index + 1;
        if (position === 1) {
          return {
            value: String(position),
            label: orderedSiblingCategories.length === 0 ? '1 - Primeira categoria' : '1 - Antes de todas',
          };
        }

        const previousCategory = orderedSiblingCategories[position - 2];
        return {
          value: String(position),
          label: previousCategory ? `${position} - Depois de ${previousCategory.name}` : `${position} - Última posição`,
        };
      }),
    [maxOrderPosition, orderedSiblingCategories]
  );

  const reorderCategories = async (targetId: string, targetName: string, targetPosition: number) => {
    const rowsWithoutTarget = sortCategoryRows(categoryOrderRows.filter((category) => category.id !== targetId));
    const nextRows: CategoryOrderRow[] = [...rowsWithoutTarget];
    nextRows.splice(Math.min(Math.max(targetPosition - 1, 0), nextRows.length), 0, {
      id: targetId,
      name: targetName,
      sort_order: targetPosition * CATEGORY_ORDER_STEP,
    });

    for (let index = 0; index < nextRows.length; index += 1) {
      const category = nextRows[index];
      const nextSortOrder = (index + 1) * CATEGORY_ORDER_STEP;
      const { error } = await withAuthRetry(
        () => supabase.from('categories').update({ sort_order: nextSortOrder }).eq('id', category.id),
        { label: 'reorder-categories' }
      );
      if (error) throw error;
    }
  };

  const requestClose = useCallback(() => {
    if (isDirty) {
      setShowUnsavedConfirm(true);
      return;
    }
    setShowUnsavedConfirm(false);
    onClose();
  }, [isDirty, onClose]);

  const handleSelectImage = () => {
    if (imageUploading) return;
    fileInputRef.current?.click();
  };

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    setImageUploading(true);
    setErrorMessage(null);

    try {
      const extension = file.name.split('.').pop() || 'jpg';
      const targetId = initialCategory?.id ?? 'new';
      const filePath = `categories/${targetId}-${Date.now()}.${extension}`;

      const { error: uploadError } = await withAuthRetry(
        () => supabase.storage.from(IMAGE_BUCKET).upload(filePath, file, { upsert: true }),
        { label: 'upload-category-image' }
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
      if (!publicData?.publicUrl) {
        throw new Error('Não foi possível gerar a URL pública da imagem.');
      }

      setImageUrl(publicData.publicUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar imagem.';
      setErrorMessage(message);
    } finally {
      setImageUploading(false);
      event.currentTarget.value = '';
    }
  };

  useEffect(() => {
    if (!isOpen || !isMobile) return;

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      requestClose();
    };

    window.addEventListener('keydown', handleEscapeKey);
    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, [isMobile, isOpen, requestClose]);

  const handleSave = async () => {
    if (saving || imageUploading) return;
    setShowUnsavedConfirm(false);
    setSaving(true);
    setErrorMessage(null);
    try {
      const trimmedName = name.trim();
      const trimmedDescription = description.trim();
      const trimmedImage = imageUrl.trim();
      const nextSlug = normalizedSlug.trim();

      if (!trimmedName) {
        throw new Error('Informe um nome para a categoria.');
      }
      if (!nextSlug) {
        throw new Error('Informe um slug válido para a categoria.');
      }

      const { data: existing, error: slugError } = await withAuthRetry(
        () =>
          supabase
            .from('categories')
            .select('id')
            .eq('slug', nextSlug)
            .maybeSingle(),
        { label: 'check-category-slug' }
      );

      if (slugError) throw slugError;
      if (existing?.id && existing.id !== initialCategory?.id) {
        throw new Error('Slug já está em uso. Escolha outro valor.');
      }

      const targetPosition = selectedOrderPosition;
      const payload = {
        name: trimmedName,
        slug: nextSlug,
        description: trimmedDescription || null,
        image_url: trimmedImage || null,
        sort_order: targetPosition * CATEGORY_ORDER_STEP,
        is_active: isActive,
      };

      let savedCategoryId = initialCategory?.id ?? null;
      if (isEditMode && initialCategory?.id) {
        const { error } = await withAuthRetry(
          () => supabase.from('categories').update(payload).eq('id', initialCategory.id),
          { label: 'update-category' }
        );
        if (error) throw error;
        savedCategoryId = initialCategory.id;
      } else {
        const { data, error } = await withAuthRetry(
          () => supabase.from('categories').insert(payload).select('id').single(),
          { label: 'insert-category' }
        );
        if (error) throw error;
        savedCategoryId = (data as { id?: string } | null)?.id ?? null;
      }

      if (savedCategoryId) {
        await reorderCategories(savedCategoryId, trimmedName, targetPosition);
      }

      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível salvar a categoria.';
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AdminModalBackdrop className="admin-modal-backdrop-category" full={isMobile}>
      <AdminModal size="md" className="admin-modal-category">
        <AdminModalHeader
          className={isMobile ? 'admin-modal-header-fixed' : undefined}
          subtitle="Categoria"
          title={isEditMode ? 'Editar categoria' : 'Nova categoria'}
          actions={
            isMobile ? (
              <button
                type="button"
                className="admin-modal-close-icon"
                aria-label="Fechar modal"
                onClick={requestClose}
              >
                <FaXmark aria-hidden="true" />
              </button>
            ) : (
              <AdminButton variant="ghost" onClick={requestClose}>
                Fechar
              </AdminButton>
            )
          }
        />

        <AdminModalBody className={isMobile ? 'admin-modal-body-scroll' : undefined}>
          {errorMessage && <div className="admin-inline-error">{errorMessage}</div>}
          <div className="admin-form-grid">
            <AdminField label="Nome *">
              <AdminInput
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) {
                    setSlug(e.target.value);
                  }
                }}
                placeholder="Ex.: Embalagens premium"
              />
            </AdminField>

            <AdminField className="admin-field-full" label="Descricao">
              <AdminTextarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Texto exibido na página de encomendas."
              />
            </AdminField>

            <div className="admin-field admin-field-full admin-category-image-field">
              <span>Imagem</span>
              <div
                className="admin-image-wrapper"
                onClick={handleSelectImage}
                role="button"
                tabIndex={0}
                aria-label={imageUrl ? 'Selecionar outra foto da categoria' : 'Selecionar foto da categoria'}
                aria-disabled={imageUploading}
                onKeyDown={(event) => {
                  if (imageUploading) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleSelectImage();
                  }
                }}
              >
                {imageUrl ? (
                  <img src={imageUrl} alt={name || 'Imagem da categoria'} className="admin-image-preview" />
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
                <AdminButton
                  variant="secondary"
                  className="admin-button-block"
                  onClick={handleSelectImage}
                  disabled={imageUploading}
                >
                  <FaUpload aria-hidden="true" />
                  {imageUploading ? 'Enviando...' : imageUrl ? 'Trocar foto' : 'Enviar foto'}
                </AdminButton>
                {imageUrl ? (
                  <AdminButton
                    variant="dangerGhost"
                    size="sm"
                    className="admin-button-block admin-category-remove-image"
                    onClick={() => setImageUrl('')}
                    disabled={imageUploading}
                  >
                    <FaTrashCan aria-hidden="true" />
                    Remover foto
                  </AdminButton>
                ) : null}
              </div>
              <small className="admin-helper-text admin-category-image-helper">
                JPG, PNG ou WEBP. A foto será enviada para o storage e salva como URL pública.
              </small>
            </div>

            <AdminField
              className="admin-field-full admin-category-order-field"
              label="Posição no catálogo"
              hint="Escolha onde a categoria aparece. Ao salvar, a ordem é reorganizada automaticamente."
            >
              <AdminSelect
                value={String(selectedOrderPosition)}
                onChange={(e) => setSortOrder(e.target.value)}
                disabled={categoryOrderLoading}
              >
                {orderOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </AdminSelect>
              <div className="admin-category-order-preview" aria-live="polite">
                <strong>{selectedOrderPosition}º lugar no catálogo</strong>
              </div>
              {categoryOrderError && <small className="admin-field-error">{categoryOrderError}</small>}
            </AdminField>

            <label className="admin-switch admin-field-full admin-category-active-switch">
              <span>Ativa</span>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span className="admin-switch-track" aria-hidden="true" />
            </label>
          </div>

          <details className="admin-advanced-panel admin-category-advanced">
            <summary>Avançado</summary>
            <div className="admin-advanced-body">
              <AdminField
                label="Slug *"
                hint="O slug e usado para URLs e integracoes. Ele sera normalizado automaticamente."
              >
                <AdminInput
                  type="text"
                  value={slugTouched ? slug : normalizedSlug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugTouched(true);
                  }}
                  placeholder="ex.: embalagens-premium"
                />
              </AdminField>
            </div>
          </details>

        </AdminModalBody>

        <AdminModalFooter className={isMobile ? 'admin-modal-footer-fixed admin-modal-footer-mobile' : undefined}>
          {!isMobile && (
            <AdminButton variant="ghost" onClick={requestClose}>
              Cancelar
            </AdminButton>
          )}
          <AdminButton onClick={handleSave} disabled={saving || imageUploading}>
            {saving ? 'Salvando...' : imageUploading ? 'Enviando foto...' : 'Salvar categoria'}
          </AdminButton>
        </AdminModalFooter>

        {showUnsavedConfirm && (
          <div
            className="admin-modal-unsaved-popover-backdrop"
            role="presentation"
            onClick={() => setShowUnsavedConfirm(false)}
          >
            <div
              className="admin-modal-unsaved-confirm admin-modal-unsaved-confirm-popover"
              role="alertdialog"
              aria-live="polite"
              aria-modal="true"
              onClick={(event) => event.stopPropagation()}
            >
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
          </div>
        )}
      </AdminModal>
    </AdminModalBackdrop>
  );
}
