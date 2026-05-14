import type { FormData } from '../types';

export type DeliveryArea = {
  label: string;
  aliases: string[];
  latitude: number;
  longitude: number;
};

export const DELIVERY_AREAS: DeliveryArea[] = [
  { label: 'Cataguases', aliases: ['cataguases'], latitude: -21.3892, longitude: -42.6962 },
  { label: 'Leopoldina', aliases: ['leopoldina'], latitude: -21.5319, longitude: -42.6429 },
  { label: 'Dona Euzébia', aliases: ['dona euzebia', 'dona euzébia'], latitude: -21.3191, longitude: -42.8072 },
  { label: 'Astolfo Dutra', aliases: ['astolfo dutra'], latitude: -21.3153, longitude: -42.8626 },
  { label: 'Itamarati de Minas', aliases: ['itamarati de minas'], latitude: -21.4172, longitude: -42.8178 },
  { label: 'Piacatuba', aliases: ['piacatuba'], latitude: -21.5894, longitude: -42.7882 },
  { label: 'Sereno', aliases: ['sereno'], latitude: -21.3558, longitude: -42.7828 },
];

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const getAreaFromText = (value?: string | null) => {
  if (!value) return null;
  const normalized = normalizeText(value);
  return DELIVERY_AREAS.find((area) => area.aliases.some((alias) => normalized.includes(normalizeText(alias)))) ?? null;
};

export const isAllowedDeliveryArea = (value?: string | null) => Boolean(getAreaFromText(value));

export const formatCheckoutAddress = (value: Partial<FormData>) => {
  const base = [value.street?.trim(), value.houseNumber?.trim()].filter(Boolean).join(', ');
  const complement =
    value.noComplement || !value.addressComplement?.trim() ? '' : `, ${value.addressComplement.trim()}`;
  const district = value.neighborhood?.trim();
  const cityState = [value.city?.trim(), value.state?.trim()].filter(Boolean).join(' - ');
  const cep = value.cep?.trim();

  return [base ? `${base}${complement}` : '', district, cityState, cep ? `CEP ${cep}` : '']
    .filter(Boolean)
    .join(' • ');
};
