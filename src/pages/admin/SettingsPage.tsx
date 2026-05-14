import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { FaPen, FaPlus, FaRotateRight, FaTrashCan } from 'react-icons/fa6';
import {
  AdminBadge,
  AdminButton,
  AdminEmptyState,
  AdminField,
  AdminInput,
  AdminPageHeader,
  AdminSectionCard,
  AdminSelect,
  AdminSkeleton,
  AdminToastStack,
} from '../../components/admin/AdminPrimitives';
import {
  deleteDiscountCoupon,
  fetchCheckoutSettings,
  listDiscountCoupons,
  saveCheckoutSettings,
  upsertDiscountCoupon,
  type DiscountCoupon,
  type DiscountType,
} from '../../lib/api/checkoutSettings';

type ToastVariant = 'info' | 'success' | 'warning' | 'error';

type Toast = {
  id: string;
  message: string;
  variant?: ToastVariant;
};

type CouponForm = {
  id: string | null;
  code: string;
  discountType: DiscountType;
  discountValue: string;
  validUntil: string;
  isActive: boolean;
  isCumulative: boolean;
};

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const emptyCouponForm: CouponForm = {
  id: null,
  code: '',
  discountType: 'percent',
  discountValue: '',
  validUntil: '',
  isActive: true,
  isCumulative: false,
};

const formatCurrency = (cents: number) => currencyFormatter.format(Math.max(0, cents) / 100);

const normalizeCode = (value: string) => value.trim().toUpperCase();

const parseDecimal = (value: string) => {
  const normalized = value
    .trim()
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const parseCurrencyToCents = (value: string) => {
  const parsed = parseDecimal(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : NaN;
};

const centsToInputValue = (cents: number | null | undefined) => {
  if (!cents) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
};

const formatCouponValue = (coupon: DiscountCoupon) => {
  if (coupon.discountType === 'percent') {
    return `${percentFormatter.format(coupon.discountPercent ?? 0)}%`;
  }

  return formatCurrency(coupon.discountCents ?? 0);
};

const formatValidity = (validUntil: string | null) => {
  if (!validUntil) return 'Sem validade definida';
  const [year, month, day] = validUntil.split('-').map(Number);
  if (!year || !month || !day) return validUntil;
  return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day));
};

