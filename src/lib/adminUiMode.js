import { useEffect, useState } from 'react';

const STORAGE_KEY = 'douha-admin-ui-mode';
const CHANGE_EVENT = 'douha-admin-ui-mode-change';

/** @returns {'modern' | 'legacy'} */
export function getAdminUiMode() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'legacy' ? 'legacy' : 'modern';
  } catch {
    return 'modern';
  }
}

/** @param {'modern' | 'legacy'} mode */
export function setAdminUiMode(mode) {
  const next = mode === 'legacy' ? 'legacy' : 'modern';
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore quota / private mode */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
  }
}

/** Hook compartilhado entre AppShell e AdminPage. */
export function useAdminUiMode() {
  const [mode, setMode] = useState(getAdminUiMode);

  useEffect(() => {
    const sync = () => setMode(getAdminUiMode());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const update = (next) => {
    setAdminUiMode(next);
    setMode(next === 'legacy' ? 'legacy' : 'modern');
  };

  return [mode, update];
}
