import { useEffect, useMemo, useState } from 'react';
import { FaMapMarkerAlt, FaTimes } from 'react-icons/fa';
import Map, { Marker, NavigationControl } from 'react-map-gl';
import type { FormData } from '../types';
import {
  DELIVERY_AREAS,
  formatCheckoutAddress,
  getAreaFromText,
  type DeliveryArea,
} from '../lib/deliveryAreas';

type MapboxFeature = {
  id: string;
  place_name: string;
  text?: string;
  address?: string;
  center?: [number, number];
  context?: Array<{
    id: string;
    text: string;
    short_code?: string;
  }>;
};

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

type MapAddressSelectorProps = {
  value: FormData;
  onChange: (patch: Partial<FormData>) => void;
};

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
const MAPBOX_BBOX = '-43.05,-21.75,-42.35,-21.1';

const DEFAULT_CENTER = DELIVERY_AREAS[0];

const formatCep = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

const getContextText = (feature: MapboxFeature, pattern: RegExp) =>
  feature.context?.find((item) => pattern.test(item.id))?.text ?? '';

const getFeatureArea = (feature: MapboxFeature) => {
  const contextText = feature.context?.map((item) => item.text).join(' ') ?? '';
  return getAreaFromText(`${feature.place_name} ${contextText}`);
};

const getFeatureNeighborhood = (feature: MapboxFeature) =>
  getContextText(feature, /neighborhood|locality|district/i);

const getFeatureCep = (feature: MapboxFeature) => getContextText(feature, /postcode/i);

const getFeatureState = (feature: MapboxFeature) =>
  feature.context?.find((item) => item.id.startsWith('region'))?.short_code?.replace(/^BR-/, '') ??
  feature.context?.find((item) => item.id.startsWith('region'))?.text ??
  'MG';

const extractPatchFromFeature = (
  feature: MapboxFeature,
  fallback: FormData,
  fallbackArea: DeliveryArea
): Partial<FormData> | null => {
  const area = getFeatureArea(feature);
  if (!area) return null;

  const [longitude, latitude] = feature.center ?? [fallbackArea.longitude, fallbackArea.latitude];
  const cep = getFeatureCep(feature);

  return {
    street: feature.text?.trim() || fallback.street,
    houseNumber: feature.address?.trim() || fallback.houseNumber,
    neighborhood: getFeatureNeighborhood(feature) || fallback.neighborhood,
    city: area.label,
    state: getFeatureState(feature),
    cep: cep ? formatCep(cep) : fallback.cep,
    addressLatitude: latitude,
    addressLongitude: longitude,
  };
};

