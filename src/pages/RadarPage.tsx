'use client';

import { Suspense } from 'react';
import { RadarLayout } from '../components/layouts/RadarLayout';
import { HDRadarScanner } from '../components/hd/dashboard/HDRadarScanner';
import { useAuth } from '../contexts/AuthContext';

/**
 * RadarPage - Symbol radar scanner page
 *
 * This is the /radar route which shows the strategy scanner UI.
 * Displays real-time composite signals across all watched symbols.
 */
export default function RadarPage() {
  const { user } = useAuth();
  const userId = user?.id || '00000000-0000-0000-0000-000000000001';

  return (
    <RadarLayout>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading radar...</div>}>
        <div className="p-4 max-w-7xl mx-auto">
          <HDRadarScanner userId={userId} />
        </div>
      </Suspense>
    </RadarLayout>
  );
}
