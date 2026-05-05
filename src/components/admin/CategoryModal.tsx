import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { FaUpload, FaXmark } from 'react-icons/fa6';
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminModal,
  AdminModalBackdrop,
  AdminModalBody,
  AdminModalFooter,
  AdminModalHeader,
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
    const nextSortOrder =
      Number.isFinite(initialCategory?.sort_order)
        ? String(initialCategory?.sort_order)
        : initialCategory?.sort_order
          ? String(initialCategory?.sort_order)
          : '0';

    setName(initialCategory?.name ?? '');
    setSlug(initialCategory?.slug ?? '');
    setDescription(initialCategory?.description ?? '');
    setImageUrl(initialCategory?.image_url ?? '');
    setSortOrder(nextSortOrder);
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

  const requestClose = useCallback(() => {
    if (isMobile && isDirty) {
      setShowUnsavedConfirm(true);
      return;
    }
    setShowUnsavedConfirm(false);
    onClose();
  }, [isDirty, isMobile, onClose]);

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
    if (!isMobile) {
      setShowUnsavedConfirm(false);
    }
  }, [isMobile]);

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

      const sortOrderNumber = Number.parseInt(sortOrder, 10);
      const payload = {
        name: trimmedName,
        slug: nextSlug,
        description: trimmedDescription || null,
        image_url: trimmedImage || null,
        sort_order: Number.isNaN(sortOrderNumber) ? 0 : sortOrderNumber,
        is_active: isActive,
      };

      if (isEditMode && initialCategory?.id) {
        const { error } = await withAuthRetry(
          () => supabase.from('categories').update(payload).eq('id', initialCategory.id),
          { label: 'update-category' }
        );
        if (error) throw error;
      } else {
        const { error } = await withAuthRetry(
          () => supabase.from('categories').insert(payload),
          { label: 'insert-category' }
        );
        if (error) throw error;
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
    <AdminModalBackdrop className="admin-modal-backdrop-category">
      <AdminModal size="md" className="admin-modal-category">
        <AdminModalHeader
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

            <div className="admin-field admin-field-full">
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
                    variant="ghost"
                    className="admin-button-block"
                    onClick={() => setImageUrl('')}
                    disabled={imageUploading}
                  >
                    Remover foto
                  </AdminButton>
                ) : null}
              </div>
              <small className="admin-helper-text">
                JPG, PNG ou WEBP. A foto será enviada para o storage e salva como URL pública.
              </small>
            </div>

            <AdminField label="Ordem">
              <AdminInput
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                min="0"
              />
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
        </AdminModalBody>

        <AdminModalFooter>
          {!isMobile && (
            <AdminButton variant="ghost" onClick={requestClose}>
              Cancelar
            </AdminButton>
          )}
          <AdminButton onClick={handleSave} disabled={saving || imageUploading}>
            {saving ? 'Salvando...' : imageUploading ? 'Enviando foto...' : 'Salvar categoria'}
          </AdminButton>
        </AdminModalFooter>
      </AdminModal>
    </AdminModalBackdrop>
  );
}
