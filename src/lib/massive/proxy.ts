const MASSIVE_PROXY_TOKEN = import.meta.env.VITE_MASSIVE_PROXY_TOKEN;
let warnedAboutMissingToken = false;

export class MassiveError extends Error {
  status: number;
  code?: 'RATE_LIMIT';

  constructor(message: string, status: number, code?: 'RATE_LIMIT') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function buildHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers ?? {});

  if (MASSIVE_PROXY_TOKEN) {
    headers.set('x-massive-proxy-token', MASSIVE_PROXY_TOKEN);
  } else if (!warnedAboutMissingToken) {
    warnedAboutMissingToken = true;
    console.warn(
      '[v0] VITE_MASSIVE_PROXY_TOKEN is not set, /api/massive requests will 403 until the token is provided.'
    );
  }

  return headers;
}

export function withMassiveProxyInit(init?: RequestInit): RequestInit {
  return {
    ...init,
    headers: buildHeaders(init),
  };
}

export async function massiveFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, withMassiveProxyInit(init));

  if (!response.ok) {
    const text = await response.text();
    const method = (init?.method || 'GET').toString().toUpperCase();
    const path =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? `${input.pathname}${input.search}`
        : String(input);
    console.error('[Massive proxy] HTTP error from /api/massive', {
      method,
      path,
      status: response.status,
      text,
    });

    const message = text || response.statusText || `HTTP ${response.status}`;
    const isRateLimit =
      response.status === 429 ||
      message.includes('Massive 429') ||
      message.toLowerCase().includes('maximum requests per minute');

    if (isRateLimit) {
      throw new MassiveError(message, 429, 'RATE_LIMIT');
    }

    throw new MassiveError(message, response.status);
  }

  return response;
}
