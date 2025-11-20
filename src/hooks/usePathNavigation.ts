import { useEffect } from 'react';
import { useUIStore } from '../stores/uiStore';

/**
 * Hook that syncs the URL pathname with the UI tab state.
 *
 * This allows URLs like:
 * - / → live tab
 * - /trades/active → active tab
 * - /trades/history → history tab
 * - /settings → settings tab
 *
 * Works with Next.js routing without needing React Router.
 */
export function usePathNavigation() {
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  useEffect(() => {
    // Get current pathname
    const pathname = window.location.pathname;

    // Map pathname to tab
    if (pathname.includes('/trades/active')) {
      setActiveTab('active');
    } else if (pathname.includes('/trades/history')) {
      setActiveTab('history');
    } else if (pathname.includes('/settings')) {
      setActiveTab('settings');
    } else {
      // Default to live tab for / and other paths
      setActiveTab('live');
    }
  }, [setActiveTab]);
}
