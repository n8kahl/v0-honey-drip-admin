/**
 * useCommandCenter.ts - React Hook for Command Center
 *
 * Ensures Command Center is running when component mounts.
 * Provides status and control functions.
 */

import { useEffect, useState } from 'react';
import {
  startCommandCenter,
  stopCommandCenter,
  restartCommandCenter,
  getCommandCenterStatus,
} from '../services/commandCenterIntegration';

export function useCommandCenter() {
  const [status, setStatus] = useState(getCommandCenterStatus());

  useEffect(() => {
    // Start Command Center when component mounts
    startCommandCenter();

    // Update status periodically
    const interval = setInterval(() => {
      setStatus(getCommandCenterStatus());
    }, 5000);

    // Cleanup on unmount
    return () => {
      clearInterval(interval);
      // Don't stop Command Center on unmount - let it run globally
    };
  }, []);

  return {
    isRunning: status.isRunning,
    activeTrades: status.activeTrades,
    restart: restartCommandCenter,
    stop: stopCommandCenter,
  };
}
