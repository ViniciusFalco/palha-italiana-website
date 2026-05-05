const url = import.meta.env.VITE_SUPABASE_URL!;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;
const restUrl = `${url}/rest/v1`;

export type PublicDbError = {
  status: number;
  message: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

type InsertPublicRowsOptions = {
  select?: string;
  single?: boolean;
};

export const createPublicUuid = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);

  if (bytes.some((byte) => byte !== 0)) {
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (char) =>
    (Number(char) ^ (Math.random() * 16) >> (Number(char) / 4)).toString(16)
  );
};

const buildTableUrl = (table: string, select?: string) => {
  const searchParams = new URLSearchParams();
  if (select) {
    searchParams.set('select', select);
  }

  const query = searchParams.toString();
  return `${restUrl}/${table}${query ? `?${query}` : ''}`;
};

const normalizeError = (payload: any, status: number): PublicDbError => {
  if (payload && typeof payload === 'object') {
    return {
      status,
      message: String(payload.message ?? `Erro HTTP ${status}`),
      details: payload.details ? String(payload.details) : null,
      hint: payload.hint ? String(payload.hint) : null,
      code: payload.code ? String(payload.code) : null,
    };
  }

  return {
    status,
    message: `Erro HTTP ${status}`,
    details: null,
    hint: null,
    code: null,
  };
};

const parseJson = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

export async function insertPublicRows<T>(
  table: string,
  values: unknown,
  options: InsertPublicRowsOptions = {}
): Promise<{ data: T | null; error: PublicDbError | null }> {
  const response = await fetch(buildTableUrl(table, options.select), {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
      Prefer: options.select ? 'return=representation' : 'return=minimal',
    },
    body: JSON.stringify(values),
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return {
      data: null,
      error: normalizeError(payload, response.status),
    };
  }

  if (!options.select) {
    return {
      data: null,
      error: null,
    };
  }

  const data = options.single && Array.isArray(payload) ? (payload[0] ?? null) : payload;

  return {
    data: (data ?? null) as T | null,
    error: null,
  };
}
