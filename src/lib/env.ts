// Environment helpers that work in both Node (process.env) and Vite/browser (import.meta.env)
const isNode = typeof process !== "undefined" && !!process.versions?.node;

export function getEnvVar(key: string): string | undefined {
  if (isNode) {
    return process.env[key];
  }
  return (import.meta as any)?.env?.[key];
}

export function getNodeEnv(): string | undefined {
  return getEnvVar("NODE_ENV") || getEnvVar("MODE");
}

export function isTestEnv(): boolean {
  return (getNodeEnv() || "").toLowerCase() === "test";
}

export function isProductionEnv(): boolean {
  return (getNodeEnv() || "").toLowerCase() === "production";
}

export function resolveApiBaseUrl(): string {
  return (
    getEnvVar("API_BASE_URL") ||
    getEnvVar("VITE_API_BASE_URL") ||
    getEnvVar("NEXT_PUBLIC_API_BASE_URL") ||
    (typeof window !== "undefined" ? window.location.origin : undefined) ||
    "http://localhost:3000"
  );
}

export function buildApiUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${resolveApiBaseUrl()}${path}`;
}
