"use client";

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  const editable = (target as HTMLElement).isContentEditable;
  return editable || tag === 'input' || tag === 'textarea' || tag === 'select';
}

export default function RadarHotkey() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (isEditable(e.target)) return;

      const key = e.key.toLowerCase();

      if (key === 'r') {
        e.preventDefault();
        if (pathname !== '/radar') router.push('/radar');
        else if (typeof window !== 'undefined' && window.history.length > 1) router.back();
        else router.push('/');
      } else if (key === 'escape') {
        if (pathname === '/radar') {
          e.preventDefault();
          if (typeof window !== 'undefined' && window.history.length > 1) router.back();
          else router.push('/');
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pathname, router]);

  return null;
}
