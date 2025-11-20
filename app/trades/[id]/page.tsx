'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const TradeDetailPage = dynamic(() => import('@/src/pages/TradeDetailPage'), {
  loading: () => <div className="flex items-center justify-center min-h-screen">Loading trade details...</div>,
});

export default function TradeDetailRoute() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <TradeDetailPage />
    </Suspense>
  );
}