export default function MapAddressSelector({ value, onChange }: MapAddressSelectorProps) {
  const [mapOpen, setMapOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(value.address || value.street || '');
  const [cepInput, setCepInput] = useState(value.cep ?? '');
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [searching, setSearching] = useState(false);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedArea = useMemo(
    () => getAreaFromText(value.city) ?? getAreaFromText(value.address) ?? DEFAULT_CENTER,
    [value.address, value.city]
  );

  const [viewState, setViewState] = useState({
    latitude: value.addressLatitude ?? selectedArea.latitude,
    longitude: value.addressLongitude ?? selectedArea.longitude,
    zoom: value.addressLatitude && value.addressLongitude ? 15 : 11,
  });

  const markerLatitude = value.addressLatitude ?? viewState.latitude;
  const markerLongitude = value.addressLongitude ?? viewState.longitude;
  const hasToken = Boolean(MAPBOX_TOKEN);

  useEffect(() => {
    if (!value.addressLatitude || !value.addressLongitude) return;
    setViewState((current) => ({
      ...current,
      latitude: value.addressLatitude ?? current.latitude,
      longitude: value.addressLongitude ?? current.longitude,
      zoom: Math.max(current.zoom, 15),
    }));
  }, [value.addressLatitude, value.addressLongitude]);

  useEffect(() => {
    if (!mapOpen || !hasToken || searchQuery.trim().length < 3) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({
          access_token: MAPBOX_TOKEN ?? '',
          country: 'br',
          bbox: MAPBOX_BBOX,
          language: 'pt-BR',
          limit: '6',
          autocomplete: 'true',
          types: 'address,poi,place,locality,neighborhood',
        });
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?${params}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error('Busca indisponível agora.');
        const payload = (await response.json()) as { features?: MapboxFeature[] };
        const allowed = (payload.features ?? []).filter((feature) => getFeatureArea(feature));
        setSuggestions(allowed);
        setError(null);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setSuggestions([]);
          setError('Não foi possível buscar o endereço agora.');
        }
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [hasToken, mapOpen, searchQuery]);

  const updateAddress = (patch: Partial<FormData>) => {
    const next = { ...value, ...patch };
    onChange({
      ...patch,
      address: formatCheckoutAddress(next),
    });
  };

  const openMap = () => {
    setMapOpen(true);
    setError(null);
    setSearchQuery(value.address || value.street || '');
    setCepInput(value.cep ?? '');
  };

  const closeMap = () => {
    setMapOpen(false);
    setSuggestions([]);
    setError(null);
  };

  const handleSelectSuggestion = (feature: MapboxFeature) => {
    const patch = extractPatchFromFeature(feature, value, selectedArea);
    if (!patch) {
      setError('Escolha um endereço dentro da área de entrega.');
      return;
    }

    updateAddress({ ...patch, addressSource: 'mapbox' });
    setSearchQuery(feature.place_name);
    setCepInput(patch.cep ?? cepInput);
    setSuggestions([]);
    setError(null);
  };

  const handleCepLookup = async () => {
    const digits = cepInput.replace(/\D/g, '');
    if (digits.length !== 8) {
      setError('Informe um CEP com 8 dígitos.');
      return;
    }

    setCepLoading(true);
    setError(null);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!response.ok) throw new Error('CEP indisponível agora.');
      const data = (await response.json()) as ViaCepResponse;
      if (data.erro) throw new Error('CEP não encontrado.');
      const area = getAreaFromText(data.localidade);
      if (!area) throw new Error('Esse CEP está fora da área de entrega.');

      updateAddress({
        cep: formatCep(data.cep ?? digits),
        street: data.logradouro || value.street,
        addressComplement: data.complemento || value.addressComplement,
        neighborhood: data.bairro || value.neighborhood,
        city: area.label,
        state: data.uf || 'MG',
        addressLatitude: area.latitude,
        addressLongitude: area.longitude,
        addressSource: 'viacep',
      });
      setViewState((current) => ({
        ...current,
        latitude: area.latitude,
        longitude: area.longitude,
        zoom: 14,
      }));
      setCepInput(formatCep(data.cep ?? digits));
      setSearchQuery([data.logradouro, data.bairro, area.label].filter(Boolean).join(', '));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível buscar o CEP.');
    } finally {
      setCepLoading(false);
    }
  };

  const reverseGeocode = async (longitude: number, latitude: number) => {
    if (!MAPBOX_TOKEN) {
      updateAddress({
        addressLatitude: latitude,
        addressLongitude: longitude,
        addressSource: 'map',
      });
      return;
    }

    setReverseLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        access_token: MAPBOX_TOKEN,
        country: 'br',
        language: 'pt-BR',
        types: 'address,poi,neighborhood,locality,place',
        limit: '1',
      });
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?${params}`
      );
      if (!response.ok) throw new Error('Não foi possível identificar esse ponto.');
      const payload = (await response.json()) as { features?: MapboxFeature[] };
      const feature = payload.features?.[0];
      const patch = feature ? extractPatchFromFeature(feature, value, selectedArea) : null;

      updateAddress({
        ...(patch ?? {}),
        addressLatitude: latitude,
        addressLongitude: longitude,
        addressSource: 'map',
      });
      if (feature) {
        setSearchQuery(feature.place_name);
        setCepInput(patch?.cep ?? cepInput);
      }
    } catch (err) {
      updateAddress({
        addressLatitude: latitude,
        addressLongitude: longitude,
        addressSource: 'map',
      });
      setError(err instanceof Error ? err.message : 'Ponto marcado. Complete rua, número e bairro se necessário.');
    } finally {
      setReverseLoading(false);
    }
  };

  const handleMapPoint = (longitude: number, latitude: number) => {
    setViewState((current) => ({
      ...current,
      latitude,
      longitude,
      zoom: Math.max(current.zoom, 15),
    }));
    void reverseGeocode(longitude, latitude);
  };

  const addressSummary = value.address || formatCheckoutAddress(value);

  return (
    <section className="space-y-3 rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-stone-950">Endereço</h3>
          <p className="text-xs text-stone-500">{selectedArea.label}, MG</p>
        </div>
        <button
          type="button"
          onClick={openMap}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 text-xs font-extrabold text-stone-800 transition hover:bg-white"
        >
          <FaMapMarkerAlt aria-hidden="true" />
          Apontar no mapa
        </button>
      </div>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Cidade</span>
        <select
          value={value.city ?? ''}
          onChange={(event) => {
            const area = DELIVERY_AREAS.find((item) => item.label === event.target.value);
            updateAddress({
              city: event.target.value,
              state: 'MG',
              addressLatitude: area?.latitude ?? value.addressLatitude,
              addressLongitude: area?.longitude ?? value.addressLongitude,
              addressSource: 'manual',
            });
          }}
          className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-3 text-sm font-semibold text-stone-800 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
        >
          <option value="">Selecione a cidade</option>
          {DELIVERY_AREAS.map((area) => (
            <option key={area.label} value={area.label}>
              {area.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_104px]">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Rua</span>
          <input
            type="text"
            value={value.street}
            onChange={(event) => updateAddress({ street: event.target.value, addressSource: 'manual' })}
            placeholder="Nome da rua"
            className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-3 text-sm text-stone-950 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Número</span>
          <input
            type="text"
            value={value.houseNumber}
            onChange={(event) => updateAddress({ houseNumber: event.target.value, addressSource: 'manual' })}
            placeholder="120"
            className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-3 text-sm text-stone-950 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Bairro</span>
          <input
            type="text"
            value={value.neighborhood ?? ''}
            onChange={(event) => updateAddress({ neighborhood: event.target.value, addressSource: 'manual' })}
            placeholder="Bairro"
            className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-3 text-sm text-stone-950 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Complemento</span>
          <input
            type="text"
            value={value.addressComplement ?? ''}
            onChange={(event) => updateAddress({ addressComplement: event.target.value, addressSource: 'manual' })}
            disabled={value.noComplement}
            placeholder="Apto, bloco..."
            className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-3 text-sm text-stone-950 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10 disabled:text-stone-400"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-xs font-semibold text-stone-600">
        <input
          type="checkbox"
          checked={value.noComplement}
          onChange={(event) =>
            updateAddress({
              noComplement: event.target.checked,
              addressComplement: event.target.checked ? '' : value.addressComplement,
              addressSource: 'manual',
            })
          }
          className="h-4 w-4 accent-primary"
        />
        Sem complemento
      </label>

      {addressSummary && (
        <div className="rounded-lg bg-stone-50 px-3 py-2 text-xs font-medium leading-relaxed text-stone-600">
          {addressSummary}
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}

      {mapOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end bg-stone-950/70 backdrop-blur-sm md:items-center md:justify-center md:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Selecionar endereço no mapa"
          onClick={closeMap}
        >
          <div
            className="max-h-[92dvh] w-full overflow-hidden rounded-t-2xl bg-[#fbfaf9] shadow-2xl md:max-w-[620px] md:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
              <div>
                <h3 className="text-base font-extrabold text-stone-950">Apontar no mapa</h3>
                <p className="text-xs text-stone-500">Busque, use o CEP ou toque no mapa.</p>
              </div>
              <button
                type="button"
                onClick={closeMap}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700"
                aria-label="Fechar mapa"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className="max-h-[calc(92dvh-64px)] space-y-3 overflow-y-auto px-4 py-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-stone-500" htmlFor="checkout-address-search">
                  Buscar endereço
                </label>
                <div className="relative">
                  <input
                    id="checkout-address-search"
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={hasToken ? 'Rua, número, bairro ou referência' : 'Busca por mapa indisponível'}
                    disabled={!hasToken}
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-3 text-sm text-stone-950 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:text-stone-400"
                  />
                  {suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-56 overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-xl">
                      {suggestions.map((feature) => (
                        <button
                          type="button"
                          key={feature.id}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            handleSelectSuggestion(feature);
                          }}
                          className="w-full border-b border-stone-100 px-3 py-2.5 text-left text-sm text-stone-800 last:border-b-0 hover:bg-stone-50"
                        >
                          {feature.place_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {searching && <p className="text-xs text-stone-500">Buscando...</p>}
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">CEP</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cepInput}
                    onChange={(event) => setCepInput(formatCep(event.target.value))}
                    onBlur={() => {
                      if (cepInput.replace(/\D/g, '').length === 8) void handleCepLookup();
                    }}
                    placeholder="36770-000"
                    className="mt-2 w-full rounded-lg border border-stone-200 bg-white px-3 py-3 text-sm text-stone-950 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleCepLookup}
                  disabled={cepLoading}
                  className="mt-6 h-12 rounded-lg bg-stone-900 px-4 text-sm font-bold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-300"
                >
                  {cepLoading ? '...' : 'OK'}
                </button>
              </div>

              {hasToken ? (
                <div className="h-[320px] overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
                  <Map
                    mapboxAccessToken={MAPBOX_TOKEN}
                    mapStyle="mapbox://styles/mapbox/streets-v12"
                    latitude={viewState.latitude}
                    longitude={viewState.longitude}
                    zoom={viewState.zoom}
                    onMove={(event) => setViewState(event.viewState)}
                    onClick={(event) => handleMapPoint(event.lngLat.lng, event.lngLat.lat)}
                    reuseMaps
                  >
                    <NavigationControl position="top-right" showCompass={false} />
                    <Marker
                      longitude={markerLongitude}
                      latitude={markerLatitude}
                      draggable
                      onDragEnd={(event) => handleMapPoint(event.lngLat.lng, event.lngLat.lat)}
                      color="#FF007F"
                    />
                  </Map>
                </div>
              ) : (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  Mapa indisponível sem token do Mapbox. Você ainda pode preencher o endereço manualmente.
                </p>
              )}

              {reverseLoading && <p className="text-xs font-semibold text-stone-500">Identificando endereço...</p>}

              <button
                type="button"
                onClick={closeMap}
                className="flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-primary/20"
              >
                Usar este endereço
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
