"use client";

import App from '../src/App';
import { AuthProvider } from '../src/contexts/AuthContext';
import { useUIStore } from '../src/stores/uiStore';
import MainCockpit from '../src/components/Cockpit/MainCockpit';

export default function Page() {
  const mainSymbol = useUIStore((s) => s.mainCockpitSymbol);
  return (
    <AuthProvider>
      {mainSymbol ? <MainCockpit symbol={mainSymbol} /> : <App />}
    </AuthProvider>
  );
}
