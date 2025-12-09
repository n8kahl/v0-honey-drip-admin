/**
 * useMemberStatus.ts - Member Status Hook for Public Portal
 *
 * Manages the demo toggle state between public and member views.
 * Uses localStorage for persistence across page reloads.
 *
 * In the future, this can be extended to check actual Discord OAuth status.
 */

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "honeydrip_demo_member_status";

interface MemberStatus {
  isMember: boolean;
  setIsMember: (value: boolean) => void;
  toggleMember: () => void;
}

/**
 * Hook to manage member status for the public portal demo.
 * Persists to localStorage for demo continuity.
 */
export function useMemberStatus(): MemberStatus {
  const [isMember, setIsMemberState] = useState<boolean>(() => {
    // Initialize from localStorage on first render
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === "true";
    }
    return false;
  });

  // Sync to localStorage when state changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(isMember));
    }
  }, [isMember]);

  const setIsMember = useCallback((value: boolean) => {
    setIsMemberState(value);
  }, []);

  const toggleMember = useCallback(() => {
    setIsMemberState((prev) => !prev);
  }, []);

  return {
    isMember,
    setIsMember,
    toggleMember,
  };
}

/**
 * Standalone function to check member status without using the hook.
 * Useful for API calls.
 */
export function getMemberStatus(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export default useMemberStatus;
