import { useEffect, useMemo, useState } from 'react';
import ProductEditModal from '../../components/admin/ProductEditModal';
import { useAuth } from '../../lib/auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import type { ProductCategory } from '../../types/product';

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category: ProductCategory;
  base_price_cents: number;
  min_quantity: number | null;
  is_active: boolean;
};

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  packaging: 'Embalagens',
  party: 'Docinhos',
  cake: 'Tortas',
};

function formatCurrency(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [modalProductId, setModalProductId] = useState<string | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { withAuthRetry } = useAuth();

  const skeletonRows = useMemo(() => Array.from({ length: 3 }, (_, index) => index), []);

  const loadProducts = async () => {
    setIsLoading(true);
    setError(null);
    const { data, error: fetchError } = await withAuthRetry(
      () =>
        supabase
          .from('products')
          .select(
            ['id', 'name', 'description', 'image_url', 'category', 'base_price_cents', 'min_quantity', 'is_active'].join(
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
  };

  useEffect(() => {
    void loadProducts();
  }, []);

  const closeModal = () => {
    setModalProductId(null);
    setIsCreateMode(false);
  };

  const handleOpenNew = () => {
    setSuccessMessage(null);
    setModalProductId(null);
    setIsCreateMode(true);
  };

  const handleEdit = (id: string) => {
    setSuccessMessage(null);
    setModalProductId(id);
    setIsCreateMode(false);
  };

  const handleSoftDelete = async (id: string) => {
    const confirmed = window.confirm('Deseja excluir (desativar) este produto?');
    if (!confirmed) return;
    setDeletingId(id);
    setError(null);
    setSuccessMessage(null);
    const { error: deleteError } = await withAuthRetry(
      () => supabase.from('products').update({ is_active: false }).eq('id', id),
      { label: 'delete-product' }
    );
    if (deleteError) {
      setError('Não foi possível excluir o produto agora.');
    } else {
      setSuccessMessage('Produto excluído com sucesso.');
      await loadProducts();
    }
    setDeletingId(null);
  };

  const noProducts = !isLoading && products.length === 0;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-kicker">Catálogo</p>
          <h1 className="admin-page-title">Produtos</h1>
          <p className="admin-page-subtitle">
            Organize o catálogo publicado e mantenha descrição, preço e status alinhados.
          </p>
        </div>
        <div className="admin-page-actions">
          <button type="button" className="admin-button" onClick={handleOpenNew}>
            + Novo produto
          </button>
        </div>
      </div>

      {successMessage && <div className="admin-alert">{successMessage}</div>}
      {error && <div className="admin-inline-error">{error}</div>}

      <div className="admin-table-shell">
        <div className="admin-table-headerbar">
          <div>
            <p className="admin-section-kicker">Itens ativos</p>
            <h3 className="admin-table-title">Catálogo publicado</h3>
            <p className="admin-table-subtitle">
              {isLoading ? 'Carregando produtos...' : `${products.length} produto(s) ativo(s) no momento.`}
            </p>
          </div>
          <div className="admin-section-actions">
            <button type="button" className="admin-button-outline" onClick={handleOpenNew}>
              Novo produto
            </button>
          </div>
        </div>

        <div className="admin-table-scroll">
          <div className="admin-table">
            <div className="admin-table-header admin-table-header-products">
              <div>Imagem</div>
              <div className="admin-cell-left">Nome</div>
              <div>Categoria</div>
              <div className="admin-col-number">Preço</div>
              <div>Status</div>
              <div className="admin-col-actions">Ações</div>
            </div>

            {isLoading &&
              skeletonRows.map((row) => (
                <div key={row} className="admin-table-row admin-table-row-products admin-row-skeleton">
                  <div>
                    <div className="admin-product-thumb admin-skeleton-block" />
                  </div>
                  <div>
                    <div className="admin-skeleton-line" />
                    <div className="admin-skeleton-line short" />
                  </div>
                  <div>
                    <div className="admin-skeleton-pill" />
                  </div>
                  <div className="admin-col-number">
                    <div className="admin-skeleton-line short" />
                  </div>
                  <div>
                    <div className="admin-skeleton-pill" />
                  </div>
                  <div className="admin-table-actions">
                    <div className="admin-skeleton-button" />
                    <div className="admin-skeleton-button ghost" />
                  </div>
                </div>
              ))}

            {noProducts && (
              <div className="admin-empty-row">
                <div>
                  <p className="admin-empty-title">Nenhum produto encontrado</p>
                  <p className="admin-empty-helper">Crie um novo produto ou ajuste seus filtros.</p>
                  <button type="button" className="admin-button" onClick={handleOpenNew}>
                    Novo produto
                  </button>
                </div>
              </div>
            )}

            {!isLoading &&
              products.map((product) => (
                <div key={product.id} className="admin-table-row admin-table-row-products">
                  <div>
                    <div className="admin-product-thumb">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} />
                      ) : (
                        <span className="admin-thumb-placeholder">SC</span>
                      )}
                    </div>
                  </div>
                  <div className="admin-cell-stack admin-cell-left">
                    <div className="admin-product-name" title={product.name}>
                      {product.name}
                    </div>
                    <div
                      className="admin-product-description admin-cell-text"
                      title={product.description ?? 'Sem descrição'}
                    >
                      {product.description ?? 'Sem descrição'}
                    </div>
                  </div>
                  <div>{CATEGORY_LABELS[product.category]}</div>
                  <div className="admin-col-number" title={formatCurrency(product.base_price_cents)}>
                    {formatCurrency(product.base_price_cents)}
                  </div>
                  <div>
                    <span className={`admin-status-badge ${product.is_active ? 'active' : 'inactive'}`}>
                      {product.is_active ? 'Sim' : 'Não'}
                    </span>
                  </div>
                  <div className="admin-table-actions">
                    <button
                      type="button"
                      className="admin-button-small"
                      onClick={() => handleEdit(product.id)}
                      title="Editar produto"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="admin-button-small admin-button-ghost"
                      onClick={() => handleSoftDelete(product.id)}
                      disabled={deletingId === product.id}
                      title="Excluir produto"
                    >
                      {deletingId === product.id ? 'Excluindo...' : 'Excluir'}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
        <div className="admin-table-footer">
          <span>{isLoading ? 'Carregando produtos...' : `${products.length} produto(s) ativo(s)`}</span>
          <div className="admin-table-actions">
            <button
              type="button"
              className="admin-button-ghost admin-button-small"
              onClick={loadProducts}
              disabled={isLoading}
            >
              Atualizar lista
            </button>
            <button type="button" className="admin-button-small" onClick={handleOpenNew}>
              Novo produto
            </button>
          </div>
        </div>
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
    </div>
  );
}
