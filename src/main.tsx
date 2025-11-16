import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AuthProvider } from "./contexts/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

console.log('[v0] main.tsx: Starting app initialization');
console.log('[v0] main.tsx: import.meta.env:', {
  mode: import.meta.env.MODE,
  prod: import.meta.env.PROD,
  dev: import.meta.env.DEV,
  hasSupabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
  hasSupabaseAnonKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
});

const rootElement = document.getElementById("root");
console.log('[v0] main.tsx: Root element found:', !!rootElement);

if (rootElement) {
  console.log('[v0] main.tsx: Creating React root...');
  createRoot(rootElement).render(
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  );
  console.log('[v0] main.tsx: React root rendered');
} else {
  console.error('[v0] main.tsx: Root element not found!');
}
