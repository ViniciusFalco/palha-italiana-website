import { supabase } from '../supabase';

export type DiscountType = 'percent' | 'fixed';

export type CheckoutSettings = {
  orderMinimumCents: number;
};

export type DiscountCoupon = {
  id: string;
  code: string;
  discountType: DiscountType;
  discountPercent: number | null;
  discountCents: number | null;
  validUntil: string | null;
  isActive: boolean;
  isCumulative: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type DiscountCouponInput = {
  id?: string | null;
  code: string;
  discountType: DiscountType;
  discountPercent?: number | null;
  discountCents?: number | null;
  validUntil?: string | null;
  isActive: boolean;
  isCumulative: boolean;
};

export type AppliedDiscountCoupon = {
  id: string;
  code: string;
  discountType: DiscountType;
  discountPercent: number | null;
  discountCents: number | null;
  discountCentsApplied: number;
  isCumulative: boolean;
  validUntil: string | null;
};

type CheckoutSettingsRow = {
  order_minimum_cents?: number | null;
};

type DiscountCouponRow = {
  id: string;
  code: string;
  discount_type: DiscountType;
  discount_percent: number | string | null;
  discount_cents: number | null;
  valid_until: string | null;
  is_active: boolean;
  is_cumulative: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type AppliedDiscountCouponRow = {
  id: string;
  code: string;
  discount_type: DiscountType;
  discount_percent: number | string | null;
  discount_cents: number | null;
  discount_cents_applied: number | null;
  is_cumulative: boolean;
  valid_until: string | null;
};

const SETTINGS_ID = true;

const normalizeCode = (value: string) => value.trim().toUpperCase();

const toNumberOrNull = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const mapCoupon = (row: DiscountCouponRow): DiscountCoupon => ({
  id: row.id,
  code: row.code,
  discountType: row.discount_type,
  discountPercent: toNumberOrNull(row.discount_percent),
  discountCents: row.discount_cents,
  validUntil: row.valid_until,
  isActive: row.is_active,
  isCumulative: row.is_cumulative,
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
});

const mapAppliedCoupon = (row: AppliedDiscountCouponRow): AppliedDiscountCoupon => ({
  id: row.id,
  code: row.code,
  discountType: row.discount_type,
  discountPercent: toNumberOrNull(row.discount_percent),
  discountCents: row.discount_cents,
  discountCentsApplied: row.discount_cents_applied ?? 0,
  isCumulative: row.is_cumulative,
  validUntil: row.valid_until,
});

export async function fetchCheckoutSettings(): Promise<CheckoutSettings> {
  const { data, error } = await supabase
    .from('checkout_settings')
    .select('order_minimum_cents')
    .eq('id', SETTINGS_ID)
    .maybeSingle();

  if (error) {
    if (import.meta.env.DEV) {
      console.warn('Falha ao carregar configurações do checkout.', error);
    }
    return { orderMinimumCents: 0 };
  }

  const row = (data ?? {}) as CheckoutSettingsRow;
  return {
    orderMinimumCents: Math.max(0, Number(row.order_minimum_cents ?? 0)),
  };
}

export async function saveCheckoutSettings(orderMinimumCents: number): Promise<CheckoutSettings> {
  const normalized = Math.max(0, Math.round(orderMinimumCents));
  const { data, error } = await supabase
    .from('checkout_settings')
    .upsert({ id: SETTINGS_ID, order_minimum_cents: normalized }, { onConflict: 'id' })
    .select('order_minimum_cents')
    .single();

  if (error) throw error;

  const row = data as CheckoutSettingsRow;
  return {
    orderMinimumCents: Math.max(0, Number(row.order_minimum_cents ?? 0)),
  };
}

export async function listDiscountCoupons(): Promise<DiscountCoupon[]> {
  const { data, error } = await supabase
    .from('discount_coupons')
    .select(
      'id, code, discount_type, discount_percent, discount_cents, valid_until, is_active, is_cumulative, created_at, updated_at'
    )
    .order('created_at', { ascending: false });

  if (error) throw error;
  return ((data ?? []) as DiscountCouponRow[]).map(mapCoupon);
}

export async function upsertDiscountCoupon(input: DiscountCouponInput): Promise<DiscountCoupon> {
  const payload = {
    ...(input.id ? { id: input.id } : {}),
    code: normalizeCode(input.code),
    discount_type: input.discountType,
    discount_percent: input.discountType === 'percent' ? input.discountPercent ?? null : null,
    discount_cents: input.discountType === 'fixed' ? input.discountCents ?? null : null,
    valid_until: input.validUntil || null,
    is_active: input.isActive,
    is_cumulative: input.isCumulative,
  };

  const { data, error } = await supabase
    .from('discount_coupons')
    .upsert(payload, { onConflict: 'id' })
    .select(
      'id, code, discount_type, discount_percent, discount_cents, valid_until, is_active, is_cumulative, created_at, updated_at'
    )
    .single();

  if (error) throw error;
  return mapCoupon(data as DiscountCouponRow);
}

export async function deleteDiscountCoupon(id: string): Promise<void> {
  const { error } = await supabase.from('discount_coupons').delete().eq('id', id);
  if (error) throw error;
}

export async function validateDiscountCoupon(
  code: string,
  subtotalCents: number
): Promise<AppliedDiscountCoupon | null> {
  const normalizedCode = normalizeCode(code);
  if (!normalizedCode || subtotalCents <= 0) return null;

  const { data, error } = await supabase.rpc('validate_discount_coupon', {
    p_code: normalizedCode,
    p_subtotal_cents: Math.max(0, Math.round(subtotalCents)),
  });

  if (error) throw error;

  const first = Array.isArray(data) ? data[0] : null;
  return first ? mapAppliedCoupon(first as AppliedDiscountCouponRow) : null;
}
