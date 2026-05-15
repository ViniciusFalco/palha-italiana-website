import { useEffect, useMemo, useState } from 'react';
import { FaCheck, FaMapMarkerAlt, FaTimes } from 'react-icons/fa';
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
  completed?: boolean;
  onFinalFieldBlur?: () => void;
};

type LookupMode = 'address' | 'cep' | null;

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

export default function MapAddressSelector({
  value,
  onChange,
  completed = false,
  onFinalFieldBlur,
}: MapAddressSelectorProps) {
  const [mapOpen, setMapOpen] = useState(false);
  const [lookupMode, setLookupMode] = useState<LookupMode>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cepInput, setCepInput] = useState(value.cep ?? '');
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [searching, setSearching] = useState(false);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAddressData = Boolean(
    value.addressSource ||
      value.address ||
      value.city ||
      value.street ||
      value.houseNumber ||
      value.neighborhood ||
      value.addressLatitude ||
      value.addressLongitude
  );
  const [fieldsVisible, setFieldsVisible] = useState(hasAddressData);

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
    if (hasAddressData) {
      setFieldsVisible(true);
    }
  }, [hasAddressData]);

  useEffect(() => {
    if (!mapOpen || lookupMode !== 'address' || !hasToken || searchQuery.trim().length < 3) {
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
  }, [hasToken, lookupMode, mapOpen, searchQuery]);

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
    setLookupMode(null);
    setSearchQuery('');
    setCepInput(value.cep ?? '');
  };

  const closeMap = () => {
    setMapOpen(false);
    setLookupMode(null);
    setSuggestions([]);
    setError(null);
  };

  const selectLookupMode = (mode: Exclude<LookupMode, null>) => {
    setLookupMode(mode);
    setError(null);
    setSuggestions([]);
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
        if (lookupMode === 'address') {
          setSearchQuery(feature.place_name);
        }
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
  const labelClass = `text-xs font-semibold uppercase tracking-wide transition-colors duration-300 ${
    completed ? 'text-white/90' : 'text-stone-500'
  }`;

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        <button
          type="button"
          onClick={openMap}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary px-4 text-sm font-extrabold text-white shadow-lg shadow-primary/15 transition hover:bg-pink-600"
        >
          <FaMapMarkerAlt aria-hidden="true" />
          Apontar no mapa
        </button>
      </div>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          fieldsVisible ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0 space-y-3 overflow-hidden">
        <label className="block">
          <span className={labelClass}>Cidade</span>
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

        <label className="block">
          <span className={labelClass}>Rua</span>
          <input
            type="text"
            value={value.street}
            onChange={(event) => updateAddress({ street: event.target.value, addressSource: 'manual' })}
            placeholder="Nome da rua"
            className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-3 text-sm text-stone-950 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
          />
        </label>

        <div className="grid grid-cols-[112px_1fr] gap-3">
          <label className="block">
            <span className={labelClass}>Número</span>
            <input
              type="text"
              value={value.houseNumber}
              onChange={(event) => updateAddress({ houseNumber: event.target.value, addressSource: 'manual' })}
              placeholder="120"
              className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-3 text-sm text-stone-950 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
            />
          </label>
          <label className="block">
            <span className={labelClass}>Bairro</span>
            <input
              type="text"
              value={value.neighborhood ?? ''}
              onChange={(event) => updateAddress({ neighborhood: event.target.value, addressSource: 'manual' })}
              onBlur={() => {
                if (value.noComplement) {
                  onFinalFieldBlur?.();
                }
              }}
              placeholder="Bairro"
              className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-3 text-sm text-stone-950 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
            />
          </label>
        </div>

        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
            value.noComplement ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <label className="block">
              <span className={labelClass}>Complemento</span>
              <input
                type="text"
                value={value.addressComplement ?? ''}
                onChange={(event) => updateAddress({ addressComplement: event.target.value, addressSource: 'manual' })}
                onBlur={onFinalFieldBlur}
                placeholder="Apto, bloco..."
                className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-3 text-sm text-stone-950 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
              />
            </label>
          </div>
        </div>

        <label className="group flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-3 text-sm font-extrabold text-stone-700 transition hover:border-primary/30 hover:bg-white">
          <span>Sem complemento</span>
          <input
            type="checkbox"
            checked={value.noComplement}
            onChange={(event) => {
              updateAddress({
                noComplement: event.target.checked,
                addressComplement: event.target.checked ? '' : value.addressComplement,
                addressSource: 'manual',
              });
              if (event.target.checked) {
                onFinalFieldBlur?.();
              }
            }}
            className="sr-only"
          />
          <span
            className={`flex h-6 w-11 items-center rounded-full border p-0.5 transition ${
              value.noComplement ? 'border-primary bg-primary' : 'border-stone-300 bg-white'
            }`}
          >
            <span
              className={`flex h-[18px] w-[18px] items-center justify-center rounded-full text-white transition ${
                value.noComplement ? 'translate-x-5 bg-white text-primary' : 'translate-x-0 bg-stone-300'
              }`}
            >
              {value.noComplement && <FaCheck size={9} aria-hidden="true" />}
            </span>
          </span>
        </label>
        </div>
      </div>

      {fieldsVisible && addressSummary && (
        <div className="rounded-lg text-center bg-stone-50 px-3 py-2 text-xs font-medium leading-relaxed text-stone-600">
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
              <div className="space-y-3">
                <div
                  className={`grid gap-2 transition-[grid-template-columns] duration-300 ease-out ${
                    lookupMode
                      ? '[grid-template-columns:minmax(0,1fr)_minmax(0,1fr)]'
                      : '[grid-template-columns:minmax(0,1fr)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectLookupMode('address')}
                    className={`overflow-hidden rounded-lg border px-3 text-sm font-extrabold transition-[min-height,transform,background-color,border-color,color,box-shadow] duration-300 ease-out ${
                      lookupMode
                        ? 'min-h-11'
                        : 'min-h-[58px]'
                    } ${
                      lookupMode === 'address'
                        ? 'border-primary bg-primary text-white shadow-lg shadow-primary/15'
                        : 'border-stone-200 bg-white text-stone-800 hover:border-primary/35 hover:text-primary active:scale-[0.99]'
                    }`}
                  >
                    Buscar endereço
                  </button>
                  <button
                    type="button"
                    onClick={() => selectLookupMode('cep')}
                    className={`overflow-hidden rounded-lg border px-3 text-sm font-extrabold transition-[min-height,transform,background-color,border-color,color,box-shadow] duration-300 ease-out ${
                      lookupMode
                        ? 'min-h-11'
                        : 'min-h-[58px]'
                    } ${
                      lookupMode === 'cep'
                        ? 'border-primary bg-primary text-white shadow-lg shadow-primary/15'
                        : 'border-stone-200 bg-white text-stone-800 hover:border-primary/35 hover:text-primary active:scale-[0.99]'
                    }`}
                  >
                    Buscar CEP
                  </button>
                </div>

                {lookupMode === 'address' && (
                  <div className="checkout-lookup-panel relative z-40 space-y-2">
                    <label
                      className="text-xs font-semibold uppercase tracking-wide text-stone-500"
                      htmlFor="checkout-address-search"
                    >
                      Endereço
                    </label>
                    <div className="relative z-40">
                      <input
                        id="checkout-address-search"
                        type="search"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder={hasToken ? 'Rua, número, bairro ou referência' : 'Busca por mapa indisponível'}
                        disabled={!hasToken}
                        autoFocus
                        className="w-full rounded-lg border border-stone-200 bg-white px-3 py-3 text-sm text-stone-950 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:text-stone-400"
                      />
                      {suggestions.length > 0 && (
                        <div className="relative z-[90] mt-2 max-h-64 overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-2xl md:absolute md:left-0 md:right-0 md:top-[calc(100%+6px)] md:mt-0">
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
                )}

                {lookupMode === 'cep' && (
                  <div className="checkout-lookup-panel grid grid-cols-[1fr_auto] gap-2">
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
                        autoFocus
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
                )}
              </div>

              {hasToken ? (
                <div className="relative z-0 h-[320px] overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
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
    </div>
  );
}
