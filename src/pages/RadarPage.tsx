import { Suspense } from 'react';

/**
 * RadarPage - Symbol radar scanner page
 *
 * This is the /radar route which shows the strategy scanner UI.
 * Eventually this will be lazily loaded from the current app/radar/page.tsx
 */
export default function RadarPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading radar...</div>}>
      {/* TODO: Integrate radar scanner component from existing app */}
      <div className="min-h-screen bg-[var(--bg-base)] p-4">
        <h1 className="text-[var(--text-high)]">Symbol Radar Scanner</h1>
        <p className="text-[var(--text-muted)] mt-2">Radar scanner component coming soon</p>
      </div>
    </Suspense>
  );
}