export default function SettingsPage() {
  const [minimumInput, setMinimumInput] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [coupons, setCoupons] = useState<DiscountCoupon[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(true);
  const [couponSaving, setCouponSaving] = useState(false);
  const [deletingCouponId, setDeletingCouponId] = useState<string | null>(null);
  const [couponForm, setCouponForm] = useState<CouponForm>(emptyCouponForm);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const activeCoupons = useMemo(() => coupons.filter((coupon) => coupon.isActive).length, [coupons]);

  const addToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, variant }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const settings = await fetchCheckoutSettings();
      setMinimumInput(centsToInputValue(settings.orderMinimumCents));
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Erro ao carregar pedido mínimo', error);
      }
      addToast('Não foi possível carregar o pedido mínimo.', 'error');
    } finally {
      setSettingsLoading(false);
    }
  }, [addToast]);

  const loadCoupons = useCallback(async () => {
    setCouponsLoading(true);
    try {
      const rows = await listDiscountCoupons();
      setCoupons(rows);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Erro ao carregar cupons', error);
      }
      addToast('Não foi possível carregar os cupons.', 'error');
    } finally {
      setCouponsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void loadSettings();
    void loadCoupons();
  }, [loadCoupons, loadSettings]);

  const resetCouponForm = () => {
    setCouponForm(emptyCouponForm);
    setCouponError(null);
  };

  const handleSaveMinimum = async (event: FormEvent) => {
    event.preventDefault();
    const cents = minimumInput.trim() ? parseCurrencyToCents(minimumInput) : 0;
    if (!Number.isFinite(cents) || cents < 0) {
      addToast('Informe um valor válido para o pedido mínimo.', 'warning');
      return;
    }

    setSettingsSaving(true);
    try {
      const saved = await saveCheckoutSettings(cents);
      setMinimumInput(centsToInputValue(saved.orderMinimumCents));
      addToast('Pedido mínimo atualizado.', 'success');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Erro ao salvar pedido mínimo', error);
      }
      addToast('Não foi possível salvar o pedido mínimo.', 'error');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleEditCoupon = (coupon: DiscountCoupon) => {
    setCouponForm({
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue:
        coupon.discountType === 'percent'
          ? String(coupon.discountPercent ?? '').replace('.', ',')
          : centsToInputValue(coupon.discountCents),
      validUntil: coupon.validUntil ?? '',
      isActive: coupon.isActive,
      isCumulative: coupon.isCumulative,
    });
    setCouponError(null);
  };

  const handleSaveCoupon = async (event: FormEvent) => {
    event.preventDefault();
    setCouponError(null);

    const code = normalizeCode(couponForm.code);
    if (code.length < 3) {
      setCouponError('Use um código com pelo menos 3 caracteres.');
      return;
    }

    const numericValue =
      couponForm.discountType === 'percent'
        ? parseDecimal(couponForm.discountValue)
        : parseCurrencyToCents(couponForm.discountValue);

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      setCouponError('Informe um desconto válido.');
      return;
    }

    if (couponForm.discountType === 'percent' && numericValue > 100) {
      setCouponError('O desconto percentual não pode passar de 100%.');
      return;
    }

    setCouponSaving(true);
    try {
      await upsertDiscountCoupon({
        id: couponForm.id,
        code,
        discountType: couponForm.discountType,
        discountPercent: couponForm.discountType === 'percent' ? numericValue : null,
        discountCents: couponForm.discountType === 'fixed' ? numericValue : null,
        validUntil: couponForm.validUntil || null,
        isActive: couponForm.isActive,
        isCumulative: couponForm.isCumulative,
      });

      resetCouponForm();
      await loadCoupons();
      addToast('Cupom salvo com sucesso.', 'success');
    } catch (error: unknown) {
      if (import.meta.env.DEV) {
        console.error('Erro ao salvar cupom', error);
      }
      const message = error instanceof Error ? error.message : '';
      setCouponError(
        message.toLowerCase().includes('duplicate') || message.toLowerCase().includes('unique')
          ? 'Já existe um cupom com esse código.'
          : 'Não foi possível salvar o cupom.'
      );
    } finally {
      setCouponSaving(false);
    }
  };

  const handleDeleteCoupon = async (coupon: DiscountCoupon) => {
    if (!window.confirm(`Excluir o cupom ${coupon.code}?`)) return;
    setDeletingCouponId(coupon.id);
    try {
      await deleteDiscountCoupon(coupon.id);
      setCoupons((prev) => prev.filter((item) => item.id !== coupon.id));
      if (couponForm.id === coupon.id) resetCouponForm();
      addToast('Cupom excluído.', 'success');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Erro ao excluir cupom', error);
      }
      addToast('Não foi possível excluir o cupom.', 'error');
    } finally {
      setDeletingCouponId(null);
    }
  };

  return (
    <div className="admin-page">
      <AdminToastStack onDismiss={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} toasts={toasts} />

      <AdminPageHeader
        kicker="Configurar"
        title="Regras do checkout"
        subtitle="Ajuste pedido mínimo e descontos usados no fechamento dos pedidos."
        actions={
          <AdminButton variant="secondary" onClick={() => void Promise.all([loadSettings(), loadCoupons()])}>
            <FaRotateRight aria-hidden="true" />
            Atualizar
          </AdminButton>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <AdminSectionCard
          kicker="Pedido mínimo"
          title="Valor mínimo para finalizar"
          helper="Use 0 ou deixe em branco para desativar essa regra no checkout."
        >
          {settingsLoading ? (
            <div className="space-y-4">
              <AdminSkeleton variant="block" />
              <AdminSkeleton variant="button" />
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSaveMinimum}>
              <AdminField label="Valor em reais" hint="Exemplo: 50,00">
                <AdminInput
                  inputMode="decimal"
                  value={minimumInput}
                  onChange={(event) => setMinimumInput(event.target.value)}
                  placeholder="0,00"
                />
              </AdminField>

              <div className="rounded-admin-xs border border-admin-stroke bg-admin-cardAlt/70 p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-admin-muted">Prévia no checkout</p>
                <p className="mt-2 text-2xl font-extrabold tracking-[-0.02em] text-admin-ink">
                  {minimumInput.trim() && Number.isFinite(parseCurrencyToCents(minimumInput))
                    ? formatCurrency(parseCurrencyToCents(minimumInput))
                    : 'Sem mínimo'}
                </p>
              </div>

              <AdminButton type="submit" className="w-full" disabled={settingsSaving}>
                {settingsSaving ? 'Salvando...' : 'Salvar pedido mínimo'}
              </AdminButton>
            </form>
          )}
        </AdminSectionCard>

        <AdminSectionCard
          kicker="Cupons"
          title={couponForm.id ? 'Editar cupom' : 'Novo cupom'}
          helper="O cliente pode aplicar um código por pedido no checkout."
          actions={
            couponForm.id ? (
              <AdminButton variant="ghost" size="sm" onClick={resetCouponForm}>
                Novo cupom
              </AdminButton>
            ) : null
          }
        >
          <form className="space-y-5" onSubmit={handleSaveCoupon}>
            {couponError ? <div className="admin-inline-error">{couponError}</div> : null}
            <div className="admin-form-grid">
              <AdminField label="Código">
                <AdminInput
                  value={couponForm.code}
                  onChange={(event) =>
                    setCouponForm((prev) => ({ ...prev, code: normalizeCode(event.target.value) }))
                  }
                  placeholder="PALHA10"
                />
              </AdminField>

              <AdminField label="Tipo">
                <AdminSelect
                  value={couponForm.discountType}
                  onChange={(event) =>
                    setCouponForm((prev) => ({
                      ...prev,
                      discountType: event.target.value as DiscountType,
                      discountValue: '',
                    }))
                  }
                >
                  <option value="percent">Porcentagem</option>
                  <option value="fixed">Valor em reais</option>
                </AdminSelect>
              </AdminField>

              <AdminField label={couponForm.discountType === 'percent' ? 'Desconto (%)' : 'Desconto (R$)'}>
                <AdminInput
                  inputMode="decimal"
                  value={couponForm.discountValue}
                  onChange={(event) => setCouponForm((prev) => ({ ...prev, discountValue: event.target.value }))}
                  placeholder={couponForm.discountType === 'percent' ? '10' : '15,00'}
                />
              </AdminField>

              <AdminField label="Validade">
                <AdminInput
                  type="date"
                  value={couponForm.validUntil}
                  onChange={(event) => setCouponForm((prev) => ({ ...prev, validUntil: event.target.value }))}
                />
              </AdminField>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="admin-switch rounded-admin-xs border border-admin-stroke bg-white p-4">
                <input
                  type="checkbox"
                  checked={couponForm.isActive}
                  onChange={(event) => setCouponForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
                <span className="admin-switch-track" aria-hidden="true" />
                <span>Cupom ativo</span>
              </label>

              <label className="admin-switch rounded-admin-xs border border-admin-stroke bg-white p-4">
                <input
                  type="checkbox"
                  checked={couponForm.isCumulative}
                  onChange={(event) => setCouponForm((prev) => ({ ...prev, isCumulative: event.target.checked }))}
                />
                <span className="admin-switch-track" aria-hidden="true" />
                <span>Cumulativo</span>
              </label>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <AdminButton type="submit" className="flex-1" disabled={couponSaving}>
                {couponForm.id ? <FaPen aria-hidden="true" /> : <FaPlus aria-hidden="true" />}
                {couponSaving ? 'Salvando...' : couponForm.id ? 'Salvar alterações' : 'Criar cupom'}
              </AdminButton>
              {couponForm.id ? (
                <AdminButton variant="secondary" className="flex-1" onClick={resetCouponForm}>
                  Cancelar edição
                </AdminButton>
              ) : null}
            </div>
          </form>
        </AdminSectionCard>
      </div>

      <AdminSectionCard
        kicker="Cupons cadastrados"
        title={`${coupons.length} cupom${coupons.length === 1 ? '' : 's'} no sistema`}
        helper={`${activeCoupons} ativo${activeCoupons === 1 ? '' : 's'} agora.`}
      >
        {couponsLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <AdminSkeleton variant="block" className="h-32" />
            <AdminSkeleton variant="block" className="h-32" />
            <AdminSkeleton variant="block" className="h-32" />
          </div>
        ) : coupons.length === 0 ? (
          <AdminEmptyState
            title="Nenhum cupom cadastrado"
            description="Crie um código para liberar descontos no checkout."
            compact
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {coupons.map((coupon) => (
              <article
                key={coupon.id}
                className="flex min-h-[168px] flex-col justify-between gap-4 rounded-admin-xs border border-admin-stroke bg-white p-4 shadow-admin-soft"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-extrabold tracking-[0.12em] text-admin-ink">{coupon.code}</p>
                      <p className="text-sm text-admin-muted">{formatValidity(coupon.validUntil)}</p>
                    </div>
                    <AdminBadge tone={coupon.isActive ? 'success' : 'danger'}>
                      {coupon.isActive ? 'Ativo' : 'Inativo'}
                    </AdminBadge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                      {formatCouponValue(coupon)}
                    </span>
                    {coupon.isCumulative ? (
                      <span className="rounded-full bg-admin-warningSoft px-3 py-1 text-sm font-bold text-admin-warning">
                        Cumulativo
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <AdminButton size="sm" variant="secondary" onClick={() => handleEditCoupon(coupon)}>
                    <FaPen aria-hidden="true" />
                    Editar
                  </AdminButton>
                  <AdminButton
                    size="sm"
                    variant="dangerGhost"
                    onClick={() => void handleDeleteCoupon(coupon)}
                    disabled={deletingCouponId === coupon.id}
                  >
                    <FaTrashCan aria-hidden="true" />
                    {deletingCouponId === coupon.id ? 'Excluindo...' : 'Excluir'}
                  </AdminButton>
                </div>
              </article>
            ))}
          </div>
        )}
      </AdminSectionCard>
    </div>
  );
}
