const MASSIVE_PROXY_TOKEN = import.meta.env.VITE_MASSIVE_PROXY_TOKEN;
let warnedAboutMissingToken = false;

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

export function massiveFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, withMassiveProxyInit(init));
}
