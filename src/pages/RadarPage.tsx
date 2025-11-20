'use client';

import { Suspense } from 'react';
import { RadarLayout } from '../components/layouts/RadarLayout';

/**
 * RadarPage - Symbol radar scanner page
 *
 * This is the /radar route which shows the strategy scanner UI.
 * Eventually this will integrate the full radar scanner component from the existing app.
 */
export default function RadarPage() {
  return (
    <RadarLayout>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading radar...</div>}>
        {/* TODO: Integrate radar scanner component from existing app/radar/page.tsx */}
        <div className="p-4">
          <h1 className="text-[var(--text-high)]">Symbol Radar Scanner</h1>
          <p className="text-[var(--text-muted)] mt-2">Radar scanner component coming soon</p>
        </div>
      </Suspense>
    </RadarLayout>
  );
}
